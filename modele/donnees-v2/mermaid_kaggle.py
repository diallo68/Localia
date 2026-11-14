# Localia, Dial-bowe v2 : exemples de SCHÉMAS en Mermaid (accord de l'auteur du 14 nov. 2026), sur Kaggle
# (2 × T4, llama.cpp CUDA). Localia dessine les blocs ```mermaid``` des réponses ; Dial-bowe v1 dessinait en
# caractères (boucles) et se trompait sur les circuits de base. Deux sortes de demandes :
# - « schema » : organigramme, étapes, séquence, cycle, schéma-bloc, états, dans les métiers de Localia ;
# - « circuit » : circuits de base dont le câblage juste est connu par programme (CIRCUITS) ; il est donné au
#   professeur comme indication (jamais dans les exemples) et revérifié sur le Mac (verifier_mermaid.cjs).
# Trois phases, chacune reprise si le noyau est relancé :
# 1. le professeur (Qwen3.6-35B-A3B, Apache 2.0) écrit les demandes par lots de 10, et une consigne système qui
#    dit que les schémas s'écrivent en Mermaid (Localia les dessine) ;
# 2. le professeur répond (avec réflexion ; seule la réponse finale est gardée) ;
# 3. le professeur note la justesse de chaque réponse (1 à 5).
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
# Essai sur le Mac (MERMAID_TEST=<dossier>, MERMAID_PROF : fichier GGUF du professeur) : un lot par sorte.
TEST = os.environ.get("MERMAID_TEST")
TRAVAIL = TEST or "/kaggle/working"
TMP = TEST or ("/kaggle/tmp" if os.path.isdir("/kaggle/tmp") else "/tmp")
LIMITE_S = 11 * 3600
DEBUT = time.time()
rnd = random.Random(20261116)


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



# --- Catalogue des circuits : câblage juste (composant, nœud, nœud) ; e = entrée, s = sortie, m = masse,
# x = nœud intérieur. Plusieurs câblages possibles : tous acceptés au Mac. ----------------------------------------
CIRCUITS = {
    "rc-passe-bas": ("filtre passe-bas RC du premier ordre", [[("R", "e", "s"), ("C", "s", "m")]]),
    "cr-passe-haut": ("filtre passe-haut RC (CR) du premier ordre", [[("C", "e", "s"), ("R", "s", "m")]]),
    "rl-passe-bas": ("filtre passe-bas RL du premier ordre", [[("L", "e", "s"), ("R", "s", "m")]]),
    "lr-passe-haut": ("filtre passe-haut RL du premier ordre", [[("R", "e", "s"), ("L", "s", "m")]]),
    "rlc-passe-bande": ("filtre passe-bande RLC série (sortie aux bornes de R)",
                        [[("L", "e", "x"), ("C", "x", "s"), ("R", "s", "m")],
                         [("C", "e", "x"), ("L", "x", "s"), ("R", "s", "m")]]),
    "rlc-coupe-bande": ("filtre coupe-bande (réjecteur) : R en série, L et C en série vers la masse",
                        [[("R", "e", "s"), ("L", "s", "x"), ("C", "x", "m")],
                         [("R", "e", "s"), ("C", "s", "x"), ("L", "x", "m")]]),
    "rlc-passe-bas-2": ("filtre passe-bas RLC du second ordre (R et L en série, C vers la masse)",
                        [[("R", "e", "x"), ("L", "x", "s"), ("C", "s", "m")],
                         [("L", "e", "x"), ("R", "x", "s"), ("C", "s", "m")]]),
    "diviseur": ("pont diviseur de tension à deux résistances", [[("R", "e", "s"), ("R", "s", "m")]]),
}
NOMS_NOEUDS = {"e": "l'entrée Ve", "s": "la sortie Vs", "m": "la masse", "x": "un nœud intermédiaire"}
NOMS_COMPOSANTS = {"R": "une résistance R", "C": "un condensateur C", "L": "une bobine L"}


def indication(circuit):
    """Câblage juste, en clair, pour le professeur seul."""
    lignes = [f"- {NOMS_COMPOSANTS[c]} entre {NOMS_NOEUDS[a]} et {NOMS_NOEUDS[b]}" for c, a, b in CIRCUITS[circuit][1][0]]
    return "\n".join(lignes)


