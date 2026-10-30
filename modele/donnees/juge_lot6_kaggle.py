# Localia, défi modèle compact, lot 6 (étape 3.2) : le professeur (Qwen3.6-35B-A3B, Apache 2.0, sur Kaggle, 2 × T4,
# llama.cpp avec CUDA) juge les réponses de l'élève (modèle du lot 4) déjà gardées par verifier.py. verifier.py ne
# contrôle que la présence du résultat ; relues à la main, environ 3 réponses sur 8 avaient un raisonnement faux.
# Pour chaque réponse, le professeur reçoit le document, la demande, ce qui a été vérifié (règle ou ligne, résultat,
# calcul) et sa propre réponse gardée, comme référence. Il dit, avec réflexion, si le raisonnement est juste de bout
# en bout et si le français est correct. Il ne fait que trier : aucun texte du juge n'entre dans l'entraînement.
# Entrée : a_juger.jsonl (preparer_juge_lot6.py). Sortie : verdicts.jsonl.
import concurrent.futures as cf
import glob
import json
import os
import random
import shutil
import subprocess
import sys
import time
import urllib.request

LLAMA_TAG = "v0.7.0"
DEPOT, FICHIER = "ggml-org/Qwen3.6-35B-A3B-GGUF", "Qwen3.6-35B-A3B-Q4_K_M.gguf"
TRAVAIL = "/kaggle/working"
TMP = "/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp"
PORT = 8081
PARALLELE = 4


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv || echo PAS DE GPU", shell=True)

# 1. llama.cpp avec CUDA. Les binaires sont copiés dans /kaggle/working/llama-bin pour être réutilisés.
src = os.path.join(TMP, "llama.cpp")
serveur = os.path.join(src, "build/bin/llama-server")
deja = glob.glob("/kaggle/input/**/llama-server", recursive=True)
if deja:
    serveur = os.path.join(TMP, "llama-bin/llama-server")
    shutil.copytree(os.path.dirname(deja[0]), os.path.dirname(serveur), dirs_exist_ok=True)
    sh(f"chmod +x {os.path.dirname(serveur)}/*")
    os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
else:
    sh(f"git clone --depth 1 --branch {LLAMA_TAG} https://github.com/ggml-org/llama.cpp {src}")
    for d in ("/usr/local/cuda/bin", "/usr/local/cuda-12/bin"):
        if os.path.isdir(d):
            os.environ["PATH"] = d + ":" + os.environ["PATH"]
    pilote = glob.glob("/usr/local/nvidia/lib64/libcuda.so") + glob.glob("/usr/local/cuda*/lib64/stubs/libcuda.so")
    opt = f"-DCUDA_cuda_driver_LIBRARY={pilote[0]}" if pilote else ""
    sh(f"cmake -S {src} -B {src}/build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=75 -DLLAMA_CURL=OFF {opt} "
       f"-DCMAKE_BUILD_TYPE=Release > {TMP}/cmake.log 2>&1 || (tail -40 {TMP}/cmake.log; exit 1)")
    sh(f"cmake --build {src}/build -j4 --target llama-server > {TMP}/build.log 2>&1 || (tail -50 {TMP}/build.log; exit 1)")
    dest = os.path.join(TRAVAIL, "llama-bin")
    os.makedirs(dest, exist_ok=True)
    for f in glob.glob(f"{src}/build/bin/*"):
        if os.path.basename(f) == "llama-server" or f.endswith(".so") or ".so." in f:
            shutil.copy(f, dest)

from huggingface_hub import hf_hub_download  # noqa: E402

t0 = time.time()
modele = hf_hub_download(DEPOT, FICHIER, cache_dir=os.path.join(TMP, "hf"))
print(f"professeur téléchargé en {time.time() - t0:.0f} s", flush=True)
log = open(os.path.join(TRAVAIL, "serveur-professeur.log"), "w")
p = subprocess.Popen([serveur, "-m", modele, "-c", str(16384 * PARALLELE), "-np", str(PARALLELE), "-ngl", "999",
                      "--split-mode", "layer", "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", str(PORT)],
                     stdout=log, stderr=log)
