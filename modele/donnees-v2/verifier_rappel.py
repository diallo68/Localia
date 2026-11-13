"""Tri des exemples de rappel (rappel_kaggle.py) : pour chaque demande, on garde au plus une des deux réponses de la
base, la mieux notée par le professeur, si :
- note ≥ 4 ;
- réponse terminée, sans balise de réflexion, dans la langue de la demande ;
- chaque égalité écrite est juste (verify.js de Localia) ;
- calcul : le résultat attendu (vérifié par programme) figure dans la réponse ;
- consignes : contraintes de forme vérifiées par programme (mêmes règles que verifier_v2.py).

Usage : python3 -I verifier_rappel.py <rappel_jugement.jsonl> <exemples-rappel.jsonl> [rapport.json]
"""
import collections
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from verifier_v2 import calculs_localia, contient_valeur, contraintes_ok, v2  # noqa: E402

NOTE_MIN = 4


def defauts(d, r, note, calculs):
    out = []
    t = (r.get("texte") or "").strip()
    if not t or r.get("erreur"):
        return ["réponse vide"]
    if r.get("fin") == "length":
        out.append("réponse coupée")
    if "<think>" in t or "</think>" in t:
        out.append("réflexion dans la réponse")
    if not isinstance(note, (int, float)) or note < NOTE_MIN:
        out.append(f"note {note}")
    lang = v2.langue_de(v2.nettoyer(t))
    if lang and lang != d["langue"]:
        out.append("autre langue")
    if any(not c["ok"] for c in calculs):
        out.append("calcul faux")
    v = d["verif"]
    if d["categorie"] == "calcul":
        dec = int(v.get("decimales", 0))
        exact = v.get("arrondi") in ("superieur", "inferieur")
        if not contient_valeur(t, v["resultat"], dec, 0 if exact else 0.002):
            out.append("résultat attendu absent")
    if d["categorie"] == "consignes":
        res = contraintes_ok(v.get("contraintes") or {}, t)
        if not res:
            out.append("contraintes illisibles")
        out += [f"contrainte {k} non tenue" for k, ok in res.items() if not ok]
    return out


def main():
    lignes = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
    textes = {f"{d['id']}|{k}": r.get("texte") or "" for d in lignes for k, r in enumerate(d["reponses"])}
    calculs = calculs_localia(textes)
    gardes, par_cat, causes = 0, collections.defaultdict(collections.Counter), collections.Counter()
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        for d in lignes:
            j = d.get("jugement") or {}
            candidats = []
            for k, (c, r) in enumerate(zip("AB", d["reponses"])):
                note = (j.get(c) or {}).get("note") if isinstance(j, dict) else None
                defs = defauts(d, r, note, calculs.get(f"{d['id']}|{k}", []))
                for x in defs:
                    causes[x.split(" ")[0] if x.startswith("note") else x] += 1
                if not defs:
                    candidats.append((note, -k, r))
            if not candidats:
                par_cat[d["categorie"]]["rejeté"] += 1
                continue
            _, _, r = max(candidats, key=lambda c: (c[0], c[1]))
            par_cat[d["categorie"]]["gardé"] += 1
            gardes += 1
            out.write(json.dumps({"id": d["id"], "type": "rappel-" + d["categorie"], "domaine": d["domaine"],
                                  "langue": d["langue"],
                                  "messages": d["messages"] + [{"role": "assistant", "content": r["texte"].strip()}]},
                                 ensure_ascii=False) + "\n")
    rapport = {"gardés": gardes, "par_categorie": {k: dict(v) for k, v in par_cat.items()},
               "taux": {k: round(v["gardé"] / max(1, sum(v.values())), 2) for k, v in par_cat.items()},
               "causes (par réponse)": dict(causes.most_common())}
    print(json.dumps(rapport, ensure_ascii=False, indent=1))
    if len(sys.argv) > 3:
        json.dump(rapport, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
