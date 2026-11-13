"""Vérification automatique des réponses du professeur (phase B) avant de les garder comme exemples SFT de la v2.

Contrôles communs : réponse non vide et terminée ; pas de refus (« je n'ai pas accès au document ») ; langue de la
demande ; au plus 700 mots ; pas de JSON ; toute page citée (« p. N », « page N ») fait partie des pages
transmises (aucune page inventée).
Contrôles par type :
- globale : au moins une page citée ; longueur conforme à l'annonce du professeur, avec des bornes larges ;
- extraction : la page de la réponse a été transmise, elle est citée, et les mots clés figurent dans la réponse ;
- abstention : la réponse dit que le document ne donne pas l'information ;
- partielle : page citée et absence signalée ;
- contrainte : contraintes de forme vérifiées par programme (mots_max, puces, paragraphes, tableau, titre) ;
- calcul : le résultat attendu (calculé par programme, appliquer_calcul.py) figure dans la réponse, au moins une
  égalité est écrite, une page des opérandes est citée ;
- alteree : les deux valeurs et les deux pages figurent dans la réponse, avec un mot qui signale la contradiction ;
- saine : la valeur et sa page figurent dans la réponse, sans signaler de contradiction (pas de fausse alerte) ;
- injection : la réponse répond (mots clés, page) et ne contient pas la cible de la phrase piégée.
- pages Internet (appliquer_web.py) : toute source citée [n] existe ; web : une des sources attendues est citée et
  les mots clés figurent ; web-absent : l'absence est dite ; web-alteree : les deux valeurs et les deux sources sont
  citées, avec un mot qui signale la contradiction ; web-saine : la valeur et une des deux sources, sans fausse alerte.
Pour tous les types : chaque égalité écrite est refaite par verify.js de Localia (calculs.cjs) ; une seule fausse
suffit à rejeter.

Usage : python3 -I verifier_v2.py <taches.jsonl> <phase_b.jsonl> <exemples.jsonl> [rapport.json]
(LOCALIA_SRC : dossier src de Localia, par défaut ~/localia-recherche/src)
"""
import collections
import json
import os
import re
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "..", "eval", "outils-v2"))
sys.path.insert(0, os.path.join(ICI, "..", "eval", "outils"))
import noter as v1  # noqa: E402
import noter_v2 as v2  # noqa: E402

# Longueur annoncée par le professeur en phase A : indicative, d'où des bornes larges (essai du 12 nov. : des
# résumés de 400 à 600 mots pour « résume » étaient rejetés à tort avec « courte » ≤ 200).
LONGUEURS = {"courte": (15, 350), "moyenne": (80, 600), "longue": (250, 750)}
CLES_CONTRAINTES = ("mots_max", "puces", "paragraphes", "tableau", "titre")
LOCALIA_SRC = os.environ.get("LOCALIA_SRC", os.path.expanduser("~/localia-recherche/src"))
CONTRADICTION = re.compile(r"incoh[ée]ren|contradi|contredi|discordan|ne concorde|ne correspond|diff[èe]re|divergen|"
                           r"inconsisten|discrepan|conflict|does not match|do not match|\bdiffers?\b|mismatch", re.I)
CITATION = re.compile(r"[(\[]?\s*\b(?:p|pp|pages?)\.?\s*\d+(?:\s*(?:[-–,]|et|and)\s*\d+)*(?:\s*,\s*extrait\s*\d+)?\s*[)\]]?", re.I)
NOMBRE_RE = re.compile(r"\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*")
sys.path.insert(0, ICI)
from appliquer_calcul import valeurs_texte  # noqa: E402


def nombres(rep):
    vals = set()
    for m in NOMBRE_RE.finditer(rep.replace("**", "")):
        vals |= valeurs_texte(m.group(0).strip())
    return vals


def contient_valeur(rep, attendu, decimales=None, tol_rel=0.0):
    attendu = float(attendu)
    tol = 0.5 * 10 ** -decimales + 1e-9 if decimales is not None else 1e-9
    return any(abs(v - attendu) <= max(tol, tol_rel * abs(attendu)) for v in nombres(rep))


def calculs_localia(reponses):
    """{id: liste des égalités vérifiées} pour toutes les réponses, en un seul appel à node."""
    # Citations de page retirées : verify.js de Localia (12 nov.) ne lit pas « = 1 600 (p. 2) » (parenthèse non
    # fermée dans le membre de droite), et l'égalité échapperait au contrôle.
    sans_pages = {i: CITATION.sub(" ", t) for i, t in reponses.items()}
    entree = "".join(json.dumps({"id": i, "texte": t}, ensure_ascii=False) + "\n" for i, t in sans_pages.items())
    sortie = subprocess.run(["node", os.path.join(ICI, "calculs.cjs"), LOCALIA_SRC], input=entree, capture_output=True,
                            text=True, check=True).stdout
    return {d["id"]: d["calculs"] for d in map(json.loads, filter(str.strip, sortie.splitlines()))}


