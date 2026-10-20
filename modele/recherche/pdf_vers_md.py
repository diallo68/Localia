"""PDF vers Markdown pour la recherche de passages (thèses, rapports, textes juridiques).

S'appuie sur pdftotext (poppler), qui sépare les pages par un saut de page (\\f). Ensuite :
- retire les en-têtes et pieds de page (lignes courtes répétées sur au moins 20 % des pages, numéros de page) ;
- écarte les lignes de table des matières, des figures et des tableaux (points de conduite « . . . ») ;
- reconnaît les titres : « Chapitre N : … », « Titre I », « Article 12 », et les numéros de section
  « 1.2.3 » (sur la même ligne que le titre ou seuls sur la ligne précédente), puis les rend en #, ##, ###… ;
- recolle les lignes d'un même paragraphe (et les mots coupés en fin de ligne).

Usage : python3 -I pdf_vers_md.py <document.pdf> <sortie.md>
"""
import collections
import re
import subprocess
import sys

RE_CHAPITRE = re.compile(r"^(chapitre|partie|titre|livre)\s+([0-9ivxlc]+)\b\s*[:.\-–—]?\s*(.*)$", re.I)
RE_ARTICLE = re.compile(r"^(article\s+[lrd]?\.?\s*[0-9][0-9\-.]*)\s*[:.\-–—]?\s*(.*)$", re.I)
RE_NUMERO = re.compile(r"^(\d+(?:\.\d+){1,4})\.?$")
RE_NUMERO_TITRE = re.compile(r"^(\d+(?:\.\d+){1,4})\.?\s+([A-ZÀ-ÖØ-Þ].{2,120})$")
RE_CONDUITE = re.compile(r"(\.\s){4,}|\.{5,}")


def pages_du_pdf(chemin):
    texte = subprocess.run(["pdftotext", "-enc", "UTF-8", chemin, "-"], capture_output=True, text=True,
                           check=True).stdout
    return texte.split("\f")


def cle(l):
    return re.sub(r"\d+", "#", l.strip().lower())


def convertir(pages):
    n = len(pages)
    compte = collections.Counter()
    for p in pages:
        for l in {cle(l) for l in p.split("\n") if 0 < len(l.strip()) <= 80}:
            compte[l] += 1
    repetees = {k for k, v in compte.items() if v >= max(3, 0.2 * n)}

    lignes = []
    for p in pages:
        non_vides = [l for l in p.split("\n") if l.strip()]
        # page de table des matières, des figures ou des tableaux : écartée en entier
        if non_vides and sum(bool(RE_CONDUITE.search(l)) for l in non_vides) >= 0.15 * len(non_vides):
            continue
        for l in p.split("\n"):
            s = l.strip()
            if not s:
                lignes.append("")
                continue
            if RE_NUMERO.match(s):  # numéro de section seul : jamais un en-tête de page
                lignes.append(s)
                continue
            if cle(s) in repetees or re.fullmatch(r"[ivxlc\d]{1,5}", s, re.I) or RE_CONDUITE.search(s):
                continue
            lignes.append(s)
        lignes.append("")

    sortie, para = [], []

    def fermer():
        if para:
            texte = ""
            for morceau in para:
                if texte.endswith("-") and morceau[:1].islower():
                    texte = texte[:-1] + morceau
                else:
                    texte = (texte + " " + morceau).strip()
            sortie.append(texte)
            para.clear()

    i = 0
    while i < len(lignes):
        s = lignes[i]
        suivante = next((x for x in lignes[i + 1:i + 4] if x), "")
        m = RE_CHAPITRE.match(s)
        if m and len(s) <= 120:
            fermer()
            titre = m.group(3).strip()
            # titre de chapitre sur deux lignes (« … des plantes » / « et sur l'IA »)
            if titre and suivante and suivante[:1].islower() and len(suivante) < 80:
                titre += " " + suivante
                i = lignes.index(suivante, i + 1)
            sortie.append(f"# {m.group(1).capitalize()} {m.group(2)}" + (f" : {titre}" if titre else ""))
            i += 1
            continue
        m = RE_NUMERO_TITRE.match(s)
        if m and not s.endswith((".", ",", ";")) and len(s) <= 120:
            fermer()
            sortie.append("#" * (m.group(1).count(".") + 1) + f" {m.group(1)} {m.group(2).strip()}")
            i += 1
            continue
        m = RE_NUMERO.match(s)
        if m:
            # numéros empilés (« 1.2.2 » / « 1.2.2.1 » / « Les causes » / « Les facteurs biotiques ») : les titres
            # suivent dans le même ordre
            j, numeros = i, []
            while j < len(lignes) and (not lignes[j] or RE_NUMERO.match(lignes[j])):
                if lignes[j]:
                    numeros.append(lignes[j].rstrip("."))
                j += 1
            titres = []
            while j < len(lignes) and len(titres) < len(numeros):
                t = lignes[j]
                if t:
                    if not (4 <= len(t) <= 120 and t[:1].isupper() and not t.endswith((".", ",")) and re.search(r"[a-zà-ÿ]", t)):
                        break
                    titres.append(t)
                j += 1
            if len(titres) == len(numeros):
                fermer()
                for num, t in zip(numeros, titres):
                    sortie.append("#" * (num.count(".") + 1) + f" {num} {t}")
                i = j
                continue
        m = RE_ARTICLE.match(s)
        if m and len(s) <= 120:
            fermer()
            sortie.append(f"### {m.group(1)}" + (f" : {m.group(2)}" if m.group(2) else ""))
            i += 1
            continue
        if not s:
            fermer()
        else:
            para.append(s)
        i += 1
    fermer()
    return "\n\n".join(sortie) + "\n"


def main():
    md = convertir(pages_du_pdf(sys.argv[1]))
    open(sys.argv[2], "w", encoding="utf-8").write(md)
    titres = [l for l in md.split("\n") if l.startswith("#")]
    print(f"{len(md)} caractères, {len(titres)} titres -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
