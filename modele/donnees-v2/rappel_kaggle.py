# Localia, Dial-bowe v2 : exemples de RAPPEL (plan §5.2, 25 % du lot), sur Kaggle (2 × T4, llama.cpp CUDA).
# But : que le modèle garde ses compétences générales (calcul, consignes de forme, explication, rédaction, code
# simple) pendant l'entraînement sur documents. Les réponses viennent de la BASE elle-même (Qwen3.5-2B élaguée
# vocfr48k, Q4_K_M), qui reste ainsi sur sa propre distribution ; on ne garde que les bonnes.
# Trois phases, chacune reprise si le noyau est relancé :
# 1. le professeur (Qwen3.6-35B-A3B, Apache 2.0) écrit les demandes, par lots de 10 (catégorie, domaine, langue) ;
#    pour le calcul, il donne aussi l'expression et le résultat, revérifiés ici par programme ;
# 2. la base répond deux fois à chaque demande (deux serveurs, un par GPU) ;
# 3. le professeur note les deux réponses (1 à 5), avec le résultat attendu ou les contraintes sous les yeux.
# Le tri final (note, contraintes, calculs refaits par verify.js de Localia) se fait sur le Mac (verifier_rappel.py).
# Les textes de ce script sont des instructions données au professeur ; ils n'entrent pas dans les exemples.
# Aucune sortie de Claude ni de GPT n'entre dans les données (provenance.md).
import ast
import concurrent.futures as cf
import glob
import json
import math
import operator
import os
import random
import shutil
import subprocess
import time
import urllib.request

PROF_DEPOT, PROF_FICHIER = "ggml-org/Qwen3.6-35B-A3B-GGUF", "Qwen3.6-35B-A3B-Q4_K_M.gguf"
# Essai sur le Mac (RAPPEL_TEST=<dossier>, RAPPEL_PROF et RAPPEL_BASE : fichiers GGUF) : un lot par catégorie.
TEST = os.environ.get("RAPPEL_TEST")
TRAVAIL = TEST or "/kaggle/working"
TMP = TEST or ("/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp")
LIMITE_S = 11 * 3600
DEBUT = time.time()
rnd = random.Random(20261115)


def sh(cmd):
    print("$", cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=True)


subprocess.run("nvidia-smi --query-gpu=name,memory.total --format=csv || echo PAS DE GPU", shell=True)


def manquantes(binaire):
    r = subprocess.run(["ldd", binaire], capture_output=True, text=True, env=os.environ)
    return [l.split()[0] for l in r.stdout.splitlines() if "not found" in l]


# Binaires llama.cpp du jeu de données privé ; image Kaggle en CUDA 13 : bibliothèques CUDA 12 par pip.
deja = [shutil.which("llama-server")] if TEST else glob.glob("/kaggle/input/**/llama-server", recursive=True)
serveur = deja[0] if TEST else os.path.join(TMP, "llama-bin/llama-server")
if not TEST:
    shutil.copytree(os.path.dirname(deja[0]), os.path.dirname(serveur), dirs_exist_ok=True)
    sh(f"chmod +x {os.path.dirname(serveur)}/*")
    os.environ["LD_LIBRARY_PATH"] = os.path.dirname(serveur) + ":" + os.environ.get("LD_LIBRARY_PATH", "")
if not TEST and manquantes(serveur):
    print("bibliothèques manquantes :", manquantes(serveur), flush=True)
    subprocess.run("pip install -q nvidia-cuda-runtime-cu12 nvidia-cublas-cu12", shell=True)
    libs = glob.glob("/usr/local/lib/python3*/dist-packages/nvidia/*/lib") + glob.glob(
        "/usr/lib/python3*/dist-packages/nvidia/*/lib")
    os.environ["LD_LIBRARY_PATH"] = ":".join(libs) + ":" + os.environ["LD_LIBRARY_PATH"]
    if manquantes(serveur):
        raise SystemExit(f"bibliothèques toujours manquantes : {manquantes(serveur)}")

from huggingface_hub import hf_hub_download  # noqa: E402

