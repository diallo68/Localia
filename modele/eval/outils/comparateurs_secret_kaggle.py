# Localia, défi modèle compact, étape 3.5 : évaluation finale des comparateurs sur le jeu secret (240 cas), une fois.
# Kaggle, 2 × T4, llama.cpp CUDA (binaires du jeu localia-llama-bin-cuda), un modèle à la fois réparti sur les deux
# cartes ; mêmes conditions que sur le Mac et que pour dev2 (executer.py : sans réflexion, température 0, 600 jetons,
# même consigne système, contexte 8 192). GROUPE "a" : comparateurs de 24 à 35 Md ; "b" : 3 à 12 Md (criteres.md, 1).
# JEU : jeu de données des cas (localia-eval-secret, ou localia-eval-dev2 pour la répétition, avec LIMITE cas par
# modèle) ; son empreinte est vérifiée avant toute génération. Pour chaque modèle : révision Hugging Face et SHA-256
# du GGUF, serveur lancé sous un alias vérifié, trois passes d'executer.py (seuls les cas en erreur sont retentés).
import glob
import os
import shutil
import subprocess
import sys
import time
import urllib.request

GROUPE = "a"
JEU, EMPREINTE, LIMITE = "localia-eval-secret", "622aac134a08e2c9c7d035e209cf9d4c1f1b0efea03de0870508d90f6e577f49", None
MODELES = {
    "a": [  # (nom court, dépôt Hugging Face, fichier) ; les quatre premiers comme pour dev et dev2
        ("mistral-small-3.2-24b-q4km", "bartowski/mistralai_Mistral-Small-3.2-24B-Instruct-2506-GGUF",
         "mistralai_Mistral-Small-3.2-24B-Instruct-2506-Q4_K_M.gguf"),
        ("gemma3-27b-q4km", "unsloth/gemma-3-27b-it-GGUF", "gemma-3-27b-it-Q4_K_M.gguf"),
        ("qwen38-27b-q4km", "ggml-org/Qwen3.8-27B-GGUF", "Qwen3.8-27B-Q4_K_M.gguf"),
        ("gemma4-31b-qat-q40", "google/gemma-4-31B-it-qat-q4_0-gguf", "gemma-4-31B_q4_0-it.gguf"),
        ("qwen36-35b-a3b-ud-q4km", "unsloth/Qwen3.6-35B-A3B-GGUF", "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf"),  # professeur
    ],
    "b": [
        ("qwen35-9b-q4km", "unsloth/Qwen3.5-9B-GGUF", "Qwen3.5-9B-Q4_K_M.gguf"),
        ("gemma3-12b-q4km", "unsloth/gemma-3-12b-it-GGUF", "gemma-3-12b-it-Q4_K_M.gguf"),
        ("mistral-nemo-12b-q4km", "bartowski/Mistral-Nemo-Instruct-2407-GGUF", "Mistral-Nemo-Instruct-2407-Q4_K_M.gguf"),
        ("gemma4-12b-qat-q40", "google/gemma-4-12B-it-qat-q4_0-gguf", "gemma-4-12b-it-qat-q4_0.gguf"),
        ("qwen35-4b-q4km", "unsloth/Qwen3.5-4B-GGUF", "Qwen3.5-4B-Q4_K_M.gguf"),
        ("ministral3-3b-q4km", "mistralai/Ministral-3-3B-Instruct-2512-GGUF", "Ministral-3-3B-Instruct-2512-Q4_K_M.gguf"),
        ("phi4-mini-q4km", "bartowski/microsoft_Phi-4-mini-instruct-GGUF", "microsoft_Phi-4-mini-instruct-Q4_K_M.gguf"),
    ],
}[GROUPE]
TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
SORTIE = os.path.join(TRAVAIL, "resultats")
os.makedirs(SORTIE, exist_ok=True)


def sh(cmd, **kw):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True, **kw)


cartes = subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", shell=True,
                        capture_output=True, text=True).stdout.strip().splitlines()
print(cartes, flush=True)
assert len(cartes) == 2 and all("T4" in c for c in cartes), "deux T4 attendues"


def entree(fragment, motif):
    return [c for c in glob.glob(f"/kaggle/input/**/{motif}", recursive=True) if fragment in c]


# 1. Jeu : reconstruit jeu/{cas.jsonl, documents/*.md} depuis le seul jeu de données JEU, puis empreinte vérifiée.
jeu = os.path.join(TMP, "jeu")
os.makedirs(os.path.join(jeu, "documents"), exist_ok=True)
(cas,) = entree(JEU, "cas.jsonl")
shutil.copy(cas, os.path.join(jeu, "cas.jsonl"))
for f in entree(JEU, "documents/*.md"):
    shutil.copy(f, os.path.join(jeu, "documents", os.path.basename(f)))
