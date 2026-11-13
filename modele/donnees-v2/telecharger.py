"""Téléchargement des documents d'entraînement de Dial-bowe v2 (plan §5.1), pour les 8 domaines de Localia.

Sources, licence vérifiée document par document et notée dans le manifeste :
- HAL : CC-BY 4.0, CC-BY-SA 4.0, CC0, Licence Ouverte Etalab 2.0 (champ licence_s) ; articles, communications,
  rapports, chapitres ; 2015-2025 (les jeux d'évaluation G et S2 viennent surtout de 2026).
- arXiv : CC-BY 4.0 ou CC-BY-SA 4.0 seulement (champ license de l'OAI-PMH), 2023-2025.
- Wikipédia FR et EN (CC-BY-SA 4.0) : texte brut de l'article, numéro de révision noté pour l'attribution.
- Banque mondiale (rapports et documents de travail, FR et EN) : licence CC BY 3.0 IGO annoncée pour ses
  publications [à vérifier document par document avant toute publication des données].
Les documents des jeux d'évaluation (exclusions-entrainement-v2.txt) sont écartés par identifiant ; la
décontamination par 13-grammes se fait après extraction du texte (decontamination.md).

Reprise automatique : un document déjà présent dans le manifeste n'est pas retéléchargé.
Usage : python3 -I telecharger.py <dossier_sortie> [source ...] [--domaines a,b]
(sources : hal arxiv wiki bm sp ; défaut : wiki bm hal arxiv ; sp : fiches Service-Public de la v1, ajouté le 13 nov.)
"""
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "Localia-donnees/1.0 (preparation de donnees d'entrainement, usage de recherche)"
ICI = os.path.dirname(os.path.abspath(__file__))
EXCLUSIONS = os.path.join(ICI, "..", "eval", "exclusions-entrainement-v2.txt")
TAILLE_MAX = 12_000_000  # PDF de plus de 12 Mo : souvent des thèses ou des scans, écartés
random.seed(20261111)

