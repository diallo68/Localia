"""Dial-bowe v2 : ramène le lot SFT à 8 192 jetons (accord de l'auteur du 14 nov. 2026).

L'essai SFT du 14 nov. a montré qu'une T4 ne tient pas au-delà de 8 192 jetons (PyTorch pur : 14,5 Go à 8 192,
mémoire insuffisante à 10 240 ; flash-linear-attention : mémoire insuffisante dès 8 192). Plutôt que d'écarter les
exemples longs (surtout synthèse globale, extraction, contraintes, réponse partielle, abstention), on retire des
extraits du bloc « SOURCE DOCUMENTAIRE », comme Localia le fait lui-même quand le document dépasse le contexte :
- on garde toujours toutes les pages citées dans la réponse (« p. N », « pages N-M », « [Page N, extrait k] ») ;
- on complète, dans la limite du budget, avec les extraits les plus proches de la demande (mots en commun,
  pondérés par leur rareté dans le document), puis les voisins des pages citées ; ordre du document conservé ;
- les numéros d'extrait de Localia (décalage / 1400 + 1) ne dépendent que de la position dans la page : on n'a
  rien à renuméroter ;
- la ligne « Couverture » est réécrite (« extraits des pages … sur N ») ;
- jamais de texte ajouté : les exemples ne contiennent que des textes déjà vérifiés (provenance.md).
Écartés plutôt que raccourcis : synthèse globale (un résumé du document entier ne se vérifie plus sur des
extraits), injection (la page de la phrase piégée n'est pas connue ici), et tout exemple dont les pages citées
dépassent à elles seules le budget.
Après coupe, contrôles : toute page citée est transmise ; chaque nombre de la réponse qui figurait dans le document
y figure encore.

Usage : python3 -I raccourcir_8k.py <exemples.jsonl> <sortie.jsonl> <rapport.json> [--budget 8000]
(TOKENIZER : tokenizer.json de Qwen3.5-2B, celui de l'entraînement)
"""
import argparse
import collections
import json
import math
import os
import re

from tokenizers import Tokenizer

TOKENIZER = os.environ.get("TOKENIZER", os.path.expanduser(
    "~/.cache/huggingface/hub/models--Qwen--Qwen3.5-2B/snapshots/15852e8c16360a2fea060d615a32b45270f8a8fc/tokenizer.json"))
ECARTES_SI_LONGS = {"globale", "injection"}
MARGE_GABARIT = 12  # jetons du gabarit de conversation par message (mesuré large)

ap = argparse.ArgumentParser()
ap.add_argument("entree")
ap.add_argument("sortie")
ap.add_argument("rapport")
ap.add_argument("--budget", type=int, default=8000)  # sous 8 192 : marge pour le gabarit de Qwen
a = ap.parse_args()
tk = Tokenizer.from_file(TOKENIZER)


def n_jetons(texte):
    return len(tk.encode(texte).ids)


def total(messages):
    return sum(n_jetons(m["content"]) + MARGE_GABARIT for m in messages)


ETIQUETTE = re.compile(r"^\[Page (\d+), extrait (\d+)[^\]]*\]$")


def decouper(bloc):
    """En-tête (lignes avant le premier extrait), extraits [(page, k, texte avec étiquette)], pied."""
    lignes = bloc.split("\n")
    entete, extraits, pied = [], [], []
    courant = None
    for ln in lignes:
        m = ETIQUETTE.match(ln)
        if m:
            courant = [int(m.group(1)), int(m.group(2)), [ln]]
            extraits.append(courant)
        elif ln.startswith("SOURCE DOCUMENTAIRE — fin"):
            pied.append(ln)
            courant = None
        elif courant is not None and not pied:
            courant[2].append(ln)
        elif pied:
            pied.append(ln)
        else:
            entete.append(ln)
    return entete, [(p, k, "\n".join(t)) for p, k, t in extraits], pied


def pages_citees(reponse):
    """Pages (position dans le fichier) citées dans la réponse."""
    pages, extraits = set(), set()
    for p, k in re.findall(r"\[Page (\d+), extrait (\d+)", reponse):
        extraits.add((int(p), int(k)))
        pages.add(int(p))
    for m in re.finditer(r"\b(?:pp?\.|[Pp]ages?)\s*((?:\d+\s*(?:[-–]\s*\d+)?\s*(?:,|et|and|&)?\s*)+)", reponse):
        for x, y in re.findall(r"(\d+)(?:\s*[-–]\s*(\d+))?", m.group(1)):
            x = int(x)
            y = int(y) if y else x
            if 0 < x <= y and y - x <= 20:
                pages.update(range(x, y + 1))
    return pages


MOT = re.compile(r"[a-zà-öø-ÿ0-9]{4,}", re.I)


def nombres(texte):
    return {re.sub(r"[\s  ]", "", n) for n in re.findall(r"\d[\d\s  ]*[.,]?\d*", texte)
            if len(re.sub(r"\D", "", n)) >= 2}


