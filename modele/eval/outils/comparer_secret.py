"""Étape 3.5 : comparaison finale sur le jeu secret (criteres.md, sections 3 à 5).

S_doc : moyenne des scores par cas avec un poids égal par catégorie (les deux catégories d'incohérence n'en font
qu'une, comme noter.py). Score principal sans les 6 cas touchés par la décontamination (234 cas), score sur les
240 cas à côté. Écart du modèle retenu avec chaque autre modèle : bootstrap apparié, 10 000 tirages, graine 0,
regroupé par document (on tire les documents avec remise et on recalcule les deux S_doc sur leurs cas).
Supériorité : borne basse > 0 ; non-infériorité : borne basse > −3 points. Un tirage où une catégorie manque est
refait (le taux est affiché). Un modèle dont un cas est resté en erreur technique (executer.py) est écarté et signalé.
« Rivalise » se juge sur les quatre comparateurs de 9 à 12 Md (le modèle retenu est le 2B : criteres.md, section 1).

Usage : python3 -I comparer_secret.py <dossier des notes note-<modele>.json> <modele retenu> [--tous]
"""
import collections
import json
import os
import random
import sys

TOUCHES = {"S013", "S024", "S033", "S043", "S066", "S068"}  # decontamination.md, fixé avant l'ouverture
N_CAS = 240
RIVALISE = ("qwen35-9b-q4km", "gemma3-12b-q4km", "mistral-nemo-12b-q4km", "gemma4-12b-qat-q40")


def categorie(c):
    return "incoherence" if c.startswith("incoherence") else c


def s_doc(cas, notes):
    par_cat = collections.defaultdict(list)
    for c in cas:
        par_cat[categorie(c["cat"])].append(notes[c["id"]])
    return sum(sum(v) / len(v) for v in par_cat.values()) / len(par_cat)


def bootstrap(cas, a, b, tirages=10000):
    par_doc = collections.defaultdict(list)
    for c in cas:
        par_doc[c["doc"]].append(c)
    docs = sorted(par_doc)
    toutes = {categorie(c["cat"]) for c in cas}
    rnd = random.Random(0)
    m, refaits = [], 0
    while len(m) < tirages:
        tir = [c for _ in docs for c in par_doc[rnd.choice(docs)]]
        if {categorie(c["cat"]) for c in tir} != toutes:
            refaits += 1
            continue
        m.append(s_doc(tir, b) - s_doc(tir, a))
    m.sort()
    return m[int(0.025 * tirages)], m[int(0.975 * tirages)], refaits / (refaits + tirages)


def main():
    dossier, retenu = sys.argv[1:3]
    notes, cas = {}, None
    for f in sorted(os.listdir(dossier)):
        if not (f.startswith("note-") and f.endswith(".json")):
            continue
        d = json.load(open(os.path.join(dossier, f), encoding="utf-8"))
        m = f[len("note-"):-len(".json")]
        ensemble = sorted((x["id"], x["doc"], x["cat"]) for x in d["details"])
        if d["n_cas"] != N_CAS or len(set(ensemble)) != N_CAS:
            sys.exit(f"{f} : {d['n_cas']} cas au lieu de {N_CAS}")
        if cas is not None and ensemble != cas:
            sys.exit(f"{f} : cas différents des autres modèles")
        cas = ensemble
        if d.get("erreurs") or d["n_repondus"] != d["n_cas"]:
            print(f"ÉCARTÉ : {m}, {len(d.get('erreurs', []))} cas en erreur technique, "
                  f"{d['n_repondus']} réponses sur {d['n_cas']}")
            continue
        notes[m] = {x["id"]: x["score"] for x in d["details"]}
    if retenu not in notes or "base" not in notes:
        sys.exit("le modèle retenu ou la base manque, rien n'est comparé")
    cas = [{"id": i, "doc": doc, "cat": cat} for i, doc, cat in cas]
    if {c["id"] for c in cas} & TOUCHES != TOUCHES:
        sys.exit("les 6 cas touchés ne sont pas tous dans le jeu")
    print("comparateurs de « Rivalise » absents ou écartés :", [m for m in RIVALISE if m not in notes] or "aucun")
    for nom, sel in (("principal, sans les cas touchés", [c for c in cas if c["id"] not in TOUCHES]),
                     ("tous les cas", cas)):
        print(f"\n== {nom} ({len(sel)} cas, {len({c['doc'] for c in sel})} documents)")
        cats = sorted({categorie(c["cat"]) for c in sel})
        print(f"  {'modèle':28s} S_doc   écart (retenu − modèle) [IC 95 %]   verdict          refaits "
              + " ".join(f"{c[:8]:>8s}" for c in cats))
        for m in sorted(notes, key=lambda m: -s_doc(sel, notes[m])):
            ligne = f"  {m:28s} {s_doc(sel, notes[m]):.3f}"
            if m != retenu:
                bas, haut, refaits = bootstrap(sel, notes[m], notes[retenu])
                e = s_doc(sel, notes[retenu]) - s_doc(sel, notes[m])
                verdict = "supérieur" if bas > 0 else "non inférieur" if bas > -0.03 else "inférieur ou indécis"
                ligne += f"  {e:+.3f} [{bas:+.3f} ; {haut:+.3f}] {verdict:20s} {refaits:5.1%}"
            else:
                ligne += " " * 53
            for c in cats:
                v = [notes[m][x["id"]] for x in sel if categorie(x["cat"]) == c]
                ligne += f" {sum(v) / len(v):8.2f}"
            print(ligne + ("  (Rivalise)" if m in RIVALISE else ""))


if __name__ == "__main__":
    main()
