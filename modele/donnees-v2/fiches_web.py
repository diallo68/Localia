"""Fiches de la v2 pour le type « pages Internet » (plan §5.2, 300 exemples), phase A du professeur.

Localia (interrupteur Internet, main.cjs : webSourcesBlock) met dans la consigne système jusqu'à 3 pages lues,
numérotées [1] [2] [3], chacune avec son titre, son adresse et 6 000 caractères de texte au plus. Faute de vraies
pages lues sur Internet (contenu sans licence connue), les « pages » sont des extraits des documents sous licence
ouverte déjà sélectionnés (selectionner.py), avec leur vraie adresse : un document principal et deux autres
documents du même domaine et de la même langue, dans un ordre tiré au hasard.

Demandes par fiche (3) :
- "web" : question tapée avec Internet allumé, dont la réponse est dans une ou plusieurs pages ;
- "reprise" (web-alteree 60 %, web-saine 40 %) : le professeur choisit un fait chiffré d'une page [n] et écrit une
  phrase qui le reprend ; le programme (appliquer_web.py) l'insère dans une autre page [m], avec une valeur changée
  (sources contradictoires) ou la même (sources concordantes) ;
- "web-absent" (40 %) ou un second "web" (60 %) : question du même sujet à laquelle aucune page ne répond.

Usage : python3 -I fiches_web.py <dossier_sources> <sortie.jsonl> [--max 200] [--graine N]
"""
import collections
import json
import os
import random
import re
import sys

TEXTE_MAX = 6000  # comme Localia (renderer.js : gatherWebSources)
TEXTE_MIN = 1500
rnd = random.Random(20261114)


def extrait(pages):
    """Pages consécutives tirées au hasard, jusqu'à TEXTE_MAX caractères (une page web est un texte continu)."""
    pages = [" ".join(p["text"].split()) for p in pages]
    # Pages de références écartées : leurs « [12] » se confondraient avec les numéros de sources [n].
    pages = [p for p in pages if len(p) > 200 and len(re.findall(r"\[\d{1,3}\]", p)) < 2
             and len(re.findall(r"et al\.|\b(?:19|20)\d\d\b", p)) < len(p) / 400
             and not re.match(r"\s*(r[ée]f[ée]rences|bibliograph|sources\b|notes\b)", p, re.I)]
    if not pages:
        return ""
    i = rnd.randrange(len(pages))
    morceaux, total = [], 0
    for p in pages[i:]:
        if total + len(p) > TEXTE_MAX:
            if not morceaux:
                morceaux.append(p[:TEXTE_MAX].rsplit(" ", 1)[0])
            break
        morceaux.append(p)
        total += len(p)
    return re.sub(r"\[(\d{1,3})\]", r"(\1)", "\n\n".join(morceaux))  # appels de note restants : ( ) au lieu de [ ]


def main():
    sources, sortie = sys.argv[1], sys.argv[2]
    opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d  # noqa: E731
    maxi = int(opt("--max", 200))
    if opt("--graine"):
        rnd.seed(int(opt("--graine")))
    docs = [json.loads(l) for l in open(os.path.join(sources, "selection.jsonl"), encoding="utf-8")]
    docs = [d for d in docs if d.get("titre") and d.get("url")]
    groupes = collections.defaultdict(list)
    for d in docs:
        groupes[(d["domaine"], d["langue"])].append(d)
    rnd.shuffle(docs)
    n, bilan = 0, collections.Counter()
    with open(sortie, "w", encoding="utf-8") as f:
        for d in docs:
            if n >= maxi:
                break
            autres = [x for x in groupes[(d["domaine"], d["langue"])] if x["id"] != d["id"]]
            if len(autres) < 2:
                continue
            choisis = [d] + rnd.sample(autres, 2)
            web = []
            for x in choisis:
                pages = json.load(open(os.path.join(sources, "pages", x["id"] + ".json"), encoding="utf-8"))["pages"]
                texte = extrait(pages)
                if len(texte) < TEXTE_MIN:
                    break
                web.append({"doc": x["id"], "title": x["titre"][:200], "url": x["url"], "text": texte})
            if len(web) < 3:
                continue
            rnd.shuffle(web)
            for k, w in enumerate(web):
                w["n"] = k + 1
            reprise = {"type": "web-alteree" if rnd.random() < 0.6 else "web-saine", "langue": d["langue"],
                       "source_insertion": rnd.randint(1, 3)}
            troisieme = "web-absent" if rnd.random() < 0.4 else "web"
            demandes = [{"type": "web", "langue": d["langue"]}, reprise, {"type": troisieme, "langue": d["langue"]}]
            for x in demandes:
                bilan[x["type"]] += 1
            f.write(json.dumps({"fiche": "web-" + d["id"], "web": web, "domaine": d["domaine"], "langue_doc": d["langue"],
                                "titre": d["titre"], "demandes": demandes}, ensure_ascii=False) + "\n")
            n += 1
    print(f"{n} fiches -> {sortie}", dict(bilan))


if __name__ == "__main__":
    main()
