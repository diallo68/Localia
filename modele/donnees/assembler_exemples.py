"""Réunit les exemples vérifiés de plusieurs lots en un jeu d'entraînement.

- Un seul exemple par (fiche, type) : la version produite avec réflexion du professeur est préférée. Exception :
  les types de TYPES_MULTIPLES (plusieurs cas concrets par fiche) gardent un exemple par demande.
- Les fausses alertes (« le document est cohérent ») sont plafonnées à PART_FAUSSE_ALERTE du nombre d'incohérences
  gardées, pour ne pas apprendre au modèle à tout déclarer cohérent.
- Ordre mélangé (graine fixe) ; rapport par type sur la sortie standard.

Usage : python3 -I assembler_exemples.py <sortie.jsonl> <exemples.jsonl> [<exemples.jsonl> ...] [--graine 1]
"""
import argparse
import collections
import json
import random

PART_FAUSSE_ALERTE = 1.0
TYPES_MULTIPLES = {"application", "tableau"}  # lots 4 et 5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("entrees", nargs="+")
    ap.add_argument("--graine", type=int, default=1)
    a = ap.parse_args()
    rnd = random.Random(a.graine)
    choisis = {}
    for chemin in a.entrees:
        for l in open(chemin, encoding="utf-8"):
            ex = json.loads(l)
            cle = (ex["fiche"], ex["type"])
            if ex["type"] in TYPES_MULTIPLES:  # plusieurs cas concrets par fiche : un exemple par demande
                cle += (ex["messages"][-2]["content"],)
            if cle not in choisis or (ex.get("reflexion_professeur") and not choisis[cle].get("reflexion_professeur")):
                choisis[cle] = ex
    exemples = list(choisis.values())
    rnd.shuffle(exemples)
    n_inc = sum(ex["type"] == "incoherence" for ex in exemples)
    plafond = int(PART_FAUSSE_ALERTE * n_inc)
    garde, n_fa = [], 0
    for ex in exemples:
        if ex["type"] == "fausse_alerte":
            if n_fa >= plafond:
                continue
            n_fa += 1
        garde.append(ex)
    with open(a.sortie, "w", encoding="utf-8") as s:
        for ex in garde:
            s.write(json.dumps(ex, ensure_ascii=False) + "\n")
    c = collections.Counter(ex["type"] for ex in garde)
    print(f"{len(garde)} exemples ({len(exemples)} après dédoublonnage) -> {a.sortie}")
    for k, v in c.most_common():
        print(f"  {k} : {v}")


if __name__ == "__main__":
    main()
