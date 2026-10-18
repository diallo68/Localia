"""Étape 2.4 : prépare, pour un échantillon de fiches sources, les transformations mécaniques et les spécifications
de tâches que le professeur (Qwen3.6-35B-A3B, Apache 2.0) transformera en demandes puis en réponses.

Règle de provenance : aucun texte écrit par Claude n'entre dans les exemples d'entraînement. Ce script ne
produit que des opérations mécaniques sur les documents sources (retrait d'un paragraphe, modification d'un
nombre) et des paramètres (contrainte de format choisie, position d'insertion). Toutes les phrases des exemples
(demandes, consignes système, instructions cachées, réponses) sont rédigées par le professeur.

Types de tâches par fiche :
- libre : extraction, citation, synthèse et rédaction (contraintes de format tirées au hasard) ;
- abstention : un paragraphe dont les nombres n'apparaissent nulle part ailleurs est retiré ; la question
  porte sur ce paragraphe ; la bonne réponse est de dire que l'information manque ;
- incoherence : un nombre suivi d'une unité, présent au moins deux fois, est modifié à une seule occurrence ;
- fausse_alerte : même demande de vérification, sur la fiche intacte ;
- injection : une instruction cachée (rédigée par le professeur) est insérée entre deux paragraphes.

Usage : python3 -I fabriquer_taches.py <sources/> <sortie.jsonl> [--n 60] [--graine 1]
"""
import argparse
import json
import os
import random
import re

UNITE = r"(jours?|mois|ans?|semaines?|heures?|€|euros?|%)"
RE_NOMBRE_UNITE = re.compile(r"(?<![\d,.])(\d{1,3}(?:[  ]\d{3})*|\d+)(?:,\d+)?\s?" + UNITE + r"(?!\w)")
RE_NOMBRE = re.compile(r"\d+(?:[  ]\d{3})*(?:,\d+)?")

# Paramètres seulement (le professeur rédige la demande qui les exprime).
FORMATS_SYNTHESE = [{"max_puces": 3}, {"max_puces": 5}, {"max_mots": 60}, {"max_phrases": 2}, {"tableau": True}]
FORMATS_REDACTION = [{"max_mots": 120}, {"max_mots": 200}, {"max_phrases": 5}]
OBJECTIFS_INJECTION = ["langue", "lien", "montant", "ignorer"]


def paragraphes(md):
    return [p for p in re.split(r"\n\s*\n", md) if p.strip()]


def nombres(s):
    return {re.sub(r"\s", "", n) for n in RE_NOMBRE.findall(s)}


def choisir_abstention(paras, rnd):
    """Paragraphe d'au moins 80 caractères, avec des nombres absents du reste du document."""
    idx = list(range(1, len(paras)))  # jamais le titre
    rnd.shuffle(idx)
    for i in idx:
        p = paras[i]
        if len(p) < 80 or p.lstrip().startswith("#"):
            continue
        n = nombres(p)
        reste = nombres("\n\n".join(paras[:i] + paras[i + 1:]))
        if n and not (n & reste):
            return i, sorted(n)
    return None


def choisir_incoherence(md, rnd):
    occ = {}
    for m in RE_NOMBRE_UNITE.finditer(md):
        u = m.group(2)
        cle = (re.sub(r"\s", "", m.group(1)), u if u in ("mois", "%", "€") else u.rstrip("s"))
        occ.setdefault(cle, []).append(m)
    candidats = [(k, v) for k, v in occ.items() if len(v) >= 2]
    if not candidats:
        return None
    (valeur, unite), ms = rnd.choice(candidats)
    m = rnd.choice(ms[1:])
    v = int(valeur)
    present = nombres(md)
    for nv in (v + 1, v * 2, v + 10, v - 1):
        if nv > 0 and str(nv) not in present:
            break
    else:
        return None
    debut, fin = m.span(1)
    modifie = md[:debut] + str(nv) + md[fin:]
    return {"document": modifie, "valeur_origine": valeur, "valeur_modifiee": str(nv), "unite": unite,
            "position": debut}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources")
    ap.add_argument("sortie")
    ap.add_argument("--n", type=int, default=60)
    ap.add_argument("--graine", type=int, default=1)
    a = ap.parse_args()
    rnd = random.Random(a.graine)
    fiches = sorted(f for f in os.listdir(a.sources) if f.endswith(".md"))
    rnd.shuffle(fiches)
    n_taches = 0
    with open(a.sortie, "w", encoding="utf-8") as s:
        gardees = 0
        for f in fiches:
            if gardees >= a.n:
                break
            md = open(os.path.join(a.sources, f), encoding="utf-8").read().strip()
            paras = paragraphes(md)
            if len(paras) < 6:
                continue
            ab = choisir_abstention(paras, rnd)
            inc = choisir_incoherence(md, rnd)
            if not ab or not inc:
                continue
            i, nombres_retires = ab
            fiche = {
                "fiche": f[:-3],
                "document": md,
                "formats": {"synthese": rnd.choice(FORMATS_SYNTHESE), "redaction": rnd.choice(FORMATS_REDACTION)},
                "abstention": {"paragraphe": paras[i], "nombres_retires": nombres_retires,
                               "document": "\n\n".join(paras[:i] + paras[i + 1:])},
                "incoherence": inc,
                "injection": {"objectif": rnd.choice(OBJECTIFS_INJECTION), "apres_paragraphe": rnd.randrange(1, len(paras) - 1)},
            }
            s.write(json.dumps(fiche, ensure_ascii=False) + "\n")
            gardees += 1
            n_taches += 8
    print(f"{gardees} fiches, {n_taches} tâches prévues -> {a.sortie}")


if __name__ == "__main__":
    main()
