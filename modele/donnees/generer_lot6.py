"""Lot 6 (étape 3.2) : réponses de l'élève vérifiées (échantillonnage avec rejet).

Le modèle retenu (lot 4, dans Ollama) répond N fois, à température 0,8, à des questions d'application (lot 4) et de
tableau (lot 5) dont le résultat a déjà été vérifié (réponse du professeur gardée par verifier.py). Les réponses de
l'élève sont écrites au format de phase B, puis contrôlées par verifier.py avec les mêmes règles que celles du
professeur ; seules les justes servent à l'entraînement. Aucun texte de Claude : questions et consignes système
viennent du professeur, réponses de l'élève.

Usage : python3 -I generer_lot6.py <sortie_phase_b.jsonl> --phase-b a.jsonl [b.jsonl ...] --gardes ex1.jsonl [ex2 ...]
        [--n-questions 300] [--n 4] [--modele localia-doc-2b-lot4] [--graine 6]
"""
import argparse
import json
import os
import random
import time
import urllib.request

OLLAMA = "http://127.0.0.1:11434/api/chat"


def demande_de(user):
    return user.partition("\n\n---\n\nDemande : ")[2]


def appeler(modele, systeme, user, graine):
    corps = {"model": modele, "stream": False, "think": False,
             "messages": [{"role": "system", "content": systeme}, {"role": "user", "content": user}],
             "options": {"temperature": 0.8, "top_p": 0.95, "num_ctx": 8192, "num_predict": 900, "seed": graine}}
    req = urllib.request.Request(OLLAMA, data=json.dumps(corps).encode(), headers={"Content-Type": "application/json"})
    r = json.loads(urllib.request.urlopen(req, timeout=1800).read())
    return {"texte": r["message"]["content"], "fin": "length" if r.get("done_reason") == "length" else "stop",
            "jetons": r.get("eval_count"), "duree_s": round(r.get("total_duration", 0) / 1e9, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("--phase-b", nargs="+", required=True)
    ap.add_argument("--gardes", nargs="+", required=True, help="exemples.jsonl de verifier.py (réponses du professeur gardées)")
    ap.add_argument("--n-questions", type=int, default=300)
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--modele", default="localia-doc-2b-lot4")
    ap.add_argument("--graine", type=int, default=6)
    a = ap.parse_args()

    gardees = set()
    for chemin in a.gardes:
        for l in open(chemin, encoding="utf-8"):
            e = json.loads(l)
            if e["type"] in ("application", "tableau"):
                gardees.add((e["fiche"], demande_de(e["messages"][1]["content"])))
    taches = [t for chemin in a.phase_b for t in map(json.loads, open(chemin, encoding="utf-8"))
              if t["type"] in ("application", "tableau") and (t["fiche"], t["demande"]) in gardees]
    rnd = random.Random(a.graine)
    rnd.shuffle(taches)
    # Autant d'application que de tableau : sans cela, le tableau (374 gardées contre 250) dominerait.
    par_type = {ty: [t for t in taches if t["type"] == ty] for ty in ("application", "tableau")}
    taches = par_type["application"][:a.n_questions // 2] + par_type["tableau"][:a.n_questions - a.n_questions // 2]
    rnd.shuffle(taches)
    faits = set()
    if os.path.exists(a.sortie):
        faits = {(x["fiche"], x["demande"], x["essai"]) for x in map(json.loads, open(a.sortie, encoding="utf-8"))}
    t0 = time.time()
    with open(a.sortie, "a", encoding="utf-8") as s:
        for i, t in enumerate(taches):
            user = f"Document :\n\n{t['document']}\n\n---\n\nDemande : {t['demande']}"
            for k in range(a.n):
                if (t["fiche"], t["demande"], k) in faits:
                    continue
                try:
                    rep = appeler(a.modele, t["systeme"], user, a.graine * 1000 + k)
                except Exception as e:
                    rep = {"texte": "", "erreur": repr(e)}
                x = {kk: v for kk, v in t.items() if kk != "reponse"}
                x.update(reponse=rep, essai=k, eleve=a.modele, reflexion=False)
                s.write(json.dumps(x, ensure_ascii=False) + "\n")
                s.flush()
            if i % 10 == 0:
                print(f"{i + 1}/{len(taches)} questions en {time.time() - t0:.0f} s", flush=True)
    print(f"fini en {time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
