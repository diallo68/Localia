#!/usr/bin/env python3
"""Prépare un GGUF pour la publication de Dial-bowe-GN-224-2B (liste de contrôle : PUBLIER.md).

Copie le fichier sous son nom publié en corrigeant les métadonnées, puis vérifie la copie :
- general.name = Dial-bowe-GN-224-2B ;
- general.base_model.0 = Qwen/Qwen3.5-2B : le convertisseur avait écrit Qwen3.5-2B-Base, la base de la base ;
- general.tags sans « image-text-to-text » : le modèle publié ne lit que du texte ;
- general.size_label recalculé à partir des tenseurs (le vocabulaire réduit fait passer de 1,9 à 1,7 Md) ;
- le gabarit de conversation doit être identique, à l'octet près, à gabarit_sans_reflexion.jinja ; avec
  --remplacer-gabarit, il est remplacé par celui-ci (fichiers du lot 4 refait, sortis avec le gabarit d'origine) ;
- chaque tenseur de la copie doit être identique à celui de la source.
L'empreinte SHA-256 de la copie est ajoutée à SHA256SUMS dans le dossier de sortie.

Usage (depuis ~/localia-labo) :
  modele-compact/env-entrainement/bin/python -I ~/localia-public/modele/publication/preparer_gguf.py \
      SOURCE.gguf Q4_K_M DOSSIER_DE_SORTIE [--remplacer-gabarit]
"""
import hashlib
import sys
from pathlib import Path

LLAMA = Path.home() / "localia-labo/llama.cpp/gguf-py"
sys.path.insert(0, str(LLAMA))
sys.path.insert(0, str(LLAMA / "gguf/scripts"))
import gguf  # noqa: E402
from gguf_new_metadata import MetadataDetails, copy_with_new_metadata  # noqa: E402

NOM = "Dial-bowe-GN-224-2B"
ICI = Path(__file__).resolve().parent
GABARIT = (ICI / NOM / "gabarit_sans_reflexion.jinja").read_text(encoding="utf-8")
S, A = gguf.GGUFValueType.STRING, gguf.GGUFValueType.ARRAY
ATTENDU = {
    "general.name": NOM,
    "general.base_model.count": 1,
    "general.base_model.0.name": "Qwen3.5 2B",
    "general.base_model.0.organization": "Qwen",
    "general.base_model.0.repo_url": "https://huggingface.co/Qwen/Qwen3.5-2B",
    "general.tags": ["text-generation", "french", "gguf"],
    "general.license": "apache-2.0",
}


def lire(r: gguf.GGUFReader, cle: str):
    f = r.get_field(cle)
    return None if f is None else f.contents()


def taille(r: gguf.GGUFReader) -> str:
    n = sum(int(t.n_elements) for t in r.tensors if not t.name.startswith("mtp."))
    return f"{n / 1e9:.1f}B"


def main() -> None:
    args = sys.argv[1:]
    remplacer = "--remplacer-gabarit" in args
    args = [a for a in args if a != "--remplacer-gabarit"]
    if len(args) != 3:
        sys.exit(__doc__)
    source, quant, sortie = Path(args[0]), args[1], Path(args[2])
    sortie.mkdir(parents=True, exist_ok=True)
    cible = sortie / f"{NOM}-{quant}.gguf"
    if cible.exists():
        sys.exit(f"{cible} existe déjà : rien n'est écrasé.")

    r = gguf.GGUFReader(source)
    if lire(r, "tokenizer.chat_template") != GABARIT and not remplacer:
        sys.exit("Le gabarit de la source diffère de gabarit_sans_reflexion.jinja : fichier refusé.")
    arch = lire(r, "general.architecture")

    nouveau = {
        "general.name": MetadataDetails(S, NOM),
        "general.size_label": MetadataDetails(S, taille(r)),
        "general.base_model.0.name": MetadataDetails(S, ATTENDU["general.base_model.0.name"]),
        "general.base_model.0.repo_url": MetadataDetails(S, ATTENDU["general.base_model.0.repo_url"]),
        "general.tags": MetadataDetails(A, ATTENDU["general.tags"], sub_type=S),
    }
    if remplacer:
        nouveau["tokenizer.chat_template"] = MetadataDetails(S, GABARIT)
    w = gguf.GGUFWriter(cible, arch=arch, endianess=r.endianess)
    w.data_alignment = r.alignment
    copy_with_new_metadata(r, w, nouveau, remove_metadata=[])

    # Vérifications de la copie.
    c = gguf.GGUFReader(cible)
    erreurs = []
    for cle, val in ATTENDU.items():
        if lire(c, cle) != val:
            erreurs.append(f"{cle} = {lire(c, cle)!r}, attendu {val!r}")
    if lire(c, "tokenizer.chat_template") != GABARIT:
        erreurs.append("gabarit modifié")
    autres = [k for k in r.fields if not k.startswith(("general.", "GGUF.")) and k != "tokenizer.chat_template"]
    for k in autres:
        if lire(c, k) != lire(r, k):
            erreurs.append(f"métadonnée {k} modifiée")
    if [t.name for t in c.tensors] != [t.name for t in r.tensors]:
        erreurs.append("liste des tenseurs différente")
    else:
        for a, b in zip(r.tensors, c.tensors):
            if a.tensor_type != b.tensor_type or a.data.tobytes() != b.data.tobytes():
                erreurs.append(f"tenseur {a.name} différent")
    if erreurs:
        cible.unlink()
        sys.exit("Copie refusée et supprimée :\n- " + "\n- ".join(erreurs))

    h = hashlib.sha256()
    with open(cible, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 24), b""):
            h.update(bloc)
    with open(sortie / "SHA256SUMS", "a") as f:
        f.write(f"{h.hexdigest()}  {cible.name}\n")
    print(f"{cible.name} : {len(c.tensors)} tenseurs identiques, {taille(c)}, "
          f"{cible.stat().st_size / 1e9:.2f} Go, SHA-256 {h.hexdigest()}")


if __name__ == "__main__":
    main()