BASE = os.environ["RAPPEL_BASE"] if TEST else glob.glob("/kaggle/input/**/Qwen3.5-2B-Q4_K_M-vocfr48k.gguf", recursive=True)[0]


def lancer(modele, port, paralleles, ctx, gpus=None, nom="serveur"):
    env = dict(os.environ)
    if gpus is not None:
        env["CUDA_VISIBLE_DEVICES"] = gpus
    log = open(os.path.join(TRAVAIL, f"{nom}.log"), "w")
    p = subprocess.Popen([serveur, "-m", modele, "-c", str(ctx * paralleles), "-np", str(paralleles), "-ngl", "999",
                          "--split-mode", "layer", "-fa", "on", "--jinja", "--host", "127.0.0.1", "--port", str(port)],
                         stdout=log, stderr=log, env=env)
    for _ in range(600):
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=5).read():
                print(f"{nom} prêt après {time.time() - DEBUT:.0f} s", flush=True)
                return p
        except Exception:
            pass
        if p.poll() is not None:
            raise SystemExit(open(os.path.join(TRAVAIL, f"{nom}.log")).read()[-3000:])
        time.sleep(2)
    raise SystemExit(f"{nom} pas prêt")


def arreter(*procs):
    for p in procs:
        p.terminate()
    for p in procs:
        p.wait()
    time.sleep(5)