# --- Phase 1 : demandes écrites par le professeur ----------------------------------------------------------------
DOMAINES = {
    "enseignement": "enseignement et éducation", "recherche": "recherche scientifique et études supérieures",
    "agriculture": "agriculture et élevage", "communication": "communication et médias",
    "ingenierie": "ingénierie, électronique, énergie, maintenance", "sante": "santé publique et prévention (non clinique)",
    "administration": "administration et démarches", "entreprise": "entreprise, gestion de projet, commerce",
}
SORTES = {  # nombre de lots de 10 demandes
    "organigramme": 4, "etapes": 4, "sequence": 3, "cycle": 3, "bloc": 4, "etats": 2,
}
CONSIGNE_SORTE = {
    "organigramme": "un organigramme de procédure avec au moins une décision (oui / non) : démarche administrative, contrôle qualité, diagnostic de panne, traitement d'une demande",
    "etapes": "les étapes d'une méthode ou d'un protocole : étude scientifique, projet, expérience, analyse de données, rédaction d'un article",
    "sequence": "un diagramme de séquence : échanges entre plusieurs acteurs (client, serveur, service, agent, patient, fournisseur…)",
    "cycle": "un cycle : cycle de vie d'un organisme, cycle de culture, cycle de l'eau, cycle d'un produit, d'un projet",
    "bloc": "un schéma-bloc d'un système technique : chaîne de mesure, alimentation électrique, réseau, chaîne de traitement du signal ou des données",
    "etats": "un diagramme d'états : statut d'un dossier, d'une commande, d'une machine, d'un appareil",
}
if TEST:
    SORTES = {"organigramme": 1}


def lots_m1():
    lots = []
    for sorte, n in SORTES.items():
        for k in range(n):
            lots.append({"lot": f"{sorte}-{k}", "sorte": sorte, "domaine": rnd.choice(list(DOMAINES)),
                         "langue": "fr" if rnd.random() < 0.7 else "en"})
    for circuit in (list(CIRCUITS)[:1] if TEST else CIRCUITS):
        lots.append({"lot": f"circuit-{circuit}", "sorte": "circuit", "circuit": circuit,
                     "domaine": "ingenierie", "langue": "fr" if rnd.random() < 0.7 else "en"})
    return lots


def consigne_m1(l):
    langue = "en français" if l["langue"] == "fr" else "en anglais"
    if l["sorte"] == "circuit":
        objet = (f"qui demandent le schéma d'un {CIRCUITS[l['circuit']][0]} : certaines le nomment simplement "
                 "(« schéma d'un filtre passe-bas »), d'autres précisent les composants, d'autres donnent des valeurs "
                 "(résistance en ohms, condensateur en nF ou µF, bobine en mH) et demandent aussi la fréquence de "
                 "coupure ou de résonance")
        theme = "électronique (étudiants, techniciens, enseignants)"
    else:
        objet = f"qui demandent un schéma : {CONSIGNE_SORTE[l['sorte']]}"
        theme = DOMAINES[l["domaine"]]
    return f"""Tu prépares des exemples d'entraînement pour un petit assistant. Écris 10 demandes différentes, rédigées {langue}, que des utilisateurs réels pourraient lui adresser, {objet}.

Thème : {theme}. Varie les tournures, la longueur (de quelques mots à quelques phrases), le niveau de langue (y compris des fautes de frappe), le sujet précis ; chaque demande se suffit à elle-même et contient les informations nécessaires.

Réponds uniquement par un objet JSON avec les clés "consigne_systeme" et "demandes".
- "consigne_systeme" : une consigne système de 2 à 4 phrases, {langue}, pour un assistant utile, honnête et précis, qui dise que les schémas s'écrivent en Mermaid dans un bloc ```mermaid``` (l'application les dessine) et jamais en caractères ; formule-la à ta façon, sans parler de JSON.
- "demandes" : la liste des 10 demandes (chaînes)."""


