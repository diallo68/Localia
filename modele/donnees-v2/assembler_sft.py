"""Dial-bowe v2 : assemble le lot SFT à partir des exemples vérifiés (étapes 1 et 2, complément).

Rôle : réunir les fichiers d'exemples, écarter les doublons (mêmes messages) et tout exemple tiré d'un document des jeux
d'évaluation v2 (eval/exclusions-entrainement-v2.txt, contrôle par identifiant ; les 13-grammes restent à passer
ensuite avec donnees/decontaminer.py), appliquer les plafonds par groupe de types (plan §5.2), mélanger et écrire
le lot avec un relevé (types, langues, domaines, longueur des réponses).

Les plafonds se donnent groupe par groupe : --plafond abstention=500 ; un groupe absent n'est pas plafonné.
Le tirage sous un plafond garde la proportion FR/EN du groupe (graine fixe).

Usage : python3 -I assembler_sft.py <sortie.jsonl> <releve.json> <exemples.jsonl ...> [--plafond groupe=N ...]
        [--exclusions eval/exclusions-entrainement-v2.txt] [--simulation]
"""
import argparse
import collections
import hashlib
import json
import os
import random
import re
import statistics

# Groupes du plan §5.2 (le type de chaque exemple → sa ligne du tableau).
GROUPES = {
    "globale": "globale",
    "extraction": "extraction",
    "calcul": "calcul",
    "partielle": "abstention", "abstention": "abstention",
    "contrainte": "contrainte",
    "injection": "incoherence", "alteree": "incoherence", "saine": "incoherence",
    "web": "web", "web-saine": "web", "web-alteree": "web", "web-absent": "web",
}
CIBLES = {"globale": 1500, "extraction": 800, "calcul": 800, "abstention": 500, "contrainte": 600,
          "incoherence": 400, "web": 300, "rappel": 1500}
GRAINE = 20261114


def groupe(t):
    return "rappel" if t.startswith("rappel") else GROUPES.get(t, "autre:" + t)


def document(ex):
    """Identifiant du document source : préfixe de l'id, plus les noms cités dans « Document : x.pdf »."""
    ids = {ex["id"].split("#")[0]}
    for m in ex["messages"]:
        if m["role"] == "user":
            ids.update(re.findall(r"Document : ([^\n]+?)\.(?:pdf|md|txt|docx|html)\b", m["content"]))
    return ids


def exclusions(chemin):
    ex = set()
    for ligne in open(chemin, encoding="utf-8"):
        if ligne.strip() and not ligne.startswith("#"):
            ex.add(ligne.split("\t")[0].strip())
    return ex


def mots(s):
    return len(s.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("releve")
    ap.add_argument("entrees", nargs="+")
    ap.add_argument("--plafond", nargs="*", default=[])
    ap.add_argument("--exclusions", default=os.path.join(os.path.dirname(__file__), "..", "eval",
                                                         "exclusions-entrainement-v2.txt"))
    ap.add_argument("--simulation", action="store_true", help="relevé seulement, rien n'est écrit")
    a = ap.parse_args()
    plafonds = {g: int(n) for g, n in (p.split("=") for p in a.plafond)}
    interdits = exclusions(a.exclusions)

    vus, tous, ecartes = set(), [], collections.Counter()
    for f in a.entrees:
        for ligne in open(f, encoding="utf-8"):
            if not ligne.strip():
                continue
            ex = json.loads(ligne)
            # Les identifiants « document#k » se répètent d'une étape à l'autre pour des tâches différentes :
            # le doublon se juge sur le contenu des messages.
            cle = hashlib.sha256(json.dumps(ex["messages"], ensure_ascii=False).encode()).hexdigest()
            if cle in vus:
                ecartes["doublon (mêmes messages)"] += 1
                continue
            if document(ex) & interdits:
                ecartes["document d'évaluation"] += 1
                continue
            if ex["messages"][-1]["role"] != "assistant" or not ex["messages"][-1]["content"].strip():
                ecartes["sans réponse"] += 1
                continue
            vus.add(cle)
            tous.append(ex)

    par_groupe = collections.defaultdict(list)
    for ex in tous:
        par_groupe[groupe(ex["type"])].append(ex)
    rnd = random.Random(GRAINE)
    lot, avant = [], {}
    for g, L in sorted(par_groupe.items()):
        avant[g] = len(L)
        n = plafonds.get(g)
        if n is not None and len(L) > n:
            # Tirage stratifié par langue : chaque langue garde sa part du groupe.
            par_l = collections.defaultdict(list)
            for ex in L:
                par_l[ex["langue"]].append(ex)
            garde = []
            for lg, M in sorted(par_l.items()):
                rnd.shuffle(M)
                garde += M[:round(n * len(M) / len(L))]
            L = garde
        lot += L
    rnd.shuffle(lot)

    def compte(cle):
        return dict(collections.Counter(cle(x) for x in lot).most_common())
    n = len(lot)
    longueurs = collections.defaultdict(list)
    for x in lot:
        longueurs[groupe(x["type"])].append(mots(x["messages"][-1]["content"]))
    releve = {
        "exemples": n,
        "écartés": dict(ecartes),
        "plafonds": plafonds,
        "par_groupe": {g: {"avant": avant[g], "gardés": len(longueurs[g]), "cible du plan": CIBLES.get(g),
                           "part": round(len(longueurs[g]) / n, 3),
                           "mots de la réponse (médiane, min, max)": [int(statistics.median(longueurs[g])),
                                                                      min(longueurs[g]), max(longueurs[g])]}
                       for g in sorted(longueurs)},
        "par_type": compte(lambda x: x["type"]),
        "langues": {k: round(v / n, 3) for k, v in compte(lambda x: x["langue"]).items()},
        "domaines": compte(lambda x: x.get("domaine")),
    }
    print(json.dumps(releve, ensure_ascii=False, indent=1))
    if a.simulation:
        return
    with open(a.sortie, "w", encoding="utf-8") as s:
        for x in lot:
            s.write(json.dumps(x, ensure_ascii=False) + "\n")
    json.dump(releve, open(a.releve, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
