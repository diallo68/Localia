"""Décontamination complète (criteres.md) : jeu d'entraînement contre jeux d'évaluation.

Trois contrôles :
1. 13-grammes de mots : recouvrement entre, d'un côté, les documents, demandes et réponses de l'entraînement, et de
   l'autre les documents et les cas (consigne et réponse attendue) de chaque jeu d'évaluation. Les 13-grammes qui
   figurent dans au moins SEUIL_BANAL documents d'entraînement distincts sont comptés à part : ce sont les formules
   répétées de Service-Public (« Nous vous présentons les informations à connaître… »), pas une fuite.
2. Similarité de documents : indice de Jaccard exact sur les 5-grammes de mots (plus strict qu'une estimation
   MinHash), pour chaque paire (document d'entraînement, document d'évaluation) ; toute paire > 0,5 est listée.
3. Voisins sémantiques : embeddings intfloat/multilingual-e5-small (MIT, déjà sur le Mac) des demandes
   d'entraînement et des consignes d'évaluation ; les VOISINS paires les plus proches sont écrites pour la
   vérification manuelle.

Le rapport publié ne contient, pour le jeu secret, que des identifiants et des scores ; les textes des paires à
vérifier sont écrits dans un fichier à part, hors du dépôt.

Usage : python -I decontaminer.py <exemples.jsonl> <sortie_rapport.md> <paires_a_verifier.jsonl>
        --eval nom=dossier [nom=dossier ...] --e5 <dossier e5-small>
"""
import argparse
import collections
import glob
import json
import os
import re
import unicodedata

SEUIL_BANAL = 3
SEUIL_JACCARD = 0.5
VOISINS = 50


def normaliser(s):
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def mots(s):
    return re.findall(r"\w+", normaliser(s))


def ngrammes(s, n):
    m = mots(s)
    return {" ".join(m[i:i + n]) for i in range(len(m) - n + 1)}


def lire_entrainement(chemin):
    docs, textes = {}, []
    for l in open(chemin, encoding="utf-8"):
        e = json.loads(l)
        user = e["messages"][1]["content"]
        doc, _, demande = user.partition("\n\n---\n\nDemande : ")
        docs[e["fiche"]] = doc.removeprefix("Document :\n\n")
        textes.append({"fiche": e["fiche"], "type": e["type"], "demande": demande, "reponse": e["messages"][2]["content"]})
    return docs, textes


def lire_eval(dossier):
    docs = {os.path.basename(f)[:-3]: open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(dossier, "documents", "*.md"))}
    cas = [json.loads(l) for l in open(os.path.join(dossier, "cas.jsonl"), encoding="utf-8")]
    return docs, cas


