"""Lot 6 (étape 3.2) : lot 5 rééquilibré, plus les réponses justes de l'élève.

- Lot 5 repris tel quel, sauf les incohérences éloignées, ramenées au nombre de fausses alertes éloignées : le lot 5
  en avait 175 contre 123, et répondait « il y a une contradiction » sur des passages cohérents dans les conditions
  de Localia (fausses alertes 0,43). Le lot 4, à parts égales, n'avait pas ce défaut.
- Réponses de l'élève gardées par verifier.py (application, tableau) : au plus N_PAR_QUESTION par question, pour ne pas
  donner trop de poids aux questions que l'élève réussit déjà à chaque essai. Elles s'ajoutent à la réponse du
  professeur à la même question, déjà dans le lot 5. Champ « source » : « eleve ».
- Avec --verdicts (juger_francais.py), les réponses de l'élève jugées fautives sont écartées avant le tirage.
- Ordre mélangé (graine fixe) ; rapport par type sur la sortie standard.

Usage : python3 -I assembler_lot6.py <sortie.jsonl> <exemples-lot5.jsonl> <eleve-exemples.jsonl> [...] [--verdicts v.jsonl] [--graine 6]
"""
import argparse
import collections
import json
import random

N_PAR_QUESTION = 2


def cle(ex):  # même clé que juger_francais.py (python3 -I n'importe pas depuis le dossier du script)
    return f"{ex['fiche']}|{ex['messages'][1]['content'][-200:]}|{ex['messages'][2]['content'][:200]}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("lot5")
    ap.add_argument("eleve", nargs="+")
    ap.add_argument("--verdicts")
    ap.add_argument("--graine", type=int, default=6)
    a = ap.parse_args()
    rnd = random.Random(a.graine)

    lot5 = [json.loads(l) for l in open(a.lot5, encoding="utf-8")]
    loin = [ex for ex in lot5 if ex["type"] == "incoherence_loin"]
    n_fa = sum(ex["type"] == "fausse_alerte_loin" for ex in lot5)
    rnd.shuffle(loin)
    retires = {id(ex) for ex in loin[n_fa:]}
    exemples = [ex for ex in lot5 if id(ex) not in retires]

    fautives = set()
    if a.verdicts:
        fautives = {v["cle"] for v in map(json.loads, open(a.verdicts, encoding="utf-8")) if v["verdict"] == "FAUTE"}
    par_question = collections.defaultdict(list)
    n_fautives = 0
    for chemin in a.eleve:
        for l in open(chemin, encoding="utf-8"):
            ex = json.loads(l)
            if cle(ex) in fautives:
                n_fautives += 1
                continue
            par_question[(ex["fiche"], ex["messages"][1]["content"])].append(ex)
    n_eleve = 0
    for question in sorted(par_question):
        reponses = par_question[question]
        rnd.shuffle(reponses)
        for ex in reponses[:N_PAR_QUESTION]:
            exemples.append(dict(ex, source="eleve"))
            n_eleve += 1

    rnd.shuffle(exemples)
    with open(a.sortie, "w", encoding="utf-8") as s:
        for ex in exemples:
            s.write(json.dumps(ex, ensure_ascii=False) + "\n")
    c = collections.Counter(ex["type"] + (" (élève)" if ex.get("source") == "eleve" else "") for ex in exemples)
    print(f"{len(exemples)} exemples -> {a.sortie} ; {len(retires)} incohérences éloignées retirées, "
          f"{n_eleve} réponses de l'élève sur {len(par_question)} questions ({n_fautives} écartées pour le français)")
    for k, v in c.most_common():
        print(f"  {k} : {v}")


if __name__ == "__main__":
    main()
