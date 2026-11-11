"""Assemble un jeu de la v2 (cas/lot*.py -> cas.jsonl) et calcule son empreinte SHA-256.

Comme assembler_jeu.py (v1), mais les documents sont des PDF ou des textes (.pdf ou .md), et l'empreinte couvre
aussi les pages lues par Localia (pages/<doc>.json) : on peut prouver plus tard que ni les questions, ni les
documents, ni le texte vu par les modèles n'ont changé.
Usage : python3 -I assembler_v2.py <dossier_jeu> <prefixe_id>
"""
import glob
import hashlib
import json
import os
import runpy
import sys
from collections import Counter

dossier, prefixe = sys.argv[1], sys.argv[2]
cas = [c for f in sorted(glob.glob(os.path.join(dossier, "cas", "lot*.py"))) for c in runpy.run_path(f)["CAS"]]
fichiers = {}
for f in os.listdir(os.path.join(dossier, "documents")):
    fichiers[f.rsplit(".", 1)[0]] = f
docs = sorted({c["doc"] for c in cas})
for d in docs:
    if d not in fichiers or not os.path.exists(os.path.join(dossier, "pages", d + ".json")):
        sys.exit(f"document ou pages manquants : {d}")
inutiles = sorted(set(fichiers) - set(docs))
if inutiles:
    sys.exit(f"documents sans cas : {inutiles}")
lignes = [json.dumps({"id": f"{prefixe}{i:03d}", **c}, ensure_ascii=False, sort_keys=True) for i, c in enumerate(cas, 1)]
texte = "\n".join(lignes) + "\n"
open(os.path.join(dossier, "cas.jsonl"), "w", encoding="utf-8").write(texte)
h = hashlib.sha256(texte.encode("utf-8"))
for d in docs:
    h.update(d.encode("utf-8"))
    h.update(open(os.path.join(dossier, "documents", fichiers[d]), "rb").read())
    h.update(open(os.path.join(dossier, "pages", d + ".json"), "rb").read())
cats = Counter(c["cat"] for c in cas)
langues = Counter(c.get("langue") for c in cas)
resume = [f"Jeu : {os.path.basename(os.path.normpath(dossier))}", f"Cas : {len(cas)} ; documents : {len(docs)}",
          "Catégories : " + ", ".join(f"{k} {v}" for k, v in sorted(cats.items())),
          "Langues des demandes : " + ", ".join(f"{k} {v}" for k, v in sorted(langues.items())),
          f"SHA-256 (cas.jsonl + documents + pages lues) : {h.hexdigest()}"]
open(os.path.join(dossier, "EMPREINTE.txt"), "w", encoding="utf-8").write("\n".join(resume) + "\n")
print("\n".join(resume))
