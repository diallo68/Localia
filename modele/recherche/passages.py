"""Recherche de passages pour les longs documents (au-delà d'environ 30 pages).

Mesuré le 18 octobre : le 2B garde sa qualité à 64k jetons (100 pages), mais la lecture complète prend 2 h 37
sur le CPU du Mac avant la première réponse. Au lieu de lire tout le document, on le découpe en passages, on
retrouve ceux qui répondent à la question et on ne donne qu'eux au modèle, dans un budget de jetons proche du
contexte court (où le modèle a été entraîné et mesuré).

Méthode (Python pur, sans dépendance) :
- découpage en suivant la structure Markdown : chaque passage garde le chemin de ses titres
  (« Titre de la fiche > Section > Sous-section ») et compte environ MOTS_PASSAGE mots ;
- classement BM25 sur le chemin des titres et le texte, après normalisation du français (minuscules, sans
  accents, mots vides retirés, pluriels ramenés au singulier) ;
- sélection des meilleurs passages dans un budget de jetons, puis remise dans l'ordre du document, regroupés
  par fiche et par section, avec « […] » entre deux passages non contigus.

Expansion de requête (option --expansion URL) : le modèle local réécrit d'abord la question avec le vocabulaire
administratif probable (mots-clés) ; deux recherches BM25 (question seule, question + mots-clés) sont fusionnées
par rang réciproque (RRF), pour aider quand l'usager n'emploie pas les mots du document (« poubelles » au lieu de
« déchets ») sans noyer la question quand il les emploie.

Usage :
  python3 -I passages.py chercher <document.md> "<question>" [--budget 3000]
  python3 -I passages.py jeu <dossier_long/> <sortie/> [--budget 3000]
      (un document d'extraits par cas : <sortie>/documents/<id>.md, et cas.jsonl adapté, pour executer.py)
"""
import argparse
import json
import math
import os
import re
import unicodedata
from collections import Counter

MOTS_PASSAGE = 120
CAR_PAR_JETON = 3.6  # [mesuré] long128k : 566 284 caractères pour 130 839 jetons (tokenizer Qwen3.5)
K1, B = 1.2, 0.75

MOTS_VIDES = set("""a au aux avec ce ces cet cette dans de des du elle elles en et est etre eux il ils je la le les leur
leurs lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sont sur ta te tes
toi ton tu un une vos votre vous y d l j m n s t c qu quel quelle quels quelles quoi dont ou si comment combien
peut peuvent doit doivent faut il-y cela ca est-ce sont ete avoir fait faire plus moins tout tous toute toutes
cas lorsque quand selon cite citez phrase document indique precise donne""".split())


def normaliser(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"(?<=\d)[  .](?=\d{3}\b)", "", s)  # 12 000 -> 12000


def racine(m):
    if m.isdigit() or len(m) <= 3:
        return m
    for suf in ("ements", "ement", "ations", "ation", "ments", "ment", "euses", "euse", "eurs", "eur", "ees", "ee",
                "es", "s", "x", "e"):
        if m.endswith(suf) and len(m) - len(suf) >= 4:
            return m[:-len(suf)]
    return m


def mots(s):
    return [racine(m) for m in re.findall(r"[a-z0-9€%]+", normaliser(s)) if m not in MOTS_VIDES]


def decouper(md):
    """Passages : {"chemin": [titres], "texte", "debut" (position), "section" (identifiant)}."""
    passages, chemin, courant, n_mots, section = [], [], [], 0, 0

    def fermer():
        nonlocal courant, n_mots
        if courant:
            passages.append({"chemin": list(chemin), "texte": "\n\n".join(courant), "section": section,
                             "rang": len(passages)})
        courant, n_mots = [], 0

    for bloc in re.split(r"\n\s*\n", md):
        bloc = bloc.strip()
        if not bloc:
            continue
        m = re.match(r"(#{1,6})\s+(.*)", bloc)
        if m and "\n" not in bloc:
            fermer()
            niveau = len(m.group(1))
            chemin = chemin[:niveau - 1] + [m.group(2).strip()]
            section += 1
            continue
        n = len(bloc.split())
        if n_mots and n_mots + n > MOTS_PASSAGE * 1.5:
            fermer()
        courant.append(bloc)
        n_mots += n
        if n_mots >= MOTS_PASSAGE:
            fermer()
    fermer()
    return passages


class Index:
    def __init__(self, passages):
        self.passages = passages
        self.docs = [Counter(mots(" ".join(p["chemin"])) * 2 + mots(p["texte"])) for p in passages]
        self.longueurs = [sum(d.values()) for d in self.docs]
        self.moyenne = sum(self.longueurs) / max(1, len(self.longueurs))
        df = Counter(m for d in self.docs for m in d)
        n = len(self.docs)
        self.idf = {m: math.log(1 + (n - f + 0.5) / (f + 0.5)) for m, f in df.items()}

    def scores(self, question):
        q = set(mots(question))
        res = []
        for d, l in zip(self.docs, self.longueurs):
            s = 0.0
            for m in q:
                f = d.get(m)
                if f:
                    s += self.idf[m] * f * (K1 + 1) / (f + K1 * (1 - B + B * l / self.moyenne))
            res.append(s)
        return res


