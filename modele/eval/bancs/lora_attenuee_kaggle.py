# Localia, défi modèle compact, étape 3.4 (suite, choix de l'auteur du 1er novembre 2026) : LoRA du lot 4 atténuée.
# Le lot 4 élagué ne passe pas le contrôle de régression (IFEval −5,9, MGSM −7,2). On applique la même LoRA à
# intensité réduite, sans réentraîner : W = W_base + s · ΔW_LoRA, s dans INTENSITES (1,0 sert de témoin du lot 4).
# LoRA : point de reprise du pas 480 sur 512 du noyau localia-lora-2b-lot4 (taux d'apprentissage des 32 derniers
# pas < 3e-7, écart négligeable avec la LoRA finale). Pour chaque s : fusion (même recette que lora_2b_kaggle.py,
# couche MTP recopiée de la base), GGUF f16, Q4_K_M, vocabulaire élagué (mesures/elaguer_vocab.py, k = 48 000),
# puis les 5 341 questions des bancs publics (bancs_kaggle.py) sur les versions élaguée et complète.
# Sorties : gguf/attenuee-<s>-vocfr48k.gguf, reponses-attenuee-<s>[-complet].jsonl.
import concurrent.futures as cf
import glob
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
LLAMA_TAG = "v0.7.0"
BASE = "Qwen/Qwen3.5-2B"
RANG = 16
INTENSITES = (0.5, 0.7, 0.85, 1.0)
PARALLELE = 8


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv", shell=True)
sh(f"{sys.executable} -m pip install -q -U 'transformers>=5.2' 'peft>=0.18' 2>&1 | tail -2")
sh(f"{sys.executable} -m pip uninstall -q -y torchao 2>&1 | tail -2")

import torch  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402
from peft import LoraConfig, get_peft_model, set_peft_model_state_dict  # noqa: E402
from safetensors import safe_open  # noqa: E402
from safetensors.torch import save_file  # noqa: E402
from transformers import AutoModelForImageTextToText  # noqa: E402

base_dir = snapshot_download(BASE, cache_dir=os.path.join(TMP, "hf"))
etat = torch.load(glob.glob("/kaggle/input/**/reprise.pt", recursive=True)[0], map_location="cpu", weights_only=False)
print(f"LoRA du pas {etat['pas']}", flush=True)
lora = etat["lora"]
del etat

# llama.cpp : conversion et quantification (CPU), comme pour le lot 4.
src = os.path.join(TMP, "llama.cpp")
sh(f"git clone --depth 1 --branch {LLAMA_TAG} https://github.com/ggml-org/llama.cpp {src} > /dev/null 2>&1")
sh(f"cmake -S {src} -B {src}/build-cpu -DGGML_CUDA=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release > /dev/null "
   f"&& cmake --build {src}/build-cpu -j4 --target llama-quantize > /dev/null")
os.environ["PYTHONPATH"] = os.path.join(src, "gguf-py")

mtp = {}
for f in glob.glob(os.path.join(base_dir, "*.safetensors")):
    with safe_open(f, "pt") as st:
        for k in st.keys():
            if k.startswith("mtp."):
                mtp[k] = st.get_tensor(k)

elagage = {n: glob.glob(f"/kaggle/input/**/{n}", recursive=True)[0]
           for n in ("elaguer_vocab.py", "qwen35-tokenizer.json", "fineweb2-fra-test-000.parquet")}
