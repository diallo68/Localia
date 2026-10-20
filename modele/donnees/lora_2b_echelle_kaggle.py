# Localia, défi modèle compact, étape 2.6 : courbe d'échelle (même recette que le lot 3, sur N exemples tirés
# des 3 633 du lot 3), avec la correction de la fuite de mémoire vive mesurée au lot 3 (~65 Mo par pas, noyau tué
# vers 31,4 Go au pas 441) : longueurs arrondies au palier de PALIER jetons, pour borner le nombre de formes distinctes
# vues par la version PyTorch de DeltaNet (cause supposée : un cache par longueur de séquence).
# Recette d'origine (étape 2.5) :
# 1. LoRA sur Qwen/Qwen3.5-2B (Apache 2.0) avec les exemples vérifiés de l'étape 2.4 (régime sans réflexion,
#    perte sur la réponse seulement).
# 2. Fusion, conversion en GGUF (convert_hf_to_gguf.py de llama.cpp), quantification Q4_K_M ; la base est
#    convertie et quantifiée de la même façon, comme témoin.
# 3. Jeu de développement sur GPU pour les deux (mêmes conditions que executer.py), pour un premier signal.
import gc
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

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
LLAMA_TAG = "v0.7.0"
BASE = "Qwen/Qwen3.5-2B"
LR, EPOQUES, ACCUM, RANG, LONGUEUR_MAX = 1e-4, 1, 8, 16, 8192
SAUVEGARDE = 40  # pas entre deux points de reprise (le lot 3, version 1, a été tué au pas 440 sur 455)
N_EXEMPLES = int(os.environ.get("N_EXEMPLES", "0"))  # 0 = tous ; sinon les N premiers d'un tirage fixe (graine 7)
PALIER = 256  # longueurs complétées au multiple de 256 (remplissage après la fin, sans effet sur la perte : modèle causal)
ESSAI_PAS = int(os.environ.get("ESSAI_PAS", "0"))  # > 0 : court essai de la correction, arrêt après ce nombre de pas


def rss_go():
    """Mémoire vive occupée par le processus (le noyau est tué quand la machine en manque)."""
    for ligne in open("/proc/self/status"):
        if ligne.startswith("VmRSS:"):
            return int(ligne.split()[1]) / 1e6
    return 0.0


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv", shell=True)
sh(f"{sys.executable} -m pip install -q -U 'transformers>=5.2' 'peft>=0.18' 2>&1 | tail -2")
# torchao 0.10 préinstallé sur Kaggle : peft >= 0.18 refuse de démarrer avec lui (et on ne s'en sert pas).
sh(f"{sys.executable} -m pip uninstall -q -y torchao 2>&1 | tail -2")

import torch  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402
from peft import LoraConfig, get_peft_model, get_peft_model_state_dict, set_peft_model_state_dict  # noqa: E402
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
if N_EXEMPLES:
    random.Random(7).shuffle(donnees)
    donnees = donnees[:N_EXEMPLES]
    print(f"courbe d'échelle : {len(donnees)} exemples retenus", flush=True)
PAD = tok.pad_token_id if tok.pad_token_id is not None else tok.eos_token_id
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

# Reprise : un point de reprise d'une version précédente (sortie d'un noyau fournie en entrée) ou de cette session.
reprise = os.path.join(TRAVAIL, "reprise.pt")
k_debut, pas = 0, 0
anciens = glob.glob("/kaggle/input/**/reprise.pt", recursive=True)
if anciens:
    etat = torch.load(anciens[0], map_location="cuda", weights_only=False)
    set_peft_model_state_dict(modele, etat["lora"])
    for p in params:
        p.data = p.data.float()
    opt.load_state_dict(etat["opt"])
    sched.load_state_dict(etat["sched"])
    scaler.load_state_dict(etat["scaler"])
    k_debut, pas = etat["k"], etat["pas"]
    print(f"reprise au pas {pas} (exemple {k_debut})", flush=True)
    del etat

