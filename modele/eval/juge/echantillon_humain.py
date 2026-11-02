"""Étape 3.6 : tire l'échantillon du contrôle humain à l'aveugle et écrit la feuille de notation de l'auteur.

60 cas parmi les 234 cas principaux (sans les 6 cas touchés), répartis entre les catégories au prorata (plus forts
restes), tirés au hasard (graine 0) ; pour chaque cas, une réponse d'un des six modèles qui décident du niveau
(base, modèle retenu, quatre comparateurs de « Rivalise »), 10 réponses par modèle, attribuées au hasard. L'auteur voit exactement ce que voit
le juge (document, demande, référence, grille, mesures, réponse), sans le nom du modèle, ni la note du juge, ni la
note automatique.

Sorties (restent sur le Mac, hors du dépôt) : echantillon.jsonl (tâche, cas, modèle) et feuille.html, une page
autonome : les notes sont gardées dans le navigateur (sous l'empreinte de l'échantillon) et exportées en
notes-humaines.json avec cette empreinte, que kappa.py vérifie. Les notes humaines sont exportées avant que l'auteur
voie les verdicts du juge.

Usage : python3 -I echantillon_humain.py <dossier du jeu> <a_juger.jsonl> <cles.jsonl> <sortie> retenu=lot4
"""
import hashlib
import html
import json
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outils"))
from comparer_secret import RIVALISE, TOUCHES  # noqa: E402

N = 60


def repartir(effectifs, n):
    total = sum(effectifs.values())
    parts = {k: n * v / total for k, v in effectifs.items()}
    r = {k: int(p) for k, p in parts.items()}
    for k in sorted(parts, key=lambda k: (-(parts[k] - r[k]), k))[:n - sum(r.values())]:
        r[k] += 1
    return r


def sections(message):
    """Découpe le message du juge en parties (document, demande, référence, grille, mesures, réponse)."""
    doc, reste = message.split("\n\n---\n\nDEMANDE\n", 1)
    demande, reste = reste.split("\n\nRÉPONSE DE RÉFÉRENCE\n", 1)
    reference, reste = reste.split("\n\nGRILLE\n", 1)
    grille, reste = reste.split("\n\nMESURES", 1)
    mesures, reste = reste.split("\n\nRÉPONSE À NOTER\n<<<\n", 1)
    reponse = reste.split("\n>>>\n\nRAPPEL : ", 1)[0]
    return {"document": doc.removeprefix("DOCUMENT\n"), "demande": demande, "reference": reference,
            "grille": grille, "mesures": mesures.split("\n", 1)[1], "reponse": reponse}


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contrôle humain</title>
<style>
:root { --fond: #fbfaf7; --carte: #ffffff; --texte: #1f1e1c; --doux: #6b6862; --bord: #e2dfd8; --accent: #2f5d8a; --fait: #e8f1e8; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fond: #1b1a18; --carte: #24231f; --texte: #ecebe7; --doux: #a19e97; --bord: #3a3833; --accent: #8db4dc; --fait: #22301f; } }
:root[data-theme="dark"] { --fond: #1b1a18; --carte: #24231f; --texte: #ecebe7; --doux: #a19e97; --bord: #3a3833; --accent: #8db4dc; --fait: #22301f; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--texte); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 24px 16px 80px; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
.aide { color: var(--doux); margin: 0 0 20px; }
.barre { position: sticky; top: 0; background: var(--fond); padding: 10px 0; border-bottom: 1px solid var(--bord); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; z-index: 1; }
button { font: inherit; padding: 6px 14px; border: 1px solid var(--accent); background: var(--accent); color: var(--fond); border-radius: 6px; cursor: pointer; }
section { background: var(--carte); border: 1px solid var(--bord); border-radius: 8px; padding: 16px; margin: 20px 0; }
section.fait { background: var(--fait); }
h2 { font-size: 1.05rem; margin: 0 0 8px; }
h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: var(--doux); margin: 14px 0 4px; }
pre { white-space: pre-wrap; word-wrap: break-word; font: inherit; margin: 0; }
details summary { cursor: pointer; color: var(--accent); }
.reponse { border-left: 3px solid var(--accent); padding-left: 12px; }
.choix { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; }
textarea { width: 100%; font: inherit; margin-top: 8px; background: var(--fond); color: var(--texte); border: 1px solid var(--bord); border-radius: 6px; }
</style></head><body><main>
<h1>Contrôle humain à l'aveugle</h1>
<p class="aide">Notez chaque réponse avec la grille affichée, comme le juge : 1, 0,5 ou 0, et dites si elle contient une affirmation non étayée. Vous ne savez pas quel modèle l'a écrite.
Les notes sont gardées dans ce navigateur ; à la fin, « Exporter » enregistre notes-humaines.json.</p>
<div class="barre"><span id="compte"></span><button id="exporter">Exporter</button></div>
__CARTES__
</main><script>
const EMPREINTE = "__EMPREINTE__", CLE = "localia-controle-humain-" + EMPREINTE;
let notes = {};
try { notes = JSON.parse(localStorage.getItem(CLE) || "{}"); } catch (e) {}
function garder() { try { localStorage.setItem(CLE, JSON.stringify(notes)); } catch (e) {} afficher(); }
function afficher() {
  const s = document.querySelectorAll("section");
  let n = 0;
  s.forEach(c => { const v = notes[c.dataset.id]; const ok = v && v.note !== undefined && v.non_etayee !== undefined;
    c.classList.toggle("fait", !!ok); n += ok ? 1 : 0; });
  document.getElementById("compte").textContent = n + " / " + s.length + " notées";
}
document.querySelectorAll("section").forEach(c => {
  const id = c.dataset.id, v = notes[id] || {};
  c.querySelectorAll("input.note").forEach(r => { r.checked = v.note === Number(r.value);
    r.onchange = () => { notes[id] = {...(notes[id] || {}), note: Number(r.value)}; garder(); }; });
  c.querySelectorAll("input.ne").forEach(r => { r.checked = v.non_etayee === (r.value === "oui");
    r.onchange = () => { notes[id] = {...(notes[id] || {}), non_etayee: r.value === "oui"}; garder(); }; });
  const t = c.querySelector("textarea"); t.value = v.remarque || "";
  t.oninput = () => { notes[id] = {...(notes[id] || {}), remarque: t.value}; garder(); };
});
document.getElementById("exporter").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify({empreinte: EMPREINTE, notes: notes}, null, 1)], {type: "application/json"}));
  a.download = "notes-humaines.json"; a.click();
};
afficher();
</script></body></html>
"""


def carte(i, t, s):
    e = html.escape
    nom = f"n{t['id']}"
    return f"""<section data-id="{t['id']}"><h2>{i}. {e(t['cat'])}</h2>