sortie = os.path.join(TRAVAIL, "gguf")
os.makedirs(sortie, exist_ok=True)
modeles = {}  # nom -> chemin du GGUF
cibles = r".*language_model.*\.(q_proj|k_proj|v_proj|o_proj|in_proj_qkv|in_proj_z|out_proj|gate_proj|up_proj|down_proj)$"
for s in INTENSITES:
    t0 = time.time()
    modele = AutoModelForImageTextToText.from_pretrained(base_dir, dtype=torch.float16, device_map={"": 0})
    modele = get_peft_model(modele, LoraConfig(r=RANG, lora_alpha=2 * RANG, lora_dropout=0.0, target_modules=cibles,
                                               task_type="CAUSAL_LM"))
    for p in modele.parameters():  # LoRA en float32, comme à la fin de l'entraînement du lot 4
        if p.requires_grad:
            p.data = p.data.float()
    set_peft_model_state_dict(modele, lora)
    n_b = 0
    with torch.no_grad():
        for nom, p in modele.named_parameters():
            if "lora_B" in nom:
                p.mul_(s)  # ΔW = s · B · A · alpha / r
                n_b += 1
    fusion = os.path.join(TMP, f"fusion-{s}")
    modele = modele.merge_and_unload()
    modele.save_pretrained(fusion, safe_serialization=True)
    del modele
    torch.cuda.empty_cache()
    for f in glob.glob(os.path.join(base_dir, "*")):
        if os.path.isfile(f) and not f.endswith((".safetensors", ".safetensors.index.json")) \
                and not os.path.exists(os.path.join(fusion, os.path.basename(f))):
            shutil.copy(f, fusion)
    if mtp:
        save_file(mtp, os.path.join(fusion, "model-mtp.safetensors"), metadata={"format": "pt"})
        index = os.path.join(fusion, "model.safetensors.index.json")
        if os.path.exists(index):
            ix = json.load(open(index))
            ix["weight_map"].update({k: "model-mtp.safetensors" for k in mtp})
            json.dump(ix, open(index, "w"), indent=1)
    f16 = os.path.join(TMP, f"attenuee-{s}-f16.gguf")
    complet = os.path.join(TMP, f"attenuee-{s}-Q4_K_M.gguf")
    elague = os.path.join(sortie, f"attenuee-{s}-vocfr48k.gguf")
    sh(f"{sys.executable} {src}/convert_hf_to_gguf.py {fusion} --outtype f16 --outfile {f16} 2>&1 | tail -2")
    sh(f"{src}/build-cpu/bin/llama-quantize {f16} {complet} Q4_K_M 2>&1 | tail -1")
    os.remove(f16)
    shutil.rmtree(fusion)
    sh(f"{sys.executable} {elagage['elaguer_vocab.py']} {complet} {elagage['qwen35-tokenizer.json']} "
       f"{elagage['fineweb2-fra-test-000.parquet']} {elague} --k 48000 2>&1 | tail -2")
    modeles[f"attenuee-{s}"] = elague
    modeles[f"attenuee-{s}-complet"] = complet
    print(f"s = {s} : {n_b} matrices B mises à l'échelle, GGUF en {time.time() - t0:.0f} s", flush=True)

# Bancs publics : un modèle par carte à la fois, sans réflexion, température 0 (comme bancs_kaggle.py).
deja = glob.glob("/kaggle/input/**/llama-server", recursive=True)
serveur = os.path.join(TMP, "llama-bin/llama-server")
shutil.copytree(os.path.dirname(deja[0]), os.path.dirname(serveur), dirs_exist_ok=True)
sh(f"chmod +x {os.path.dirname(serveur)}/*")
os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
questions = [json.loads(l) for chemin in glob.glob("/kaggle/input/**/bancs.jsonl", recursive=True) for l in open(chemin)]
print(f"{len(questions)} questions", flush=True)


def demarrer(nom, carte):
    port = 8081 + carte
    log = open(os.path.join(TRAVAIL, f"serveur-{nom}.log"), "w")
    env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(carte))
    p = subprocess.Popen([serveur, "-m", modeles[nom], "-c", str(4096 * PARALLELE), "-np", str(PARALLELE), "-ngl",
                          "999", "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", str(port)],
                         stdout=log, stderr=log, env=env)
    for _ in range(300):
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=5).read():
                break
        except Exception:
            pass
        time.sleep(2)
    return p, port


def appeler(port, q):
    corps = {"messages": q["messages"], "temperature": 0, "max_tokens": q["max_tokens"],
             "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=1800) as r:
                rep = json.loads(r.read())
            c = rep["choices"][0]
            return {"id": q["id"], "texte": c["message"].get("content") or "", "fin": c.get("finish_reason"),
                    "usage": rep.get("usage", {})}
        except Exception as e:
            err = repr(e)
            time.sleep(5)
    return {"id": q["id"], "texte": "", "erreur": err}


def passer(nom, carte):
    p, port = demarrer(nom, carte)
    t = time.time()
    with cf.ThreadPoolExecutor(PARALLELE) as ex, open(os.path.join(TRAVAIL, f"reponses-{nom}.jsonl"), "w") as s:
        for r in ex.map(lambda q: appeler(port, q), questions):
            s.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{nom} terminé en {time.time() - t:.0f} s", flush=True)
    p.terminate()
    p.wait()


def carte_de(carte):
    for nom in list(modeles)[carte::2]:
        passer(nom, carte)


with cf.ThreadPoolExecutor(2) as ex:
    list(ex.map(carte_de, (0, 1)))
print("FIN", flush=True)
