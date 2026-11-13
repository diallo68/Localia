"""Fiches de la v2 pour la phase A du professeur : une fiche par document sélectionné (selectionner.py).

La fiche contient la « vue du professeur » : le texte du document page par page, avec les numéros de page tels
que Localia les donne (« Page N » = position dans le fichier). Un document trop long est coupé : premières pages,
puis pages du milieu tirées au hasard, puis dernières pages, dans la limite de VUE_MAX caractères ; les pages
montrées sont notées, pour que les questions d'extraction portent seulement sur elles.

Chaque fiche porte aussi le plan de ses demandes (types et langues), tiré au hasard avec une graine fixe, pour
atteindre la composition du plan (§5.2) : demandes globales, extraction avec page, abstention ou réponse partielle,
rédaction sous contrainte. Environ 15 % des demandes sont dans l'autre langue que le document.

Usage : python3 -I fabriquer_fiches.py <dossier_sources> <sortie.jsonl> [--max N] [--sauf fiches_deja.jsonl]
         [--plan globale:1.6,extraction:0.8,contrainte:1.0] [--graine N] [--prefixe c-]
         [--domaines a,b] [--sauf-domaines a,b]
(--plan, --graine, --prefixe : complément du 14 nov., mêmes documents, autres demandes ; le préfixe distingue les
identifiants de fiche de ceux de l'étape 1.)
"""
import json
import os
import random
import sys

VUE_MAX = 36000  # caractères, environ 12 000 jetons : la fiche entière tient dans le contexte du professeur
PAGE_MAX = 6000  # une page plus longue est coupée dans la vue (tableaux mal lus, pages de références)
rnd = random.Random(20261112)

# Nombre de demandes par fiche et par type [supposé] : environ 1 050 documents × 4 demandes ≈ 4 200 demandes, soit
# environ 3 000 exemples gardés au taux de l'essai du 12 nov. (68 %).
PLAN = [("globale", 1.4), ("extraction", 0.8), ("abstention", 0.45), ("contrainte", 0.55), ("partielle", 0.8)]


def vue(pages):
    pages = [{"number": p["number"], "text": " ".join(p["text"].split())[:PAGE_MAX]} for p in pages]
    if sum(len(p["text"]) for p in pages) <= VUE_MAX:
        return pages
    debut, fin = pages[:4], pages[-2:]
    milieu = pages[4:-2]
    rnd.shuffle(milieu)
    choisies, total = list(debut + fin), sum(len(p["text"]) for p in debut + fin)
    for p in milieu:
        if total + len(p["text"]) > VUE_MAX:
            continue
        choisies.append(p)
        total += len(p["text"])
    return sorted(choisies, key=lambda p: p["number"])


def nombre(moyenne):
    return int(moyenne) + (rnd.random() < moyenne - int(moyenne))


def main():
    sources, sortie = sys.argv[1], sys.argv[2]
    opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d  # noqa: E731
    maxi = int(opt("--max")) if opt("--max") else None
    plan = [(k, float(v)) for k, v in (x.split(":") for x in opt("--plan").split(","))] if opt("--plan") else PLAN
    if opt("--graine"):
        rnd.seed(int(opt("--graine")))
    prefixe = opt("--prefixe", "")
    domaines = set(opt("--domaines").split(",")) if opt("--domaines") else None
    sauf_domaines = set(opt("--sauf-domaines").split(",")) if opt("--sauf-domaines") else set()
    sauf = set()
    if "--sauf" in sys.argv:  # fiches déjà traitées (essai)
        sauf = {json.loads(l)["fiche"] for l in open(sys.argv[sys.argv.index("--sauf") + 1], encoding="utf-8")}
    docs = [json.loads(l) for l in open(os.path.join(sources, "selection.jsonl"), encoding="utf-8")]
    docs = [d for d in docs if d["id"] not in sauf and (domaines is None or d["domaine"] in domaines)
            and d["domaine"] not in sauf_domaines]
    rnd.shuffle(docs)
    n = 0
    with open(sortie, "w", encoding="utf-8") as f:
        for d in docs[:maxi]:
            lu = json.load(open(os.path.join(sources, "pages", d["id"] + ".json"), encoding="utf-8"))
            v = vue(lu["pages"])
            demandes = []
            for t, moy in plan:
                for _ in range(nombre(moy)):
                    autre = rnd.random() < 0.15
                    demandes.append({"type": t, "langue": ({"fr": "en", "en": "fr"}[d["langue"]] if autre else d["langue"])})
            if not demandes:
                demandes = [{"type": "globale", "langue": d["langue"]}]
            f.write(json.dumps({"fiche": prefixe + d["id"], "doc": d["id"], "domaine": d["domaine"], "langue_doc": d["langue"], "titre": d["titre"],
                                "nb_pages": len(lu["pages"]), "pages_vues": [p["number"] for p in v],
                                "vue": v, "demandes": demandes}, ensure_ascii=False) + "\n")
            n += 1
    print(f"{n} fiches -> {sortie}")


if __name__ == "__main__":
    main()