# Nombre de documents visés par domaine et par source [supposé : environ 1 400 documents, 70 % FR].
DOMAINES = {
    "enseignement": {
        "hal": ["1.shs.edu"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["physics.ed-ph", "cs.CY"], "mots": r"educat|teach|student|school|learning|curricul", "n": 15},
        "wiki_fr": ["pédagogie", "système éducatif", "évaluation scolaire", "formation professionnelle", "alphabétisation",
                    "enseignement supérieur", "didactique", "décrochage scolaire"],
        "wiki_en": ["education policy", "pedagogy", "literacy", "vocational education"],
        "bm": "education", "bm_fr": 8, "bm_en": 4,
    },
    "recherche": {
        "hal": ["0.info", "0.math", "0.phys", "0.sdv", "0.chim"], "hal_fr": 70, "hal_en": 20,
        "arxiv": {"cats": ["stat.ME", "cs.CL", "q-bio.QM", "physics.soc-ph", "cs.LG"], "mots": None, "n": 20},
        "wiki_fr": ["méthode scientifique", "statistique", "évaluation par les pairs", "épistémologie",
                    "intelligence artificielle", "biologie moléculaire", "physique quantique", "climatologie"],
        "wiki_en": ["scientific method", "statistics", "machine learning", "peer review"],
    },
    "agriculture": {
        "hal": ["1.sdv.sa", "1.sde.es"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["q-bio.PE", "eess.SP", "cs.CV", "econ.GN"], "mots": r"agricult|crop|farm|soil|irrigat|livestock|yield", "n": 10},
        "wiki_fr": ["agriculture", "agroécologie", "irrigation", "élevage", "sécurité alimentaire", "riziculture",
                    "fertilisation", "agroforesterie"],
        "wiki_en": ["agronomy", "food security", "irrigation", "smallholder farming"],
        "bm": "agriculture", "bm_fr": 10, "bm_en": 5,
    },
    "communication": {
        "hal": ["1.shs.info"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["cs.SI", "cs.HC", "cs.CY"], "mots": r"media|communicat|social network|news|journalis|misinformation", "n": 15},
        "wiki_fr": ["communication", "journalisme", "réseau social", "relations publiques", "désinformation",
                    "communication politique", "médias", "publicité"],
        "wiki_en": ["mass media", "public relations", "misinformation", "science communication"],
    },
    "ingenierie": {
        "hal": ["0.spi"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["eess.SY", "cs.RO", "physics.app-ph", "eess.SP"], "mots": None, "n": 15},
        "wiki_fr": ["génie civil", "énergie solaire", "résistance des matériaux", "automatique", "réseau électrique",
                    "traitement de l'eau", "béton armé", "maintenance industrielle"],
        "wiki_en": ["civil engineering", "renewable energy", "control engineering", "water treatment"],
        "bm": "infrastructure energy", "bm_fr": 6, "bm_en": 4,
    },
    "sante": {
        "hal": ["1.sdv.spee", "1.sdv.mhep", "1.shs.socio"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["q-bio.PE", "stat.AP", "physics.med-ph", "cs.CY"], "mots": r"health|epidemi|disease|hospital|patient|vaccin|malaria", "n": 10},
        "wiki_fr": ["santé publique", "épidémiologie", "paludisme", "vaccination", "nutrition", "système de santé",
                    "hygiène", "santé mentale"],
        "wiki_en": ["public health", "epidemiology", "malaria", "health system"],
        "bm": "health", "bm_fr": 8, "bm_en": 4,
    },
    "droit": {
        "hal": ["1.shs.droit"], "hal_fr": 80, "hal_en": 15,
        "arxiv": {"cats": ["cs.CY"], "mots": r"\blaw\b|legal|regulat|court|legislat|GDPR|contract", "n": 8},
        "wiki_fr": ["droit des contrats", "droit du travail", "droit administratif", "procédure civile",
                    "droit foncier", "OHADA", "protection des données personnelles", "droit de la consommation"],
        "wiki_en": ["contract law", "labour law", "data protection", "land law"],
        "bm": "governance legal", "bm_fr": 6, "bm_en": 3,
    },
    "finance": {
        "hal": ["1.shs.eco", "1.shs.gestion", "0.qfin"], "hal_fr": 70, "hal_en": 15,
        "arxiv": {"cats": ["q-fin.GN", "q-fin.RM", "econ.GN", "q-fin.PM"], "mots": None, "n": 15},
        "wiki_fr": ["comptabilité", "microfinance", "inflation", "budget de l'État", "analyse financière", "fiscalité",
                    "banque centrale", "crédit"],
        "wiki_en": ["financial accounting", "microfinance", "public finance", "inflation"],
        "bm": "finance microfinance", "bm_fr": 10, "bm_en": 5,
    },
    # 13 nov. : les deux métiers de Localia qui manquaient (metiers.js : administration, entreprise et commerce).
    "administration": {
        "hal": ["1.shs.scipo"], "hal_fr": 30, "hal_en": 8,
        "wiki_fr": ["fonction publique", "collectivité territoriale", "marché public", "procédure administrative",
                    "état civil", "service public", "décentralisation", "archivistique"],
        "wiki_en": ["public administration", "civil service", "public procurement", "local government"],
        "bm": "public sector management administration", "bm_fr": 6, "bm_en": 3,
        "sp": 70,  # fiches Service-Public de la v1 (démarches), Licence Ouverte
    },
    "entreprise": {
        "hal": ["1.shs.gestion"], "hal_fr": 55, "hal_en": 12,
        "wiki_fr": ["petite et moyenne entreprise", "plan d'affaires", "devis", "commerce de détail", "gestion des stocks",
                    "relation client", "entrepreneuriat", "marketing"],
        "wiki_en": ["small business", "business plan", "retail", "customer service"],
        "bm": "small and medium enterprises entrepreneurship", "bm_fr": 8, "bm_en": 4,
    },
}
SP_SOURCES = os.path.expanduser("~/localia-labo/modele-compact/donnees-entrainement/sources")

LICENCES_HAL = [
    "https://creativecommons.org/licenses/by/4.0/",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    "https://creativecommons.org/publicdomain/zero/1.0/",
    "https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf",
]
LICENCES_ARXIV = ("http://creativecommons.org/licenses/by/4.0/", "http://creativecommons.org/licenses/by-sa/4.0/",
                  "http://creativecommons.org/publicdomain/zero/1.0/")
WIKI_ARTICLES = {"fr": 3, "en": 3}  # articles gardés par mot-clé


def lire(url, essais=4, pause=3.0):
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", None)
            if code in (403, 404, 410):
                raise
            time.sleep(pause * (2 ** i) * (5 if code in (429, 503) else 1))
    raise RuntimeError(f"échec : {url}")