def appeler(port, messages, json_mode=False, max_tokens=2500, temperature=0.7, top_p=0.95, top_k=None):
    if TEST:
        max_tokens = min(max_tokens, 1500)
    corps = {"messages": messages, "temperature": temperature, "top_p": top_p, "max_tokens": max_tokens,
             "chat_template_kwargs": {"enable_thinking": False}}
    if top_k:
        corps["top_k"] = top_k
    if json_mode:
        corps["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        rep = json.loads(r.read())
    m = rep["choices"][0]["message"]
    return {"texte": m.get("content") or "", "fin": rep["choices"][0].get("finish_reason"),
            "jetons": rep.get("usage", {}).get("completion_tokens")}


def lire(f):
    return [json.loads(l) for l in open(f)] if os.path.exists(f) else []


def en_parallele(fonction, elements, sortie, n):
    with cf.ThreadPoolExecutor(n) as ex, open(sortie, "a") as s:
        for r in ex.map(fonction, elements):
            if r is not None:
                s.write(json.dumps(r, ensure_ascii=False) + "\n")
                s.flush()


# --- Phase 1 : demandes écrites par le professeur ----------------------------------------------------------------
DOMAINES = {
    "enseignement": "enseignement et éducation", "recherche": "recherche scientifique et études supérieures",
    "agriculture": "agriculture et élevage", "communication": "communication et médias",
    "ingenierie": "ingénierie, bâtiment, énergie, maintenance", "sante": "santé publique et prévention (non clinique)",
    "droit": "droit et démarches administratives", "finance": "finance, comptabilité, petit commerce",
    "quotidien": "vie quotidienne (budget, cuisine, voyage, bricolage, famille)", "general": "culture générale et sciences",
}
CATEGORIES = {  # nombre de lots de 10 demandes
    "calcul": 70, "consignes": 70, "explication": 40, "redaction": 30, "code": 15, "raisonnement": 15,
}
CONSIGNE_CAT = {
    "calcul": """des problèmes de calcul concrets, comme ceux qu'on pose à un assistant : pourcentages, évolutions, règles de trois, conversions d'unités, prix, budgets, moyennes, surfaces et volumes, durées, partages, intérêts simples, nombre d'unités nécessaires arrondi au supérieur, nombre de parts entières arrondi à l'inférieur. Une à quatre opérations. Toutes les données sont dans la demande ; si un arrondi est attendu, la demande le fait comprendre naturellement (« combien de bus faut-il ? », « arrondis à l'euro près »), sans jargon. Pour chacune, clés : "demande" ; "expression" : le calcul complet en Python (nombres, + - * / et parenthèses seulement, sans fonction, point décimal ; 12 % s'écrit 12/100) ; "arrondi" : "aucun", "superieur", "inferieur" ou "proche" ; "decimales" : nombre de décimales du résultat final ; "resultat" : le résultat final après arrondi, en notation Python ; "unite".""",
    "consignes": """des demandes de rédaction ou d'explication avec des contraintes de forme vérifiables, énoncées en toutes lettres dans la demande. Pour chacune, clés : "demande" ; "contraintes" : un objet avec une ou deux de ces clés seulement : "mots_max" (nombre), "puces" (nombre exact de puces), "paragraphes" (nombre exact), "tableau" (true), "titre" (true).""",
    "explication": """des demandes d'explication : expliquer une notion, comparer deux choses, donner des conseils pratiques, répondre à une question de fond, expliquer à un débutant ou à un enfant. Clé : "demande".""",
    "redaction": """des demandes de rédaction : courriel, lettre, compte rendu, annonce, publication, message, discours court, avec le contexte nécessaire donné dans la demande. Clé : "demande".""",
    "code": """des demandes de code simple : petite fonction Python, formule de tableur, requête SQL simple, expression régulière, explication d'un court extrait de code donné dans la demande. Clé : "demande".""",
    "raisonnement": """des petits problèmes de raisonnement ou d'organisation : logique, ordre, planning, choix entre options avec critères, détection d'une erreur dans un raisonnement donné. La demande contient toutes les données ; la réponse est unique et vérifiable. Clés : "demande", "reponse_attendue" (courte).""",
}
if TEST:
    CATEGORIES = {"calcul": 1, "consignes": 1}
NIVEAUX = ["débutant", "étudiant", "professionnel", "personne pressée qui écrit court", "personne qui écrit en détail"]


def lots_r1():
    lots = []
    for cat, n in CATEGORIES.items():
        for k in range(n):
            lots.append({"lot": f"{cat}-{k}", "categorie": cat, "domaine": rnd.choice(list(DOMAINES)),
                         "langue": "fr" if rnd.random() < 0.7 else "en", "niveau": rnd.choice(NIVEAUX)})
    return lots


def consigne_r1(l):
    langue = "en français" if l["langue"] == "fr" else "en anglais"
    return f"""Tu prépares des exemples d'entraînement pour un petit assistant généraliste. Écris 10 demandes différentes, rédigées {langue}, que des utilisateurs réels pourraient lui adresser : {CONSIGNE_CAT[l['categorie']]}

Thème : {DOMAINES[l['domaine']]}. Profil des utilisateurs : surtout {l['niveau']}, mais varie. Varie les tournures, la longueur (de quelques mots à quelques phrases), le niveau de langue ; évite les demandes génériques ou répétitives. Chaque demande se suffit à elle-même (pas de document joint).

Réponds uniquement par un objet JSON avec les clés "consigne_systeme" (une consigne système de 1 à 3 phrases, {langue}, pour un assistant généraliste utile, honnête et précis ; formule-la à ta façon, sans parler de JSON) et "demandes" (la liste des 10 objets)."""


OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}


def evaluer(expr):
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool):
            return float(n.value)
        if isinstance(n, ast.BinOp) and type(n.op) in OPS:
            return OPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        raise ValueError("expression non permise")
    return ev(ast.parse(str(expr), mode="eval"))


def calcul_ok(d):
    try:
        v, dec, mode = evaluer(d["expression"]), int(d.get("decimales", 0)), d.get("arrondi", "aucun")
        f = 10 ** dec
        v = {"superieur": math.ceil(v * f - 1e-9) / f, "inferieur": math.floor(v * f + 1e-9) / f,
             "proche": round(v, dec)}.get(mode, v)
        return abs(v - float(d["resultat"])) <= max(0.5 * 10 ** -dec + 1e-9 if mode == "aucun" else 1e-6, 1e-6)
    except Exception:  # noqa: BLE001
        return False


