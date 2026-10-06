"""Série de calcul tirée de MGSM (questions de mathématiques élémentaires en français).

Source : MGSM, Shi et al. (2022), « Language Models are Multilingual Chain-of-Thought Reasoners »,
https://huggingface.co/datasets/juletxara/mgsm — licence CC BY-SA 4.0. La série produite est une
adaptation (format Localia) et reste sous CC BY-SA 4.0.

Usage : python3 benchmark/banque/outils/mgsm.py [nombre=15] [graine=42]
"""
import pathlib
import random
import sys
import urllib.request

import pandas as pd

URL = "https://huggingface.co/datasets/juletxara/mgsm/resolve/main/fr/test-00000-of-00001.parquet"
n = int(sys.argv[1]) if len(sys.argv) > 1 else 15
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 42
here = pathlib.Path(__file__).resolve().parent
cache = here / "mgsm_fr_test.parquet"
if not cache.exists():
    urllib.request.urlretrieve(URL, cache)
df = pd.read_parquet(cache)
rows = sorted(random.Random(seed).sample(range(len(df)), n))
blocks = []
for k, i in enumerate(rows, 1):
    q = df.iloc[i]
    answer = q["answer_number"]
    answer = int(answer) if float(answer).is_integer() else answer
    blocks.append(
        f"## M{k:02d} MGSM-fr {i}\nCatégorie : Raisonnement\n{q['question'].strip()}\n"
        f"Donne le résultat final sous la forme « Réponse : nombre ».\n"
        f"Attendu : {answer} (MGSM-fr, question {i} ; licence CC BY-SA 4.0)."
    )
out = here.parent / "serie-mgsm-fr.txt"
out.write_text("\n---\n".join(blocks) + "\n", encoding="utf-8")
print(f"{out.name} : {n} questions (graine {seed}) sur {len(df)}")
