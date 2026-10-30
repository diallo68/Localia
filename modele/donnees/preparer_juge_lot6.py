"""Lot 6 (étape 3.2) : prépare les réponses justes de l'élève pour le professeur juge (juge_lot6_kaggle.py).

verifier.py ne contrôle que la présence du résultat : relues à la main, environ 3 réponses gardées sur 8 avaient un
raisonnement faux (« 6 mois après le 15 février » donnant le 1er août, un « supplément de 12 € » inventé). Pour
chaque réponse gardée de l'élève, on joint ce qui a été vérifié : la règle ou la ligne du tableau, le résultat, le
calcul (phase A), et la réponse du professeur gardée par verifier.py pour la même question, comme référence.

Usage : python3 -I preparer_juge_lot6.py <sortie.jsonl> --lots resultats/lot4a resultats/lot4b resultats/lot5a
        --eleve resultats/lot6
        python3 -I preparer_juge_lot6.py <verdicts-assemblage.jsonl> --convertir <a_juger.jsonl> <verdicts.jsonl>
La seconde forme traduit les verdicts du professeur au format de juger_francais.py, que lit assembler_lot6.py :
PROPRE si le raisonnement est juste et le français correct, FAUTE sinon (ou si le verdict manque).
"""
import argparse
import json
import os


def cle_question(fiche, user):
    return fiche, user.partition("\n\n---\n\nDemande : ")[2]


def cle(fiche, document, demande, reponse):  # même clé que juger_francais.py
    user = f"Document :\n\n{document}\n\n---\n\nDemande : {demande}"
    return f"{fiche}|{user[-200:]}|{reponse[:200]}"


def convertir(sortie, a_juger, verdicts):
    v = {x["id"]: x.get("verdict") for x in map(json.loads, open(verdicts, encoding="utf-8"))}
    n = {"PROPRE": 0, "FAUTE": 0}
    with open(sortie, "w", encoding="utf-8") as s:
        for t in map(json.loads, open(a_juger, encoding="utf-8")):
            d = v.get(t["id"]) or {}
            ok = d.get("raisonnement_juste") is True and d.get("francais_correct") is True
            n["PROPRE" if ok else "FAUTE"] += 1
            s.write(json.dumps({"cle": cle(t["fiche"], t["document"], t["demande"], t["reponse"]),
                                "verdict": "PROPRE" if ok else "FAUTE", "professeur": d}, ensure_ascii=False) + "\n")
    print(n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("--convertir", nargs=2, metavar=("A_JUGER", "VERDICTS"))
    ap.add_argument("--lots", nargs="+")
    ap.add_argument("--eleve")
    a = ap.parse_args()
    if a.convertir:
        return convertir(a.sortie, *a.convertir)
    n = 0
    with open(a.sortie, "w", encoding="utf-8") as s:
        for dossier in a.lots:
            lot = os.path.basename(dossier.rstrip("/"))
            reference = {}
            for ex in map(json.loads, open(os.path.join(dossier, "verif", "exemples.jsonl"), encoding="utf-8")):
                if ex["type"] in ("application", "tableau"):
                    reference[cle_question(ex["fiche"], ex["messages"][1]["content"])] = ex["messages"][2]["content"]
            phase_a = {}
            for t in map(json.loads, open(os.path.join(a.eleve, f"eleve-{lot}.jsonl"), encoding="utf-8")):
                phase_a[(t["fiche"], t["demande"], t["reponse"]["texte"].strip())] = t["application"]
            for ex in map(json.loads, open(os.path.join(a.eleve, f"verif-{lot}", "exemples.jsonl"), encoding="utf-8")):
                fiche, demande = cle_question(ex["fiche"], ex["messages"][1]["content"])
                reponse = ex["messages"][2]["content"]
                s.write(json.dumps({"id": f"{lot}-{n:04d}", "fiche": fiche, "type": ex["type"],
                                    "document": ex["messages"][1]["content"].partition("Document :\n\n")[2].partition(
                                        "\n\n---\n\nDemande : ")[0],
                                    "demande": demande, "verifie": phase_a[(fiche, demande, reponse)],
                                    "reference": reference[(fiche, demande)], "reponse": reponse},
                                   ensure_ascii=False) + "\n")
                n += 1
    print(f"{n} réponses à juger -> {a.sortie}")


if __name__ == "__main__":
    main()
