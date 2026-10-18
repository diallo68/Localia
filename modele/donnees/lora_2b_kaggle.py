# Localia, défi modèle compact, étape 2.5 : mini-entraînement de bout en bout sur Kaggle (T4).
# 1. LoRA sur Qwen/Qwen3.5-2B (Apache 2.0) avec les exemples vérifiés de l'étape 2.4 (régime sans réflexion,
#    perte sur la réponse seulement).
# 2. Fusion, conversion en GGUF (convert_hf_to_gguf.py de llama.cpp), quantification Q4_K_M ; la base est
#    convertie et quantifiée de la même façon, comme témoin.
# 3. Jeu de développement sur GPU pour les deux (mêmes conditions que executer.py), pour un premier signal.
import glob
import json
import math
import os
import random
import shutil
import subprocess
import sys
import time
import urllib.request

TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
LLAMA_TAG = "v0.7.0"
BASE = "Qwen/Qwen3.5-2B"
LR, EPOQUES, ACCUM, RANG, LONGUEUR_MAX = 1e-4, 2, 8, 16, 8192


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv", shell=True)
sh(f"{sys.executable} -m pip install -q -U 'transformers>=5.2' 'peft>=0.18' 2>&1 | tail -2")

import torch  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402
from peft import LoraConfig, get_peft_model  # noqa: E402
from transformers import AutoModelForImageTextToText, AutoTokenizer  # noqa: E402

print("torch", torch.__version__, flush=True)
base_dir = snapshot_download(BASE, cache_dir=os.path.join(TMP, "hf"))
tok = AutoTokenizer.from_pretrained(base_dir)

# Données.
exemples = [json.loads(l) for l in open(glob.glob("/kaggle/input/**/exemples.jsonl", recursive=True)[0])]
donnees, ecartes = [], 0
for ex in exemples:
    m = ex["messages"]
    prefixe = tok.apply_chat_template(m[:-1], tokenize=False, add_generation_prompt=True, enable_thinking=False)
    complet = tok.apply_chat_template(m, tokenize=False, enable_thinking=False)
    if not complet.startswith(prefixe):
        ecartes += 1
        continue
    ids_p = tok(prefixe, add_special_tokens=False)["input_ids"]
    ids = tok(complet.rstrip("\n"), add_special_tokens=False)["input_ids"]
    if ids[:len(ids_p)] != ids_p or len(ids) > LONGUEUR_MAX:
        ecartes += 1
        continue
    donnees.append((ids, len(ids_p)))
print(f"exemples : {len(donnees)} gardés, {ecartes} écartés (gabarit ou longueur)", flush=True)
print("exemple de cible :", repr(tok.decode(donnees[0][0][donnees[0][1]:])[:300]), flush=True)

# Modèle et LoRA (couches de langage seulement : attention, DeltaNet et MLP).
modele = AutoModelForImageTextToText.from_pretrained(base_dir, dtype=torch.float16, device_map={"": 0})
modele.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
modele.enable_input_require_grads()
# in_proj_b / in_proj_a (quelques têtes) et conv1d restent figés.
cibles = r".*language_model.*\.(q_proj|k_proj|v_proj|o_proj|in_proj_qkv|in_proj_z|out_proj|gate_proj|up_proj|down_proj)$"
modele = get_peft_model(modele, LoraConfig(r=RANG, lora_alpha=2 * RANG, lora_dropout=0.05, target_modules=cibles,
                                           task_type="CAUSAL_LM"))
modele.print_trainable_parameters()
params = [p for p in modele.parameters() if p.requires_grad]
for p in params:
    p.data = p.data.float()
opt = torch.optim.AdamW(params, lr=LR, weight_decay=0.0)
pas_total = math.ceil(len(donnees) * EPOQUES / ACCUM)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / 5) * 0.5 * (1 + math.cos(math.pi * min(s, pas_total) / pas_total)))
scaler = torch.amp.GradScaler("cuda")

