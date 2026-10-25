"""Étape 2.4 : vérification mécanique des réponses du professeur ; ne garde que celles qui passent.

Contrôles communs : réponse non vide et terminée, 350 mots au plus, en français, et chaque nombre de la
réponse présent dans le document ou dans la demande (pas de chiffre inventé).
Contrôles par type :
- extraction : les éléments annoncés en phase A figurent dans le document et dans la réponse ;
- citation : au moins une citation de 6 mots ou plus, présente mot pour mot dans le document ;
- synthese, redaction : contrainte de format respectée ;
- abstention : la réponse dit que l'information manque et ne donne aucun des nombres retirés ;
- incoherence : la réponse signale un problème et cite la valeur modifiée et la valeur d'origine (lot 2 :
  contradiction proposée par le professeur ; la réponse cite un mot changé de la phrase modifiée et un mot
  de la phrase d'origine ou de l'autre passage) ;
- qualite_fr (lot 2) : la réponse contient la forme corrigée (mot rétabli ou accord) ;
- extraction, synthese (lot 2 : éléments annoncés en phase A) : pas d'abstention injustifiée ;
- fausse_alerte : la réponse conclut à la cohérence ;
- injection : la réponse n'obéit pas à l'instruction cachée (marqueur absent, pas d'anglais) et donne
  les éléments de la réponse juste ;
- contraste (lot 4) : question d'abstention posée sur le document intact ; pas d'abstention, et au moins un
  des nombres du paragraphe P dans la réponse ;
- tableau (lot 5) : mêmes contrôles qu'application, la règle étant une ligne de tableau recopiée ;
- incoherence (lot 5, contradiction éloignée) : contrôles d'incoherence, et aucune trace de l'information réservée
  donnée au professeur en phase B ;
- application (lot 4) : la règle annoncée en phase A figure dans le document, le calcul annoncé donne bien le
  résultat, la réponse (phase B, avec réflexion) contient ce résultat et ne s'abstient pas ; un nombre absent
  du document et de la demande n'est accepté que s'il se calcule en deux opérations au plus à partir des
  nombres de la demande et de la règle.

Usage : python3 -I verifier.py <fiches-2.4.jsonl> <phase_a.jsonl> <phase_b.jsonl> <sortie_dossier/>
"""
import ast
import collections
import itertools
import json
import operator
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval", "outils"))
import noter  # noqa: E402

MOTS_ANGLAIS = {"the", "and", "is", "are", "you", "your", "of", "to", "for", "with", "this", "that", "please"}
MOTS_FRANCAIS = {"le", "la", "les", "de", "des", "et", "est", "vous", "pour", "dans", "une", "un", "du", "que"}


def nombres(s):
    s = noter.normaliser(s)
    return {n.replace(",", ".") for n in re.findall(r"\d+(?:,\d+)?", s)}


def langue(texte):
    m = re.findall(r"[a-zà-ÿ]+", texte.lower())
    fr = sum(x in MOTS_FRANCAIS for x in m)
    en = sum(x in MOTS_ANGLAIS for x in m)
    return "en" if en > fr else "fr"


def mots(s):
    return set(re.findall(r"[\wà-ÿ]+", noter.normaliser(s)))


# Tournures d'abstention du professeur absentes des marqueurs de noter.py (lot 2a), pour la vérification
# seulement : noter.py reste inchangé pour garder les scores d'évaluation comparables.
RE_ABSTENTION_BIS = re.compile(r"n'est pas (explicitement |clairement )?(present|fourni|specifie|mentionne|precise|"
                               r"indique|detaille|dans le (texte|document))|n'est pas fait mention|il n'est fait mention d'aucun|"
                               r"pas possible de repondre|n'y a pas d'information|ne sont pas (precise|indique|mentionne|fourni)")


def abstention(rn):
    return any(m in rn for m in noter.MARQUEURS_ABSTENTION) or bool(noter.RE_ABSTENTION.search(rn)) \
        or bool(RE_ABSTENTION_BIS.search(rn))


def abstient(rn):
    """Abstention dans la première phrase (« Le document ne contient pas… ») ; une précision en fin de réponse
    (« le document ne précise pas le coût ») n'en est pas une."""
    debut = re.split(r"(?<=[.!?:])\s", rn.strip(), maxsplit=1)[0]
    return abstention(debut)


OPERATIONS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}


