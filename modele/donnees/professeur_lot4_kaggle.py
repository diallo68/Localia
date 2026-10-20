# Localia, défi modèle compact, lot 4 : exemples ciblés sur les abstentions à tort du lot 3 (D018, D025, D031 :
# le modèle du lot 3 répond « le document ne le précise pas » quand il faut appliquer une règle du document).
# Le professeur est le même (Qwen3.6-35B-A3B, Apache 2.0, sur Kaggle, 2 × T4, llama.cpp avec CUDA).
# Deux types de tâches :
# - application : un cas concret (montant, date, durée, âge, seuil) où la réponse s'obtient en appliquant une
#   règle écrite dans le document ; le professeur donne en phase A la règle (recopiée), le résultat et le calcul,
#   et répond en phase B avec réflexion ; la vérification sur le Mac contrôle le calcul et l'accord des deux phases ;
# - contraste : la question d'abstention (portant sur le paragraphe P) posée sur le document intact ; la bonne
#   réponse donne l'information. Avec l'abstention (même question, P retiré), elle forme une paire.
# Les textes de ce script sont des instructions données au professeur ; ils n'entrent pas dans les exemples.
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
p = subprocess.Popen([serveur, "-m", modele, "-c", str(12288 * PARALLELE), "-np", str(PARALLELE), "-ngl", "999",
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


N_APPLICATIONS = 3


def consigne_phase_a(fiche):
    return f"""Tu prépares des exemples d'entraînement pour un petit assistant qui travaille sur des documents administratifs en français.
Voici un document, puis un paragraphe extrait de ce document.

DOCUMENT
{fiche['document']}

PARAGRAPHE P
{fiche['abstention']['paragraphe']}

Rédige en français naturel, comme le ferait un usager ou un agent, les éléments suivants. Varie les tournures. Réponds uniquement par un objet JSON avec ces clés :
- "consigne_systeme" : une consigne système de 2 à 4 phrases pour un assistant documentaire (répondre à partir du document seulement, dire quand une information manque, mais appliquer les règles du document aux situations concrètes qu'on lui soumet, en montrant le raisonnement). Formule-la à ta façon ; elle ne doit pas parler de JSON : l'assistant répond en texte.
- "applications" : liste de {N_APPLICATIONS} objets {{"demande": la situation concrète d'une personne (avec ses propres données : montant, date de naissance, date d'un événement, durée, revenu, nombre d'enfants…) et une question dont la réponse n'est pas écrite telle quelle dans le document mais s'obtient en appliquant une règle du document (calcul, barème, tableau, condition, seuil, délai à compter d'une date) ; la question ne cite pas la règle, "regle": la phrase ou la ligne du document qui contient la règle, recopiée exactement, caractère pour caractère, "resultat": la réponse finale, courte (un nombre avec son unité, une date, un âge, ou « oui » / « non »), "calcul": si la réponse est un nombre obtenu par calcul, l'expression arithmétique qui le donne, avec seulement des nombres, + - * / et des parenthèses (par exemple "5000 - 5000 * 20 / 100") ; sinon une chaîne vide}}. Varie les règles et les types de situations ; si le document contient moins de {N_APPLICATIONS} règles applicables, donne-en moins.
- "abstention" : objet {{"demande": une question précise dont la réponse se trouve uniquement dans le PARAGRAPHE P et nulle part ailleurs dans le document ; la question ne doit pas mentionner ce paragraphe ni la lettre P}}."""


def user(doc, demande):
    return f"Document :\n\n{doc}\n\n---\n\nDemande : {demande}"


fiches = [json.loads(l) for l in open(glob.glob("/kaggle/input/**/fiches-*.jsonl", recursive=True)[0])]
sortie_a = os.path.join(TRAVAIL, "phase_a.jsonl")
sortie_b = os.path.join(TRAVAIL, "phase_b.jsonl")


def phase_a(fiche):
    for essai in range(3):
        r = appeler([{"role": "user", "content": consigne_phase_a(fiche)}], json_mode=True, max_tokens=2500)
        try:
            return fiche["fiche"], json.loads(r["texte"]), r
        except Exception:
            continue
    return fiche["fiche"], None, r


def phase_b(t):
    try:
        r = appeler([{"role": "system", "content": t["systeme"]}, {"role": "user", "content": user(t["document"], t["demande"])}],
                    reflexion=t["reflexion"])
    except Exception as e:
        r = {"texte": "", "erreur": repr(e)}
    return dict(t, reponse=r)


t0 = time.time()
demandes = {}
with cf.ThreadPoolExecutor(PARALLELE) as ex, open(sortie_a, "w") as s:
    for nom, d, r in ex.map(phase_a, fiches):
        demandes[nom] = d
        s.write(json.dumps({"fiche": nom, "demandes": d, "brut": r}, ensure_ascii=False) + "\n")
print(f"phase A : {sum(v is not None for v in demandes.values())}/{len(fiches)} fiches en {time.time() - t0:.0f} s", flush=True)

rnd = random.Random(4)
systemes = [d["consigne_systeme"] for d in demandes.values()
            if d and d.get("consigne_systeme") and "json" not in d["consigne_systeme"].lower()]
taches = []
for fiche in fiches:
    d = demandes.get(fiche["fiche"])
    if not d:
        continue
    try:
        q = str(d["abstention"]["demande"])
        taches.append({"fiche": fiche["fiche"], "type": "abstention", "reflexion": False, "systeme": rnd.choice(systemes),
                       "document": fiche["abstention"]["document"], "demande": q})
        taches.append({"fiche": fiche["fiche"], "type": "contraste", "reflexion": False, "systeme": rnd.choice(systemes),
                       "document": fiche["document"], "demande": q})
    except (KeyError, TypeError):
        pass
    for j, a in enumerate((d.get("applications") or [])[:N_APPLICATIONS]):
        try:
            if str(a["regle"]) not in fiche["document"] or not str(a["resultat"]).strip():
                continue  # règle mal recopiée : écartée avant la phase B
            taches.append({"fiche": fiche["fiche"], "type": "application", "reflexion": True, "systeme": rnd.choice(systemes),
                           "document": fiche["document"], "demande": str(a["demande"]), "application": a, "rang": j})
        except (KeyError, TypeError):
            continue

t0 = time.time()
with cf.ThreadPoolExecutor(PARALLELE) as ex, open(sortie_b, "w") as s:
    for i, res in enumerate(ex.map(phase_b, taches)):
        s.write(json.dumps(res, ensure_ascii=False) + "\n")
        if i % 40 == 0:
            print(f"phase B : {i + 1}/{len(taches)} en {time.time() - t0:.0f} s", flush=True)
print(f"phase B : {len(taches)} tâches en {time.time() - t0:.0f} s", flush=True)
p.terminate()
print("FIN", flush=True)