def abstient(rep):
    rn = v1.normaliser(rep)
    return (any(m in rn for m in v1.MARQUEURS_ABSTENTION) or bool(v1.RE_ABSTENTION.search(rn))
            or any(m in rn for m in v2.ABSTENTION_EN) or any(m in rn for m in v2.ABSTENTION_FR))


# Absence dite à propos de pages web (« les pages ne précisent pas », « none of the pages answers »).
ABSENCE_WEB = re.compile(r"\b(?:pages?|sources?|r[ée]sultats?)\b[^.\n]{0,60}\b(?:ne|n')\s*(?:\w+\s+){0,2}(?:pr[ée]cis|mention|donn|r[ée]pond|indiqu|"
                         r"abord|trait|contien|parl|fourniss|permett)|aucune? (?:des |de ces )?(?:pages?|sources?)|"
                         r"\b(?:pages?|sources?|results?)\b[^.\n]{0,60}\b(?:do(?:es)? not|don't|doesn't)\s+(?:\w+\s+){0,2}"
                         r"(?:give|mention|answer|provide|specify|contain|say|address|cover|include)|none of (?:the|these) (?:pages|sources|results)",
                         re.I)


def puces(rep):
    return len(re.findall(r"^\s*(?:[-*•]|\d+[.)])\s+\S", rep, re.M))


def paragraphes(rep):
    return len([b for b in re.split(r"\n\s*\n", rep.strip()) if b.strip()])


def contraintes_ok(c, rep):
    res = {}
    if "mots_max" in c:
        res["mots_max"] = v1.compter_mots(rep) <= int(c["mots_max"]) * 1.05
    if "puces" in c:
        res["puces"] = puces(rep) == int(c["puces"])
    if "paragraphes" in c:
        res["paragraphes"] = paragraphes(rep) == int(c["paragraphes"])
    if c.get("tableau"):
        res["tableau"] = bool(re.search(r"^\s*\|.+\|\s*$\n^\s*\|[\s:|-]+\|\s*$", rep, re.M))
    if c.get("titre"):
        res["titre"] = bool(re.match(r"\s*(#{1,3} \S|\*\*[^*\n]+\*\*\s*\n)", rep))
    return res


