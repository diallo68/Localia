"""Vérifie l'empreinte d'un jeu figé (même calcul qu'assembler_jeu.py : cas.jsonl, puis nom et contenu de chaque
document, dans l'ordre alphabétique). Code de sortie 1 si elle ne correspond pas.

Usage : python3 -I verifier_empreinte.py <dossier du jeu> <empreinte attendue>
"""
import hashlib
import json
import os
import sys

dossier, attendue = sys.argv[1:3]
texte = open(os.path.join(dossier, "cas.jsonl"), encoding="utf-8").read()
h = hashlib.sha256(texte.encode("utf-8"))
for d in sorted({json.loads(l)["doc"] for l in texte.splitlines() if l.strip()}):
    h.update(d.encode("utf-8"))
    h.update(open(os.path.join(dossier, "documents", d + ".md"), "rb").read())
print(h.hexdigest())
sys.exit(0 if h.hexdigest() == attendue else 1)