(executer,) = entree("localia-outils-eval", "executer.py")
(verifier,) = entree("localia-outils-eval", "verifier_empreinte.py")
sh(f"{sys.executable} -I {verifier} {jeu} {EMPREINTE}")
n_cas = sum(1 for _ in open(os.path.join(jeu, "cas.jsonl")))
ids = None
if LIMITE:
    import json
    ids = ",".join(json.loads(l)["id"] for l in list(open(os.path.join(jeu, "cas.jsonl")))[:LIMITE])
    n_cas = LIMITE
print("cas :", n_cas, "documents :", len(os.listdir(os.path.join(jeu, "documents"))), flush=True)

# 2. llama.cpp avec CUDA.
(deja,) = entree("localia-llama-bin-cuda", "llama-server")
serveur = os.path.join(TMP, "llama-bin/llama-server")
shutil.copytree(os.path.dirname(deja), os.path.dirname(serveur), dirs_exist_ok=True)
sh(f"chmod +x {os.path.dirname(serveur)}/*")
os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
version = subprocess.run(f"{serveur} --version", shell=True, capture_output=True, text=True)
print(version.stdout + version.stderr, flush=True)


def libre(port):
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2)
        return False
    except Exception:
        return True


from huggingface_hub import hf_hub_download  # préinstallé sur Kaggle

# 3. Un modèle après l'autre ; un échec (téléchargement, serveur) n'arrête pas les suivants, et il est écrit.
import hashlib  # noqa: E402
import json  # noqa: E402

manifeste = open(os.path.join(SORTIE, "manifeste.jsonl"), "a")
for nom, depot, fichier in MODELES:
    sortie = os.path.join(SORTIE, f"secret-{nom}.jsonl")
    t0 = time.time()
    p = None
    info = {"modele": nom, "depot": depot, "fichier": fichier, "jeu": JEU, "empreinte_jeu": EMPREINTE,
            "llama": (version.stdout + version.stderr).strip()[-200:]}
    try:
        chemin = hf_hub_download(depot, fichier, cache_dir=os.path.join(TMP, "hf"))
        info["revision"] = chemin.split("/snapshots/")[1].split("/")[0]
        h = hashlib.sha256()
        with open(chemin, "rb") as f:
            for bloc in iter(lambda: f.read(1 << 24), b""):
                h.update(bloc)
        info["sha256"], info["octets"] = h.hexdigest(), os.path.getsize(chemin)
        print(f"{nom} : téléchargé et haché en {time.time() - t0:.0f} s", flush=True)
        assert libre(8081), "port 8081 déjà occupé"
        log = open(os.path.join(SORTIE, f"serveur-{nom}.log"), "w")
        p = subprocess.Popen([serveur, "-m", chemin, "-a", nom, "-c", "8192", "-ngl", "999", "--split-mode", "layer",
                              "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", "8081", "-np", "1"],
                             stdout=log, stderr=log)
        for _ in range(450):
            assert p.poll() is None, "le serveur s'est arrêté"
            try:
                if b"ok" in urllib.request.urlopen("http://127.0.0.1:8081/health", timeout=5).read():
                    break
            except Exception:
                pass
            time.sleep(2)
        else:
            raise TimeoutError("serveur pas prêt après 15 min")
        servi = json.loads(urllib.request.urlopen("http://127.0.0.1:8081/v1/models", timeout=10).read())
        assert [m["id"] for m in servi["data"]] == [nom], f"modèle servi inattendu : {servi}"
        for passe in range(3):
            subprocess.run(f"{sys.executable} -I {executer} {jeu} {sortie} --url http://127.0.0.1:8081/v1 --modele {nom}"
                           + (f" --ids {ids}" if ids else ""), shell=True)
            assert p.poll() is None, "le serveur s'est arrêté pendant les appels"
    except Exception as e:
        info["echec"] = repr(e)
        print(f"{nom} : ÉCHEC {e!r}", flush=True)
    if p:
        p.terminate()
        p.wait()
    shutil.rmtree(os.path.join(TMP, "hf"), ignore_errors=True)  # libère le disque avant le modèle suivant
    if os.path.exists(sortie):
        dern = {x["id"]: x for x in map(json.loads, filter(str.strip, open(sortie)))}
        info["cas_reussis"] = sum(1 for x in dern.values() if not x.get("erreur"))
        info["fins_length"] = sum(1 for x in dern.values() if x.get("fin") == "length")
        info["reflexion"] = sum(1 for x in dern.values() if x.get("reflexion_car"))
    info["minutes"] = round((time.time() - t0) / 60, 1)
    manifeste.write(json.dumps(info, ensure_ascii=False) + "\n")
    manifeste.flush()
    print(f"{nom} : {info.get('cas_reussis', 0)}/{n_cas} cas réussis, {info['minutes']} min", flush=True)

shutil.rmtree(jeu, ignore_errors=True)  # le jeu secret ne reste pas dans les sorties du noyau
print("FIN", flush=True)
