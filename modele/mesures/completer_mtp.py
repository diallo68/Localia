"""Pilote 2.5 : remet dans le GGUF du modèle entraîné la couche MTP (prédiction anticipée) de la base.

`save_pretrained` après la fusion LoRA n'écrit pas les poids `mtp.*` : la classe transformers ne les charge
pas. La configuration annonce toujours la couche (block_count 25, nextn_predict_layers 1). Le GGUF converti
n'a donc pas les tenseurs blk.24.*, et llama.cpp 0.5 refuse de le charger. La LoRA ne touchait pas cette
couche : ses tenseurs sont recopiés octet pour octet depuis le GGUF de la base, converti et quantifié par la
même chaîne. Les tenseurs du modèle et ses métadonnées sont gardés tels quels.

Usage : python -I completer_mtp.py <entraine.gguf> <base.gguf> <sortie.gguf>
"""
import os
import sys

sys.path.insert(0, os.path.expanduser("~/localia-labo/llama.cpp/gguf-py"))
from gguf import GGUFReader, GGUFValueType, GGUFWriter  # noqa: E402


def main():
    entree, base, sortie = sys.argv[1:4]
    r, rb = GGUFReader(entree), GGUFReader(base)
    presents = {t.name for t in r.tensors}
    manquants = [t for t in rb.tensors if t.name not in presents]
    if not manquants or any(not t.name.startswith("blk.24.") for t in manquants):
        sys.exit(f"tenseurs manquants inattendus : {[t.name for t in manquants]}")
    w = GGUFWriter(sortie, arch=r.fields["general.architecture"].contents(), endianess=r.endianess)
    for f in r.fields.values():
        if f.name in ("GGUF.version", "GGUF.tensor_count", "GGUF.kv_count", "general.architecture"):
            continue
        vt = f.types[0]
        w.add_key_value(f.name, f.contents(), vt, sub_type=f.types[-1] if vt == GGUFValueType.ARRAY else None)
    tenseurs = list(r.tensors) + manquants
    for t in tenseurs:
        w.add_tensor_info(t.name, t.data.shape, t.data.dtype, t.data.nbytes, t.tensor_type)
    w.write_header_to_file()
    w.write_kv_data_to_file()
    w.write_ti_data_to_file()
    for t in tenseurs:
        w.write_tensor_data(t.data, tensor_endianess=r.endianess)
    w.close()
    print(f"{len(manquants)} tenseurs recopiés de la base ; {sortie} : {os.path.getsize(sortie) / 1e9:.3f} Go")


if __name__ == "__main__":
    main()