def phase_1():
    sortie = os.path.join(TRAVAIL, "rappel_demandes.jsonl")
    faits = {d["lot"] for d in lire(sortie)}

    def un(l):
        if time.time() - DEBUT > LIMITE_S:
            return None
        for _ in range(3):
            try:
                r = appeler(8081, [{"role": "user", "content": consigne_r1(l)}], json_mode=True, max_tokens=4000,
                            temperature=0.9)
                d = json.loads(r["texte"])
                if isinstance(d.get("demandes"), list) and d["demandes"]:
                    return dict(l, consigne_systeme=d.get("consigne_systeme"), demandes=d["demandes"])
            except Exception as e:  # noqa: BLE001
                print("phase 1 :", repr(e)[:200], flush=True)
        return None

    t0 = time.time()
    en_parallele(un, [l for l in lots_r1() if l["lot"] not in faits], sortie, 8)
    print(f"phase 1 : {len(lire(sortie))} lots en {time.time() - t0:.0f} s", flush=True)


def demandes_r2():
    """Demandes à faire répondre par la base : messages (avec la consigne système du lot une fois sur deux)."""
    vues, out = set(), []
    for l in lire(os.path.join(TRAVAIL, "rappel_demandes.jsonl")):
        sys_ok = isinstance(l.get("consigne_systeme"), str) and 20 < len(l["consigne_systeme"]) < 600 and \
            "json" not in l["consigne_systeme"].lower()
        for i, d in enumerate(l["demandes"]):
            # Le professeur nomme parfois la clé autrement (13 nov. : « texte », « content », chaîne seule…).
            if isinstance(d, str):
                d = {"demande": d}
            elif isinstance(d, dict) and not isinstance(d.get("demande"), str):
                autre = next((d[k] for k in ("texte", "text", "content", "contenu", "value", "question", "prompt")
                              if isinstance(d.get(k), str)), None)
                d = dict(d, demande=autre) if autre else d
            if not isinstance(d, dict) or not isinstance(d.get("demande"), str) or len(d["demande"].strip()) < 5:
                continue
            cle = " ".join(d["demande"].lower().split())
            if cle in vues or "json" in cle:
                continue
            if l["categorie"] == "calcul" and not calcul_ok(d):
                continue
            vues.add(cle)
            msgs = [{"role": "user", "content": d["demande"].strip()}]
            if sys_ok and rnd.random() < 0.5:
                msgs.insert(0, {"role": "system", "content": l["consigne_systeme"].strip()})
            out.append({"id": f"{l['lot']}#{i}", "categorie": l["categorie"], "domaine": l["domaine"],
                        "langue": l["langue"], "verif": {k: v for k, v in d.items() if k not in (
                            "demande", "texte", "text", "content", "contenu", "value", "question", "prompt")},
                        "messages": msgs})
    return out


# --- Phase 2 : la base répond deux fois --------------------------------------------------------------------------
def phase_2(demandes):
    sortie = os.path.join(TRAVAIL, "rappel_reponses.jsonl")
    faits = {d["id"] for d in lire(sortie)}

    def une(x):
        k, d = x
        if time.time() - DEBUT > LIMITE_S:
            return None
        rep = []
        for _ in range(2):
            try:  # réglages conseillés par Qwen pour le mode sans réflexion
                rep.append(appeler(8091 + k % 2, d["messages"], max_tokens=1500, temperature=0.7, top_p=0.8, top_k=20))
            except Exception as e:  # noqa: BLE001
                rep.append({"texte": "", "erreur": repr(e)[:200]})
        return dict(d, reponses=rep)

    t0 = time.time()
    en_parallele(une, [(k, d) for k, d in enumerate(demandes) if d["id"] not in faits], sortie, 16)
    print(f"phase 2 : {len(lire(sortie))} demandes en {time.time() - t0:.0f} s", flush=True)


