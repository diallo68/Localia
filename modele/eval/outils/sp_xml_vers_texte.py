"""Convertit une fiche Service-Public (XML vosdroits 3.4, Licence Ouverte) en texte Markdown simple.

Garde : titre, chapô, introduction, chapitres, cas, paragraphes, listes, tableaux, encadrés.
Ignore : liens « Où s'adresser », services en ligne, références, voir aussi, questionnaires de personnalisation.

Usage : python3 -I sp_xml_vers_texte.py fiche.xml > fiche.md
"""
import re
import sys
import xml.etree.ElementTree as ET

IGNORER = {"OuSAdresser", "ServiceEnLigne", "Reference", "PourEnSavoirPlus", "VoirAussi", "Theme", "SousDossier",
           "Fiche", "Condition", "estVrai", "affecteVrai", "affecteFaux", "Choix", "Question", "SiSelectionne",
           "IntituleSiSelectionne", "Definition", "Abreviation", "QuestionReponse", "CommentFaireSi",
           "InformationComplementaire", "Montant", "Partenaire", "Actualite", "Source", "PivotLocal",
           "RessourceWeb", "LienWeb", "Audience", "Canal", "FilDAriane", "Avertissement", "SurTitre"}
ENCADRES = {"ANoter": "À noter", "Attention": "Attention", "ASavoir": "À savoir", "Rappel": "Rappel"}


def texte(e):
    s = "".join(e.itertext())
    return re.sub(r"\s+", " ", s).strip()


def rendre(e, niveau, out):
    tag = e.tag.split("}")[-1]
    if tag in IGNORER or tag.startswith("{"):
        return
    if tag in ("Chapitre", "SousChapitre", "Cas"):
        t = e.find("Titre")
        if t is not None and texte(t):
            prefixe = "Cas : " if tag == "Cas" else ""
            out.append("\n" + "#" * min(niveau, 6) + " " + prefixe + texte(t) + "\n")
        for c in e:
            if c.tag != "Titre":
                rendre(c, niveau + 1, out)
    elif tag == "Paragraphe":
        s = texte(e)
        if s:
            out.append(s + "\n")
    elif tag == "Liste":
        for it in e.findall("Item"):
            s = " ".join(texte(p) for p in it.iter("Paragraphe")) or texte(it)
            if s:
                out.append("- " + s)
        out.append("")
    elif tag == "Tableau":
        titre = e.find("Titre")
        if titre is not None:
            out.append("\n**" + texte(titre) + "**\n")
        lignes = []
        for r in e.findall("Rangée") + e.findall("Rang"):
            lignes.append("| " + " | ".join(texte(c) for c in r.findall("Cellule")) + " |")
        if lignes:
            out.append(lignes[0])
            out.append("|" + "---|" * lignes[0].count(" | ") + "---|")
            out.extend(lignes[1:])
            out.append("")
    elif tag in ENCADRES:
        t = e.find("Titre")
        corps = " ".join(texte(p) for p in e.iter("Paragraphe"))
        lib = ENCADRES[tag]
        if t is not None and texte(t) and texte(t) != lib:
            lib += ' : ' + texte(t)
        out.append(f'> **{lib}** — {corps}\n')
    elif tag == "Titre":
        s = texte(e)
        if s:
            out.append("\n" + "#" * min(niveau, 6) + " " + s + "\n")
    else:
        for c in e:
            rendre(c, niveau, out)


racine = ET.parse(sys.argv[1]).getroot()
ns = {"dc": "http://purl.org/dc/elements/1.1/"}
out = ["# " + racine.findtext("dc:title", namespaces=ns), ""]
desc = racine.findtext("dc:description", namespaces=ns)
if desc:
    out.append(desc + "\n")
for bloc in ("Introduction", "Texte"):
    for e in racine.findall(bloc):
        rendre(e, 2, out)
print(re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip())
