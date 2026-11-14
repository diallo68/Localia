// Dial-bowe v2 : tri des exemples de schémas (sortie de mermaid_kaggle.py), sans modèle.
// Une réponse est gardée si :
// - elle contient un bloc ```mermaid``` fermé, que Mermaid (11, comme dans Localia) analyse et dessine TEL QUEL
//   (sans les réparations de Localia : l'exemple doit apprendre le code juste) ;
// - elle n'a ni ligne « style », ni schéma en caractères hors du bloc, ni fin coupée ;
// - le professeur l'a notée 4 ou 5 ;
// - sa langue est celle de la demande ;
// - chaque égalité écrite est juste (verify.js de Localia) ;
// - pour un circuit : le câblage lu dans le Mermaid est l'un des câblages justes du catalogue CIRCUITS de
//   mermaid_kaggle.py (lu dans ce fichier : une seule source).
// Usage : node verifier_mermaid.cjs <mermaid_jugement.jsonl> <exemples.jsonl> <verification.json>
//         [--localia ~/localia-recherche]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Catalogue des circuits, lu dans mermaid_kaggle.py.
const lireCircuits = () =>
  JSON.parse(
    execFileSync('python3', [
      '-I',
      '-c',
      'import ast,json,sys\nt=ast.parse(open(sys.argv[1]).read())\n' +
        'n=[x for x in t.body if isinstance(x,ast.Assign) and getattr(x.targets[0],"id","")=="CIRCUITS"][0]\n' +
        'print(json.dumps(ast.literal_eval(n.value)))',
      path.join(__dirname, 'mermaid_kaggle.py'),
    ]),
  );

// --- Câblage d'un circuit lu dans un flowchart -------------------------------------------------------------------
const plain = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function kindOf(label) {
  const t = plain(label);
  if (/\b(r\d*|resistance|resistor|resistor\w*)\b/.test(t)) return 'R';
  if (/\b(c\d*|condensateur|capacitor|capacite|capacitance)\b/.test(t)) return 'C';
  if (/\b(l\d*|bobine|inductance|inductor|self)\b/.test(t)) return 'L';
  if (/(masse|terre|ground|\bgnd\b|\b0 ?v\b)/.test(t)) return 'm';
  if (/(entree|input|\bv_?e\b|\bv_?in\b|source|generateur|generator)/.test(t)) return 'e';
  if (/(sortie|output|\bv_?s\b|\bv_?out\b)/.test(t)) return 's';
  return null; // fil ou nœud intermédiaire
}
// vertices : [{id, label}] ; edges : [[a, b]]. Renvoie [[composant, net, net]] ou un motif de refus.
function wiring(vertices, edges) {
  const kind = new Map(vertices.map((v) => [v.id, kindOf(v.label || v.id)]));
  const isComp = (id) => ['R', 'C', 'L'].includes(kind.get(id));
  // Deux composants reliés directement : un fil (nœud anonyme) entre eux.
  let wires = 0;
  const links = [];
  for (const [a, b] of edges) {
    if (isComp(a) && isComp(b)) {
      const w = `__fil${wires++}`;
      kind.set(w, null);
      links.push([a, w], [w, b]);
    } else links.push([a, b]);
  }
  // Nets : nœuds non composants reliés entre eux, plus tous les nœuds d'une même borne (e, s, m).
  const parent = new Map();
  const find = (x) =>
    parent.get(x) === x || !parent.has(x) ? (parent.set(x, x), x) : find(parent.get(x));
  const union = (a, b) => parent.set(find(a), find(b));
  for (const [id, k] of kind) if (!isComp(id)) find(id);
  for (const [a, b] of links) if (!isComp(a) && !isComp(b)) union(a, b);
  const borne = {};
  for (const [id, k] of kind)
    if (['e', 's', 'm'].includes(k)) borne[k] ? union(id, borne[k]) : (borne[k] = id);
  const netName = (id) => {
    const root = find(id);
    for (const k of ['e', 's', 'm']) if (borne[k] && find(borne[k]) === root) return k;
    return 'x:' + root;
  };
  const out = [];
  for (const [id] of kind) {
    if (!isComp(id)) continue;
    const nets = [
      ...new Set(
        links.filter((l) => l.includes(id)).map((l) => netName(l[0] === id ? l[1] : l[0])),
      ),
    ];
    if (nets.length !== 2) return `composant ${id} relié à ${nets.length} nœud(s)`;
    out.push([kind.get(id), ...nets]);
  }
  if (!['e', 's', 'm'].every((k) => borne[k])) return 'entrée, sortie ou masse absente';
  return out;
}
// Même câblage, au nommage près des nœuds intérieurs (x).
function sameWiring(got, expected) {
  if (got.length !== expected.length) return false;
  const inner = [...new Set(got.flatMap(([, a, b]) => [a, b]).filter((n) => n.startsWith('x:')))];
  const names = [
    ...new Set(expected.flatMap(([, a, b]) => [a, b]).filter((n) => n.startsWith('x'))),
  ];
  if (inner.length !== names.length) return false;
  const key = (list) =>
    list
      .map(([c, a, b]) => c + ':' + [a, b].sort().join('-'))
      .sort()
      .join(' ');
  const target = key(expected);
  const perms = (xs) =>
    xs.length <= 1
      ? [xs]
      : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map((p) => [x, ...p]));
  for (const p of perms(names)) {
    const map = Object.fromEntries(inner.map((n, i) => [n, p[i]]));
    if (key(got.map(([c, a, b]) => [c, map[a] || a, map[b] || b])) === target) return true;
  }
  return false;
}

