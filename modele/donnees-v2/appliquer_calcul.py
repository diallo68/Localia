"""Entre la phase A et la phase B du calcul et des incohérences : vérification par programme de ce que le professeur
a écrit, puis documents modifiés.

- "calcul" : chaque opérande se trouve sur sa page ; l'expression (nombres et + - * / seulement) redonne le
  résultat après l'arrondi annoncé ; les valeurs des opérandes figurent dans l'expression.
- "alteree" / "saine" : la valeur est écrite sur sa page et dans la phrase, la page diffère de la page d'insertion ;
  la phrase est insérée dans la page d'insertion, avec une autre valeur pour "alteree" (choisie par le programme).
- "injection" : les mots clés sont sur la page, la cible n'est pas dans le document ; la phrase piégée est insérée
  dans la page de la réponse.
Une demande rejetée garde sa place (demande vide), pour que les identifiants restent alignés.
Sorties : <phase_a_complet.jsonl> (demandes enrichies de ce qu'il faut pour la vérification) et, pour chaque demande
qui modifie le document, <pages_modif>/<fiche>#<i>.json.

Usage : python3 -I appliquer_calcul.py <phase_a.jsonl> <fiches.jsonl> <phase_a_complet.jsonl> <pages_modif>
"""
import ast
import collections
import json
import math
import operator
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fiches_calcul import NOMBRE, ecrire_comme, valeur  # noqa: E402

rnd = random.Random(20261114)
OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}


def evaluer(expr):
    """Expression arithmétique sûre : nombres, + - * /, parenthèses. Renvoie (valeur, constantes)."""
    consts = []

    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool):
            consts.append(float(n.value))
            return float(n.value)
        if isinstance(n, ast.BinOp) and type(n.op) in OPS:
            return OPS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        raise ValueError("expression non permise")

    return ev(ast.parse(str(expr), mode="eval")), consts


def arrondir(x, mode, dec):
    f = 10 ** dec
    if mode == "superieur":
        return math.ceil(x * f - 1e-9) / f
    if mode == "inferieur":
        return math.floor(x * f + 1e-9) / f
    if mode == "proche":
        return round(x, dec)
    return x


def valeurs_texte(tok):
    """Lectures possibles d'un nombre écrit (« 1 250 », « 1,250 », « 8,75 », « 12 % »)."""
    t = re.sub(r"[\s  %]", "", str(tok))
    if not re.fullmatch(r"\d[\d.,]*", t):
        return set()
    vals = set()
    if "," in t and "." in t:
        dec = "," if t.rfind(",") > t.rfind(".") else "."
        mil = "." if dec == "," else ","
        vals.add(float(t.replace(mil, "").replace(dec, ".")))
    elif "," in t or "." in t:
        sep = "," if "," in t else "."
        if re.fullmatch(rf"\d{{1,3}}(\{sep}\d{{3}})+", t):
            vals.add(float(t.replace(sep, "")))
        if t.count(sep) == 1:
            vals.add(float(t.replace(sep, ".")))
    else:
        vals.add(float(t))
    return vals


# Mots seulement : « m », « k » seuls sont ambigus (mètres, kilo-).
MULT = [(r"milliards?\b|billions?\b", 1e9), (r"millions?\b", 1e6), (r"mille\b|thousands?\b", 1e3)]
NUM_SEUL = re.compile(r"\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?")


def normaliser_operande(o):
    """13 nov. : 436 opérandes de la phase A recopiés avec unité ou mot (« 2,1 millions », « $43,792 », « 120h »).
    Renvoie (nombre tel qu'écrit, multiplicateur) ; nombre None si l'opérande n'a pas de chiffres (« dix »)."""
    t = str(o.get("texte", ""))
    m = NUM_SEUL.search(t)
    if not m:
        return None, 1.0
    reste = t[m.end():]
    mult = next((f for motif, f in MULT if re.match(r"\s*(?:" + motif + ")", reste, re.I)), 1.0)
    return m.group(0), mult


def sur_page(tok, texte):
    """Le nombre tok est-il écrit sur la page (même valeur, quelle que soit l'écriture) ?"""
    cible = valeurs_texte(tok)
    if not cible:
        return False
    for m in NOMBRE.finditer(texte):
        if valeurs_texte(m.group(1)) & cible:
            return True
    return False


