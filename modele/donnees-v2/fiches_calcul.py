"""Fiches de la v2 pour le calcul sur document et les incohérences (plan §5.2), phase A du professeur.

Documents : ceux de la sélection (selectionner.py) de 30 000 caractères au plus (le document entier tient dans le
contexte de Localia, donc toutes ses pages sont transmises) et riches en nombres.
Demandes par document :
- "calcul" (3) : le professeur écrit une question de calcul à partir des nombres du document, avec les opérandes
  (texte exact et page), l'expression et le résultat ; tout est revérifié par programme (appliquer_calcul.py) ;
- deux demandes parmi :
  - "alteree" : le professeur choisit un fait chiffré page X et écrit une phrase qui le reprend ; le programme
    insère cette phrase page Y avec une valeur changée (incohérence insérée, position connue) ;
  - "saine" : même chose, phrase insérée avec la bonne valeur (autant de cas sans problème, contre les fausses
    alertes ; le document contient lui aussi une phrase ajoutée, seul le chiffre diffère) ;
  - "injection" : le professeur écrit une phrase adressée à une IA, insérée ensuite dans une page par le programme,
    et une question normale sur le document.

Usage : python3 -I fiches_calcul.py <dossier_sources> <sortie.jsonl> [--calcul 3] [--reprise] [--graine N] [--prefixe c-]
(--reprise : complément du 14 nov., une seule demande « reprise » par document, altérée 60 % ou saine 40 %, sans
injection ; le préfixe distingue les identifiants de fiche.)
"""
import collections
import json
import os
import random
import re
import sys

CAR_MAX = 30000
NOMBRES_MIN = 25
rnd = random.Random(20261113)
NOMBRE = re.compile(r"(?<![\w.,])(\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?![\w]|[.,]\d)")


def valeur(tok):
    t = re.sub(r"[   ]", "", tok)
    return float(t.replace(",", ".")) if t.count(",") + t.count(".") <= 1 else None


def significatif(tok):
    v = valeur(tok)
    chiffres = len(re.sub(r"\D", "", tok))
    return v is not None and chiffres >= 3 and v >= 10 and not re.fullmatch(r"(1[89]|20)\d\d", tok)


def ecrire_comme(tok, v):
    """Nouvelle valeur écrite dans le même format que tok (séparateur de milliers, décimales)."""
    sep_mil = next((c for c in "   " if c in tok), None)
    dec = "," if "," in tok else "." if "." in tok else None
    nd = len(re.split(r"[.,]", tok)[1]) if dec else 0
    s = f"{v:.{nd}f}"
    ent, _, fr = s.partition(".")
    if sep_mil:
        ent = f"{int(ent):,}".replace(",", sep_mil)
    return ent + (dec + fr if dec else "")


def alterer(tok, toks_doc):
    v = valeur(tok)
    for _ in range(20):
        f = rnd.choice([rnd.uniform(0.55, 0.85), rnd.uniform(1.2, 1.7)])
        nv = v * f
        if "," not in tok and "." not in tok:
            nv = round(nv)
        nouveau = ecrire_comme(tok, nv)
        if nouveau != tok and nouveau not in toks_doc and valeur(nouveau) != v:
            return nouveau
    return None


def main():
    sources, sortie = sys.argv[1], sys.argv[2]
    opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d  # noqa: E731
    n_calcul, prefixe = int(opt("--calcul", 3)), opt("--prefixe", "")
    if opt("--graine"):
        rnd.seed(int(opt("--graine")))
    docs = [json.loads(l) for l in open(os.path.join(sources, "selection.jsonl"), encoding="utf-8")]
    rnd.shuffle(docs)
    n, bilan = 0, collections.Counter()
    with open(sortie, "w", encoding="utf-8") as f:
        for d in docs:
            pages = json.load(open(os.path.join(sources, "pages", d["id"] + ".json"), encoding="utf-8"))["pages"]
            pages = [{"number": p["number"], "text": " ".join(p["text"].split())} for p in pages]
            if sum(len(p["text"]) for p in pages) > CAR_MAX:
                continue
            toks = [m.group(1) for p in pages for m in NOMBRE.finditer(p["text"])]
            if sum(1 for t in toks if len(re.sub(r"\D", "", t)) >= 2) < NOMBRES_MIN:
                continue
            autre = lambda: {"fr": "en", "en": "fr"}[d["langue"]] if rnd.random() < 0.15 else d["langue"]  # noqa: E731
            demandes = [{"type": "calcul", "langue": autre()} for _ in range(n_calcul)]
            cycle = ["alteree", "saine", "injection"]
            k = n % 3
            choix = ([("alteree" if rnd.random() < 0.6 else "saine")] if "--reprise" in sys.argv
                     else (cycle[k], cycle[(k + 1) % 3]))
            for t in choix:
                x = {"type": t, "langue": autre()}
                if t != "injection":
                    x["page_insertion"] = rnd.choice([p["number"] for p in pages]) if len(pages) > 1 else None
                    if x["page_insertion"] is None:
                        x = {"type": "injection", "langue": x["langue"]}
                demandes.append(x)
            for x in demandes:
                bilan[x["type"]] += 1
            f.write(json.dumps({"fiche": prefixe + d["id"], "doc": d["id"], "domaine": d["domaine"], "langue_doc": d["langue"], "titre": d["titre"],
                                "nb_pages": len(pages), "pages_vues": [p["number"] for p in pages], "vue": pages,
                                "demandes": demandes}, ensure_ascii=False) + "\n")
            n += 1
    print(f"{n} fiches -> {sortie}", dict(bilan))


if __name__ == "__main__":
    main()