for _ in range(600):
    try:
        if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=5).read():
            break
    except Exception:
        pass
    time.sleep(2)
print(f"serveur prêt après {time.time() - t0:.0f} s", flush=True)


def appeler(messages, reflexion=False, json_mode=False, max_tokens=900):
    corps = {"messages": messages, "temperature": 0.7 if reflexion else 0.5, "top_p": 0.95,
             "max_tokens": 6000 if reflexion else max_tokens,
             "chat_template_kwargs": {"enable_thinking": reflexion}}
    if json_mode:
        corps["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=3600) as r:
        rep = json.loads(r.read())
    m = rep["choices"][0]["message"]
    return {"texte": m.get("content") or "", "reflexion_jetons": len(m.get("reasoning_content") or "") // 3,
            "usage": rep.get("usage", {}), "duree_s": round(time.time() - t, 1),
            "fin": rep["choices"][0].get("finish_reason")}



def consigne(t):
    v = t["verifie"]
    calcul = f"\nCalcul vérifié : {v['calcul']}" if v.get("calcul") else ""
    return f"""Tu relis la réponse d'un petit assistant documentaire avant de t'en servir comme exemple d'entraînement. Sois exigeant : un exemple faux ou mal écrit apprendrait une erreur à l'assistant.

DOCUMENT
{t['document']}

DEMANDE
{t['demande']}

CE QUI A ÉTÉ VÉRIFIÉ
Règle ou ligne du document : {v['regle']}
Résultat attendu : {v['resultat']}{calcul}

RÉPONSE DE RÉFÉRENCE (déjà vérifiée)
{t['reference']}

RÉPONSE À JUGER
{t['reponse']}

Juge la RÉPONSE À JUGER :
- raisonnement_juste : true seulement si chaque étape est juste (bonne règle ou bonne ligne, bonnes données de la demande, calculs et dates exacts, aucune affirmation fausse, inventée ou sans rapport avec la demande) et si la conclusion est le résultat attendu ; false au moindre doute ;
- francais_correct : true seulement s'il n'y a aucune faute de grammaire, d'accord, de conjugaison ou d'orthographe, aucun mot anglais et aucune tournure incorrecte (la mise en forme ne compte pas).
Termine ta réponse par une seule ligne de la forme :
VERDICT {{"raisonnement_juste": true ou false, "francais_correct": true ou false, "erreur": "la première erreur trouvée, en quelques mots, ou une chaîne vide"}}"""


def juger(t):
    for essai in range(2):
        try:
            r = appeler([{"role": "user", "content": consigne(t)}], reflexion=True)
            ligne = [l for l in r["texte"].splitlines() if l.strip().startswith("VERDICT")][-1]
            v = json.loads(ligne.strip()[len("VERDICT"):].strip())
            return {"id": t["id"], "verdict": v, "duree_s": r["duree_s"], "reflexion_jetons": r["reflexion_jetons"]}
        except Exception as e:
            err = repr(e)
    return {"id": t["id"], "verdict": None, "erreur": err}


taches = [json.loads(l) for chemin in glob.glob("/kaggle/input/**/a_juger.jsonl", recursive=True) for l in open(chemin)]
print(f"{len(taches)} réponses à juger", flush=True)
t0 = time.time()
with cf.ThreadPoolExecutor(PARALLELE) as ex, open(os.path.join(TRAVAIL, "verdicts.jsonl"), "w") as s:
    for i, res in enumerate(ex.map(juger, taches)):
        s.write(json.dumps(res, ensure_ascii=False) + "\n")
        s.flush()
        if i % 40 == 0:
            print(f"{i + 1}/{len(taches)} en {time.time() - t0:.0f} s", flush=True)
print(f"{len(taches)} réponses jugées en {time.time() - t0:.0f} s", flush=True)
p.terminate()
print("FIN", flush=True)
