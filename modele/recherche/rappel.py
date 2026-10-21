"""Rappel de la recherche de passages, sans modèle : les éléments de réponse attendus sont-ils dans les extraits ?

Usage : python3 -I rappel.py <dossier eval-long> <budgets, ex. 3000,5000> [cache_expansion.json]
Avec un fichier de cache, compare aussi la fusion avec l'expansion de requête (modèle local sur le port 8081).
"""
import json, sys, os
ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
sys.path.insert(0, os.path.join(ICI, "..", "eval", "outils"))
import passages as P, noter
d, budgets = sys.argv[1], [int(b) for b in sys.argv[2].split(",")]
cache_f = sys.argv[3] if len(sys.argv) > 3 else None
cache = json.load(open(cache_f)) if cache_f and os.path.exists(cache_f) else {}
cas = [json.loads(l) for l in open(d + "/cas.jsonl")]
docs = {}
for c in cas:
    if c["doc"] not in docs:
        docs[c["doc"]] = P.Index(P.decouper(open(f"{d}/documents/{c['doc']}.md").read()))
    if cache_f and c["consigne"] not in cache:
        cache[c["consigne"]] = P.etendre(c["consigne"], "http://127.0.0.1:8081/v1")
        json.dump(cache, open(cache_f, "w"), ensure_ascii=False)
for budget in budgets:
    for mode in (["sans", "fusion"] if cache_f else ["sans"]):
        par_type = {}
        for c in cas:
            idx, q = docs[c["doc"]], c["consigne"]
            ch = P.selectionner(idx, q if mode == "sans" else [q, q + " " + cache[q]], budget)
            g = noter.groupes_ok(noter.normaliser(P.rendre(idx, ch)), c["auto"]["groupes"])
            ok = g if isinstance(g, bool) else g >= 1
            t = par_type.setdefault(c.get("type_question", "-"), [0, 0, []])
            t[0] += ok; t[1] += 1
            if not ok: t[2].append(c["id"])
        print(f"budget {budget} {mode:6s} " + " | ".join(f"{k} {v[0]}/{v[1]} {v[2]}" for k, v in par_type.items()))
