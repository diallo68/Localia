"""Étape 3.6 : rassemble les verdicts du juge par modèle, au format de noter.py, pour comparer_secret.py.

Contrôles d'abord (relecture de Codex, 2 nov. 2026) : l'empreinte de a_juger.jsonl est celle que le noyau a vérifiée
(manifeste.json) ; les identifiants des tâches, des clés et des verdicts sont uniques et forment le même ensemble.
Chaque note-<modele>.json reprend les cas du jeu avec la note du juge (0, 0,5 ou 1) comme score ; une tâche sans
verdict est listée dans « erreurs » (comparer_secret.py écarte alors le modèle). Affiche aussi, par modèle, le taux
d'affirmations non étayées (publié à part, criteres.md, section 3), l'écart moyen avec la note automatique, et cet
écart pour les réponses de plus de 350 mots (la note automatique les divise par 2, le juge non).

Usage : python3 -I noter_juge.py <dossier du jeu> <dossier de préparation> <dossier du noyau> <notes auto> <sortie>
"""
import collections
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outils"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -I n'ajoute pas le dossier du script
import noter  # noqa: E402
from echantillon_humain import sections  # noqa: E402


def lignes(chemin):
    return [json.loads(l) for l in open(chemin, encoding="utf-8") if l.strip()]


def charger(preparation, noyau):
    """Tâches, clés et verdicts d'une même préparation, ou arrêt."""
    a_juger = os.path.join(preparation, "a_juger.jsonl")
    empreinte = hashlib.sha256(open(a_juger, "rb").read()).hexdigest()
    manifeste = json.load(open(os.path.join(noyau, "manifeste.json"), encoding="utf-8"))
    if manifeste["a_juger"] != empreinte:
        sys.exit(f"verdicts d'une autre préparation ({manifeste['a_juger']} au lieu de {empreinte})")
    taches, cles, verdicts = (lignes(a_juger), lignes(os.path.join(preparation, "cles.jsonl")),
                              lignes(os.path.join(noyau, "verdicts.jsonl")))
    ensembles = [[x["id"] for x in l] for l in (taches, cles, verdicts)]
    if any(len(set(e)) != len(e) for e in ensembles):
        sys.exit("identifiants en double")
    if not (set(ensembles[0]) == set(ensembles[1]) == set(ensembles[2])):
        sys.exit("tâches, clés et verdicts ne portent pas sur les mêmes identifiants")
    return {t["id"]: t for t in taches}, cles, {v["id"]: v for v in verdicts}, manifeste


def main():
    jeu, preparation, noyau, auto, sortie = sys.argv[1:6]
    cas = [json.loads(l) for l in open(os.path.join(jeu, "cas.jsonl"), encoding="utf-8")]
    taches, cles, v, manifeste = charger(preparation, noyau)
    print(f"juge {manifeste['juge']} ({manifeste['sha256'][:12]}…), {len(v)} verdicts, {manifeste['erreurs']} en erreur")
    par_modele = collections.defaultdict(dict)
    for k in cles:
        par_modele[k["modele"]][k["cas"]] = (v[k["id"]], taches[k["id"]])
    os.makedirs(sortie, exist_ok=True)
    print(f"{'modèle':28s} sans verdict  non étayées  |juge − auto|  juge − auto (> 350 mots, n)")
    for m in sorted(par_modele):
        d = par_modele[m]
        ok = {i: x[0]["verdict"] for i, x in d.items() if x[0].get("verdict")}
        erreurs = sorted(set(d) - set(ok))
        details = [{"id": c["id"], "doc": c["doc"], "cat": c["cat"],
                    "score": ok[c["id"]]["note"] if c["id"] in ok else 0.0,
                    "non_etayee": bool(c["id"] in ok and ok[c["id"]]["affirmation_non_etayee"]),
                    "justification": ok[c["id"]]["justification"] if c["id"] in ok else ""}
                   for c in cas if c["id"] in d]
        json.dump({"n_cas": len(details), "n_repondus": len(details) - len(erreurs), "erreurs": erreurs,
                   "details": details},
                  open(os.path.join(sortie, f"note-{m}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        note_auto = os.path.join(auto, f"note-{m}.json")
        ecart = longues = ""
        if os.path.exists(note_auto):
            a = {x["id"]: x["score"] for x in json.load(open(note_auto, encoding="utf-8"))["details"]}
            ecart = f"{sum(abs(x['score'] - a[x['id']]) for x in details) / len(details):.3f}"
            lg = [x["score"] - a[x["id"]] for x in details
                  if noter.compter_mots(sections(d[x["id"]][1]["messages"][1]["content"])["reponse"]) > noter.MOTS_MAX]
            longues = f"{sum(lg) / len(lg):+.3f} ({len(lg)})" if lg else "— (0)"
        n_ne = sum(x["non_etayee"] for x in details)
        print(f"{m:28s} {len(erreurs):12d}  {n_ne / len(details):11.1%}  {ecart:>12s}  {longues}")


if __name__ == "__main__":
    main()
