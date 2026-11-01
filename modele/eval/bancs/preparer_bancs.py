"""Étape 3.4 : questions des benchmarks publics français (criteres.md, section 2.3), pour la base et le modèle retenu.

Bancs : Belebele fra_Latn (900 QCM), FQuAD 2.0 (800 questions de l'échantillon FrenchBench, la moitié sans réponse),
IFEval d'origine en anglais (541 consignes ; IFEval-fr est mal annoté), MGSM fr (250 problèmes) et MMMLU FR-FR
(50 questions par matière, graine 0 : 2 850 sur 14 042). Sans réflexion (canal de réflexion fermé ; MGSM demande
quand même le raisonnement dans la réponse), réponse gloutonne (température 0), consigne de format en français, la
même pour les deux modèles. Une ligne par question : id, banc, groupe (pour le bootstrap par document), messages, max_tokens, attendu.

Avec --anglais : Belebele eng_Latn (900) et SQuAD 2.0 (800, validation, moitié sans réponse), consignes en anglais.

Usage : python3 -I preparer_bancs.py <dossier des fichiers téléchargés> <sortie.jsonl> [--anglais]
"""
import csv
import json
import os
import random
import sys

import pandas as pd

LETTRES = "ABCD"


def belebele(d):
    for l in open(os.path.join(d, "belebele-fra_Latn.jsonl"), encoding="utf-8"):
        x = json.loads(l)
        choix = "\n".join(f"{i}. {x[f'mc_answer{i}']}" for i in range(1, 5))
        yield {"id": f"belebele-{x['link']}-{x['question_number']}", "groupe": x["link"],
               "texte": f"Lis le passage puis réponds à la question.\n\nPassage : {x['flores_passage']}\n\n"
                        f"Question : {x['question']}\n\n{choix}\n\nRéponds uniquement par le numéro de la bonne réponse.",
               "max_tokens": 16, "attendu": x["correct_answer_num"]}


def fquad(d):
    t = pd.read_parquet(os.path.join(d, "fquad2-test.parquet"))
    for i, x in t.iterrows():
        yield {"id": f"fquad-{i:04d}", "groupe": x["title"].rsplit("_", 2)[0],
               "texte": f"Texte : {x['context']}\n\nQuestion : {x['question']}\n\nRéponds par un extrait exact du texte, "
                        "le plus court possible. Si le texte ne permet pas de répondre, réponds exactement : sans réponse.",
               "max_tokens": 96,
               "attendu": {"impossible": bool(x["is_impossible"]), "textes": list(x["answers"]["text"])}}


def ifeval(d):
    # IFEval d'origine (Google, anglais) : les annotations d'IFEval-fr ne correspondent souvent pas aux consignes
    # (journal, 1er novembre 2026), si bien que la note mesurerait les erreurs d'annotation.
    for l in open(os.path.join(d, "ifeval-en.jsonl"), encoding="utf-8"):
        x = json.loads(l)
        yield {"id": f"ifeval-{x['key']}", "groupe": f"ifeval-{x['key']}", "texte": x["prompt"], "max_tokens": 1536,
               "attendu": {"instructions": x["instruction_id_list"], "kwargs": x["kwargs"]}}


def mgsm(d):
    t = pd.read_parquet(os.path.join(d, "mgsm-fr-test.parquet"))
    for i, x in t.iterrows():
        yield {"id": f"mgsm-{i:03d}", "groupe": f"mgsm-{i:03d}",
               "texte": f"{x['question']}\n\nRaisonne étape par étape, puis termine par une ligne « Réponse : » suivie "
                        "du nombre seul.",
               "max_tokens": 1024, "attendu": float(x["answer_number"])}


def mmmlu(d, par_matiere=50):
    lignes = list(csv.DictReader(open(os.path.join(d, "mmmlu-FR-FR.csv"), encoding="utf-8")))
    rnd = random.Random(0)
    for matiere in sorted({x["Subject"] for x in lignes}):
        qs = [x for x in lignes if x["Subject"] == matiere]
        for x in sorted(rnd.sample(qs, min(par_matiere, len(qs))), key=lambda x: int(x[""])):
            choix = "\n".join(f"{c}. {x[c]}" for c in LETTRES)
            ident = f"mmmlu-{matiere}-{int(x['']):03d}"  # la numérotation repart à 0 à chaque matière
            yield {"id": ident, "groupe": ident,
                   "texte": f"Question : {x['Question']}\n\n{choix}\n\nRéponds uniquement par la lettre de la bonne réponse.",
                   "max_tokens": 16, "attendu": x["Answer"], "matiere": matiere}


def belebele_en(d):
    for l in open(os.path.join(d, "belebele-eng_Latn.jsonl"), encoding="utf-8"):
        x = json.loads(l)
        choix = "\n".join(f"{i}. {x[f'mc_answer{i}']}" for i in range(1, 5))
        yield {"id": f"belebele_en-{x['link']}-{x['question_number']}", "groupe": x["link"],
               "texte": f"Read the passage, then answer the question.\n\nPassage: {x['flores_passage']}\n\n"
                        f"Question: {x['question']}\n\n{choix}\n\nAnswer with the number of the correct option only.",
               "max_tokens": 16, "attendu": x["correct_answer_num"]}


def squad(d, n=400):
    # SQuAD 2.0 (validation) : 400 questions avec réponse et 400 sans, graine 0, comme l'échantillon de FQuAD.
    t = pd.read_parquet(os.path.join(d, "squad2-validation.parquet"))
    rnd = random.Random(0)
    avec = [i for i, a in enumerate(t["answers"]) if len(a["text"])]
    sans = [i for i, a in enumerate(t["answers"]) if not len(a["text"])]
    for i in sorted(rnd.sample(avec, n) + rnd.sample(sans, n)):
        x = t.iloc[i]
        yield {"id": f"squad-{x['id']}", "groupe": x["title"],
               "texte": f"Text: {x['context']}\n\nQuestion: {x['question']}\n\nAnswer with an exact excerpt from the "
                        "text, as short as possible. If the text does not allow you to answer, answer exactly: no answer.",
               "max_tokens": 96,
               "attendu": {"impossible": not len(x["answers"]["text"]), "textes": list(x["answers"]["text"])}}


def main():
    d, sortie = sys.argv[1:3]
    bancs = (("belebele", belebele), ("fquad", fquad), ("ifeval", ifeval), ("mgsm", mgsm), ("mmmlu", mmmlu))
    if "--anglais" in sys.argv:  # bancs anglais, ajoutés le 1er novembre 2026 : Localia lit aussi l'anglais
        bancs = (("belebele_en", belebele_en), ("squad", squad))
    n = {}
    with open(sortie, "w", encoding="utf-8") as s:
        for banc, gen in bancs:
            for q in gen(d):
                q["banc"] = banc
                q["messages"] = [{"role": "user", "content": q.pop("texte")}]
                s.write(json.dumps(q, ensure_ascii=False) + "\n")
                n[banc] = n.get(banc, 0) + 1
    print(n, sum(n.values()), "->", sortie)


if __name__ == "__main__":
    main()