def raccourcir(ex):
    """Renvoie (messages raccourcis, None) ou (None, cause)."""
    msgs = ex["messages"]
    i_doc = next((i for i, m in enumerate(msgs) if m["role"] == "user" and m["content"].startswith("SOURCE DOCUMENTAIRE")),
                 None)
    if i_doc is None:
        return None, "pas de document"
    if ex["type"] in ECARTES_SI_LONGS:
        return None, f"{ex['type']} trop long"
    entete, extraits, pied = decouper(msgs[i_doc]["content"])
    if not extraits:
        return None, "document sans extraits"
    reponse = msgs[-1]["content"]
    cites = pages_citees(reponse)
    pages_doc = {p for p, _, _ in extraits}
    if not cites & pages_doc and ex["type"] != "abstention":  # abstention : retirer du texte la laisse vraie
        return None, "aucune page citée transmise"
    hors_bloc = sum(n_jetons(m["content"]) + MARGE_GABARIT for j, m in enumerate(msgs) if j != i_doc)
    fixe = n_jetons("\n".join(entete + pied)) + 40 + MARGE_GABARIT  # 40 : ligne « Couverture » réécrite
    budget = a.budget - hors_bloc - fixe
    couts = [n_jetons(t) + 1 for _, _, t in extraits]
    garde = [p in cites for p, _, _ in extraits]
    if sum(c for c, g in zip(couts, garde) if g) > budget:
        return None, "pages citées plus longues que le budget"
    # Pertinence : mots de la demande, pondérés par leur rareté dans le document (idf sur les extraits).
    demande = " ".join(m["content"] for j, m in enumerate(msgs) if m["role"] == "user" and j != i_doc).lower()
    mots_dem = set(MOT.findall(demande))
    df = collections.Counter(w for _, _, t in extraits for w in set(MOT.findall(t.lower())))
    n = len(extraits)

    def score(i):
        p, _, t = extraits[i]
        mots = set(MOT.findall(t.lower()))
        s = sum(math.log(1 + n / df[w]) for w in mots_dem & mots)
        voisin = min((abs(p - c) for c in cites), default=99)
        return s + (2.0 if voisin == 1 else 0.0)

    reste = budget - sum(c for c, g in zip(couts, garde) if g)
    for i in sorted((i for i in range(n) if not garde[i]), key=score, reverse=True):
        if couts[i] <= reste:
            garde[i] = True
            reste -= couts[i]
    gardes = [e for e, g in zip(extraits, garde) if g]
    pages = sorted({p for p, _, _ in gardes})
    sur = re.search(r" sur (\d+)\.", "\n".join(entete))
    n_pages = int(sur.group(1)) if sur else max(pages_doc)
    entete2 = [f"Couverture : extraits des pages {', '.join(map(str, pages))} sur {n_pages}."
               if ln.startswith("Couverture :") else ln for ln in entete]
    bloc = "\n".join(entete2 + [t for _, _, t in gardes] + pied)
    # Contrôles : pages citées transmises ; nombres de la réponse présents dans le document le restent.
    if not (cites & pages_doc) <= set(pages):
        return None, "page citée perdue"
    avant, apres = nombres(msgs[i_doc]["content"]), nombres(bloc)
    perdus = {x for x in nombres(reponse) & avant if x not in apres}
    if perdus:
        return None, "nombre de la réponse perdu"
    nouveaux = [dict(m, content=bloc) if j == i_doc else m for j, m in enumerate(msgs)]
    if total(nouveaux) > a.budget:
        return None, "toujours trop long"
    return nouveaux, None


rapport = {"gardés tels quels": 0, "raccourcis": collections.Counter(), "écartés": collections.Counter(),
           "jetons avant": 0, "jetons après": 0, "extraits retirés (médiane %)": None}
parts = []
with open(a.sortie, "w") as s:
    for l in open(a.entree):
        ex = json.loads(l)
        t = total(ex["messages"])
        rapport["jetons avant"] += t
        if t <= a.budget:
            rapport["gardés tels quels"] += 1
            rapport["jetons après"] += t
            s.write(l if l.endswith("\n") else l + "\n")
            continue
        nouveaux, cause = raccourcir(ex)
        if cause:
            rapport["écartés"][f"{ex['type']} : {cause}"] += 1
            continue
        rapport["raccourcis"][ex["type"]] += 1
        rapport["jetons après"] += total(nouveaux)
        doc_avant = next(m["content"] for m in ex["messages"] if m["content"].startswith("SOURCE DOCUMENTAIRE"))
        doc_apres = next(m["content"] for m in nouveaux if m["content"].startswith("SOURCE DOCUMENTAIRE"))
        parts.append(1 - doc_apres.count("\n[Page ") / max(1, doc_avant.count("\n[Page ")))
        s.write(json.dumps(dict(ex, messages=nouveaux, raccourci_8k=True), ensure_ascii=False) + "\n")
parts.sort()
rapport["extraits retirés (médiane %)"] = round(100 * parts[len(parts) // 2]) if parts else None
rapport["total gardés"] = rapport["gardés tels quels"] + sum(rapport["raccourcis"].values())
json.dump(rapport, open(a.rapport, "w"), ensure_ascii=False, indent=1)
print(json.dumps(rapport, ensure_ascii=False))
