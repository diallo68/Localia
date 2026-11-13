"""Type « pages Internet » : de la phase A (fiches_web.py, professeur) aux tâches de la phase B.

Contrôles par programme, puis messages au format de Localia (main.cjs : webSourcesBlock) :
- consigne système = consigne écrite par le professeur, suivie du bloc des pages (étiquettes de structure de Localia
  seulement, comme pour les documents dans taches_v2.cjs : la phrase de consigne de Localia est retirée, règle de
  provenance) ; message de l'utilisateur = la demande ;
- "web" : les numéros de sources existent, et chaque mot clé figure dans le texte d'une des pages citées ;
- "web-absent" : demande non vide (le contrôle de l'absence est la réponse du professeur, vérifiée ensuite) ;
- "web-alteree" / "web-saine" : la valeur figure dans sa page et dans la phrase ; la phrase est insérée dans la page
  d'insertion avec une valeur changée (alteree) ou la même (saine). Pour « alteree », une indication est vue par le
  professeur seul en phase B (les deux valeurs et leurs pages), comme dans taches_v2.cjs.

Usage : python3 -I appliquer_web.py <phase_a.jsonl> <fiches-web.jsonl> <taches.jsonl>
"""
import collections
import json
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from appliquer_calcul import alterer, inserer, normaliser, sur_page  # noqa: E402

rnd = random.Random(20261114)
NUM = re.compile(r"\d{1,3}(?:[   ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?")


def bloc(web, lang, jour):
    pages = "\n\n".join(f"[{w['n']}] {w['title'] or w['url']}\n{w['url']}\n{w['text']}" for w in web)
    return (f"WEB RESULTS (pages read on {jour} for this question):\n{pages}" if lang == "en"
            else f"RÉSULTATS INTERNET (pages lues le {jour} pour cette question) :\n{pages}")


def main():
    phase_a, fiches_f, sortie = sys.argv[1:4]
    fiches = {f["fiche"]: f for f in map(json.loads, open(fiches_f, encoding="utf-8"))}
    rejets, n = collections.Counter(), 0
    with open(sortie, "w", encoding="utf-8") as out:
        for a in map(json.loads, open(phase_a, encoding="utf-8")):
            fiche, r = fiches.get(a["fiche"]), a.get("resultat")
            if not fiche or not fiche.get("web"):
                continue
            if not r or not isinstance(r.get("demandes"), list):
                rejets["phase A sans résultat"] += 1
                continue
            for i, d in enumerate(r["demandes"]):
                if i >= len(fiche["demandes"]) or not isinstance(d, dict):
                    continue
                prevu = fiche["demandes"][i]
                typ, lang = prevu["type"], prevu["langue"]
                web = [dict(w) for w in fiche["web"]]
                textes = {w["n"]: w["text"] for w in web}
                systeme = r.get("consigne_systeme_en" if lang == "en" else "consigne_systeme_fr")
                demande = d.get("demande")
                if not isinstance(demande, str) or len(demande.strip()) < 2 or re.search(r"json", demande, re.I):
                    rejets[f"{typ} : demande vide ou JSON"] += 1
                    continue
                if not isinstance(systeme, str) or len(systeme) < 40 or re.search(r"json", systeme, re.I):
                    rejets["consigne système absente ou JSON"] += 1
                    continue
                verif, indice = {}, None
                try:
                    if typ == "web":
                        src = sorted({int(x) for x in d.get("sources") or []})
                        mots = [str(m) for m in d.get("mots_cles") or [] if str(m).strip()]
                        if not src or any(x not in textes for x in src):
                            raise ValueError("sources inexistantes")
                        if not mots:
                            raise ValueError("mots clés absents")
                        texte_src = normaliser(" ".join(textes[x] for x in src))
                        if any(normaliser(m) not in texte_src for m in mots):
                            raise ValueError("mot clé absent des pages citées")
                        verif = {"sources": src, "mots_cles": mots, "reponse_courte": d.get("reponse_courte")}
                    elif typ == "web-absent":
                        verif = {"absent": d.get("absent")}
                    else:  # web-alteree, web-saine
                        p, m = int(d.get("source", -1)), int(prevu["source_insertion"])
                        val, phrase = str(d.get("valeur", "")).strip(), str(d.get("phrase", ""))
                        num = (NUM.match(val) or [None])[0] if val else None
                        if num and p in textes and not sur_page(num, textes[p]):
                            p = next((k for k, t in textes.items() if sur_page(num, t)), p)  # page fausse annoncée
                        if p == m:
                            m = rnd.choice([k for k in textes if k != p])
                        if p not in textes or not num or val not in phrase or not sur_page(num, textes[p]):
                            raise ValueError("valeur absente de sa page ou de la phrase")
                        nouveau = alterer(num) if typ == "web-alteree" else num
                        if nouveau is None or (typ == "web-alteree" and sur_page(nouveau, textes[m])):
                            raise ValueError("valeur non modifiable")
                        insere = phrase.replace(val, val.replace(num, nouveau, 1), 1)
                        for w in web:
                            if w["n"] == m:
                                w["text"] = inserer(w["text"], insere)
                        verif = {"source": p, "source_insertion": m, "valeur": num, "nouveau": nouveau,
                                 "phrase_inseree": insere, "sources_requises": sorted({p, m})}
                        if typ == "web-alteree":
                            indice = (f"Writing note (not to be mentioned): pages [{p}] and [{m}] give two different "
                                      f"values for the same fact: {num} in [{p}] and {nouveau} in [{m}]. Point this out, "
                                      "citing both pages, without deciding which one is right unless the pages allow it, "
                                      "then answer the request." if lang == "en" else
                                      f"Indication de rédaction (à ne pas mentionner) : les pages [{p}] et [{m}] donnent "
                                      f"deux valeurs différentes pour le même fait : {num} en [{p}] et {nouveau} en [{m}]. "
                                      "Signale-le en citant les deux pages, sans trancher sauf si les pages le permettent, "
                                      "puis réponds à la demande.")
                except (ValueError, TypeError) as e:
                    rejets[f"{typ} : {e}"] += 1
                    continue
                jour = f"2026-{rnd.randint(1, 12):02d}-{rnd.randint(1, 28):02d}"
                t = {"id": f"{a['fiche']}#{i}", "fiche": a["fiche"], "domaine": fiche["domaine"], "type": typ,
                     "langue": lang, "pages": [], "web_n": len(web), "verif": verif, "reflexion": False,
                     "messages": [{"role": "system", "content": systeme.strip() + "\n\n" + bloc(web, lang, jour)},
                                  {"role": "user", "content": demande.strip()}]}
                if indice:
                    t["indice"] = indice
                out.write(json.dumps(t, ensure_ascii=False) + "\n")
                n += 1
    print(json.dumps({"taches": n, "rejets": dict(rejets.most_common())}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
