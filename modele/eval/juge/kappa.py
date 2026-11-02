"""Étape 3.6 : accord entre l'auteur (notes à l'aveugle) et le juge sur l'échantillon du contrôle humain.

κ de Cohen non pondéré sur les trois notes (0, 0,5, 1) : c'est lui qui décide (criteres.md, amendement du
2 novembre 2026) ; κ < 0,6, ou κ indéfini (une seule note utilisée), veut dire juge non fiable. Publiés à côté :
IC à 95 % de κ (bootstrap par document, 10 000 tirages, graine 0), κ pondéré (quadratique), accord brut, matrice de
confusion, écart signé juge − auteur par modèle et par catégorie, κ sur « affirmation non étayée », et les mêmes
chiffres entre l'auteur et la note automatique arrondie à la note la plus proche (0, 0,5, 1).

Usage : python3 -I kappa.py <echantillon.jsonl> <notes-humaines.json> <dossier du noyau du juge> [<notes auto>]
"""
import collections
import hashlib
import json
import math
import os
import random
import sys

NIVEAUX = (0.0, 0.5, 1.0)


def kappa(paires, poids=None):
    n = len(paires)
    w = poids or (lambda a, b: float(a != b))
    observe = sum(w(a, b) for a, b in paires) / n
    pa = collections.Counter(a for a, _ in paires)
    pb = collections.Counter(b for _, b in paires)
    attendu = sum(w(a, b) * pa[a] * pb[b] for a in NIVEAUX for b in NIVEAUX) / n / n
    return 1 - observe / attendu if attendu else float("nan")


def ic(paires, docs, tirages=10000):
    par_doc = collections.defaultdict(list)
    for p, d in zip(paires, docs):
        par_doc[d].append(p)
    blocs = list(par_doc.values())
    rnd = random.Random(0)
    k, degeneres = [], 0
    for _ in range(tirages):
        x = kappa([p for _ in blocs for p in rnd.choice(blocs)])
        if math.isnan(x):
            degeneres += 1
        else:
            k.append(x)
    k.sort()
    return k[int(0.025 * len(k))], k[int(0.975 * len(k))], degeneres


def rapport(nom, paires, docs):
    k = kappa(paires)
    bas, haut, deg = ic(paires, docs)
    print(f"\n== auteur / {nom} ({len(paires)} réponses, {len(set(docs))} documents)")
    print(f"  κ de Cohen (décisif) : {k:.3f} [IC 95 % {bas:.3f} ; {haut:.3f}, {deg} tirages dégénérés]"
          + ("  → indéfini : validation insuffisante" if math.isnan(k) else ""))
    print(f"  κ pondéré (quadratique) : {kappa(paires, lambda a, b: (a - b) ** 2):.3f}")
    print(f"  accord brut : {sum(a == b for a, b in paires) / len(paires):.1%} ; "
          f"désaccords d'un niveau {sum(abs(a - b) == 0.5 for a, b in paires)}, de deux {sum(abs(a - b) == 1 for a, b in paires)}")
    print(f"  auteur \\ {nom[:10]:10s}" + "".join(f"{b:>6}" for b in NIVEAUX) + "  total")
    for a in NIVEAUX:
        ligne = [sum(1 for x, y in paires if x == a and y == b) for b in NIVEAUX]
        print(f"  {a:>19}" + "".join(f"{n:6d}" for n in ligne) + f"{sum(ligne):7d}")
    print(f"  {'total':>19}" + "".join(f"{sum(1 for _, y in paires if y == b):6d}" for b in NIVEAUX))
    return k


def main():
    chemin_ech = sys.argv[1]
    echantillon = [json.loads(l) for l in open(chemin_ech, encoding="utf-8")]
    empreinte = hashlib.sha256(open(chemin_ech, "rb").read()).hexdigest()
    export = json.load(open(sys.argv[2], encoding="utf-8"))
    if export.get("empreinte") != empreinte:
        sys.exit("notes humaines d'un autre échantillon")
    humain = export["notes"]
    noyau = sys.argv[3]
    verdicts = {v["id"]: v for v in map(json.loads, filter(str.strip, open(os.path.join(noyau, "verdicts.jsonl"),
                                                                           encoding="utf-8")))}
    manque = [x["id"] for x in echantillon if humain.get(x["id"], {}).get("note") is None
              or humain[x["id"]].get("non_etayee") is None]
    if manque:
        sys.exit(f"{len(manque)} réponses sans note humaine complète")
    sans = [x["id"] for x in echantillon if not (verdicts.get(x["id"]) or {}).get("verdict")]
    if sans:
        sys.exit(f"{len(sans)} réponses sans verdict du juge")
    h = {x["id"]: float(humain[x["id"]]["note"]) for x in echantillon}
    j = {x["id"]: float(verdicts[x["id"]]["verdict"]["note"]) for x in echantillon}
    docs = [x["doc"] for x in echantillon]
    k = rapport("juge", [(h[x["id"]], j[x["id"]]) for x in echantillon], docs)
    for cle in ("modele", "cat"):
        groupes = collections.defaultdict(list)
        for x in echantillon:
            groupes[x[cle]].append(j[x["id"]] - h[x["id"]])
        print(f"\n  juge − auteur par {'modèle' if cle == 'modele' else 'catégorie'} (moyenne, accord) : "
              + ", ".join(f"{g} {sum(v) / len(v):+.2f} {sum(d == 0 for d in v)}/{len(v)}" for g, v in sorted(groupes.items())))
    ne = [(float(bool(humain[x["id"]]["non_etayee"])), float(verdicts[x["id"]]["verdict"]["affirmation_non_etayee"]))
          for x in echantillon]
    print(f"\n  affirmation non étayée : accord {sum(a == b for a, b in ne) / len(ne):.1%}, "
          f"auteur {sum(a for a, _ in ne):.0f} oui, juge {sum(b for _, b in ne):.0f} oui")
    if len(sys.argv) > 4:
        auto = {}
        for x in echantillon:
            d = json.load(open(os.path.join(sys.argv[4], f"note-{x['modele']}.json"), encoding="utf-8"))
            s = {y["id"]: y["score"] for y in d["details"]}[x["cas"]]
            auto[x["id"]] = min(NIVEAUX, key=lambda n: (abs(n - s), n))
        rapport("note automatique", [(h[x["id"]], auto[x["id"]]) for x in echantillon], docs)
    fiable = not math.isnan(k) and k >= 0.6
    print(f"\nDécision (criteres.md) : κ = {k:.3f} → " + ("juge fiable, niveau lu sur le S_doc du juge" if fiable
          else "juge non fiable, niveau de la note automatique, notes de l'auteur publiées"))


if __name__ == "__main__":
    main()
