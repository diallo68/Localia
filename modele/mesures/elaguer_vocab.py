"""Élagage du vocabulaire d'un GGUF Qwen3.5 (fiche 08, étape 2.3).

Jetons gardés : sélection de couverture_vocab_ascii.py (K plus fréquents sur la moitié « apprentissage »
de FineWeb-2 fr, octets de base, jetons ASCII, fermeture par les fusions BPE), plus tous les jetons
de contrôle et définis par l'utilisateur du GGUF. Les jetons de remplissage [PAD…] sont retirés.
Les lignes de token_embd (partagée avec la sortie) sont recopiées octet pour octet, sans recompression ;
les fusions dont un parent ou le résultat a disparu sont retirées ; les identifiants spéciaux sont renumérotés.

Usage : python -I elaguer_vocab.py <entree.gguf> <tokenizer.json> <fineweb.parquet> <sortie.gguf> [--k 48000]
(gguf-py de llama.cpp dans PYTHONPATH ; l'environnement isolé -I l'ignore, d'où l'ajout explicite plus bas.)
"""
import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/localia-labo/llama.cpp/gguf-py"))
import numpy as np  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402
from gguf import GGUFReader, GGUFValueType, GGUFWriter  # noqa: E402
from tokenizers import Tokenizer  # noqa: E402

B2U = {chr(c) for c in range(33, 127)} | {"Ġ", "Ċ", "ĉ", "ċ", "č"}
IDS_SPECIAUX = ("tokenizer.ggml.bos_token_id", "tokenizer.ggml.eos_token_id", "tokenizer.ggml.padding_token_id",
                "tokenizer.ggml.unknown_token_id", "tokenizer.ggml.eot_token_id", "tokenizer.ggml.eom_token_id",
                "tokenizer.ggml.sep_token_id", "tokenizer.ggml.mask_token_id")


def jetons_gardes(tok_path, parquet_path, k):
    raw = json.load(open(tok_path))
    tok = Tokenizer.from_str(json.dumps(raw))
    vocab = raw["model"]["vocab"]
    id2tok = {i: t for t, i in vocab.items()}
    merges = [tuple(m.split(" ", 1)) if isinstance(m, str) else tuple(m) for m in raw["model"]["merges"]]
    parents = {a + b: (a, b) for a, b in merges}
    texts = pq.read_table(parquet_path, columns=["text"]).column("text").to_pylist()
    counts = collections.Counter()
    for enc in tok.encode_batch(texts[: len(texts) // 2], add_special_tokens=False):
        counts.update(enc.ids)
    keep = {id2tok[i] for i, _ in counts.most_common(k) if i in id2tok}
    keep |= {t for t in vocab if len(t) == 1} | {t for t in vocab if all(ch in B2U for ch in t)}
    pile = list(keep)
    while pile:
        t = pile.pop()
        for p in parents.get(t, ()):
            if p not in keep:
                keep.add(p)
                pile.append(p)
    return keep, vocab


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entree")
    ap.add_argument("tokenizer")
    ap.add_argument("parquet")
    ap.add_argument("sortie")
    ap.add_argument("--k", type=int, default=48000)
    a = ap.parse_args()

    keep_txt, vocab_hf = jetons_gardes(a.tokenizer, a.parquet, a.k)
    r = GGUFReader(a.entree)
    arch = r.fields["general.architecture"].contents()
    tokens = r.fields["tokenizer.ggml.tokens"].contents()
    types = [int(x) for x in r.fields["tokenizer.ggml.token_type"].contents()]
    for t, i in vocab_hf.items():  # le tokenizer HF et le GGUF doivent numéroter les jetons de la même façon
        if tokens[i] != t:
            sys.exit(f"tokenizer.json et GGUF divergent à l'identifiant {i}")
    garder = [i for i, (t, ty) in enumerate(zip(tokens, types)) if ty in (3, 4) or (ty == 1 and t in keep_txt)]
    ancien2nouveau = {old: new for new, old in enumerate(garder)}
    kept = {tokens[i] for i in garder}
    merges = [m for m in r.fields["tokenizer.ggml.merges"].contents()
              if (lambda p: p[0] in kept and p[1] in kept and p[0] + p[1] in kept)(m.split(" ", 1))]
    print(f"jetons : {len(tokens)} -> {len(garder)} ; fusions : {len(r.fields['tokenizer.ggml.merges'].contents())} "
          f"-> {len(merges)}", flush=True)

    w = GGUFWriter(a.sortie, arch=arch, endianess=r.endianess)
    for f in r.fields.values():
        if f.name in ("GGUF.version", "GGUF.tensor_count", "GGUF.kv_count", "general.architecture"):
            continue
        vt = f.types[0]
        st = f.types[-1] if vt == GGUFValueType.ARRAY else None
        v = f.contents()
        if f.name == "tokenizer.ggml.tokens":
            v = [tokens[i] for i in garder]
        elif f.name == "tokenizer.ggml.token_type":
            v = [types[i] for i in garder]
        elif f.name == "tokenizer.ggml.merges":
            v = merges
        elif f.name == "tokenizer.ggml.scores":
            v = [v[i] for i in garder]
        elif f.name in IDS_SPECIAUX:
            if v not in ancien2nouveau:
                sys.exit(f"{f.name} = {v} n'est pas gardé")
            v = ancien2nouveau[v]
        elif f.name.endswith(".vocab_size"):
            v = len(garder)
        w.add_key_value(f.name, v, vt, sub_type=st)

    idx = np.array(garder)
    donnees = []
    for t in r.tensors:
        d = t.data
        if t.name in ("token_embd.weight", "output.weight"):
            if d.shape[0] != len(tokens):
                sys.exit(f"{t.name} : {d.shape[0]} lignes pour {len(tokens)} jetons")
            d = np.ascontiguousarray(d[idx])
            print(f"{t.name} {t.tensor_type.name} : {t.n_bytes / 1e6:.0f} Mo -> {d.nbytes / 1e6:.0f} Mo", flush=True)
        donnees.append(d)
        w.add_tensor_info(t.name, d.shape, d.dtype, d.nbytes, t.tensor_type)
    w.write_header_to_file()
    w.write_kv_data_to_file()
    w.write_ti_data_to_file()
    for d in donnees:
        w.write_tensor_data(d, tensor_endianess=r.endianess)
    w.close()
    print(f"{a.sortie} : {os.path.getsize(a.sortie) / 1e9:.3f} Go (entrée {os.path.getsize(a.entree) / 1e9:.3f} Go)")


if __name__ == "__main__":
    main()
