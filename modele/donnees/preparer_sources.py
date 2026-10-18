"""Étape 2.4, sources : fiches Service-Public (Licence Ouverte) converties en Markdown, décontaminées.

Écarte :
- les fiches listées dans eval/exclusions-entrainement.txt (jeu secret et jeu de développement) ;
- les fiches dont plus de SEUIL des 13-grammes de mots figurent dans un document ou un cas d'évaluation
  (secret et développement) : passages repris d'une fiche à l'autre ;
- les fiches trop courtes ou trop longues pour le contexte d'entraînement.
Écrit les fiches gardées et un rapport (decontamination.json) qui donne la raison de chaque rejet.

Usage : python -I preparer_sources.py <dossier_xml> <exclusions.txt> <sortie/> <dossier_eval> [<dossier_eval> ...]
        [--tokenizer qwen35-tokenizer.json] [--min 600] [--max 6000]
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import unicodedata

from tokenizers import Tokenizer

SEUIL = 0.05
N = 13
CONVERTIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval", "outils", "sp_xml_vers_texte.py")


def mots(s):
    s = unicodedata.normalize("NFKC", s).lower()
    return re.findall(r"\w+", s)


def ngrammes(s):
    m = mots(s)
    return {" ".join(m[i:i + N]) for i in range(len(m) - N + 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xml")
    ap.add_argument("exclusions")
    ap.add_argument("sortie")
    ap.add_argument("eval", nargs="+")
    ap.add_argument("--tokenizer", required=True)
    ap.add_argument("--min", type=int, default=600)
    ap.add_argument("--max", type=int, default=6000)
    a = ap.parse_args()

    exclus = set()
    for l in open(a.exclusions, encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#"):
            exclus.add(l.removeprefix("dev:").removeprefix("sp-"))
    ng_eval = set()
    for d in a.eval:
        for f in glob.glob(os.path.join(d, "documents", "*.md")):
            ng_eval |= ngrammes(open(f, encoding="utf-8").read())
        for l in open(os.path.join(d, "cas.jsonl"), encoding="utf-8"):
            c = json.loads(l)
            ng_eval |= ngrammes(c["consigne"] + " " + json.dumps(c.get("attendu", ""), ensure_ascii=False))
    print(f"13-grammes d'évaluation : {len(ng_eval)}", flush=True)

    tok = Tokenizer.from_file(a.tokenizer)
    os.makedirs(a.sortie, exist_ok=True)
    rapport = {}
    for x in sorted(glob.glob(os.path.join(a.xml, "**", "F*.xml"), recursive=True)):
        fid = os.path.basename(x)[:-4]
        if fid in exclus:
            rapport[fid] = "jeu d'évaluation"
            continue
        r = subprocess.run([sys.executable, "-I", CONVERTIR, x], capture_output=True, text=True)
        md = r.stdout.strip()
        if r.returncode or not md:
            rapport[fid] = "conversion impossible"
            continue
        n = len(tok.encode(md, add_special_tokens=False).ids)
        if not a.min <= n <= a.max:
            rapport[fid] = f"longueur {n} jetons"
            continue
        ng = ngrammes(md)
        recouvrement = len(ng & ng_eval) / max(1, len(ng))
        if recouvrement > SEUIL:
            rapport[fid] = f"recouvrement {recouvrement:.1%} avec l'évaluation"
            continue
        open(os.path.join(a.sortie, f"sp-{fid}.md"), "w", encoding="utf-8").write(md + "\n")
        rapport[fid] = f"gardée ({n} jetons, recouvrement {recouvrement:.1%})"
    json.dump(rapport, open(os.path.join(a.sortie, "..", "decontamination.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1, sort_keys=True)
    gardees = sum(v.startswith("gardée") for v in rapport.values())
    raisons = {}
    for v in rapport.values():
        k = v.split(" ")[0] if not v.startswith("jeu") else v
        raisons[k] = raisons.get(k, 0) + 1
    print(f"{len(rapport)} fiches, {gardees} gardées ; {raisons}")


if __name__ == "__main__":
    main()