modele.train()
rnd = random.Random(1)
journal = open(os.path.join(TRAVAIL, "entrainement.log"), "w")
t0, pas, cumul = time.time(), 0, []
for epoque in range(EPOQUES):
    ordre = list(range(len(donnees)))
    rnd.shuffle(ordre)
    for k, i in enumerate(ordre):
        ids, n_p = donnees[i]
        x = torch.tensor([ids], device="cuda")
        y = x.clone()
        y[0, :n_p] = -100
        with torch.autocast("cuda", dtype=torch.float16):
            perte = modele(input_ids=x, labels=y).loss / ACCUM
        scaler.scale(perte).backward()
        cumul.append(perte.item() * ACCUM)
        if (k + 1) % ACCUM == 0 or k == len(ordre) - 1:
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(params, 1.0)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sched.step()
            pas += 1
            ligne = f"époque {epoque + 1} pas {pas}/{pas_total} perte {sum(cumul) / len(cumul):.4f} " \
                    f"lr {sched.get_last_lr()[0]:.2e} {time.time() - t0:.0f} s mém {torch.cuda.max_memory_allocated() / 1e9:.1f} Go"
            print(ligne, flush=True)
            journal.write(ligne + "\n")
            cumul = []

# Fusion et sauvegarde au format Hugging Face (avec les fichiers de la base : gabarit, processeur).
fusion = os.path.join(TMP, "fusion")
modele = modele.merge_and_unload()
modele.save_pretrained(fusion, safe_serialization=True)
for f in glob.glob(os.path.join(base_dir, "*")):  # tokenizer, gabarit, configurations du processeur
    if os.path.isfile(f) and not f.endswith((".safetensors", ".safetensors.index.json")) \
            and not os.path.exists(os.path.join(fusion, os.path.basename(f))):
        shutil.copy(f, fusion)
del modele
torch.cuda.empty_cache()

# Conversion et quantification (même recette pour la base témoin et le modèle entraîné).
src = os.path.join(TMP, "llama.cpp")
sh(f"git clone --depth 1 --branch {LLAMA_TAG} https://github.com/ggml-org/llama.cpp {src} > /dev/null 2>&1")
sh(f"cmake -S {src} -B {src}/build-cpu -DGGML_CUDA=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release > /dev/null "
   f"&& cmake --build {src}/build-cpu -j4 --target llama-quantize > /dev/null")
os.environ["PYTHONPATH"] = os.path.join(src, "gguf-py")
sortie = os.path.join(TRAVAIL, "gguf")
os.makedirs(sortie, exist_ok=True)
for nom, d in (("base", base_dir), ("lora", fusion)):
    f16 = os.path.join(TMP, f"{nom}-f16.gguf")
    sh(f"{sys.executable} {src}/convert_hf_to_gguf.py {d} --outtype f16 --outfile {f16} 2>&1 | tail -3")
    sh(f"{src}/build-cpu/bin/llama-quantize {f16} {sortie}/qwen35-2b-{nom}-Q4_K_M.gguf Q4_K_M 2>&1 | tail -2")
    os.remove(f16)

# Jeu de développement sur GPU (binaires CUDA du notebook du professeur, s'ils sont fournis).
binaire = glob.glob("/kaggle/input/**/llama-server", recursive=True)
dev = glob.glob("/kaggle/input/**/cas.jsonl", recursive=True)
executer = glob.glob("/kaggle/input/**/executer.py", recursive=True)
if binaire and dev and executer:
    bindir = os.path.join(TMP, "llama-bin")
    shutil.copytree(os.path.dirname(binaire[0]), bindir, dirs_exist_ok=True)
    sh(f"chmod +x {bindir}/*")
    env = dict(os.environ, LD_LIBRARY_PATH=bindir + ":" + os.environ.get("LD_LIBRARY_PATH", ""))
    jeu = os.path.join(TMP, "dev")
    os.makedirs(os.path.join(jeu, "documents"), exist_ok=True)
    shutil.copy(dev[0], jeu)
    for f in glob.glob(os.path.join(os.path.dirname(dev[0]), "**", "*.md"), recursive=True):
        shutil.copy(f, os.path.join(jeu, "documents"))
    for nom in ("base", "lora"):
        p = subprocess.Popen([f"{bindir}/llama-server", "-m", f"{sortie}/qwen35-2b-{nom}-Q4_K_M.gguf", "-c", "8192",
                              "-ngl", "999", "-fa", "on", "--jinja", "--port", "8081", "-np", "1"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
        for _ in range(150):
            try:
                if b"ok" in urllib.request.urlopen("http://127.0.0.1:8081/health", timeout=5).read():
                    break
            except Exception:
                pass
            time.sleep(2)
        sh(f"{sys.executable} {executer[0]} {jeu} {TRAVAIL}/dev-qwen35-2b-{nom}-kaggle.jsonl --url http://127.0.0.1:8081/v1 "
           f"--modele {nom} > /dev/null")
        p.terminate()
        p.wait()
print("FIN", flush=True)