# --- Phase 3 : le professeur note ---------------------------------------------------------------------------------
def consigne_r3(d):
    v = d["verif"]
    ref = ""
    if d["categorie"] == "calcul":
        ref = f"Résultat attendu (vérifié) : {v.get('resultat')} {v.get('unite', '')} (calcul : {v.get('expression')}, arrondi : {v.get('arrondi')}).\n"
    elif d["categorie"] == "consignes":
        ref = f"Contraintes de forme à respecter : {json.dumps(v.get('contraintes'), ensure_ascii=False)}.\n"
    elif d["categorie"] == "raisonnement" and v.get("reponse_attendue"):
        ref = f"Réponse attendue : {v['reponse_attendue']}.\n"
    sysm = next((m["content"] for m in d["messages"] if m["role"] == "system"), None)
    reps = "\n\n".join(f"RÉPONSE {c}\n{r.get('texte', '')}\nFIN DE LA RÉPONSE {c}"
                       for c, r in zip("AB", d["reponses"]))
    return f"""Tu évalues les réponses d'un petit assistant. Note chaque réponse de 1 à 5 :
5 = juste, complète, suit toutes les consignes, bien rédigée, dans la langue de la demande, longueur adaptée ;
4 = juste et utile, défauts mineurs de forme ;
3 = utilisable mais avec une imprécision ou un oubli ;
2 = erreur notable, consigne non suivie ou langue incorrecte ;
1 = fausse, hors sujet, incohérente ou répétitive.
Toute erreur de calcul ou de fait, tout résultat différent du résultat attendu, toute contrainte de forme non respectée donne 2 au plus.
{('Consigne système donnée à l’assistant : ' + sysm + chr(10)) if sysm else ''}DEMANDE
{d['messages'][-1]['content']}
FIN DE LA DEMANDE
{ref}
{reps}

Réponds uniquement par un objet JSON : {{"A": {{"note": n, "defaut": "le principal défaut en quelques mots, ou vide"}}, "B": {{"note": n, "defaut": "..."}}}}."""


def phase_3():
    sortie = os.path.join(TRAVAIL, "rappel_jugement.jsonl")
    faits = {d["id"] for d in lire(sortie)}

    def une(d):
        if time.time() - DEBUT > LIMITE_S:
            return None
        if not any(r.get("texte") for r in d["reponses"]):
            return dict(d, jugement=None)
        for _ in range(2):
            try:
                r = appeler(8081, [{"role": "user", "content": consigne_r3(d)}], json_mode=True, max_tokens=300,
                            temperature=0.2)
                return dict(d, jugement=json.loads(r["texte"]))
            except Exception as e:  # noqa: BLE001
                print("phase 3 :", repr(e)[:200], flush=True)
        return dict(d, jugement=None)

    t0 = time.time()
    en_parallele(une, [d for d in lire(os.path.join(TRAVAIL, "rappel_reponses.jsonl")) if d["id"] not in faits], sortie, 8)
    print(f"phase 3 : {len(lire(sortie))} jugements en {time.time() - t0:.0f} s", flush=True)


# Reprise : sorties d'un passage précédent jointes en jeu de données (les phases déjà faites sont sautées).
for f in ("rappel_demandes.jsonl", "rappel_reponses.jsonl", "rappel_jugement.jsonl"):
    prec = glob.glob(f"/kaggle/input/**/{f}", recursive=True)
    if prec and not os.path.exists(os.path.join(TRAVAIL, f)):
        shutil.copy(prec[0], os.path.join(TRAVAIL, f))
        print(f"reprise : {f} ({len(lire(prec[0]))} lignes)", flush=True)
prof = os.environ["RAPPEL_PROF"] if TEST else hf_hub_download(PROF_DEPOT, PROF_FICHIER, cache_dir=os.path.join(TMP, "hf"))
print(f"professeur téléchargé en {time.time() - DEBUT:.0f} s", flush=True)
p = lancer(prof, 8081, 8, 8192, nom="serveur-professeur-1")
phase_1()
arreter(p)
demandes = demandes_r2()[:4 if TEST else None]
print(f"{len(demandes)} demandes retenues pour la base", flush=True)
b1 = lancer(BASE, 8091, 8, 4096, gpus="0", nom="serveur-base-0")
b2 = lancer(BASE, 8092, 8, 4096, gpus="1", nom="serveur-base-1")
phase_2(demandes)
arreter(b1, b2)
p = lancer(prof, 8081, 8, 8192, nom="serveur-professeur-3")
phase_3()
arreter(p)
print(f"fin après {time.time() - DEBUT:.0f} s", flush=True)
