"""Cherche un motif (expression régulière, sans casse) dans les pages lues par Localia : page et extrait.
Usage : python3 -I cherche.py <dossier_jeu> <doc> <motif> [<motif>...]"""
import json, re, sys, os
dossier, doc, *motifs = sys.argv[1:]
pages = json.load(open(os.path.join(dossier, 'pages', doc + '.json'), encoding='utf-8'))['pages']
for m in motifs:
    n = 0
    for p in pages:
        t = ' '.join(p['text'].split())
        for x in re.finditer(m, t, re.I):
            print(f"[{m}] p.{p['number']}: …{t[max(0, x.start() - 90):x.end() + 90]}…")
            n += 1
            if n >= 2: break
        if n >= 2: break
    if not n: print(f"[{m}] ABSENT")