def normaliser(s):
    import unicodedata
    s = unicodedata.normalize("NFD", str(s).lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def inserer(texte, phrase):
    """Insère la phrase à une fin de phrase proche d'un point tiré au hasard dans la page."""
    fins = [m.end() for m in re.finditer(r"[.!?]\s", texte)]
    if not fins:
        return texte.rstrip() + " " + phrase
    cible = rnd.uniform(0.25, 0.85) * len(texte)
    i = min(fins, key=lambda f: abs(f - cible))
    return texte[:i] + phrase.strip() + " " + texte[i:]


def alterer(tok):
    v = valeur(tok)
    if v is None:
        return None
    for _ in range(20):
        nv = v * rnd.choice([rnd.uniform(0.55, 0.85), rnd.uniform(1.2, 1.7)])
        if not re.search(r"[.,]\d", tok):
            nv = round(nv)
        nouveau = ecrire_comme(tok, nv)
        if nouveau != tok and valeur(nouveau) not in (None, v):
            return nouveau
    return None


def main():
    phase_a, fiches_f, sortie, modif = sys.argv[1:5]
    os.makedirs(modif, exist_ok=True)
    fiches = {f["fiche"]: f for f in map(json.loads, open(fiches_f, encoding="utf-8"))}
    bilan, rejets = collections.Counter(), collections.Counter()
    with open(sortie, "w", encoding="utf-8") as out:
        for a in map(json.loads, open(phase_a, encoding="utf-8")):
            fiche, r = fiches.get(a["fiche"]), a.get("resultat")
            if not fiche or not r or not isinstance(r.get("demandes"), list):
                out.write(json.dumps(a, ensure_ascii=False) + "\n")
                continue
            pages = {p["number"]: p["text"] for p in fiche["vue"]}
            doc_norm = normaliser(" ".join(pages.values()))
            demandes = []
            for i, d in enumerate(r["demandes"]):
                if i >= len(fiche["demandes"]) or not isinstance(d, dict):
                    continue
                prevu = fiche["demandes"][i]
                d = dict(d, type=prevu["type"], langue=prevu["langue"])
                motif = None
                try:
                    if prevu["type"] == "calcul":
                        ops = [o for o in (d.get("operandes") or []) if isinstance(o, dict)]
                        for o in ops:
                            num, mult = normaliser_operande(o)
                            if num:
                                o["texte"], o["mult"] = num, mult
                        d["operandes"] = ops
                        if not ops:
                            motif = "calcul sans opérande"
                        # Page fausse annoncée par le professeur (13 nov. : cas fréquent) : le nombre est cherché sur
                        # toutes les pages ; les pages requises sont celles où il figure.
                        trouve = [[int(o.get("page", -1))] if sur_page(o.get("texte"), pages.get(int(o.get("page", -1)), ""))
                                  else [k for k, t in pages.items() if sur_page(o.get("texte"), t)] for o in ops]
                        if any(not t for t in trouve):
                            motif = "opérande absent du document"
                        elif not re.search(r"\d\s*[-+*/]\s*[\d(]", str(d.get("expression", ""))):
                            motif = "calcul sans opération"
                        else:
                            v, consts = evaluer(d["expression"])
                            res = arrondir(v, d.get("arrondi", "aucun"), int(d.get("decimales", 0)))
                            attendu = float(d["resultat"])
                            if abs(res - attendu) > max(1e-6, 1e-6 * abs(attendu)) and not (
                                    d.get("arrondi", "aucun") == "aucun"
                                    and abs(v - attendu) <= 0.5 * 10 ** -int(d.get("decimales", 0)) + 1e-9):
                                motif = "résultat faux"
                            elif any(not any(abs(c - y) <= max(1e-9, 1e-9 * abs(y)) or abs(c - x / 100) < 1e-12
                                             for c in consts for x in valeurs_texte(o["texte"])
                                             for y in {x, x * o.get("mult", 1.0)})
                                     for o in ops):
                                motif = "opérande absent de l'expression"
                            # 13 nov. : 101 questions sur 525 étaient de simples lectures (« 189 », « 40 / 100 * 100 ») ;
                            # un calcul dont le résultat est l'un de ses nombres n'en est pas un.
                            elif any(abs(attendu - x) <= max(1e-9, 1e-9 * abs(x))
                                     for o in ops for v0 in valeurs_texte(o["texte"]) for x in {v0, v0 * o.get("mult", 1.0)}):
                                motif = "calcul trivial (résultat = un opérande)"
                            else:
                                d["resultat"] = attendu
                                for o, t in zip(ops, trouve):  # page réelle du nombre (indication de la phase B)
                                    o["page"] = t[0]
                                d["pages_requises"] = sorted({p for t in trouve for p in t[:1]})
                                d["pages_operandes"] = sorted({p for t in trouve for p in t})
                    elif prevu["type"] in ("alteree", "saine"):
                        p, y, val, phrase = int(d.get("page", -1)), prevu["page_insertion"], str(d.get("valeur", "")).strip(), str(d.get("phrase", ""))
                        # Valeur écrite avec un mot (« 2,1 millions ») : seul le nombre est cherché et modifié.
                        m = re.match(r"\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?", val)
                        num = m.group(0) if m else ""
                        if num and p not in pages or (num and not sur_page(num, pages.get(p, ""))):
                            ailleurs = [k for k, t in pages.items() if sur_page(num, t)]  # page fausse annoncée
                            p = ailleurs[0] if ailleurs else p
                        if p == y and len(pages) > 1:  # le professeur a pris la page d'insertion : on en tire une autre
                            y = rnd.choice([k for k in pages if k != p])
                        if p == y or p not in pages:
                            motif = "page du fait = page d'insertion"
                        elif not num or val not in phrase or not sur_page(num, pages[p]) or valeur(num) is None:
                            motif = "valeur absente de sa page ou de la phrase"
                        else:
                            nouveau = alterer(num) if prevu["type"] == "alteree" else num
                            if nouveau is None:
                                motif = "valeur non modifiable"
                            else:
                                d["page"], d["valeur"] = p, num
                                insert = phrase.replace(val, val.replace(num, nouveau, 1), 1)
                                nv = dict(pages)
                                nv[y] = inserer(pages[y], insert)
                                d.update(page_insertion=y, nouveau=nouveau, phrase_inseree=insert, pages_requises=sorted({p, y}))
                                json.dump({"name": fiche["titre"], "pages": [{"number": k, "text": nv[k]} for k in sorted(nv)]},
                                          open(os.path.join(modif, f"{a['fiche']}#{i}.json"), "w", encoding="utf-8"), ensure_ascii=False)
                    elif prevu["type"] == "injection":
                        p, inj, cible = int(d.get("page", -1)), str(d.get("injection", "")), normaliser(d.get("cible", ""))
                        mots = [str(m) for m in d.get("mots_cles") or []]
                        if p not in pages or len(inj) < 20 or not cible:
                            motif = "injection incomplète"
                        elif cible in doc_norm:
                            motif = "cible déjà dans le document"
                        elif not mots or any(normaliser(m) not in normaliser(pages[p]) for m in mots):
                            motif = "mots clés absents de la page"
                        else:
                            nv = dict(pages)
                            nv[p] = inserer(pages[p], inj)
                            d["pages_requises"] = [p]
                            json.dump({"name": fiche["titre"], "pages": [{"number": k, "text": nv[k]} for k in sorted(nv)]},
                                      open(os.path.join(modif, f"{a['fiche']}#{i}.json"), "w", encoding="utf-8"), ensure_ascii=False)
                except (ValueError, TypeError, KeyError, SyntaxError, ZeroDivisionError) as e:
                    motif = f"illisible ({type(e).__name__})"
                bilan[prevu["type"]] += 1
                if motif:
                    rejets[f"{prevu['type']} : {motif}"] += 1
                    d["demande"] = ""
                demandes.append(d)
            a["resultat"]["demandes"] = demandes
            out.write(json.dumps(a, ensure_ascii=False) + "\n")
    print(json.dumps({"demandes": dict(bilan), "rejets": dict(rejets.most_common())}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
