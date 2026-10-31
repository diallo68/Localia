"""Étape 3.4 : note les réponses de bancs_kaggle.py et compare le modèle retenu à la base.

- Belebele, MMMLU : exactitude. Le symbole (1 à 4, A à D) est lu sur une réponse réduite au symbole, ou après
  « Réponse : » ou « la bonne réponse est » ; sinon seulement s'il est le seul symbole isolé de la réponse.
- FQuAD 2.0 : F1 sur les mots (normalisation à la SQuAD, articles français retirés), meilleur des textes attendus ;
  question sans réponse : 1 si la réponse entière est « sans réponse », 0 sinon ; « sans réponse » sur une question
  qui a une réponse : 0. Publiés à part : F1 sur les questions avec réponse, taux d'abstention juste.
- IFEval (d'origine, anglais) : vérificateur de Google (Apache 2.0, copie d'lm-evaluation-harness), score strict
  par consigne (toutes les instructions suivies) et par instruction. Une exception du vérificateur compte comme
  instruction non suivie (le nombre est affiché).
- MGSM : nombre de la ligne « Réponse », sinon dernier nombre de la réponse (espaces insécables, séparateurs de
  milliers et virgule décimale à la française) ; égalité avec la valeur attendue.

Les deux séries doivent être complètes (aucune réponse manquante ni en erreur), sinon rien n'est comparé.
Écart de chaque modèle avec la base (reponses-base.jsonl) : bootstrap apparié, 10 000 tirages, graine 0, regroupé par document (passage Belebele, article
FQuAD ; chaque question ailleurs), comme dans criteres.md, section 4.

Usage : python3 -I noter_bancs.py <bancs.jsonl> <dossier des réponses> <dossier du code ifeval> [--details d.jsonl]
"""
import collections
import importlib
import json
import os
import random
import re
import string
import sys
import unicodedata

ESPACES = dict.fromkeys(map(ord, "\u00a0\u202f\u2009\u2007"), " ")


def symbole(texte, motif):
    t = texte.translate(ESPACES).strip()
    if re.fullmatch(motif, re.sub(r"[\W_]", "", t)):
        return re.sub(r"[\W_]", "", t).upper()
    m = re.search(rf"r[ée]ponse\s*(?:correcte\s*)?(?:est|:)\s*(?:la\s+|le\s+)?(?:(?:r[ée]ponse|option|num[ée]ro)\s+)?"
                  rf"[*(]*({motif})(?![\w'’])", t, re.IGNORECASE)
    m = m or re.match(rf"[*(\s]*({motif})(?:[.)\]:*]|\n|$)", t)
    if m:
        return m.group(1).upper()
    isoles = set(re.findall(rf"(?<![\w'’]){motif}(?![\w'’])", t))
    return isoles.pop() if len(isoles) == 1 else None


ARTICLES = re.compile(r"\b(?:le|la|les|un|une|des|du|de)\b|\b[ld]'")


def normaliser(s):
    s = unicodedata.normalize("NFKC", s.lower()).replace("’", "'")
    s = ARTICLES.sub(" ", s)
    s = "".join(" " if c in string.punctuation + "«»" else c for c in s)
    return s.split()


def f1(prediction, attendu):
    p, a = normaliser(prediction), normaliser(attendu)
    if not p or not a:
        return float(p == a)
    commun = sum((collections.Counter(p) & collections.Counter(a)).values())
    if commun == 0:
        return 0.0
    precision, rappel = commun / len(p), commun / len(a)
    return 2 * precision * rappel / (precision + rappel)


def abstention(texte):
    t = unicodedata.normalize("NFKC", texte.lower()).translate(ESPACES)
    return re.sub(r"[\s.*_`\"'«»!]+", " ", t).strip() == "sans réponse"


NOMBRE = re.compile(r"-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?(?!\d)|-?\d+(?:[.,]\d+)?")


def lire_nombre(n):
    if re.fullmatch(r"-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?", n):
        n = n.replace(" ", "").replace(".", "")
    return float(n.replace(",", "."))


def nombre(texte):
    t = texte.translate(ESPACES).replace("**", "")
    lignes = [l for l in t.splitlines() if re.search(r"r[ée]ponse\s*:", l, re.IGNORECASE)]
    for zone in ([lignes[-1].split(":", 1)[-1]] if lignes else []) + [t]:
        trouves = NOMBRE.findall(zone)
        if trouves:
            return lire_nombre(trouves[0] if zone is not t else trouves[-1])
    return None


