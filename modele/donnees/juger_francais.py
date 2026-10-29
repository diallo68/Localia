"""Lot 6 (étape 3.2) : relecture du français des réponses de l'élève, avant l'assemblage.

verifier.py contrôle le résultat, pas la langue : des réponses justes mais fautives (« le requalification »,
« valid en tant que CDD ») passaient, et l'entraînement sur ses propres fautes renforcerait celles de l'élève.
Juge : Qwen3 8B (Apache 2.0) dans Ollama, sans réflexion, température 0, un seul mot (FAUTE ou PROPRE). Il ne fait
que trier : aucun texte du juge n'entre dans l'entraînement.

Usage : python3 -I juger_francais.py <verdicts.jsonl> <exemples.jsonl> [...] [--modele qwen3:8b]
Reprend là où il s'était arrêté (verdicts déjà écrits).
"""
import argparse
import json
import os
import time
import urllib.request

OLLAMA = "http://127.0.0.1:11434/api/chat"
CONSIGNE = ("Tu relis des textes en français. Réponds par un seul mot : FAUTE si le texte contient au moins une faute de "
            "grammaire, d'accord, de conjugaison, d'orthographe, un mot anglais ou une tournure incorrecte ; PROPRE sinon. "
            "Ignore la mise en forme (gras, listes) et les nombres.")


def cle(ex):
    return f"{ex['fiche']}|{ex['messages'][1]['content'][-200:]}|{ex['messages'][2]['content'][:200]}"


def juger(modele, texte):
    corps = {"model": modele, "stream": False, "think": False,
             "messages": [{"role": "system", "content": CONSIGNE}, {"role": "user", "content": "Texte :\n\n" + texte}],
             "options": {"temperature": 0, "num_predict": 5, "num_ctx": 4096}}
    req = urllib.request.Request(OLLAMA, data=json.dumps(corps).encode(), headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=900).read())["message"]["content"].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("entrees", nargs="+")
    ap.add_argument("--modele", default="qwen3:8b")
    a = ap.parse_args()
    faits = set()
    if os.path.exists(a.sortie):
        faits = {json.loads(l)["cle"] for l in open(a.sortie, encoding="utf-8")}
    exemples = [json.loads(l) for chemin in a.entrees for l in open(chemin, encoding="utf-8")]
    t0 = time.time()
    with open(a.sortie, "a", encoding="utf-8") as s:
        for i, ex in enumerate(exemples):
            if cle(ex) in faits:
                continue
            v = juger(a.modele, ex["messages"][2]["content"])
            s.write(json.dumps({"cle": cle(ex), "verdict": "FAUTE" if "FAUTE" in v.upper() else "PROPRE", "brut": v},
                               ensure_ascii=False) + "\n")
            s.flush()
            if i % 25 == 0:
                print(f"{i + 1}/{len(exemples)} en {time.time() - t0:.0f} s", flush=True)
    print(f"fini en {time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