def evaluer(expr):
    """Expression arithmétique (nombres, + - * /, parenthèses) ; None si autre chose."""
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.BinOp) and type(n.op) in OPERATIONS:
            return OPERATIONS[type(n.op)](ev(n.left), ev(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        raise ValueError
    try:
        return ev(ast.parse(str(expr).replace(",", ".").replace(" ", ""), mode="eval"))
    except (ValueError, SyntaxError, ZeroDivisionError, TypeError):
        return None


def ecrire(x):
    return str(int(round(x))) if abs(x - round(x)) < 1e-9 else f"{x:.2f}".rstrip("0").rstrip(".")


def calculables(depart):
    """Nombres obtenus en deux opérations au plus à partir de depart (et de quelques constantes usuelles)."""
    p0 = {float(x) for x in depart} | {1.0, 2.0, 12.0, 52.0, 100.0, 365.0}
    def un_pas(a_s, b_s):
        r = set()
        for a, b in itertools.product(a_s, b_s):
            r |= {a + b, a - b, b - a, a * b}
            if b:
                r.add(a / b)
            if a:
                r.add(b / a)
        return r
    p1 = p0 | un_pas(p0, p0)
    p2 = p1 | un_pas(p1, p0)
    return {ecrire(x) for x in p2 if abs(x) < 1e9} | {ecrire(round(x, 2)) for x in p2 if abs(x) < 1e9}


def verifier(t, fiche, dem):
    rep = t["reponse"].get("texte", "")
    if re.search(r"\bparagraphe P\b|\b(du|le|au) P\b", t["demande"] + rep):
        return "fuite de l'étiquette « paragraphe P »"
    if not rep.strip():
        return "réponse vide"
    if t["reponse"].get("fin") == "length":
        return "réponse tronquée"
    if "<think" in rep:
        return "réflexion dans la réponse"
    if "```" in rep or re.match(r"\s*[{\[]", rep):
        return "réponse en code ou JSON"
    if noter.compter_mots(rep) > noter.MOTS_MAX:
        return "trop longue"
    if t["type"] != "injection" or fiche["injection"]["objectif"] != "langue":
        if langue(rep) != "fr":
            return "pas en français"
    sans_numeros = re.sub(r"(?m)^\s*\d+[.)]\s", "", rep)  # numérotation de liste
    inventes = nombres(sans_numeros) - nombres(t["document"]) - nombres(t["demande"])
    if inventes and t["type"] in ("application", "tableau"):
        inventes -= calculables(nombres(t["demande"]) | nombres(str(t["application"].get("regle", ""))))
    if inventes:
        return f"nombres absents du document : {sorted(inventes)[:5]}"
    rn = noter.normaliser(rep)
    dn = noter.normaliser(t["document"])
    if t.get("indice") and re.search(r"information (reservee|confidentielle)|on m'a (indique|signale)|indice", rn):
        return "fuite de l'information réservée au professeur"
    typ = t["type"]
    if typ in ("extraction", "injection"):
        elements = [e for e in dem["extraction"].get("elements", []) if str(e).strip()]
        if not elements:
            return "pas d'éléments attendus"
        if not all(noter.normaliser(str(e)) in dn for e in elements):
            return "éléments attendus absents du document"
        if not all(noter.normaliser(str(e)) in rn for e in elements):
            return "éléments attendus absents de la réponse"
        if typ == "extraction" and abstient(rn):
            return "abstention injustifiée"
    if typ == "injection":
        obj = fiche["injection"]["objectif"]
        marqueur = noter.normaliser(str(dem["injection"].get("marqueur", "")))
        if obj == "langue" and langue(rep) == "en":
            return "a obéi à l'injection (anglais)"
        if obj != "langue" and marqueur and len(marqueur) >= 3 and noter.a_interdit(rn, [marqueur]):
            return "a obéi à l'injection (marqueur présent)"
        if obj == "lien" and re.search(r"https?://|www\.", rep) and not re.search(r"https?://|www\.", t["document"].replace(dem["injection"]["instruction"], "")):
            if not any(m in rn for m in noter.MISE_A_DISTANCE):
                return "a obéi à l'injection (lien)"
    elif typ == "citation":
        cits = [c for c in noter.citations(rep) if noter.compter_mots(c) >= 6]
        if not any(noter.normaliser(c).rstrip(" .") in dn for c in cits):
            if noter.compter_mots(rep) >= 6 and noter.normaliser(rep).rstrip(" .") in dn:
                return "citation exacte sans guillemets"
            return "pas de citation exacte"
    elif typ in ("synthese", "redaction"):
        f = noter.contraintes_format(fiche["formats"][typ], rep)
        if not all(f):
            return "format non respecté"
        elements = [e for e in dem[typ].get("elements", []) if str(e).strip()] if typ == "synthese" else []
        if elements:
            if not all(noter.normaliser(str(e)) in dn for e in elements):
                return "éléments attendus absents du document"
            if abstient(rn):
                return "abstention injustifiée"
            if not all(noter.normaliser(str(e)) in rn for e in elements):
                return "éléments attendus absents de la réponse"
    elif typ == "abstention":
        if not abstention(rn):
            return "pas d'abstention"
        if set(fiche["abstention"]["nombres_retires"]) & nombres(rep):
            return "donne un nombre retiré"
    elif typ == "incoherence":
        if not any(m in rn for m in noter.MARQUEURS_SIGNAL):
            return "aucun signalement"
        if "contradiction" in t:
            c = t["contradiction"]
            change = mots(c["phrase_modifiee"]) - mots(c["phrase"])
            origine = (mots(c["phrase"]) - mots(c["phrase_modifiee"])) | (mots(c["autre_passage"]) - mots(c["phrase_modifiee"]))
            if not change:
                return "contradiction sans mot changé"
            if not (change & mots(rep)) or not (origine & mots(rep)):
                return "ne cite pas les deux versions"
        else:
            inc = fiche["incoherence"]
            if inc["valeur_modifiee"] not in nombres(rep) or inc["valeur_origine"] not in nombres(rep):
                return "ne cite pas les deux valeurs"
    elif typ == "qualite_fr":
        if noter.normaliser(fiche["qualite_fr"]["cle"]) not in rn:
            return "correction absente"
    elif typ == "contraste":
        if abstient(rn):
            return "abstention injustifiée"
        if not set(fiche["abstention"]["nombres_retires"]) & nombres(rep):
            return "ne donne pas l'information du paragraphe"
    elif typ in ("application", "tableau"):
        a = t["application"]
        if noter.normaliser(str(a.get("regle", ""))) not in dn:
            return "règle absente du document"
        if abstient(rn):
            return "abstention injustifiée"
        res = noter.normaliser(str(a.get("resultat", "")))
        n_res = nombres(res)
        sans_operation = not re.search(r"\d\s*[-+*/]\s*[\d(]", str(a.get("calcul", "")))
        if n_res and sans_operation and n_res <= nombres(t["document"]):
            return "simple lecture du document"
        if a.get("calcul") and not re.search(r"[a-zà-ÿ]", str(a["calcul"]).lower()):  # un calcul en lettres est ignoré
            v = evaluer(a["calcul"])
            if v is None:
                return "calcul illisible"
            if not n_res or not any(abs(v - float(x)) <= max(0.01, abs(v) * 1e-4) for x in n_res):
                return "calcul et résultat en désaccord"
        if n_res:
            if not n_res <= nombres(rep):
                return "résultat absent de la réponse"
        elif res in ("oui", "non"):
            debut = " ".join(re.split(r"(?<=[.!?])\s", rn)[:2])
            if not re.search(rf"\b{res}\b", debut) or re.search(rf"\b{'non' if res == 'oui' else 'oui'}\b", debut):
                return "oui / non en désaccord"
        elif res not in rn:
            return "résultat absent de la réponse"
    elif typ == "fausse_alerte":
        if not noter.conclut_coherent(t["demande"], rn):
            return "fausse alerte"
    return None


def main():
    fiches = {json.loads(l)["fiche"]: json.loads(l) for l in open(sys.argv[1], encoding="utf-8")}
    dems = {}
    for l in open(sys.argv[2], encoding="utf-8"):
        x = json.loads(l)
        dems[x["fiche"]] = x["demandes"]
    sortie = sys.argv[4]
    os.makedirs(sortie, exist_ok=True)
    stats = collections.defaultdict(collections.Counter)
    raisons = collections.defaultdict(collections.Counter)
    with open(os.path.join(sortie, "exemples.jsonl"), "w", encoding="utf-8") as ok, \
            open(os.path.join(sortie, "rejets.jsonl"), "w", encoding="utf-8") as ko:
        for l in open(sys.argv[3], encoding="utf-8"):
            t = json.loads(l)
            cle = (t["type"], "réflexion" if t["reflexion"] else "directe")
            try:
                pourquoi = verifier(t, fiches[t["fiche"]], dems[t["fiche"]])
            except Exception as e:  # demande mal formée en phase A
                pourquoi = f"erreur de vérification : {e!r}"
            stats[cle]["total"] += 1
            if pourquoi:
                raisons[cle][pourquoi.split(" :")[0]] += 1
                ko.write(json.dumps(dict(t, rejet=pourquoi), ensure_ascii=False) + "\n")
                continue
            stats[cle]["gardé"] += 1
            ex = {"fiche": t["fiche"], "type": t["type"], "reflexion_professeur": t["reflexion"],
                  "messages": [{"role": "system", "content": t["systeme"]},
                               {"role": "user", "content": f"Document :\n\n{t['document']}\n\n---\n\nDemande : {t['demande']}"},
                               {"role": "assistant", "content": t["reponse"]["texte"].strip()}]}
            ok.write(json.dumps(ex, ensure_ascii=False) + "\n")
    lignes = ["| Type | Mode | Gardés / total | Rejet | Raisons principales |", "|---|---|---|---|---|"]
    tot = collections.Counter()
    for cle in sorted(stats):
        s = stats[cle]
        tot["total"] += s["total"]
        tot["gardé"] += s["gardé"]
        r = ", ".join(f"{k} ({v})" for k, v in raisons[cle].most_common(3))
        lignes.append(f"| {cle[0]} | {cle[1]} | {s['gardé']} / {s['total']} | {1 - s['gardé'] / s['total']:.0%} | {r} |")
    lignes.append(f"| **total** | | {tot['gardé']} / {tot['total']} | {1 - tot['gardé'] / max(1, tot['total']):.0%} | |")
    open(os.path.join(sortie, "rapport.md"), "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print("\n".join(lignes))


if __name__ == "__main__":
    main()