class IFEval:
    def __init__(self, dossier):
        sys.path.insert(0, os.path.dirname(os.path.abspath(dossier)))
        paquet = os.path.basename(os.path.abspath(dossier))
        self.registre = importlib.import_module(f"{paquet}.instructions_registry").INSTRUCTION_DICT
        importlib.import_module("langdetect").DetectorFactory.seed = 0  # langdetect est aléatoire sinon
        self.exceptions = 0

    def noter(self, attendu, prompt, reponse):
        suivies = []
        for ident, kwargs in zip(attendu["instructions"], attendu["kwargs"]):
            inst = self.registre[ident](ident)
            inst.build_description(**{k: v for k, v in kwargs.items() if v is not None})
            if "prompt" in (inst.get_instruction_args() or {}):
                inst.build_description(prompt=prompt)
            try:
                suivies.append(bool(reponse.strip()) and bool(inst.check_following(reponse)))
            except Exception:
                self.exceptions += 1
                suivies.append(False)
        return float(all(suivies)), suivies


def noter(q, texte, ifeval):
    b, a = q["banc"], q["attendu"]
    if b == "belebele":
        return float(symbole(texte, "[1-4]") == a), {}
    if b == "mmmlu":
        return float(symbole(texte, "[ABCD]") == a), {}
    if b == "fquad":
        s = abstention(texte)
        if a["impossible"]:
            return float(s), {"impossible": True}
        return (0.0 if s else max(f1(texte, t) for t in a["textes"])), {"impossible": False}
    if b == "mgsm":
        n = nombre(texte)
        return float(n is not None and abs(n - a) < 1e-6), {}
    if b == "ifeval":
        s, suivies = ifeval.noter(a, q["messages"][0]["content"], texte)
        return s, {"instructions": suivies}
    raise ValueError(b)


def bootstrap(paires, groupes, tirages=10000):
    par_groupe = collections.defaultdict(list)
    for (x, y), g in zip(paires, groupes):
        par_groupe[g].append(y - x)
    blocs = list(par_groupe.values())
    rnd = random.Random(0)
    m = []
    for _ in range(tirages):
        tir = [d for _ in blocs for d in rnd.choice(blocs)]
        m.append(sum(tir) / len(tir))
    m.sort()
    return m[int(0.025 * tirages)], m[int(0.975 * tirages)]


def main():
    bancs, dossier, code = sys.argv[1:4]
    details = sys.argv[sys.argv.index("--details") + 1] if "--details" in sys.argv else None
    questions = {q["id"]: q for q in map(json.loads, open(bancs, encoding="utf-8"))}
    ifeval = IFEval(code)
    modeles = ["base"] + sorted(f[len("reponses-"):-len(".jsonl")] for f in os.listdir(dossier)
                                if f.startswith("reponses-") and f != "reponses-base.jsonl")
    notes = {}
    for modele in modeles:
        rep = {r["id"]: r for r in map(json.loads, open(os.path.join(dossier, f"reponses-{modele}.jsonl"), encoding="utf-8"))}
        manquantes = sum(1 for i in questions if i not in rep or rep[i].get("erreur"))
        tronquees = sum(1 for r in rep.values() if r.get("fin") == "length")
        print(f"{modele} : {len(rep)} réponses, {manquantes} manquantes ou en erreur, {tronquees} tronquées")
        if manquantes:
            sys.exit(f"{modele} : série incomplète, relancer les appels manquants avant de comparer")
        notes[modele] = {i: noter(q, rep[i]["texte"], ifeval) for i, q in questions.items()}
    print(f"exceptions du vérificateur IFEval (instruction non suivie) : {ifeval.exceptions}")
    for banc in ("belebele", "fquad", "ifeval", "mgsm", "mmmlu"):
        ids = [i for i, q in questions.items() if q["banc"] == banc]
        x = [notes["base"][i][0] for i in ids]
        print(f"\n{banc} ({len(ids)} questions)")
        for m in modeles:
            y = [notes[m][i][0] for i in ids]
            ligne = f"  {m:13s} {sum(y) / len(y):.3f}"
            if m != "base":
                bas, haut = bootstrap(list(zip(x, y)), [questions[i]["groupe"] for i in ids])
                ligne += f"  − base : {(sum(y) - sum(x)) / len(ids):+.3f} [{bas:+.3f} ; {haut:+.3f}]"
            if banc == "fquad":
                for imp, nom in ((False, "F1 avec réponse"), (True, "abstention juste")):
                    sel = [i for i in ids if questions[i]["attendu"]["impossible"] is imp]
                    ligne += f" ; {nom} {sum(notes[m][i][0] for i in sel) / len(sel):.3f}"
            if banc == "ifeval":
                s = [v for i in ids for v in notes[m][i][1]["instructions"]]
                ligne += f" ; par instruction {sum(s) / len(s):.3f}"
            print(ligne)
    if details:
        with open(details, "w", encoding="utf-8") as s:
            for i, q in questions.items():
                s.write(json.dumps({"id": i, "banc": q["banc"], **{m: notes[m][i][0] for m in modeles}},
                                   ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