<details><summary>Document</summary><pre>{e(s['document'])}</pre></details>
<h3>Demande</h3><pre>{e(s['demande'])}</pre>
<h3>Réponse de référence</h3><pre>{e(s['reference'])}</pre>
<details><summary>Grille</summary><pre>{e(s['grille'])}</pre></details>
<h3>Mesures</h3><pre>{e(s['mesures'])}</pre>
<h3>Réponse à noter</h3><pre class="reponse">{e(s['reponse'])}</pre>
<div class="choix">Note : <label><input class="note" type="radio" name="{nom}" value="1"> 1</label>
<label><input class="note" type="radio" name="{nom}" value="0.5"> 0,5</label>
<label><input class="note" type="radio" name="{nom}" value="0"> 0</label></div>
<div class="choix">Affirmation non étayée : <label><input class="ne" type="radio" name="{nom}e" value="oui"> oui</label>
<label><input class="ne" type="radio" name="{nom}e" value="non"> non</label></div>
<textarea rows="2" placeholder="Remarque (facultatif)"></textarea></section>"""


def main():
    jeu, a_juger, cles, sortie = sys.argv[1:5]
    retenu = dict(a.split("=", 1) for a in sys.argv[5:])["retenu"]
    decisifs = sorted({"base", retenu, *RIVALISE})
    cas = [json.loads(l) for l in open(os.path.join(jeu, "cas.jsonl"), encoding="utf-8")]
    principaux = [c for c in cas if c["id"] not in TOUCHES]
    taches = {t["id"]: t for t in map(json.loads, open(a_juger, encoding="utf-8"))}
    cle = {(k["cas"], k["modele"]): k["id"] for k in map(json.loads, open(cles, encoding="utf-8"))}
    rnd = random.Random(0)
    par_cat = {}
    for c in principaux:
        par_cat.setdefault(c["cat"], []).append(c)
    choisis = []
    for cat, n in sorted(repartir({k: len(v) for k, v in par_cat.items()}, N).items()):
        choisis += rnd.sample(par_cat[cat], n)
    rnd.shuffle(choisis)
    modeles = decisifs * (N // len(decisifs))  # 10 réponses par modèle décisif
    rnd.shuffle(modeles)
    echantillon = [{"id": cle[(c["id"], m)], "cas": c["id"], "doc": c["doc"], "cat": c["cat"], "modele": m}
                   for c, m in zip(choisis, modeles)]
    os.makedirs(sortie, exist_ok=True)
    with open(os.path.join(sortie, "echantillon.jsonl"), "w", encoding="utf-8") as s:
        for x in echantillon:
            s.write(json.dumps(x, ensure_ascii=False) + "\n")
    empreinte = hashlib.sha256(open(os.path.join(sortie, "echantillon.jsonl"), "rb").read()).hexdigest()
    cartes = "\n".join(carte(i + 1, taches[x["id"]], sections(taches[x["id"]]["messages"][1]["content"]))
                       for i, x in enumerate(echantillon))
    open(os.path.join(sortie, "feuille.html"), "w", encoding="utf-8").write(PAGE.replace("__CARTES__", cartes).replace("__EMPREINTE__", empreinte))
    compte = {}
    for x in echantillon:
        compte[x["cat"]] = compte.get(x["cat"], 0) + 1
    print(len(echantillon), "réponses ;", compte)
    print({m: sum(x["modele"] == m for x in echantillon) for m in decisifs})
    print(len({x["doc"] for x in echantillon}), "documents ; modèle × catégorie :")
    cats = sorted(compte)
    print(f"  {'':24s}" + " ".join(f"{c[:8]:>8s}" for c in cats))
    for m in decisifs:
        print(f"  {m:24s}" + " ".join(f"{sum(x['modele'] == m and x['cat'] == c for x in echantillon):8d}" for c in cats))
    print("empreinte de l'échantillon :", empreinte)


if __name__ == "__main__":
    main()