class Manifeste:
    def __init__(self, sortie):
        self.chemin = os.path.join(sortie, "manifeste.jsonl")
        self.ids = set()
        self.par = {}
        if os.path.exists(self.chemin):
            for x in map(json.loads, filter(str.strip, open(self.chemin, encoding="utf-8"))):
                self.ids.add(x["id"])
                k = (x["source"], x["domaine"], x["langue"])
                self.par[k] = self.par.get(k, 0) + 1
        self.exclus = set()
        for ligne in open(EXCLUSIONS, encoding="utf-8"):
            if ligne.strip() and not ligne.startswith("#"):
                self.exclus.add(ligne.split("\t")[0].strip().lower())

    def compte(self, source, domaine, langue):
        return self.par.get((source, domaine, langue), 0)

    def exclu(self, doc_id):
        return doc_id.lower() in self.exclus or doc_id in self.ids

    def ajouter(self, entree):
        with open(self.chemin, "a", encoding="utf-8") as f:
            f.write(json.dumps(entree, ensure_ascii=False) + "\n")
        self.ids.add(entree["id"])
        k = (entree["source"], entree["domaine"], entree["langue"])
        self.par[k] = self.par.get(k, 0) + 1


def enregistrer(man, sortie, source, domaine, langue, doc_id, contenu, ext, meta):
    dossier = os.path.join(sortie, source, domaine)
    os.makedirs(dossier, exist_ok=True)
    chemin = os.path.join(dossier, doc_id + ext)
    with open(chemin, "wb") as f:
        f.write(contenu)
    man.ajouter({"id": doc_id, "source": source, "domaine": domaine, "langue": langue,
                 "fichier": os.path.relpath(chemin, sortie), "sha256": hashlib.sha256(contenu).hexdigest(),
                 "octets": len(contenu), **meta})


def est_pdf(contenu):
    return contenu[:5] == b"%PDF-" and len(contenu) < TAILLE_MAX