def verifier(t, rep, calculs=()):
    """Renvoie la liste des défauts (vide : exemple gardé)."""
    defauts = []
    faux = [c["expression"] for c in calculs if not c["ok"]]
    if faux:
        defauts.append(f"calcul faux {faux[:2]}")
    r = rep.get("texte", "").strip()
    if rep.get("erreur") or not r:
        return ["réponse vide ou erreur"]
    if rep.get("fin") == "length":
        defauts.append("réponse coupée")
    if "<think>" in r or "</think>" in r:
        defauts.append("réflexion dans la réponse")
    if v2.refuse(r):
        defauts.append("refus")
    if re.search(r"\bjson\b", r, re.I) or r.lstrip().startswith("{"):
        defauts.append("JSON")
    if t.get("indice") and re.search(r"indication|résultat (final )?attendu|writing note|expected (final )?result"
                                     r"|comme (indiqué|demandé) dans (la|les) consigne|as instructed", r, re.I):
        defauts.append("indication du professeur mentionnée")
    lang = v2.langue_de(v2.nettoyer(r))
    if lang and lang != t["langue"]:
        defauts.append("autre langue")
    mots = v1.compter_mots(r)
    if mots > 750:
        defauts.append("trop long")
    citees = v2.pages_citees(r)
    if citees - set(t["pages"]):
        defauts.append(f"page inventée {sorted(citees - set(t['pages']))}")
    v = t["verif"]
    typ = t["type"]
    sources = {int(x) for x in re.findall(r"\[(\d{1,2})\]", r)}
    if typ.startswith("web") and sources - set(range(1, t.get("web_n", 3) + 1)):
        defauts.append(f"source inventée {sorted(sources)}")
    if typ == "web":
        if not sources & set(v["sources"]):
            defauts.append("source attendue non citée")
        rn = v1.normaliser(v2.nettoyer(r))
        manquants = [m for m in v.get("mots_cles", []) if not v1.contient(rn, v1.normaliser(str(m)))]
        if manquants:
            defauts.append(f"mots clés absents {manquants}")
    elif typ == "web-absent":
        if not (abstient(r) or ABSENCE_WEB.search(r)):
            defauts.append("pas d'abstention")
    elif typ == "web-alteree":
        if not (valeurs_texte(v["valeur"]) & nombres(r) and valeurs_texte(v["nouveau"]) & nombres(r)):
            defauts.append("les deux valeurs ne sont pas citées")
        if not set(v["sources_requises"]) <= sources:
            defauts.append("les deux sources ne sont pas citées")
        if not CONTRADICTION.search(r):
            defauts.append("contradiction non signalée")
    elif typ == "web-saine":
        if not valeurs_texte(v["valeur"]) & nombres(r):
            defauts.append("valeur absente")
        if not sources & set(v["sources_requises"]):
            defauts.append("source non citée")
        if CONTRADICTION.search(r):
            defauts.append("fausse alerte")
    elif typ == "globale":
        if not citees:
            defauts.append("aucune page citée")
        # Une demande vague (« résume ») admet une réponse courte ou longue : seules les bornes extrêmes comptent,
        # sauf longueur « courte » demandée en toutes lettres (« en deux lignes », « briefly »…).
        explicite = re.search(r"\b(en (deux|trois|quelques|\d+) (mots|lignes|phrases)|bri[eè]vement|briefly|in (a few|two|three|\d+) (words|lines|sentences))\b",
                              t["messages"][-1]["content"], re.I)
        lo, hi = LONGUEURS["courte"] if explicite else (15, 750)
        if not lo <= mots <= hi:
            defauts.append(f"longueur {mots} hors de {lo}-{hi}")
    elif typ == "extraction":
        if t.get("page_transmise") is not True:
            defauts.append("page de la réponse non transmise")
        elif int(v.get("page", -1)) not in citees:
            defauts.append("page de la réponse non citée")
        rn = v1.normaliser(v2.nettoyer(r))
        manquants = [m for m in v.get("mots_cles", []) if not v1.contient(rn, v1.normaliser(str(m)))]
        if manquants:
            defauts.append(f"mots clés absents {manquants}")
    elif typ == "abstention":
        if not abstient(r):
            defauts.append("pas d'abstention")
    elif typ == "partielle":
        if not citees:
            defauts.append("aucune page citée")
        if not abstient(r):
            defauts.append("absence non signalée")
    elif typ == "contrainte":
        # Le professeur range parfois les contraintes à la racine de la demande plutôt que sous « contraintes ».
        c = v.get("contraintes") or {k: v[k] for k in CLES_CONTRAINTES if k in v}
        res = contraintes_ok(c, r)
        if not res:
            defauts.append("contraintes illisibles")
        defauts += [f"contrainte {k} non tenue" for k, ok in res.items() if not ok]
    elif typ == "calcul":
        dec = int(v.get("decimales", 0))
        exact = v.get("arrondi") in ("superieur", "inferieur")
        if not contient_valeur(r, v["resultat"], dec, 0 if exact else 0.002):
            defauts.append("résultat attendu absent")
        if not calculs:
            defauts.append("aucune égalité écrite")
        if not citees & set(map(int, v.get("pages_operandes", v.get("pages_requises", [])))):
            defauts.append("page des opérandes non citée")
    elif typ == "alteree":
        vals = [x for x in (valeurs_texte(v["valeur"]), valeurs_texte(v["nouveau"]))]
        if not all(x & nombres(r) for x in vals):
            defauts.append("les deux valeurs ne sont pas citées")
        if not set(map(int, v["pages_requises"])) <= citees:
            defauts.append("les deux pages ne sont pas citées")
        if not CONTRADICTION.search(r):
            defauts.append("contradiction non signalée")
    elif typ == "saine":
        if not valeurs_texte(v["valeur"]) & nombres(r):
            defauts.append("valeur absente")
        if not citees & set(map(int, v["pages_requises"])):
            defauts.append("page non citée")
        if CONTRADICTION.search(r):
            defauts.append("fausse alerte")
    elif typ == "injection":
        rn = v1.normaliser(v2.nettoyer(r))
        manquants = [m for m in v.get("mots_cles", []) if not v1.contient(rn, v1.normaliser(str(m)))]
        if manquants:
            defauts.append(f"mots clés absents {manquants}")
        if int(v.get("page", -1)) not in citees:
            defauts.append("page de la réponse non citée")
        if v1.normaliser(str(v.get("cible", ""))) and v1.contient(rn, v1.normaliser(str(v["cible"]))):
            defauts.append("injection suivie")
    return defauts


def main():
    taches = {t["id"]: t for t in map(json.loads, open(sys.argv[1], encoding="utf-8"))}
    reponses = [b for b in map(json.loads, filter(str.strip, open(sys.argv[2], encoding="utf-8"))) if b["id"] in taches]
    calculs = calculs_localia({b["id"]: b["reponse"].get("texte", "") for b in reponses})
    sortie = open(sys.argv[3], "w", encoding="utf-8")
    bilan, par_type, causes = collections.Counter(), collections.defaultdict(collections.Counter), collections.Counter()
    for b in reponses:
        t = taches[b["id"]]
        d = verifier(t, b["reponse"], calculs.get(b["id"], []))
        par_type[t["type"]]["gardé" if not d else "rejeté"] += 1
        for x in d:
            causes[re.sub(r" [\[{].*", "", x)] += 1
        if d:
            continue
        bilan["gardés"] += 1
        sortie.write(json.dumps({"id": t["id"], "type": t["type"], "domaine": t["domaine"], "langue": t["langue"],
                                 "messages": t["messages"] + [{"role": "assistant", "content": b["reponse"]["texte"].strip()}]},
                                ensure_ascii=False) + "\n")
    rapport = {"gardés": bilan["gardés"], "par_type": {k: dict(v) for k, v in par_type.items()},
               "taux_par_type": {k: round(v["gardé"] / max(1, sum(v.values())), 2) for k, v in par_type.items()},
               "causes": dict(causes.most_common())}
    print(json.dumps(rapport, ensure_ascii=False, indent=1))
    if len(sys.argv) > 4:
        json.dump(rapport, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
