"""Couverture du vocabulaire Qwen3.5 sur du français (fiche 08, mesure à 0 €).

Sélection des jetons gardés sur une moitié du corpus (apprentissage), mesure sur des textes tenus à part.
Pour chaque taille K : jetons les plus fréquents + 256 octets de base + jetons spéciaux + fermeture
par les fusions BPE (les deux parents de chaque jeton gardé sont gardés). On reconstruit un BPE élagué
(fusions dont le résultat ou un parent a disparu retirées) et on mesure l'allongement réel des textes.

Usage : python3 -I couverture_vocab.py <tokenizer.json> <fineweb.parquet> <sortie.md> [fichiers tenus à part...]
"""
import collections
import json
import sys

import pyarrow.parquet as pq
from tokenizers import Tokenizer

tok_path, parquet_path, out_path, *extra = sys.argv[1:]
raw = json.load(open(tok_path))
tok = Tokenizer.from_str(json.dumps(raw))
model = raw["model"]
vocab = model["vocab"]
id2tok = {i: t for t, i in vocab.items()}
merges = [tuple(m.split(" ", 1)) if isinstance(m, str) else tuple(m) for m in model["merges"]]
parents = {a + b: (a, b) for a, b in merges}
special = {t["content"] for t in raw.get("added_tokens", [])}

texts = pq.read_table(parquet_path, columns=["text"]).column("text").to_pylist()
half = len(texts) // 2
train, held = texts[:half], texts[half:]
held_sets = {"FineWeb-2 fr (tenu à part)": held}
for path in extra:
    held_sets[path.split("/")[-1]] = [open(path, encoding="utf-8", errors="ignore").read()]

counts = collections.Counter()
for enc in tok.encode_batch(train, add_special_tokens=False):
    counts.update(enc.ids)
n_train = sum(counts.values())

# Octets de base : les jetons d'un seul caractère de l'alphabet byte-level.
base = {t for t in vocab if len(t) == 1}
B2U = {chr(c) for c in range(33, 127)} | {"\u0120", "\u010a", "\u0109", "\u010b", "\u010d"}
ascii = {t for t in vocab if all(ch in B2U for ch in t)}
print("jetons ASCII:", len(ascii), flush=True)


def closure(keep):
    stack = list(keep)
    while stack:
        t = stack.pop()
        if t in parents:
            for p in parents[t]:
                if p not in keep:
                    keep.add(p)
                    stack.append(p)
    return keep


def trimmed_tokenizer(keep):
    new = json.loads(json.dumps(raw))
    kept = sorted(keep, key=lambda t: vocab[t])
    new["model"]["vocab"] = {t: i for i, t in enumerate(kept)}
    new["model"]["merges"] = [
        f"{a} {b}" if isinstance(model["merges"][0], str) else [a, b]
        for a, b in merges
        if a in keep and b in keep and (a + b) in keep
    ]
    new["added_tokens"] = []  # les jetons spéciaux ne servent pas au comptage
    return Tokenizer.from_str(json.dumps(new))


ref_len = {name: sum(len(e.ids) for e in tok.encode_batch(ts, add_special_tokens=False))
           for name, ts in held_sets.items()}

lines = [
    "# Couverture du vocabulaire Qwen3.5 (fiche 08)",
    "",
    f"Tokenizer : {len(vocab)} jetons BPE + {len(special)} spéciaux. Sélection sur {half} documents FineWeb-2 fr "
    f"({n_train:,} jetons) ; {len(counts):,} jetons distincts y apparaissent au moins une fois.".replace(",", " "),
    "",
    "| K demandé | Gardés (après fermeture) | Couverture sélection | " + " | ".join(f"Allongement : {n}" for n in held_sets) + " |",
    "|---|---|---|" + "---|" * len(held_sets),
]
for k in (16000, 32000, 48000, 64000):
    top = {id2tok[i] for i, _ in counts.most_common(k) if i in id2tok}
    keep = closure(top | base | ascii | (special & set(vocab)))
    cov = sum(c for i, c in counts.items() if id2tok.get(i) in keep) / n_train
    tt = trimmed_tokenizer(keep)
    infl = []
    for name, ts in held_sets.items():
        n = sum(len(e.ids) for e in tt.encode_batch(ts, add_special_tokens=False))
        infl.append(f"+{100 * (n / ref_len[name] - 1):.2f} %")
    lines.append(f"| {k} | {len(keep)} | {100 * cov:.3f} % | " + " | ".join(infl) + " |")
    print(lines[-1], flush=True)

lines += ["", "Allongement = jetons nécessaires avec le vocabulaire élagué / jetons avec le vocabulaire complet − 1, "
          "sur des textes non utilisés pour la sélection."]
open(out_path, "w").write("\n".join(lines) + "\n")
