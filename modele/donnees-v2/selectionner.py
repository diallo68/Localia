"""Sélection des documents d'entraînement de la v2 après lecture par Localia (extraire_pages.cjs).

Un document est gardé s'il :
- a été lu sans erreur, compte 2 à 120 pages et au moins 1 200 mots ;
- n'est pas un scan (au moins 80 mots par page en moyenne, moins de 30 % de pages vides) ;
- est bien dans la langue annoncée (mots outils français ou anglais) ;
- ne partage aucun passage avec un document d'évaluation (G, G-test, S2) : moins de 5 13-grammes de mots communs,
  sans compter les 13-grammes présents dans au moins 3 documents d'entraînement ou 3 documents d'évaluation (page de garde de HAL, mentions de
  licence, formules de la Banque mondiale : du gabarit, pas une fuite).
  Le rapport ne donne pour S2 que des identifiants et des nombres.

Usage : python3 -I selectionner.py <dossier_sources> <dossier_eval_v2>
Sortie : <dossier_sources>/selection.jsonl et selection-rapport.txt
"""
import collections
import json
import os
import re
import sys
import unicodedata

FR = {"le", "la", "les", "des", "est", "et", "une", "du", "que", "pour", "dans", "sur", "par", "pas", "qui", "il"}
EN = {"the", "and", "is", "of", "to", "in", "that", "for", "with", "are", "this", "it", "on", "by", "was", "be"}
N = 13
SEUIL_COMMUNS = 5


def mots(s):
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.findall(r"\w+", s)


def ngrammes(m):
    return {hash(" ".join(m[i:i + N])) for i in range(len(m) - N + 1)}


def texte(chemin):
    return " ".join(p["text"] for p in json.load(open(chemin, encoding="utf-8"))["pages"])


def main():
    sources, eval_v2 = sys.argv[1], sys.argv[2]
    eval_ng, eval_df = set(), collections.Counter()
    for jeu in ("G", "Gtest", "S2"):
        d = os.path.join(eval_v2, jeu, "pages")
        for f in os.listdir(d):
            if f.endswith(".json"):
                ng = ngrammes(mots(texte(os.path.join(d, f))))
                eval_ng |= ng
                eval_df.update(ng)
    man = {x["id"]: x for x in map(json.loads, open(os.path.join(sources, "manifeste.jsonl"), encoding="utf-8"))}
    stats = {}
    for x in map(json.loads, open(os.path.join(sources, "pages", "stats.jsonl"), encoding="utf-8")):
        stats[x["id"]] = x
    # Fréquence documentaire des 13-grammes d'entraînement, pour écarter le gabarit commun.
    ng_doc, df = {}, collections.Counter()
    for doc_id, st in stats.items():
        if doc_id in man and "erreur" not in st:
            ng_doc[doc_id] = ngrammes(mots(texte(os.path.join(sources, "pages", doc_id + ".json")))) & eval_ng
            df.update(ng_doc[doc_id])
    banals = {g for g, k in df.items() if k >= 3} | {g for g, k in eval_df.items() if k >= 3}
    gardes, rejets = [], collections.Counter()
    for doc_id, st in stats.items():
        m = man.get(doc_id)
        if not m:
            continue
        if "erreur" in st:
            rejets["erreur de lecture"] += 1
            continue
        if not 2 <= st["pages"] <= 120 or st["mots"] < 1200:
            rejets["trop court ou trop long"] += 1
            continue
        if st["mots"] / st["pages"] < 80 or st["vides"] / st["pages"] > 0.3:
            rejets["scan ou pages vides"] += 1
            continue
        t = mots(texte(os.path.join(sources, "pages", doc_id + ".json")))
        fr, en = sum(w in FR for w in t), sum(w in EN for w in t)
        if (fr > en) != (m["langue"] == "fr"):
            rejets["autre langue"] += 1
            continue
        communs = len(ng_doc[doc_id] - banals)
        if communs >= SEUIL_COMMUNS:
            rejets["passages communs avec l'évaluation"] += 1
            print(f"exclu (évaluation) : {doc_id}, {communs} 13-grammes communs")
            continue
        gardes.append({"id": doc_id, "source": m["source"], "domaine": m["domaine"], "langue": m["langue"],
                       "pages": st["pages"], "mots": st["mots"], "titre": m.get("titre", ""), "licence": m["licence"],
                       "url": m["url"], "communs_eval": communs})
    with open(os.path.join(sources, "selection.jsonl"), "w", encoding="utf-8") as f:
        for g in gardes:
            f.write(json.dumps(g, ensure_ascii=False) + "\n")
    lignes = [f"documents lus : {len(stats)} ; gardés : {len(gardes)} ; 13-grammes de gabarit ignorés : {len(banals)}", "rejets : " + json.dumps(rejets, ensure_ascii=False), ""]
    tab = collections.Counter((g["domaine"], g["langue"]) for g in gardes)
    for dom in sorted({g["domaine"] for g in gardes}):
        lignes.append(f"{dom:14s} fr {tab[(dom, 'fr')]:4d}  en {tab[(dom, 'en')]:4d}")
    src = collections.Counter(g["source"] for g in gardes)
    fr = sum(g["langue"] == "fr" for g in gardes)
    lignes += ["", "par source : " + json.dumps(src), f"français : {fr / max(1, len(gardes)):.0%}",
               f"mots : {sum(g['mots'] for g in gardes):,}".replace(",", " ")]
    open(os.path.join(sources, "selection-rapport.txt"), "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print("\n".join(lignes))


if __name__ == "__main__":
    main()
