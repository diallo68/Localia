#!/usr/bin/env python3
"""Élagage personnalisé d'un modèle à experts (MoE) au format GGUF.

Garde, dans chaque couche, les K experts les mieux notés par les statistiques de llama-moe-stats
(score de type REAP : poids de routage × norme de la sortie de l'expert, ou nombre de routages),
et retire les autres : tenseurs des experts (*_exps) et lignes du routeur (ffn_gate_inp). Les
poids gardés sont recopiés octet pour octet, sans décompression ni recompression. Le nombre
d'experts actifs par jeton (expert_used_count) ne change pas.

python3 prune-gguf.py modele.gguf stats.json sortie.gguf --garder 192 [--score reap|count|wsum]
python3 prune-gguf.py modele.gguf stats.json sortie.gguf --garder 256   # copie témoin (0 %)
"""
import argparse
import json
import sys

import numpy as np
from gguf import GGUFReader, GGUFWriter, GGUFValueType

EXPERT_TENSORS = ("ffn_gate_exps", "ffn_up_exps", "ffn_down_exps", "ffn_gate_up_exps")
ROUTER_TENSORS = ("ffn_gate_inp.weight", "exp_probs_b")


def layer_of(name):
    return int(name.split(".")[1]) if name.startswith("blk.") else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model")
    parser.add_argument("stats")
    parser.add_argument("output")
    parser.add_argument("--garder", type=int, required=True, help="experts gardés par couche")
    parser.add_argument("--score", default="reap", choices=["reap", "count", "wsum"])
    args = parser.parse_args()

    reader = GGUFReader(args.model)
    arch = reader.fields["general.architecture"].contents()
    n_expert = int(reader.fields[f"{arch}.expert_count"].contents())
    n_used = int(reader.fields[f"{arch}.expert_used_count"].contents())
    keep_n = args.garder
    if not n_used <= keep_n <= n_expert:
        sys.exit(f"--garder doit être entre {n_used} (experts actifs) et {n_expert}.")

    stats = json.load(open(args.stats))
    if stats["n_expert"] != n_expert:
        sys.exit("Les statistiques ne viennent pas de ce modèle (nombre d'experts différent).")
    keep = {}
    for layer, data in stats["layers"].items():
        scores = np.array(data[args.score], dtype=np.float64)
        # Les mieux notés, rangés dans l'ordre d'origine (les indices du routeur suivent cet ordre).
        keep[int(layer)] = np.sort(np.argsort(-scores, kind="stable")[:keep_n])

    writer = GGUFWriter(args.output, arch=arch, endianess=reader.endianess)
    for field in reader.fields.values():
        if field.name == "GGUF.version" or field.name == "GGUF.tensor_count" or field.name == "GGUF.kv_count":
            continue
        if field.name == "general.architecture":
            continue  # écrit par GGUFWriter
        value_type = field.types[0]
        sub_type = field.types[-1] if value_type == GGUFValueType.ARRAY else None
        value = field.contents()
        if field.name == f"{arch}.expert_count":
            value = keep_n
        writer.add_key_value(field.name, value, value_type, sub_type=sub_type)

    tensors = []
    removed = 0
    for tensor in reader.tensors:
        data = tensor.data
        layer = layer_of(tensor.name)
        is_expert = any(f".{t}." in tensor.name for t in EXPERT_TENSORS)
        is_router = any(tensor.name.endswith(t) or f".{t}" in tensor.name for t in ROUTER_TENSORS)
        if layer is not None and (is_expert or is_router):
            if layer not in keep:
                sys.exit(f"Aucune statistique pour la couche {layer}.")
            if data.shape[0] != n_expert:
                sys.exit(f"{tensor.name} : dimension des experts inattendue {data.shape}.")
            sliced = np.ascontiguousarray(data[keep[layer]])
            removed += data.nbytes - sliced.nbytes
            data = sliced
        tensors.append((tensor, data))
        writer.add_tensor_info(tensor.name, data.shape, data.dtype, data.nbytes, tensor.tensor_type)

    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_ti_data_to_file()
    for tensor, data in tensors:
        writer.write_tensor_data(data, tensor_endianess=reader.endianess)
    writer.close()
    print(f"{args.output} : {keep_n}/{n_expert} experts gardés par couche, "
          f"{removed / 1e9:.2f} Go retirés.")


if __name__ == "__main__":
    main()
