# Dial-bowe v2 : noyau Kaggle du SFT (plan §6). Lance sft_v2_entrainement.py par torchrun sur les cartes de la
# machine (deux T4), puis, une fois l'entraînement fini (fini.json) : fusion, couche MTP recopiée de la base, GGUF
# F16 (gardé en pleine précision, leçon n° 7 de la v1), Q8_0, Q5_K_M, Q4_K_M, chacun aussi élagué à 48 000 jetons
# (vocfr48k, même outil qu'en v1). Le gabarit sans réflexion est injecté ensuite sur le Mac (preparer_gguf.py).
# MODE est réécrit par la chaîne qui pousse le noyau : « essai » (mesure de mémoire et de débit) ou « sft ».
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys

MODE = "essai"
TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
LLAMA_TAG = "v0.7.0"
BASE = "Qwen/Qwen3.5-2B"
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


def entree(nom):
    trouve = glob.glob(f"/kaggle/input/**/{nom}", recursive=True)
    return trouve[0] if trouve else None


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv", shell=True)
sh(f"{sys.executable} -m pip install -q -U 'transformers>=5.2' 'peft>=0.18' 2>&1 | tail -2")
sh(f"{sys.executable} -m pip uninstall -q -y torchao 2>&1 | tail -2")  # peft >= 0.18 refuse torchao 0.10
import torch  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402

base_dir = snapshot_download(BASE, cache_dir=os.path.join(TMP, "hf"))
cartes = torch.cuda.device_count()
reprise = entree("reprise.pt") or ""  # sortie d'une session précédente, fournie en entrée
commande = (f"torchrun --standalone --nproc_per_node {cartes} {entree('sft_v2_entrainement.py')} "
            f"--base {base_dir} --exemples {entree('exemples.jsonl')} --sortie {TRAVAIL} --mode {MODE} "
            f"--reprise '{reprise}'")
if MODE == "essai":
    # Deux mesures : DeltaNet en PyTorch pur (recette v1), puis avec flash-linear-attention (noyaux Triton), si elle
    # s'installe et tourne sur T4. Pertes et mémoire comparées dans essai-reference.json / essai-fla.json.
    for nom in ("reference", "fla"):
        if nom == "fla":
            subprocess.run(f"{sys.executable} -m pip install -q flash-linear-attention 2>&1 | tail -2", shell=True)
        r = subprocess.run(commande, shell=True)
        print(f"torchrun ({nom}) :", r.returncode, flush=True)
        if os.path.exists(os.path.join(TRAVAIL, "essai.json")):
            os.replace(os.path.join(TRAVAIL, "essai.json"), os.path.join(TRAVAIL, f"essai-{nom}.json"))
        for f in glob.glob(os.path.join(TRAVAIL, "reprise.pt*")):
            os.remove(f)
    print("FIN de l'essai", flush=True)
    sys.exit(0)
r = subprocess.run(commande, shell=True)
print("torchrun :", r.returncode, flush=True)
if not os.path.exists(os.path.join(TRAVAIL, "fini.json")):
    print("FIN (pas de fusion)", flush=True)
    sys.exit(0)

# Fusion (recette v1 : fp16, fichiers de la base recopiés, couche MTP recopiée de la base).
from peft import PeftModel  # noqa: E402
from safetensors import safe_open  # noqa: E402
from safetensors.torch import save_file  # noqa: E402
from transformers import AutoModelForImageTextToText  # noqa: E402

fusion = os.path.join(TMP, "fusion")
modele = AutoModelForImageTextToText.from_pretrained(base_dir, dtype=torch.float16, device_map={"": 0})
modele = PeftModel.from_pretrained(modele, os.path.join(TRAVAIL, "adaptateur")).merge_and_unload()
modele.save_pretrained(fusion, safe_serialization=True)
del modele
torch.cuda.empty_cache()
for f in glob.glob(os.path.join(base_dir, "*")):
    if os.path.isfile(f) and not f.endswith((".safetensors", ".safetensors.index.json")) \
            and not os.path.exists(os.path.join(fusion, os.path.basename(f))):
        shutil.copy(f, fusion)
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

# GGUF : F16 complet gardé, puis quantifications ; chaque variante aussi élaguée (vocfr48k).
src = os.path.join(TMP, "llama.cpp")
sh(f"git clone --depth 1 --branch {LLAMA_TAG} https://github.com/ggml-org/llama.cpp {src} > /dev/null 2>&1")
sh(f"cmake -S {src} -B {src}/build-cpu -DGGML_CUDA=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release > /dev/null "
   f"&& cmake --build {src}/build-cpu -j4 --target llama-quantize > /dev/null")
os.environ["PYTHONPATH"] = os.path.join(src, "gguf-py")
sortie = os.path.join(TRAVAIL, "gguf")
os.makedirs(sortie, exist_ok=True)
f16 = os.path.join(sortie, "dial-bowe-v2-F16.gguf")
sh(f"{sys.executable} {src}/convert_hf_to_gguf.py {fusion} --outtype f16 --outfile {f16} 2>&1 | tail -2")
shutil.rmtree(fusion)


def elaguer(chemin, nom):
    dest = os.path.join(sortie, f"dial-bowe-v2-{nom}-vocfr48k.gguf")
    sh(f"{sys.executable} {entree('elaguer_vocab.py')} {chemin} {entree('qwen35-tokenizer.json')} "
       f"{entree('fineweb2-fra-test-000.parquet')} {dest} --k 48000 2>&1 | tail -2")
    return dest


fichiers = {"F16": f16, "F16-vocfr48k": elaguer(f16, "F16")}
for q in ("Q8_0", "Q5_K_M", "Q4_K_M"):
    complet = os.path.join(TMP, f"v2-{q}.gguf")
    sh(f"{src}/build-cpu/bin/llama-quantize {f16} {complet} {q} 2>&1 | tail -1")
    fichiers[q + "-vocfr48k"] = elaguer(complet, q)
    os.remove(complet)
releve = {}
for nom, chemin in fichiers.items():
    h = hashlib.sha256()
    with open(chemin, "rb") as fh:
        for bloc in iter(lambda: fh.read(1 << 24), b""):
            h.update(bloc)
    releve[nom] = {"fichier": os.path.basename(chemin), "octets": os.path.getsize(chemin), "sha256": h.hexdigest()}
    print(nom, releve[nom], flush=True)
json.dump(releve, open(os.path.join(TRAVAIL, "fichiers.json"), "w"), indent=1)
print("FIN", flush=True)
