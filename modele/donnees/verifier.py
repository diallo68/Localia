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
  les éléments de la réponse juste.

Usage : python3 -I verifier.py <fiches-2.4.jsonl> <phase_a.jsonl> <phase_b.jsonl> <sortie_dossier/>
"""
import collections
import json
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
    if inventes:
        return f"nombres absents du document : {sorted(inventes)[:5]}"
    rn = noter.normaliser(rep)
    dn = noter.normaliser(t["document"])
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