# ---------- HAL ----------
def hal(man, sortie):
    for domaine, spec in DOMAINES.items():
        for langue in ("fr", "en"):
            vise = spec[f"hal_{langue}"]
            if man.compte("hal", domaine, langue) >= vise:
                continue
            candidats = []
            for dom in spec["hal"]:
                params = [("q", "*:*"),
                          ("fq", "licence_s:(" + " OR ".join(f'"{x}"' for x in LICENCES_HAL) + ")"),
                          ("fq", "docType_s:(ART OR COMM OR REPORT OR COUV OR UNDEFINED)"),
                          ("fq", f'domain_s:"{dom}"'), ("fq", f"language_s:{langue}"),
                          ("fq", "submittedDateY_i:[2015 TO 2025]"),
                          ("fl", "halId_s,title_s,licence_s,fileMain_s,docType_s,submittedDateY_i,domain_s"),
                          ("sort", "docid asc")]
                base = "https://api.archives-ouvertes.fr/search/?" + urllib.parse.urlencode(params)
                total = json.loads(lire(base + "&rows=0"))["response"]["numFound"]
                # Trois tranches tirées au hasard dans tout le résultat (HAL n'a pas de tri aléatoire).
                for debut in sorted(random.sample(range(0, max(1, total - 100), 100), min(3, max(1, total // 100)))):
                    docs = json.loads(lire(f"{base}&rows=100&start={debut}"))["response"]["docs"]
                    candidats += [d for d in docs if d.get("fileMain_s")]
                    time.sleep(1)
            random.shuffle(candidats)
            for d in candidats:
                if man.compte("hal", domaine, langue) >= vise:
                    break
                doc_id = d["halId_s"]
                if man.exclu(doc_id):
                    continue
                try:
                    contenu = lire(d["fileMain_s"], essais=2)
                except Exception as e:  # noqa: BLE001
                    print(f"hal {doc_id} : {e}", flush=True)
                    continue
                time.sleep(1)
                if not est_pdf(contenu):
                    continue
                enregistrer(man, sortie, "hal", domaine, langue, doc_id, contenu, ".pdf",
                            {"titre": (d.get("title_s") or [""])[0], "licence": d["licence_s"],
                             "url": f"https://hal.science/{doc_id}", "annee": d.get("submittedDateY_i"),
                             "type": d.get("docType_s")})
            print(f"hal {domaine} {langue} : {man.compte('hal', domaine, langue)}/{vise}", flush=True)


# ---------- arXiv ----------
NS = {"o": "http://www.openarchives.org/OAI/2.0/", "a": "http://arxiv.org/OAI/arXiv/"}
ENSEMBLES = {"physics": "physics", "cs": "cs", "stat": "stat", "q-bio": "q-bio", "q-fin": "q-fin", "econ": "econ",
             "eess": "eess"}


def arxiv_notices():
    """Notices CC-BY de quelques fenêtres de dates 2023-2025, tous ensembles utiles (mises en cache)."""
    notices = []
    for ens in ENSEMBLES:
        for (debut, fin) in (("2023-03-01", "2023-03-08"), ("2024-02-01", "2024-02-08"), ("2024-10-01", "2024-10-08"),
                             ("2025-05-01", "2025-05-08")):
            url = (f"https://oaipmh.arxiv.org/oai?verb=ListRecords&metadataPrefix=arXiv&set={ens}"
                   f"&from={debut}&until={fin}")
            pages = 0
            while url and pages < 6:
                racine = ET.fromstring(lire(url, pause=10))
                for rec in racine.iterfind(".//o:record", NS):
                    a = rec.find(".//a:arXiv", NS)
                    if a is None:
                        continue
                    lic = (a.findtext("a:license", "", NS) or "").strip()
                    if lic not in LICENCES_ARXIV:
                        continue
                    notices.append({"id": a.findtext("a:id", "", NS), "titre": " ".join(a.findtext("a:title", "", NS).split()),
                                    "resume": " ".join(a.findtext("a:abstract", "", NS).split()),
                                    "cats": a.findtext("a:categories", "", NS).split(), "licence": lic})
                jeton = racine.findtext(".//o:resumptionToken", "", NS)
                url = (f"https://oaipmh.arxiv.org/oai?verb=ListRecords&resumptionToken={urllib.parse.quote(jeton)}"
                       if jeton else None)
                pages += 1
                time.sleep(4)
            print(f"arxiv notices {ens} {debut} : {len(notices)}", flush=True)
    return notices


def arxiv(man, sortie):
    cache = os.path.join(sortie, "arxiv-notices.json")
    if os.path.exists(cache):
        notices = json.load(open(cache, encoding="utf-8"))
    else:
        notices = arxiv_notices()
        json.dump(notices, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
    random.shuffle(notices)
    pris = set()
    for domaine, spec in DOMAINES.items():
        a = spec["arxiv"]
        mots = re.compile(a["mots"], re.I) if a["mots"] else None
        for n in notices:
            if man.compte("arxiv", domaine, "en") >= a["n"]:
                break
            doc_id = "arxiv-" + n["id"]
            if n["id"] in pris or man.exclu(doc_id) or not set(n["cats"]) & set(a["cats"]):
                continue
            if mots and not mots.search(n["titre"] + " " + n["resume"]):
                continue
            pris.add(n["id"])
            try:
                contenu = lire(f"https://arxiv.org/pdf/{n['id']}", essais=2)
            except Exception as e:  # noqa: BLE001
                print(f"arxiv {n['id']} : {e}", flush=True)
                continue
            time.sleep(3)
            if not est_pdf(contenu):
                continue
            enregistrer(man, sortie, "arxiv", domaine, "en", doc_id, contenu, ".pdf",
                        {"titre": n["titre"], "licence": n["licence"], "url": f"https://arxiv.org/abs/{n['id']}",
                         "categories": n["cats"]})
        print(f"arxiv {domaine} : {man.compte('arxiv', domaine, 'en')}/{a['n']}", flush=True)


# ---------- Wikipédia ----------
def wiki(man, sortie):
    for domaine, spec in DOMAINES.items():
        for langue in ("fr", "en"):
            for mot in spec[f"wiki_{langue}"]:
                params = {"action": "query", "format": "json", "list": "search", "srsearch": mot, "srlimit": 15,
                          "srnamespace": 0, "srprop": "size"}
                url = f"https://{langue}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
                res = json.loads(lire(url))["query"]["search"]
                gardes = 0
                for r in res:
                    if gardes >= WIKI_ARTICLES[langue]:
                        break
                    if not 15_000 <= r["size"] <= 200_000:
                        continue
                    titre = r["title"]
                    doc_id = f"wiki-{langue}-" + titre.replace(" ", "_")
                    if man.exclu(doc_id):
                        continue
                    p = {"action": "query", "format": "json", "prop": "extracts|revisions", "explaintext": 1,
                         "titles": titre, "rvprop": "ids", "redirects": 1}
                    page = next(iter(json.loads(lire(f"https://{langue}.wikipedia.org/w/api.php?"
                                                     + urllib.parse.urlencode(p)))["query"]["pages"].values()))
                    texte = page.get("extract", "")
                    if len(texte) < 8000:
                        continue
                    texte = re.sub(r"\n(=+) (.+?) =+\n", lambda m: "\n" + "#" * len(m.group(1)) + " " + m.group(2) + "\n", texte)
                    texte = f"# {page['title']}\n\n{texte}\n"
                    oldid = page["revisions"][0]["revid"]
                    enregistrer(man, sortie, "wiki", domaine, langue, doc_id, texte.encode("utf-8"), ".md",
                                {"titre": page["title"], "licence": "CC-BY-SA-4.0",
                                 "url": f"https://{langue}.wikipedia.org/w/index.php?oldid={oldid}"})
                    gardes += 1
                    time.sleep(1.5)
            print(f"wiki {domaine} : fr {man.compte('wiki', domaine, 'fr')}, en {man.compte('wiki', domaine, 'en')}", flush=True)


# ---------- Service-Public (fiches de la v1, déjà décontaminées pour la v1 : preparer_sources.py) ----------
def sp(man, sortie):
    for domaine, spec in DOMAINES.items():
        vise = spec.get("sp", 0)
        if not vise or man.compte("sp", domaine, "fr") >= vise:
            continue
        fiches = sorted(f for f in os.listdir(SP_SOURCES) if f.startswith("sp-F") and f.endswith(".md"))
        random.shuffle(fiches)
        for f in fiches:
            if man.compte("sp", domaine, "fr") >= vise:
                break
            doc_id = f[:-3]
            if man.exclu(doc_id):
                continue
            contenu = open(os.path.join(SP_SOURCES, f), "rb").read()
            titre = contenu.decode("utf-8").split("\n", 1)[0].lstrip("# ").strip()
            enregistrer(man, sortie, "sp", domaine, "fr", doc_id, contenu, ".md",
                        {"titre": titre, "licence": "Licence Ouverte / Etalab 2.0",
                         "url": f"https://www.service-public.fr/particuliers/vosdroits/{doc_id[3:]}"})
        print(f"sp {domaine} : {man.compte('sp', domaine, 'fr')}/{vise}", flush=True)


# ---------- Banque mondiale ----------
def bm(man, sortie):
    for domaine, spec in DOMAINES.items():
        if "bm" not in spec:
            continue
        for langue, nom in (("fr", "French"), ("en", "English")):
            vise = spec[f"bm_{langue}"]
            if man.compte("bm", domaine, langue) >= vise:
                continue
            params = {"format": "json", "qterm": spec["bm"], "lang_exact": nom, "rows": 60,
                      "strdate": "2015-01-01", "fl": "display_title,pdfurl,docty,docdt,url",
                      "docty_exact": "Policy Research Working Paper" if langue == "en" else None}
            params = {k: v for k, v in params.items() if v is not None}
            url = "https://search.worldbank.org/api/v3/wds?" + urllib.parse.urlencode(params)
            docs = list(json.loads(lire(url)).get("documents", {}).values())
            random.shuffle(docs)
            for d in docs:
                if man.compte("bm", domaine, langue) >= vise:
                    break
                if not isinstance(d, dict) or not d.get("pdfurl") or "id" not in d:
                    continue
                doc_id = "bm-" + d["id"]
                if man.exclu(doc_id):
                    continue
                try:
                    contenu = lire(d["pdfurl"].replace("http://", "https://"), essais=2)
                except Exception as e:  # noqa: BLE001
                    print(f"bm {doc_id} : {e}", flush=True)
                    continue
                time.sleep(2)
                if not est_pdf(contenu):
                    continue
                enregistrer(man, sortie, "bm", domaine, langue, doc_id, contenu, ".pdf",
                            {"titre": d.get("display_title", ""), "licence": "CC-BY-3.0-IGO [à vérifier]",
                             "url": d.get("url") or d["pdfurl"], "type": d.get("docty"), "date": d.get("docdt")})
            print(f"bm {domaine} {langue} : {man.compte('bm', domaine, langue)}/{vise}", flush=True)


def main():
    sortie = os.path.abspath(sys.argv[1])
    os.makedirs(sortie, exist_ok=True)
    args = sys.argv[2:]
    if "--domaines" in args:  # 13 nov. : ne traiter que certains domaines (les autres sont complets)
        k = args.index("--domaines")
        gardes = args[k + 1].split(",")
        for d in list(DOMAINES):
            if d not in gardes:
                del DOMAINES[d]
        args = args[:k] + args[k + 2:]
    sources = args or ["wiki", "bm", "hal", "arxiv"]
    man = Manifeste(sortie)
    for s in sources:
        try:
            {"hal": hal, "arxiv": arxiv, "wiki": wiki, "bm": bm, "sp": sp}[s](man, sortie)
        except Exception as e:  # noqa: BLE001
            print(f"!! source {s} interrompue : {e}", flush=True)
    print("=== fin", time.strftime("%H:%M"), flush=True)


if __name__ == "__main__":
    main()
