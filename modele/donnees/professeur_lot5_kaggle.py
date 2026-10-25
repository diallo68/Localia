# Localia, défi modèle compact, lot 5 : exemples ciblés sur les défauts du lot 4 mesurés sur dev2 (25 oct. 2026) :
# mauvaise ligne de tableau ou calcul faux (V037, V038, V049, V133), contradiction éloignée non vue (V041, V071).
# Le professeur est le même (Qwen3.6-35B-A3B, Apache 2.0, sur Kaggle, 2 × T4, llama.cpp avec CUDA).
# Fiches préparées mécaniquement par fabriquer_lot5.py. Trois types de tâches :
# - tableau : une situation dont la réponse s'obtient avec une ligne précise d'un tableau du document (et souvent un
#   calcul) ; en phase A, le professeur recopie la ligne, donne le résultat et le calcul ; il répond en phase B avec
#   réflexion ; la vérification sur le Mac contrôle la ligne, le calcul et la présence du résultat ;
# - incoherence : un nombre a été changé à une occurrence, loin d'une autre occurrence de la même règle ; en phase A,
#   le professeur dit si les deux passages portent sur la même règle (sinon la fiche est écartée) et rédige une demande
#   de vérification ; en phase B, il reçoit en plus une information réservée (les deux passages et les deux valeurs)
#   qui n'entre pas dans l'exemple : seuls la consigne système, le document, la demande et la réponse sont gardés ;
# - fausse_alerte : la même demande sur le document intact ; la bonne réponse conclut à la cohérence.
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


N_TABLEAU = 4


def consigne_tableau(fiche):
    tabs = "\n\n".join(fiche["tableaux"])
    return f"""Tu prépares des exemples d'entraînement pour un petit assistant qui travaille sur des documents administratifs en français.
Voici un document, puis le ou les tableaux qu'il contient.

DOCUMENT
{fiche['document']}

TABLEAUX
{tabs}

Rédige en français naturel, comme le ferait un usager ou un agent, les éléments suivants. Varie les tournures. Réponds uniquement par un objet JSON avec ces clés :
- "consigne_systeme" : une consigne système de 2 à 4 phrases pour un assistant documentaire (répondre à partir du document seulement, lire avec soin la bonne ligne et la bonne colonne des tableaux, vérifier les seuils et les tranches, montrer le calcul). Formule-la à ta façon ; elle ne doit pas parler de JSON : l'assistant répond en texte.
- "situations" : liste de {N_TABLEAU} objets {{"demande": la situation concrète d'une personne (avec ses propres données : âge, revenu, durée, nombre d'enfants, montant, date…) et une question dont la réponse s'obtient en choisissant la bonne ligne d'un des tableaux, puis souvent en faisant un calcul ; la question ne cite pas la ligne, "ligne": la ligne du tableau qui donne la réponse, recopiée exactement, caractère pour caractère, barres verticales comprises, "resultat": la réponse finale, courte (un nombre avec son unité, une date, ou « oui » / « non »), "calcul": si la réponse est obtenue par un calcul, l'expression arithmétique qui la donne, avec seulement des chiffres, + - * / et des parenthèses ; sinon une chaîne vide}}. Choisis des situations proches d'une limite entre deux lignes (par exemple un âge ou un revenu juste au-dessus ou juste au-dessous d'un seuil), pour qu'une ligne voisine donnerait une réponse fausse. Au moins deux situations doivent demander un calcul. Si les tableaux permettent moins de {N_TABLEAU} situations différentes, donne-en moins."""


def consigne_incoherence(fiche):
    inc = fiche["incoherence"]
    return f"""Tu prépares des exemples d'entraînement pour un petit assistant qui travaille sur des documents administratifs en français.
Voici un document, puis deux passages de ce document qui contiennent la même valeur ({inc['valeur_origine']} {inc['unite']}).

DOCUMENT
{fiche['document']}

PASSAGE 1
{inc['autre_passage']}

PASSAGE 2 (version d'origine)
{inc['phrase_origine']}

Réponds uniquement par un objet JSON avec ces clés :
- "meme_regle" : true si les deux passages énoncent la même règle ou la même donnée, de sorte que si l'un des deux donnait une autre valeur, le document se contredirait ; false s'ils parlent de choses différentes qui ont par hasard la même valeur.
- "consigne_systeme" : une consigne système de 2 à 4 phrases pour un assistant documentaire (répondre à partir du document seulement, vérifier que les passages qui parlent de la même chose sont d'accord, signaler une contradiction en citant les deux passages). Formule-la à ta façon ; elle ne doit pas parler de JSON.
- "demande" : une demande naturelle, comme celle d'un usager ou d'un agent, qui demande de vérifier si le document est cohérent sur le sujet de ces passages, ou qui demande la valeur en question en précisant qu'il faut s'assurer qu'elle est la même partout ; elle ne cite aucun chiffre et ne mentionne ni les passages ni le mot « passage »."""