modele.train()
rnd = random.Random(1)
journal = open(os.path.join(TRAVAIL, "entrainement.log"), "a")
t0, cumul = time.time(), []
for epoque in range(EPOQUES):
    ordre = list(range(len(donnees)))
    rnd.shuffle(ordre)
    for k, i in enumerate(ordre):
        if k < k_debut:
            continue
        ids, n_p = donnees[i]
        L = -(-len(ids) // PALIER) * PALIER
        x = torch.tensor([ids + [PAD] * (L - len(ids))], device="cuda")
        cible = x[0, n_p:len(ids)]
        # Logits sur la réponse seulement : sur 8k jetons, la sortie complète (vocabulaire de 248k, fp32)
        # ne tient pas sur une T4. Les L - n_p + 1 dernières positions vont de n_p - 1 à L - 1 ; on garde celles
        # qui prédisent les jetons n_p .. len(ids) - 1 (le remplissage, placé après, ne les influence pas).
        with torch.autocast("cuda", dtype=torch.float16):
            logits = modele(input_ids=x, logits_to_keep=L - n_p + 1).logits[0, :len(ids) - n_p].float()
        perte = torch.nn.functional.cross_entropy(logits, cible) / ACCUM
        del logits
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
                    f"lr {sched.get_last_lr()[0]:.2e} {time.time() - t0:.0f} s mém {torch.cuda.max_memory_allocated() / 1e9:.1f} Go " \
                    f"RAM {rss_go():.1f} Go"
            print(ligne, flush=True)
            journal.write(ligne + "\n")
            journal.flush()
            cumul = []
            if pas % 10 == 0:
                gc.collect()
                torch.cuda.empty_cache()
            if pas % SAUVEGARDE == 0:
                torch.save({"lora": get_peft_model_state_dict(modele), "opt": opt.state_dict(), "sched": sched.state_dict(),
                            "scaler": scaler.state_dict(), "k": k + 1, "pas": pas}, reprise + ".tmp")
                os.replace(reprise + ".tmp", reprise)
            if ESSAI_PAS and pas >= ESSAI_PAS:
                break
    if ESSAI_PAS:
        break
if ESSAI_PAS:
    print("FIN de l'essai (RAM à comparer au lot 3 : 2,8 Go au pas 1, ~65 Mo de plus par pas)", flush=True)
    sys.exit(0)

# Fusion et sauvegarde au format Hugging Face (avec les fichiers de la base : gabarit, processeur).
fusion = os.path.join(TMP, "fusion")
modele = modele.merge_and_unload()
modele.save_pretrained(fusion, safe_serialization=True)
for f in glob.glob(os.path.join(base_dir, "*")):  # tokenizer, gabarit, configurations du processeur
    if os.path.isfile(f) and not f.endswith((".safetensors", ".safetensors.index.json")) \
            and not os.path.exists(os.path.join(fusion, os.path.basename(f))):
        shutil.copy(f, fusion)
# Couche MTP (prédiction anticipée) : la classe transformers ne la charge pas, save_pretrained ne l'écrit donc pas,
# alors que la configuration l'annonce (llama.cpp 0.5 refuse alors le GGUF). Non touchée par la LoRA : recopiée de la base.
from safetensors import safe_open  # noqa: E402
from safetensors.torch import save_file  # noqa: E402
mtp = {}
for f in glob.glob(os.path.join(base_dir, "*.safetensors")):
    with safe_open(f, "pt") as st:
        for k in st.keys():
            if k.startswith("mtp."):
                mtp[k] = st.get_tensor(k)
if mtp:
    save_file(mtp, os.path.join(fusion, "model-mtp.safetensors"), metadata={"format": "pt"})
    index = os.path.join(fusion, "model.safetensors.index.json")
    if os.path.exists(index):
        ix = json.load(open(index))
        ix["weight_map"].update({k: "model-mtp.safetensors" for k in mtp})
        json.dump(ix, open(index, "w"), indent=1)
print(f"couche MTP : {len(mtp)} tenseurs recopiés de la base", flush=True)
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
for nom, d in (("lora", fusion),):  # base témoin déjà notée (0,854, identique aux lots précédents)
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
    for nom in ("lora",):
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
