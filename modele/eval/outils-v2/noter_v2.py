"""Notation automatique des jeux de la v2 (G : demandes globales ; S2 : jeu secret), sur la base de noter.py (v1).

Ajouts par rapport à la v1 (écrits le 11 nov. 2026, avant toute réponse de modèle sur ces jeux) :
- tournures anglaises d'abstention, de signalement et de cohérence ;
- type « synthese » : au moins n idées sur une liste, avec contraintes de format facultatives ;
- type « page » : le fait demandé (moitié de la note) et un numéro de page juste (autre moitié) ;
- type « pas_de_refus » (jeu G) : 0 si la réponse dit ne pas avoir accès au document ; 1 si elle parle du document
  (un mot du titre) en 40 mots au moins ; 0,5 sinon ;
- langue : une réponse dans l'autre langue que la demande vaut la moitié (S2 seulement) ;
- tournures d'abstention courantes ajoutées (« n'a pas de », « not in the report ») et réponse « Non : … » comptée
  comme un signalement (contrôle sur les réponses attendues, avant tout modèle) ;
- mise en forme LaTeX retirée avant la notation (« 10\\,545\\,000 », « \\text{GNF} ») ;
- longueur : au-delà de 700 mots, la note est divisée par 2 (350 en v1, mais la v2 demande des résumés entiers).

Usage : python3 -I noter_v2.py <dossier_jeu> <reponses.jsonl> [sortie.json]
"""
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outils"))
import noter as v1  # noqa: E402

MOTS_MAX = 700

ABSTENTION_EN = [
    "not mentioned", "does not mention", "doesn't mention", "not specified", "does not specify", "doesn't specify",
    "not provided", "does not provide", "doesn't provide", "no information", "not in the document",
    "not in the text", "not stated", "does not state", "doesn't state", "does not say", "doesn't say",
    "not reported", "does not report", "doesn't report", "not given", "does not give", "doesn't give",
    "no mention", "does not include", "doesn't include", "is not mentioned", "isn't mentioned", "cannot find",
    "can't find", "not available in", "not included", "does not contain", "doesn't contain", "no data",
    "not covered", "does not cover", "doesn't cover", "no figure", "no such", "not indicated",
    "not in the report", "not in the article", "not in the paper", "none is mentioned", "there is no",
    "is not listed", "not listed", "no indication",
]
# Tournures françaises courantes absentes de la liste de la v1 (« le bulletin n'a pas de note d'informatique »).
ABSTENTION_FR = ["n'a pas de", "n'y a pas de", "n'y a aucun", "n'en parle", "ne contient aucun", "aucune note",
                 "pas de note", "n'existe pas dans"]
SIGNAL_EN = [
    "inconsisten", "contradict", "discrepanc", "error", "mistake", "incorrect", "wrong", "does not match",
    "doesn't match", "mismatch", "not consistent", "suspicious", "hidden instruction", "injection", "ignore",
    "however", "but ", "should be", "not correct", "miscalculat", "below the minimum", "missing",
]
COHERENT_EN = ["consistent", "no inconsistenc", "no discrepanc", "is correct", "are correct", "add up", "adds up",
               "match", "accurate", "no error", "correctly"]
NEGATION_EN = re.compile(r"inconsisten|not consistent|discrepanc|\berror|incorrect|\bwrong|mismatch|"
                         r"do(es)? not match|doesn't match|don't match|miscalculat")

# Refus de lire un document pourtant fourni (défaut de la v1, Localia, 10 nov. 2026).
REFUS = re.compile(
    r"je n'ai pas acces|je n'ai aucun acces|je ne (peux|suis) pas (en mesure d')?(acceder|lire|ouvrir|voir|consulter|"
    r"analyser|telecharger)|pas acces (au|a ce|a votre|aux)|aucun (document|fichier)( n'a ete| n'est)? "
    r"(joint|fourni|partage|transmis)|pas de (document|fichier) (joint|fourni)|veuillez (copier|coller|fournir|"
    r"partager|joindre)|copiez[- ]collez|copier[- ]coller (le|son|votre) (texte|contenu)|pouvez-vous (me )?(fournir|"
    r"partager|copier|envoyer|coller)|je ne vois (pas|aucun) (de |le )?(document|fichier)|"
    r"i (don't|do not) have access|i (can't|cannot|am unable to) (access|open|see|read|view)|"
    r"please (provide|paste|share|upload)|no (document|file) (was|has been) (attached|provided|shared)|"
    r"you (haven't|have not) (attached|shared|provided|uploaded)"
)

FR_MOTS = {"le", "la", "les", "des", "est", "et", "une", "du", "que", "pour", "dans", "sur", "par", "pas", "qui", "il"}
EN_MOTS = {"the", "and", "is", "of", "to", "in", "that", "for", "with", "are", "this", "it", "on", "by", "was", "be"}


def nettoyer(rep):
    """Retire la mise en forme LaTeX que les modèles mettent autour des calculs."""
    rep = re.sub(r"\\text\{([^}]*)\}", r" \1", rep)
    rep = rep.replace("\\,", " ").replace("\\ ", " ").replace("\\times", "×").replace("\\approx", "≈")
    rep = re.sub(r"\\(frac|dfrac)\{([^{}]*)\}\{([^{}]*)\}", r"\2 / \3", rep)
    rep = re.sub(r"\\[()\[\]]|\$", " ", rep)
    return rep


def langue_de(rep):
    mots = re.findall(r"[a-zà-ÿ']+", rep.lower())
    fr = sum(m in FR_MOTS for m in mots)
    en = sum(m in EN_MOTS for m in mots)
    if fr + en < 5:
        return None
    return "fr" if fr > en else "en"