def embeddings(textes, dossier_e5, prefixe):
    import torch
    from transformers import AutoModel, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(dossier_e5)
    mod = AutoModel.from_pretrained(dossier_e5).eval()
    res = []
    with torch.no_grad():
        for i in range(0, len(textes), 64):
            b = tok([prefixe + t for t in textes[i:i + 64]], padding=True, truncation=True, max_length=256, return_tensors="pt")
            h = mod(**b).last_hidden_state
            m = b["attention_mask"].unsqueeze(-1)
            v = (h * m).sum(1) / m.sum(1)
            res.append(torch.nn.functional.normalize(v, dim=-1))
    return torch.cat(res)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("exemples")
    ap.add_argument("rapport")
    ap.add_argument("paires")
    ap.add_argument("--eval", nargs="+", required=True)
    ap.add_argument("--e5", required=True)
    a = ap.parse_args()

    docs_ent, textes = lire_entrainement(a.exemples)
    jeux = {n: lire_eval(d) for n, d in (x.split("=", 1) for x in a.eval)}
    lignes = [f"# Décontamination : {os.path.basename(os.path.dirname(a.exemples)) or a.exemples}", "",
              f"Entraînement : {len(textes)} exemples, {len(docs_ent)} documents distincts.", ""]

    # 1. 13-grammes
    df = collections.Counter()
    ng_doc = {}
    for f, d in docs_ent.items():
        ng_doc[f] = ngrammes(d, 13)
        df.update(ng_doc[f])
    ng_ent = set().union(*ng_doc.values())
    for t in textes:
        ng_ent |= ngrammes(t["demande"], 13) | ngrammes(t["reponse"], 13)
    lignes += ["## 1. 13-grammes communs", "", "| Jeu | Partie | 13-grammes de l'évaluation | communs | dont formules répétées | autres |", "|---|---|---|---|---|---|"]
    detail_autres = []
    for nom, (docs, cas) in jeux.items():
        for partie, morceaux in (("documents", list(docs.items())),
                                 ("cas", [(c["id"], c["consigne"] + "\n" + c.get("attendu", "")) for c in cas])):
            total, communs, banals, autres = 0, 0, 0, 0
            for ident, texte in morceaux:
                ng = ngrammes(texte, 13)
                total += len(ng)
                c = ng & ng_ent
                communs += len(c)
                b = {g for g in c if df[g] >= SEUIL_BANAL}
                banals += len(b)
                autres += len(c - b)
                if c - b:
                    detail_autres.append((nom, partie, ident, len(c - b)))
            lignes.append(f"| {nom} | {partie} | {total} | {communs} | {banals} | {autres} |")
    lignes += ["", f"Formule répétée : 13-gramme présent dans au moins {SEUIL_BANAL} documents d'entraînement distincts."]
    if detail_autres:
        lignes += ["", "Éléments d'évaluation avec des 13-grammes communs non banals (identifiant, nombre) :", ""]
        lignes += [f"- {n} / {p} / {i} : {k}" for n, p, i, k in sorted(detail_autres, key=lambda x: -x[3])]

    # 2. Jaccard sur 5-grammes
    sh_ent = {f: ngrammes(d, 5) for f, d in docs_ent.items()}
    lignes += ["", "## 2. Similarité de documents (Jaccard exact, 5-grammes)", ""]
    maxi = []
    for nom, (docs, _) in jeux.items():
        for ident, d in docs.items():
            s = ngrammes(d, 5)
            meilleur = max(((len(s & e) / max(1, len(s | e)), f) for f, e in sh_ent.items()), default=(0, None))
            maxi.append((meilleur[0], nom, ident, meilleur[1]))
    maxi.sort(reverse=True)
    au_dessus = [m for m in maxi if m[0] > SEUIL_JACCARD]
    lignes.append(f"Paires au-dessus de {SEUIL_JACCARD} : **{len(au_dessus)}**. Les 10 plus proches (document d'évaluation, document d'entraînement le plus proche) :")
    lignes += [""] + [f"- {j:.3f} : {n} / {i} — {f}" for j, n, i, f in maxi[:10]]

    # 3. voisins sémantiques
    ev = [(nom, c["id"], c["consigne"]) for nom, (_, cas) in jeux.items() for c in cas]
    demandes = [t["demande"] for t in textes]
    E = embeddings(demandes, a.e5, "query: ")
    Q = embeddings([x[2] for x in ev], a.e5, "query: ")
    sim = Q @ E.T
    vals, idx = sim.max(dim=1)
    ordre = sorted(range(len(ev)), key=lambda i: -float(vals[i]))
    lignes += ["", "## 3. Voisins sémantiques (e5-small, cosinus)", "",
               f"Pour chaque cas d'évaluation, la demande d'entraînement la plus proche. Les {VOISINS} paires les plus proches sont vérifiées à la main (section 4).", "",
               "| Rang | Jeu | Cas | Cosinus | Fiche d'entraînement |", "|---|---|---|---|---|"]
    with open(a.paires, "w", encoding="utf-8") as s:
        for r, i in enumerate(ordre[:VOISINS], 1):
            nom, ident, q = ev[i]
            t = textes[int(idx[i])]
            lignes.append(f"| {r} | {nom} | {ident} | {float(vals[i]):.3f} | {t['fiche']} ({t['type']}) |")
            s.write(json.dumps({"rang": r, "jeu": nom, "cas": ident, "cosinus": round(float(vals[i]), 3), "consigne": q,
                                "fiche_entrainement": t["fiche"], "type": t["type"], "demande": t["demande"]}, ensure_ascii=False) + "\n")
    quantiles = sorted(float(v) for v in vals)
    lignes += ["", f"Répartition du cosinus maximal sur {len(ev)} cas : médiane {quantiles[len(quantiles) // 2]:.3f}, "
               f"90e centile {quantiles[int(len(quantiles) * 0.9)]:.3f}, maximum {quantiles[-1]:.3f}."]
    open(a.rapport, "w", encoding="utf-8").write("\n".join(lignes) + "\n")
    print("\n".join(lignes[:40]))


if __name__ == "__main__":
    main()