def phase_1():
    sortie = os.path.join(TRAVAIL, "mermaid_demandes.jsonl")
    faits = {d["lot"] for d in lire(sortie)}

    def un(l):
        if time.time() - DEBUT > LIMITE_S:
            return None
        for _ in range(3):
            try:
                r = appeler(8081, [{"role": "user", "content": consigne_m1(l)}], json_mode=True, max_tokens=3000,
                            temperature=0.9)
                d = json.loads(r["texte"])
                if (isinstance(d.get("demandes"), list) and d["demandes"] and isinstance(d.get("consigne_systeme"), str)
                        and "mermaid" in d["consigne_systeme"].lower()):
                    return dict(l, consigne_systeme=d["consigne_systeme"], demandes=d["demandes"])
            except Exception as e:  # noqa: BLE001
                print("phase 1 :", repr(e)[:200], flush=True)
        return None

    t0 = time.time()
    en_parallele(un, [l for l in lots_m1() if l["lot"] not in faits], sortie, 8)
    print(f"phase 1 : {len(lire(sortie))} lots en {time.time() - t0:.0f} s", flush=True)


def demandes_m2():
    vues, out = set(), []
    for l in lire(os.path.join(TRAVAIL, "mermaid_demandes.jsonl")):
        sysm = l["consigne_systeme"].strip()
        if not 30 < len(sysm) < 800 or "json" in sysm.lower() or "mermaid" not in sysm.lower():
            continue
        for i, d in enumerate(l["demandes"]):
            if isinstance(d, dict):
                d = next((d[k] for k in ("demande", "texte", "text", "content", "question") if isinstance(d.get(k), str)), None)
            if not isinstance(d, str) or len(d.strip()) < 5:
                continue
            cle = " ".join(d.lower().split())
            if cle in vues or "json" in cle:
                continue
            vues.add(cle)
            out.append({"id": f"m-{l['lot']}#{i}", "sorte": l["sorte"], "circuit": l.get("circuit"),
                        "domaine": l["domaine"], "langue": l["langue"],
                        "messages": [{"role": "system", "content": sysm}, {"role": "user", "content": d.strip()}]})
    return out


# --- Phase 2 : le professeur répond --------------------------------------------------------------------------------
def messages_m2(d):
    """Messages de l'exemple ; pour un circuit, le câblage juste est ajouté pour le professeur seul."""
    msgs = [dict(m) for m in d["messages"]]
    consignes = ("Pour le schéma : un seul bloc ```mermaid``` (flowchart), lisible, avec des libellés courts ; "
                 "ne mets pas de lignes « style ». Explique brièvement le schéma en dehors du bloc.")
    if d["sorte"] == "circuit":
        consignes += (f"\nCâblage juste du circuit demandé (indication pour toi seul : ne la cite pas, ne dis pas "
                      f"qu'on te l'a donnée) :\n{indication(d['circuit'])}\n"
                      "Dans le Mermaid, chaque composant est un nœud (« R[Résistance R] »), l'entrée, la sortie et la "
                      "masse sont des nœuds (une seule masse, une seule sortie), et un nœud intermédiaire est un "
                      "nœud à part (« N1(( )) ») ; chaque composant est relié aux deux nœuds entre lesquels il est "
                      "branché, et jamais directement à un autre composant. Si des valeurs sont données et une "
                      "fréquence demandée, écris le calcul complet avec la formule.")
    msgs[0] = {"role": "system", "content": msgs[0]["content"] + "\n\n" + consignes}
    return msgs


def phase_2(demandes):
    sortie = os.path.join(TRAVAIL, "mermaid_reponses.jsonl")
    faits = {d["id"] for d in lire(sortie)}

    def une(d):
        if time.time() - DEBUT > LIMITE_S:
            return None
        try:
            corps = messages_m2(d)
            r = appeler_reflexion(corps)
            return dict(d, reponse=r)
        except Exception as e:  # noqa: BLE001
            return dict(d, reponse={"texte": "", "erreur": repr(e)[:200]})

    t0 = time.time()
    en_parallele(une, [d for d in demandes if d["id"] not in faits], sortie, 6)
    print(f"phase 2 : {len(lire(sortie))} réponses en {time.time() - t0:.0f} s", flush=True)