def indice(fiche):
    inc = fiche["incoherence"]
    return (f"Information réservée, à ne jamais mentionner ni laisser deviner : dans ce document, le passage « {inc['phrase_modifiee']} » "
            f"donne {inc['valeur_modifiee']} {inc['unite']}, alors que le passage « {inc['autre_passage']} » donne {inc['valeur_origine']} {inc['unite']} "
            "pour la même règle. Réponds comme si tu avais repéré toi-même la contradiction en lisant le document : cite les deux passages "
            "et les deux valeurs, explique en quoi ils se contredisent, et indique qu'il faut vérifier auprès de l'organisme compétent "
            "quelle valeur est la bonne. Ne dis pas laquelle est la bonne.")


def user(doc, demande):
    return f"Document :\n\n{doc}\n\n---\n\nDemande : {demande}"


fiches = [json.loads(l) for chemin in glob.glob("/kaggle/input/**/fiches-*.jsonl", recursive=True) for l in open(chemin)]
sortie_a = os.path.join(TRAVAIL, "phase_a.jsonl")
sortie_b = os.path.join(TRAVAIL, "phase_b.jsonl")


def phase_a(fiche):
    consigne = consigne_tableau(fiche) if "tableaux" in fiche else consigne_incoherence(fiche)
    for essai in range(3):
        r = appeler([{"role": "user", "content": consigne}], json_mode=True, max_tokens=2500)
        try:
            return fiche["fiche"], json.loads(r["texte"]), r
        except Exception:
            continue
    return fiche["fiche"], None, r


def phase_b(t):
    systeme = t["systeme"] + ("\n\n" + t["indice"] if t.get("indice") else "")
    try:
        r = appeler([{"role": "system", "content": systeme}, {"role": "user", "content": user(t["document"], t["demande"])}],
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

rnd = random.Random(5)
systemes = [d["consigne_systeme"] for d in demandes.values()
            if d and d.get("consigne_systeme") and "json" not in str(d["consigne_systeme"]).lower()]
taches = []
for fiche in fiches:
    d = demandes.get(fiche["fiche"])
    if not d:
        continue
    if "tableaux" in fiche:
        for j, a in enumerate((d.get("situations") or [])[:N_TABLEAU]):
            try:
                ligne = str(a["ligne"]).strip()
                if ligne not in fiche["document"] or not ligne.startswith("|") or not str(a["resultat"]).strip():
                    continue  # ligne mal recopiée : écartée avant la phase B
                app = {"regle": ligne, "resultat": a["resultat"], "calcul": a.get("calcul", "")}
                taches.append({"fiche": fiche["fiche"], "type": "tableau", "reflexion": True, "systeme": rnd.choice(systemes),
                               "document": fiche["document"], "demande": str(a["demande"]), "application": app, "rang": j})
            except (KeyError, TypeError):
                continue
    else:
        try:
            if d.get("meme_regle") is not True or not str(d.get("demande", "")).strip():
                continue
            q = str(d["demande"])
            taches.append({"fiche": fiche["fiche"], "type": "incoherence", "reflexion": True, "systeme": rnd.choice(systemes),
                           "document": fiche["incoherence"]["document"], "demande": q, "indice": indice(fiche)})
            taches.append({"fiche": fiche["fiche"], "type": "fausse_alerte", "reflexion": False, "systeme": rnd.choice(systemes),
                           "document": fiche["document"], "demande": q})
        except (KeyError, TypeError):
            continue
print(f"{len(taches)} tâches", flush=True)

t0 = time.time()
with cf.ThreadPoolExecutor(PARALLELE) as ex, open(sortie_b, "w") as s:
    for i, res in enumerate(ex.map(phase_b, taches)):
        s.write(json.dumps(res, ensure_ascii=False) + "\n")
        if i % 40 == 0:
            print(f"phase B : {i + 1}/{len(taches)} en {time.time() - t0:.0f} s", flush=True)
print(f"phase B : {len(taches)} tâches en {time.time() - t0:.0f} s", flush=True)
p.terminate()
print("FIN", flush=True)
