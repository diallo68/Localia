"""Lot 5 : prépare les fiches de deux nouveaux types de tâches, ciblés sur les défauts du lot 4 mesurés sur dev2
(mauvaise ligne de tableau, calcul faux, contradiction éloignée non vue).

Opérations mécaniques seulement (aucun texte écrit par Claude n'entre dans les exemples) :
- tableau : la fiche contient au moins un tableau Markdown d'au moins 3 lignes chiffrées ; le professeur écrira
  des situations dont la réponse s'obtient avec une ligne précise du tableau ;
- loin : un nombre suivi d'une unité, présent au moins deux fois, est modifié à une seule occurrence, choisie à
  au moins PART_LOIN de la longueur du document d'une autre occurrence de la même valeur, dans une phrase qui parle
  de la même chose (PROXIMITE_MIN) ; les deux phrases
  (modifiée et d'origine) sont gardées pour la vérification et pour l'indice donné au professeur.

Les fiches du jeu secret et des jeux de développement (eval/exclusions-entrainement.txt) sont écartées par
preparer_sources.py, en amont, et de nouveau ici (dev2 a été constitué après le dossier des sources). Une fiche déjà utilisée dans un lot précédent peut servir ici : les types de tâches
sont nouveaux.

Usage : python3 -I fabriquer_lot5.py <sources/> <sortie.jsonl> --mode tableau|loin [--n 170] [--graine 5]
        [--exclure fiches.jsonl ...]
"""
import argparse
import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python3 -I n'ajoute pas le dossier du script
from fabriquer_taches import RE_NOMBRE_UNITE, nombres  # noqa: E402

PART_LOIN = 0.25
# Deux phrases qui ne parlent pas de la même chose (« 12 mois » d'ancienneté, « 12 mois » de validité) ne se
# contredisent pas quand l'une change : on exige qu'elles partagent au moins 30 % de leurs mots (relu à la main sur
# un échantillon : en dessous de 0,2, les paires ne sont presque jamais de vraies contradictions).
PROXIMITE_MIN = 0.3
EXCLUSIONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval", "exclusions-entrainement.txt")
RE_LIGNE_CHIFFREE = re.compile(r"^\|.*\d.*\|\s*$")


def tableaux(md):
    """Tableaux Markdown (texte du bloc) d'au moins 3 lignes de données chiffrées."""
    res, bloc = [], []
    for l in md.split("\n") + [""]:
        if l.startswith("|"):
            bloc.append(l)
            continue
        if bloc:
            donnees = [x for x in bloc if RE_LIGNE_CHIFFREE.match(x) and not re.fullmatch(r"[|\s:-]+", x)]
            if len(donnees) >= 3:
                res.append("\n".join(bloc))
        bloc = []
    return res


def phrase_autour(md, pos):
    debut = max(md.rfind("\n", 0, pos), md.rfind(". ", 0, pos) + 1)
    fin_l, fin_p = md.find("\n", pos), md.find(". ", pos)
    fin = min(x for x in (fin_l, fin_p + 1, len(md)) if x > 0)
    return md[debut:fin].strip()


def proximite(p, q):
    """Part des mots de 4 lettres ou plus communs aux deux phrases (indice de Jaccard)."""
    a, b = (set(re.findall(r"[a-zà-ÿ]{4,}", x.lower())) for x in (p, q))
    return len(a & b) / max(1, len(a | b))


def choisir_loin(md, rnd):
    occ = {}
    for m in RE_NOMBRE_UNITE.finditer(md):
        u = m.group(2)
        cle = (re.sub(r"\s", "", m.group(1)), u if u in ("mois", "%", "€") else u.rstrip("s"))
        occ.setdefault(cle, []).append(m)
    paires = []
    for (valeur, unite), ms in occ.items():
        for a in ms:
            for b in ms:
                if a is not b and abs(a.start() - b.start()) >= PART_LOIN * len(md) \
                        and proximite(phrase_autour(md, a.start()), phrase_autour(md, b.start())) >= PROXIMITE_MIN:
                    paires.append((valeur, unite, a, b))
    if not paires:
        return None
    valeur, unite, m, autre = rnd.choice(paires)
    v = int(valeur)
    present = nombres(md)
    # grands montants : doublés ou augmentés de moitié (150 000 € -> 300 000 €), plutôt que + 1
    essais = (v * 2, v + v // 2, v + 10) if v >= 100 else (v + 1, v * 2, v + 10, v - 1)
    for nv in essais:
        if nv > 0 and str(nv) not in present:
            break
    else:
        return None
    sep = re.search(r"\s", m.group(1))  # même séparateur de milliers que le document (espace ou insécable)
    texte_nv = f"{nv:,}".replace(",", sep.group(0)) if sep else str(nv)
    debut, fin = m.span(1)
    modifie = md[:debut] + texte_nv + md[fin:]
    return {"document": modifie, "valeur_origine": valeur, "valeur_modifiee": str(nv), "unite": unite,
            "position": debut, "phrase_modifiee": phrase_autour(modifie, debut), "phrase_origine": phrase_autour(md, debut),
            "autre_passage": phrase_autour(md, autre.start()),
            "distance": round(abs(m.start() - autre.start()) / len(md), 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources")
    ap.add_argument("sortie")
    ap.add_argument("--mode", choices=["tableau", "loin"], required=True)
    ap.add_argument("--n", type=int, default=170)
    ap.add_argument("--graine", type=int, default=5)
    ap.add_argument("--exclure", nargs="*", default=[], help="fiches à ne pas reprendre (autre mode du lot 5)")
    a = ap.parse_args()
    deja = {json.loads(l)["fiche"] for chemin in a.exclure for l in open(chemin, encoding="utf-8")}
    # le dossier des sources a été préparé avant dev2 : la liste d'exclusion est relue ici
    for l in open(EXCLUSIONS, encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#"):
            deja.add("sp-" + l.removeprefix("dev:").removeprefix("sp-"))
    rnd = random.Random(a.graine)
    fiches = sorted(f for f in os.listdir(a.sources) if f.endswith(".md"))
    rnd.shuffle(fiches)
    gardees = 0
    with open(a.sortie, "w", encoding="utf-8") as s:
        for f in fiches:
            if gardees >= a.n:
                break
            if f[:-3] in deja:
                continue
            md = open(os.path.join(a.sources, f), encoding="utf-8").read().strip()
            fiche = {"fiche": f[:-3], "document": md}
            if a.mode == "tableau":
                t = tableaux(md)
                if not t:
                    continue
                fiche["tableaux"] = t
            else:
                inc = choisir_loin(md, rnd)
                if not inc:
                    continue
                fiche["incoherence"] = inc
            s.write(json.dumps(fiche, ensure_ascii=False) + "\n")
            gardees += 1
    print(f"{gardees} fiches ({a.mode}) -> {a.sortie}")


if __name__ == "__main__":
    main()