def appeler_reflexion(messages):
    """Réponse avec réflexion (réglages conseillés par Qwen) ; seule la réponse finale est gardée."""
    corps = {"messages": messages, "temperature": 0.6, "top_p": 0.95, "top_k": 20,
             "max_tokens": 1500 if TEST else 8000, "chat_template_kwargs": {"enable_thinking": True}}
    req = urllib.request.Request("http://127.0.0.1:8081/v1/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=3600) as r:
        rep = json.loads(r.read())
    m = rep["choices"][0]["message"]
    return {"texte": m.get("content") or "", "fin": rep["choices"][0].get("finish_reason"),
            "jetons": rep.get("usage", {}).get("completion_tokens")}


# --- Phase 3 : le professeur note la justesse ------------------------------------------------------------------------
def consigne_m3(d):
    ref = f"Câblage juste attendu :\n{indication(d['circuit'])}\n" if d["sorte"] == "circuit" else ""
    return f"""Tu évalues la réponse d'un assistant à qui l'on a demandé un schéma (écrit en Mermaid). Note de 1 à 5 :
5 = schéma juste et complet pour la demande, explication juste et claire, dans la langue de la demande ;
4 = juste, défauts mineurs (libellé maladroit, détail manquant sans importance) ;
3 = utilisable mais avec un oubli ou une imprécision ;
2 = erreur de fond (étape fausse ou dans le mauvais ordre, composant mal branché, calcul faux), ou consigne non suivie ;
1 = faux, hors sujet, ou schéma absent.
Toute erreur de fond donne 2 au plus.
{ref}DEMANDE
{d['messages'][-1]['content']}
FIN DE LA DEMANDE

RÉPONSE
{d['reponse'].get('texte', '')}
FIN DE LA RÉPONSE

Réponds uniquement par un objet JSON : {{"note": n, "defaut": "le principal défaut en quelques mots, ou vide"}}."""


def phase_3():
    sortie = os.path.join(TRAVAIL, "mermaid_jugement.jsonl")
    faits = {d["id"] for d in lire(sortie)}

    def une(d):
        if time.time() - DEBUT > LIMITE_S:
            return None
        if not d["reponse"].get("texte"):
            return dict(d, jugement=None)
        for _ in range(2):
            try:
                r = appeler(8081, [{"role": "user", "content": consigne_m3(d)}], json_mode=True, max_tokens=300,
                            temperature=0.2)
                return dict(d, jugement=json.loads(r["texte"]))
            except Exception as e:  # noqa: BLE001
                print("phase 3 :", repr(e)[:200], flush=True)
        return dict(d, jugement=None)

    t0 = time.time()
    en_parallele(une, [d for d in lire(os.path.join(TRAVAIL, "mermaid_reponses.jsonl")) if d["id"] not in faits],
                 sortie, 8)
    print(f"phase 3 : {len(lire(sortie))} jugements en {time.time() - t0:.0f} s", flush=True)


for f in ("mermaid_demandes.jsonl", "mermaid_reponses.jsonl", "mermaid_jugement.jsonl"):
    prec = glob.glob(f"/kaggle/input/**/{f}", recursive=True)
    if prec and not os.path.exists(os.path.join(TRAVAIL, f)):
        shutil.copy(prec[0], os.path.join(TRAVAIL, f))
        print(f"reprise : {f} ({len(lire(prec[0]))} lignes)", flush=True)
prof = os.environ["MERMAID_PROF"] if TEST else hf_hub_download(PROF_DEPOT, PROF_FICHIER, cache_dir=os.path.join(TMP, "hf"))
print(f"professeur téléchargé en {time.time() - DEBUT:.0f} s", flush=True)
p = lancer(prof, 8081, 2 if TEST else 6, 6144 if TEST else 12288,  # Kaggle : même mémoire que professeur_v2
           nom="serveur-professeur")                                # (3 × 24 576) ; essai : Mac Intel 16 Go
phase_1()
demandes = demandes_m2()[:3 if TEST else None]
print(f"{len(demandes)} demandes retenues", flush=True)
phase_2(demandes)
phase_3()
arreter(p)
print(f"fin après {time.time() - DEBUT:.0f} s", flush=True)