// --- Langue (réponse hors du code) -----------------------------------------------------------------------------
const FR = /\b(le|la|les|des|est|et|une|du|pour|dans|que|qui|avec)\b/g;
const EN = /\b(the|is|and|of|to|for|with|that|this|are|in)\b/g;
function langueOk(texte, langue) {
  const prose = texte.replace(/```[\s\S]*?```/g, ' ').toLowerCase();
  const fr = (prose.match(FR) || []).length;
  const en = (prose.match(EN) || []).length;
  if (fr + en < 5) return true; // trop court pour juger
  return langue === 'en' ? en > fr : fr > en;
}

async function main() {
  const args = process.argv.slice(2);
  const LOCALIA = path.resolve(
    args.includes('--localia')
      ? args[args.indexOf('--localia') + 1]
      : path.join(require('node:os').homedir(), 'localia-recherche'),
  );
  const [entree, sortie, rapport] = args.filter(
    (a, i) => !a.startsWith('--') && args[i - 1] !== '--localia',
  );
  const { chromium } = require(path.join(LOCALIA, 'node_modules/@playwright/test'));
  const MERMAID = path.join(LOCALIA, 'node_modules/mermaid/dist/mermaid.min.js');
  const { checkCalculations } = require(path.join(LOCALIA, 'src/verify.js'));
  const CIRCUITS = lireCircuits();
  const items = fs
    .readFileSync(entree, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: MERMAID });
  await page.evaluate(() => mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }));
  const analyse = (code) =>
    page.evaluate(async (c) => {
      try {
        await mermaid.parse(c);
        await mermaid.render('v' + Math.random().toString(36).slice(2), c);
        const d = await mermaid.mermaidAPI.getDiagramFromText(c);
        const db = d.db;
        const vertices = db.getVertices
          ? [
              ...(db.getVertices() instanceof Map
                ? db.getVertices().values()
                : Object.values(db.getVertices())),
            ].map((v) => ({ id: v.id, label: v.text || v.label || v.id }))
          : [];
        const edges = db.getEdges ? db.getEdges().map((e) => [e.start, e.end]) : [];
        return { ok: true, type: d.type, vertices, edges };
      } catch (e) {
        return { ok: false, erreur: String(e.message || e).split('\n')[0] };
      }
    }, code);

  const gardes = [];
  const causes = {};
  const parSorte = {};
  const refus = (d, cause) => {
    causes[cause] = (causes[cause] || 0) + 1;
    (parSorte[d.sorte] ||= { gardé: 0, rejeté: 0 }).rejeté++;
  };
  for (const d of items) {
    const texte = d.reponse?.texte || '';
    const blocs = [...texte.matchAll(/```mermaid[ \t]*\n([\s\S]*?)```/g)].map((m) => m[1]);
    if (!texte.trim() || d.reponse.fin === 'length') {
      refus(d, 'réponse vide ou coupée');
      continue;
    }
    if (!blocs.length) {
      refus(d, 'pas de bloc mermaid fermé');
      continue;
    }
    if (blocs.some((b) => /^\s*(style|classDef|linkStyle)\b/m.test(b))) {
      refus(d, 'lignes de style');
      continue;
    }
    const autres = texte.replace(/```mermaid[ \t]*\n[\s\S]*?```/g, '');
    if (/```[\s\S]*?```/.test(autres) && /[|+]-{2,}|-{2,}[|+>]|\|\s*$/m.test(autres)) {
      refus(d, 'schéma en caractères');
      continue;
    }
    if (!(d.jugement?.note >= 4)) {
      refus(d, 'note du professeur < 4');
      continue;
    }
    if (!langueOk(texte, d.langue)) {
      refus(d, 'autre langue');
      continue;
    }
    if (checkCalculations(texte).some((c) => !c.ok)) {
      refus(d, 'calcul faux');
      continue;
    }
    let echec = null;
    for (const b of blocs) {
      const a = await analyse(b);
      if (!a.ok) {
        echec = 'mermaid illisible';
        break;
      }
      if (d.sorte === 'circuit') {
        const w = wiring(a.vertices, a.edges);
        if (typeof w === 'string')
          echec = 'câblage illisible : ' + w.replace(/composant \S+/, 'composant');
        else if (!CIRCUITS[d.circuit][1].some((alt) => sameWiring(w, alt))) echec = 'circuit faux';
      }
    }
    if (echec) {
      refus(d, echec);
      continue;
    }
    (parSorte[d.sorte] ||= { gardé: 0, rejeté: 0 }).gardé++;
    gardes.push({
      id: d.id,
      type: d.sorte === 'circuit' ? 'schema-circuit' : 'schema',
      domaine: d.domaine,
      langue: d.langue,
      messages: [...d.messages, { role: 'assistant', content: texte.trim() }],
    });
  }
  await browser.close();
  fs.writeFileSync(
    sortie,
    gardes.map((g) => JSON.stringify(g)).join('\n') + (gardes.length ? '\n' : ''),
  );
  const bilan = { gardés: gardes.length, total: items.length, par_sorte: parSorte, causes };
  fs.writeFileSync(rapport, JSON.stringify(bilan, null, 1));
  console.log(JSON.stringify(bilan));
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
module.exports = { wiring, sameWiring, kindOf, lireCircuits };
