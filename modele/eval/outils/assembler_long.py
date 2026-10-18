"""Jeu « contexte long » : les cas d'extraction et de citation du jeu de développement, posés sur un seul
document long qui réunit les fiches du jeu de développement et des fiches Service-Public de remplissage.

Un seul document par longueur : tous les cas partagent le même préfixe (document), ce qui permet au
serveur de réutiliser la lecture d'un cas à l'autre si son cache le permet. Les cas d'abstention, de
synthèse et d'incohérence sont écartés : une autre fiche du document long pourrait y répondre.
Les fiches du jeu secret ne sont jamais utilisées comme remplissage (exclusions-entrainement.txt).

Usage : python -I assembler_long.py <dossier_dev> <fiches_remplissage/> <exclusions.txt> <tokenizer.json>
        <sortie/> --jetons 16000 [--graine 1] [--eviter F14043,F34110]
Écrit <sortie>/cas.jsonl (préfixe L) et <sortie>/documents/long.md.
"""
import argparse
import json
import os
import random

from tokenizers import Tokenizer

CATS = ("extraction", "citation")


def main():
    ap = argparse.ArgumentParser()
    for n in ("dev", "remplissage", "exclusions", "tokenizer", "sortie"):
        ap.add_argument(n)
    ap.add_argument("--jetons", type=int, required=True)
    ap.add_argument("--graine", type=int, default=1)
    ap.add_argument("--eviter", default="", help="fiches de remplissage à écarter (sujet trop proche d'une cible)")
    a = ap.parse_args()

    tok = Tokenizer.from_file(a.tokenizer)
    n_jetons = lambda s: len(tok.encode(s, add_special_tokens=False).ids)  # noqa: E731
    exclus = set()
    for l in open(a.exclusions, encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#"):
            exclus.add(l.removeprefix("dev:").removeprefix("sp-"))
    exclus |= {f for f in a.eviter.split(",") if f}

    cas = [json.loads(l) for l in open(os.path.join(a.dev, "cas.jsonl"), encoding="utf-8")]
    cas = [c for c in cas if c["cat"] in CATS]
    cibles = sorted({c["doc"] for c in cas})
    textes = {d: open(os.path.join(a.dev, "documents", d + ".md"), encoding="utf-8").read().strip() for d in cibles}
    total = sum(n_jetons(t) for t in textes.values())
    # Trop long avec toutes les fiches du jeu de développement : on garde les premières qui tiennent dans 70 %.
    while total > 0.7 * a.jetons and len(cibles) > 1:
        retiree = cibles.pop()
        total -= n_jetons(textes.pop(retiree))
    cas = [c for c in cas if c["doc"] in textes]

    rnd = random.Random(a.graine)
    candidats = sorted(f for f in os.listdir(a.remplissage) if f.endswith(".md") and f[:-3] not in exclus)
    rnd.shuffle(candidats)
    morceaux = list(textes.items())
    for f in candidats:
        if total >= a.jetons:
            break
        t = open(os.path.join(a.remplissage, f), encoding="utf-8").read().strip()
        n = n_jetons(t)
        if total + n > a.jetons * 1.03:
            continue
        morceaux.append(("sp-" + f[:-3], t))
        total += n
    rnd.shuffle(morceaux)
    corps = "\n\n".join(f"===== Fiche {i + 1} =====\n\n{t}" for i, (_, t) in enumerate(morceaux))

    os.makedirs(os.path.join(a.sortie, "documents"), exist_ok=True)
    open(os.path.join(a.sortie, "documents", "long.md"), "w", encoding="utf-8").write(corps + "\n")
    with open(os.path.join(a.sortie, "cas.jsonl"), "w", encoding="utf-8") as s:
        for c in cas:
            c = dict(c, id="L" + c["id"][1:], doc="long", doc_origine=c["doc"])
            s.write(json.dumps(c, ensure_ascii=False, sort_keys=True) + "\n")
    ordre = [d for d, _ in morceaux]
    print(f"{a.sortie} : {n_jetons(corps)} jetons, {len(morceaux)} fiches, {len(cas)} cas ; "
          f"position des fiches cibles : {[ordre.index(d) + 1 for d in textes]}")
    json.dump({"fiches": ordre, "cibles": list(textes)}, open(os.path.join(a.sortie, "composition.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
