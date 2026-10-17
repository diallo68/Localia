"""Assemble les lots de cas (fichiers lotNN.py) en un jeu JSONL figé, avec identifiants et empreinte SHA-256.

L'empreinte couvre le fichier de cas ET tous les documents référencés (contenu, dans l'ordre des noms),
ce qui permet de prouver plus tard que ni les questions ni les documents n'ont changé.

Usage : python3 -I assembler_jeu.py <dossier_jeu> <prefixe_id> [fichier_retraits.txt]
  <dossier_jeu>/cas/lot*.py  ->  <dossier_jeu>/cas.jsonl + <dossier_jeu>/EMPREINTE.txt
"""
import glob
import hashlib
import json
import os
import runpy
import sys

dossier, prefixe = sys.argv[1], sys.argv[2]
retraits = set()
if len(sys.argv) > 3:
    retraits = {l.strip() for l in open(sys.argv[3], encoding="utf-8") if l.strip() and not l.startswith("#")}

cas = []
for f in sorted(glob.glob(os.path.join(dossier, "cas", "lot*.py"))):
    for c in runpy.run_path(f)["CAS"]:
        if any(c["consigne"].startswith(r) for r in retraits):
            continue
        cas.append(c)

docs = sorted({c["doc"] for c in cas})
for d in docs:
    if not os.path.exists(os.path.join(dossier, "documents", d + ".md")):
        sys.exit(f"document manquant : {d}")

lignes = []
for i, c in enumerate(cas, 1):
    c = {"id": f"{prefixe}{i:03d}", **c}
    lignes.append(json.dumps(c, ensure_ascii=False, sort_keys=True))
texte = "\n".join(lignes) + "\n"
open(os.path.join(dossier, "cas.jsonl"), "w", encoding="utf-8").write(texte)

h = hashlib.sha256()
h.update(texte.encode("utf-8"))
for d in docs:
    h.update(d.encode("utf-8"))
    h.update(open(os.path.join(dossier, "documents", d + ".md"), "rb").read())
empreinte = h.hexdigest()

from collections import Counter
cats = Counter(c["cat"] for c in cas)
resume = [f"Jeu : {dossier}", f"Cas : {len(cas)} ; documents : {len(docs)}",
          "Catégories : " + ", ".join(f"{k} {v}" for k, v in sorted(cats.items())),
          f"SHA-256 (cas.jsonl + documents) : {empreinte}"]
open(os.path.join(dossier, "EMPREINTE.txt"), "w", encoding="utf-8").write("\n".join(resume) + "\n")
print("\n".join(resume))