CONSIGNE_EXPANSION = ("Un usager pose cette question sur un long document administratif français : « {q} »\n"
                      "Donne, sur une seule ligne, 10 à 15 mots-clés que le document emploierait probablement pour "
                      "en parler (termes administratifs ou juridiques officiels, synonymes). Réponds seulement par les mots-clés.")


def etendre(question, url):
    import urllib.request
    corps = {"messages": [{"role": "user", "content": CONSIGNE_EXPANSION.format(q=question)}], "temperature": 0,
             "max_tokens": 80, "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(url.rstrip("/") + "/chat/completions", data=json.dumps(corps).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=300).read())["choices"][0]["message"]["content"]


def jetons(s):
    return len(s) / CAR_PAR_JETON


def selectionner(index, question, budget=3000, k_rrf=60):
    """question : une chaîne, ou une liste de requêtes dont les classements sont fusionnés (rang réciproque)."""
    requetes = [question] if isinstance(question, str) else list(question)
    fusion = {}
    for q in requetes:
        sc = index.scores(q)
        for rang, i in enumerate(sorted((i for i in range(len(sc)) if sc[i] > 0), key=lambda i: -sc[i])[:200]):
            fusion[i] = fusion.get(i, 0.0) + 1 / (k_rrf + rang)
    choisis, total = [], 0.0
    for i in sorted(fusion, key=lambda i: -fusion[i]):
        p = index.passages[i]
        cout = jetons(p["texte"]) + jetons(" > ".join(p["chemin"])) + 4
        if total + cout > budget:
            if choisis:
                continue
        choisis.append(i)
        total += cout
        if total >= budget:
            break
    return sorted(choisis)


def rendre(index, choisis):
    """Extraits dans l'ordre du document, en Markdown : titre de fiche, chemin de section, « […] » entre deux
    passages non contigus."""
    sortie, fiche, section, precedent = [], None, None, None
    for i in choisis:
        p = index.passages[i]
        titre = p["chemin"][0] if p["chemin"] else ""
        if titre != fiche:
            sortie.append(f"# {titre}")
            fiche, section = titre, None
        elif precedent is not None and i != precedent + 1:
            sortie.append("[…]")
        if p["section"] != section and len(p["chemin"]) > 1:
            sortie.append("## " + " > ".join(p["chemin"][1:]))
        section = p["section"]
        sortie.append(p["texte"])
        precedent = i
    return "\n\n".join(sortie)


def chercher(md, question, budget=3000, index=None, expansion=None):
    index = index or Index(decouper(md))
    requetes = [question, question + " " + etendre(question, expansion)] if expansion else question
    return rendre(index, selectionner(index, requetes, budget))


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    a1 = sp.add_parser("chercher")
    a1.add_argument("document")
    a1.add_argument("question")
    a1.add_argument("--budget", type=int, default=3000)
    a1.add_argument("--expansion", help="URL OpenAI du modèle local (ex. http://127.0.0.1:8081/v1)")
    a2 = sp.add_parser("jeu")
    a2.add_argument("dossier")
    a2.add_argument("sortie")
    a2.add_argument("--budget", type=int, default=3000)
    a2.add_argument("--expansion", help="URL OpenAI du modèle local (ex. http://127.0.0.1:8081/v1)")
    a = ap.parse_args()
    if a.cmd == "chercher":
        print(chercher(open(a.document, encoding="utf-8").read(), a.question, a.budget, expansion=a.expansion))
        return
    cas = [json.loads(l) for l in open(os.path.join(a.dossier, "cas.jsonl"), encoding="utf-8")]
    os.makedirs(os.path.join(a.sortie, "documents"), exist_ok=True)
    index = {}
    with open(os.path.join(a.sortie, "cas.jsonl"), "w", encoding="utf-8") as s:
        for c in cas:
            if c["doc"] not in index:
                md = open(os.path.join(a.dossier, "documents", c["doc"] + ".md"), encoding="utf-8").read()
                index[c["doc"]] = Index(decouper(md))
            texte = chercher(None, c["consigne"], a.budget, index[c["doc"]], a.expansion)
            open(os.path.join(a.sortie, "documents", c["id"] + ".md"), "w", encoding="utf-8").write(texte)
            s.write(json.dumps(dict(c, doc=c["id"], doc_long=c["doc"]), ensure_ascii=False) + "\n")
    print(f"{len(cas)} cas -> {a.sortie} (budget {a.budget} jetons)")


if __name__ == "__main__":
    main()