def pages_citees(rep):
    nums = set()
    for m in re.finditer(r"(?:\bp\.|\bpp\.|\bpages?\b|\bdiapositives?\b|\bslides?\b)\s*(\d{1,3})((?:\s*(?:,|et|and|-|–|à|to)\s*\d{1,3})*)",
                         rep, re.I):
        nums.add(int(m.group(1)))
        nums.update(int(x) for x in re.findall(r"\d{1,3}", m.group(2) or ""))
    return nums


def refuse(rep):
    return bool(REFUS.search(v1.normaliser(rep)))


def noter_cas(cas, rep, doc_n):
    auto = cas["auto"]
    t = auto["type"]
    rep = nettoyer(rep)
    rn = v1.normaliser(rep)
    if not rn:
        return 0.0, "réponse vide"
    if t == "pas_de_refus":
        if refuse(rep):
            return 0.0, "refus"
        parle = any(v1.contient(rn, m) for m in auto.get("mots_cles", []))
        if parle and v1.compter_mots(rep) >= 40:
            return 1.0, "répond sur le document"
        return 0.5, "pas de refus, mais réponse pauvre ou hors du document"
    if v1.a_interdit(rn, auto.get("interdits")):
        return 0.0, "contient un élément interdit"
    g = v1.groupes_ok(rn, auto.get("groupes"))
    if t == "synthese":
        n = sum(any(v1.contient(rn, v) for v in grp) for grp in auto["groupes"])
        s = min(1.0, n / auto["n"])
        f = v1.contraintes_format(auto, rep)
        if f:
            s *= 0.5 + 0.5 * sum(f) / len(f)
        return s, f"{n} idées" + (f", format {sum(f)}/{len(f)}" if f else "")
    if t == "page":
        cit = pages_citees(rep)
        ok = bool(cit & set(auto["pages"]))
        return 0.5 * g + 0.5 * ok, f"faits {g:.2f}, page {'juste' if ok else 'absente ou fausse'} {sorted(cit)}"
    if t == "abstention":
        ok = (any(m in rn for m in v1.MARQUEURS_ABSTENTION) or bool(v1.RE_ABSTENTION.search(rn))
              or any(m in rn for m in ABSTENTION_EN) or any(m in rn for m in ABSTENTION_FR))
        return (1.0 if ok else 0.0) * g, "abstention détectée" if ok else "pas d'abstention"
    if t == "signal":
        # Réponse « Non : … » à une question « est-ce juste / cohérent / respecté ? » : c'est un signalement.
        ok = (any(m in rn for m in v1.MARQUEURS_SIGNAL) or any(m in rn for m in SIGNAL_EN)
              or bool(re.match(r"(non|no)\b", rn)))
        return (0.5 + 0.5 * g) if ok else 0.0, "signalement" if ok else "aucun signalement"
    if t == "pas_de_signal":
        if cas.get("langue") == "en":
            ok = not NEGATION_EN.search(rn) and (rn.startswith("yes") or any(m in rn for m in COHERENT_EN))
        else:
            ok = v1.conclut_coherent(cas["consigne"], rn)
        return (0.5 + 0.5 * g) if ok else 0.0, "conclut à la cohérence" if ok else "ne conclut pas à la cohérence"
    return v1.noter_cas(cas, rep, doc_n)


def noter_cas_borne(cas, rep, doc_n):
    s, pourquoi = noter_cas(cas, rep, doc_n)
    if cas["auto"]["type"] != "pas_de_refus":
        lang = langue_de(nettoyer(rep))
        if lang and cas.get("langue") and lang != cas["langue"]:
            s, pourquoi = s / 2, pourquoi + " ; réponse dans l'autre langue"
    if v1.compter_mots(rep) > MOTS_MAX:
        s, pourquoi = s / 2, pourquoi + " ; réponse trop longue"
    return s, pourquoi


def texte_doc(dossier, doc):
    pages = json.load(open(os.path.join(dossier, "pages", doc + ".json"), encoding="utf-8"))["pages"]
    return v1.normaliser(" ".join(p["text"] for p in pages))


def main():
    dossier, chemin = sys.argv[1], sys.argv[2]
    cas = {c["id"]: c for c in map(json.loads, open(os.path.join(dossier, "cas.jsonl"), encoding="utf-8"))}
    reponses = {}
    for x in map(json.loads, filter(str.strip, open(chemin, encoding="utf-8"))):
        if not x.get("erreur"):
            reponses[x["id"]] = x.get("reponse", "")
    docs = {}
    lignes = []
    par_cat = defaultdict(list)
    refus = 0
    for cid, c in cas.items():
        rep = reponses.get(cid)
        if rep is None:
            sys.exit(f"réponse manquante : {cid}")
        if c["doc"] not in docs:
            docs[c["doc"]] = texte_doc(dossier, c["doc"])
        s, pourquoi = noter_cas_borne(c, rep, docs[c["doc"]])
        refus += refuse(rep)
        par_cat[c["cat"]].append(s)
        lignes.append({"id": cid, "cat": c["cat"], "langue": c.get("langue"), "score": round(s, 3), "pourquoi": pourquoi})
    total = sum(x["score"] for x in lignes) / len(lignes)
    resume = {"cas": len(lignes), "score": round(total, 4), "refus": refus,
              "par_categorie": {k: round(sum(v) / len(v), 3) for k, v in sorted(par_cat.items())}}
    print(json.dumps(resume, ensure_ascii=False, indent=1))
    if len(sys.argv) > 3:
        json.dump({"resume": resume, "cas": lignes}, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
