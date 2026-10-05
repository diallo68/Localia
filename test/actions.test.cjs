const { test } = require('node:test');
const assert = require('node:assert/strict');
const a = require('../src/actions.js');

const entries = [
  { path: 'Articles', type: 'folder' },
  { path: 'Articles/vieux.pdf', type: 'file', size: 1200 },
  { path: 'mildiou-2019.pdf', type: 'file', size: 2_400_000 },
  { path: 'mildiou-2023.pdf', type: 'file', size: 800_000 },
  { path: 'notes.txt', type: 'file', size: 40 },
];

test('chemins : relatifs, sans « .. », sans fichier caché, sans chemin absolu', () => {
  assert.equal(a.cleanPath('./Articles/2023/'), 'Articles/2023');
  assert.equal(a.cleanPath('Articles\\2023'), 'Articles/2023');
  for (const bad of [
    '/etc/passwd',
    '../x',
    'a/../../b',
    '~/Documents',
    '.ssh/id',
    'C:/x',
    '',
    'a//b',
  ])
    assert.throws(() => a.cleanPath(bad), undefined, bad);
});

test('contenu du dossier : format présenté au modèle et relu par le Benchmark', () => {
  const text = a.formatListing(entries);
  assert.match(text, /^- \[dossier\] Articles\/$/m);
  assert.match(text, /^- \[fichier\] mildiou-2019\.pdf \(2,4 Mo\)$/m);
  assert.deepEqual(
    a.parseListing(`Contenu :\n${text}\n\nDemande : classe`),
    entries.map((e) => ({ path: e.path, type: e.type })),
  );
});

test('plan lu dans un bloc json, ou dans le premier objet de la réponse', () => {
  const plan = a.parsePlan(
    'Voici le plan.\n```json\n{"summary": "Classement", "actions": [{"type": "create_folder", "path": "2019"}]}\n```',
  );
  assert.equal(plan.summary, 'Classement');
  assert.equal(plan.actions.length, 1);
  assert.equal(a.parsePlan('Plan : {"actions": []} fin').actions.length, 0);
  assert.equal(a.parsePlan('Je ne peux pas faire cela.'), null);
  assert.equal(a.parsePlan('```json\n{"actions": [ incomplet\n```'), null);
});

test('plan vérifié dans l’ordre : dossier créé avant d’y déplacer, rien d’écrasé', () => {
  const checked = a.validatePlan(
    [
      { type: 'move', from: 'mildiou-2019.pdf', to: '2019/mildiou-2019.pdf' }, // dossier pas encore créé
      { type: 'create_folder', path: '2023' },
      { type: 'move', from: 'mildiou-2023.pdf', to: '2023/mildiou-2023.pdf', reason: 'année' },
      { type: 'move', from: 'notes.txt', to: 'Articles' }, // existe déjà
      { type: 'move', from: 'absent.pdf', to: 'x.pdf' },
      { type: 'move', from: 'Articles', to: 'Articles/sous' }, // dans lui-même
      { type: 'create_file', path: 'index.md', content: '# Index' },
      { type: 'create_file', path: 'script.sh', content: 'rm -rf ~' },
      { type: 'trash', path: 'Articles' },
      { type: 'move', from: 'Articles/vieux.pdf', to: 'vieux.pdf' }, // à la corbeille avec son dossier
      { type: 'delete', path: 'notes.txt' },
      { type: 'move', from: 'notes.txt', to: '../notes.txt' },
    ],
    entries,
  );
  assert.deepEqual(
    checked.map((c) => c.ok),
    [false, true, true, false, false, false, true, false, true, false, false, false],
  );
  assert.match(checked[0].error, /dossier « 2019 » n’existe pas/);
  assert.match(checked[3].error, /existe déjà/);
  assert.match(checked[7].error, /\.md, \.txt et \.csv/);
  assert.match(checked[10].error, /inconnu/);
  assert.match(checked[11].error, /chemin invalide/);
  assert.equal(checked[2].action.reason, 'année');
});

test('dossier créé avec ses parents manquants', () => {
  const checked = a.validatePlan(
    [
      { type: 'create_folder', path: 'Dalaba/2023' },
      { type: 'move', from: 'notes.txt', to: 'Dalaba/2023/notes.txt' },
      { type: 'create_file', path: 'Vide/x.md', content: 'x' }, // un fichier n'ajoute pas de dossier
    ],
    entries,
  );
  assert.deepEqual(
    checked.map((c) => c.ok),
    [true, true, false],
  );
  assert.deepEqual(checked[0].action.parents, ['Dalaba']);
  assert.equal(
    a.describeAction(checked[0].action),
    'Créer le dossier « Dalaba/2023 » (et « Dalaba »)',
  );
  assert.equal(
    a.validatePlan([{ type: 'create_folder', path: 'Articles/2023' }], entries)[0].action.parents,
    undefined,
  );
});

test('déplacer un dossier déplace son contenu ; renommer est décrit comme tel', () => {
  const checked = a.validatePlan(
    [
      { type: 'move', from: 'Articles', to: 'Archives' },
      { type: 'move', from: 'Archives/vieux.pdf', to: 'Archives/ancien.pdf' },
    ],
    entries,
  );
  assert.ok(checked.every((c) => c.ok));
  assert.equal(
    a.describeAction(checked[1].action),
    'Renommer « Archives/vieux.pdf » en « ancien.pdf »',
  );
  assert.equal(
    a.describeAction({ type: 'move', from: 'a.pdf', to: 'B/a.pdf' }),
    'Déplacer « a.pdf » vers « B/a.pdf »',
  );
});

test('vérification automatique d’une réponse du Benchmark', () => {
  const question = `Contenu du dossier :\n${a.formatListing(entries)}\n\nDemande : range les PDF par année.`;
  const answer =
    '```json\n{"actions": [{"type": "create_folder", "path": "2019"}, {"type": "move", "from": "mildiou-2019.pdf", "to": "2019/mildiou-2019.pdf"}, {"type": "move", "from": "mildiou-2021.pdf", "to": "2019/mildiou-2021.pdf"}]}\n```';
  const report = a.checkPlanAnswer(answer, question);
  assert.equal(report.valid, 2);
  assert.deepEqual(report.invalid, [
    {
      action: 'Déplacer « mildiou-2021.pdf » vers « 2019/mildiou-2021.pdf »',
      error: '« mildiou-2021.pdf » n’existe pas',
    },
  ]);
  assert.equal(a.checkPlanAnswer('pas de plan', question).readable, false);
  assert.equal(a.checkPlanAnswer(answer, 'Question sans dossier'), null);
});
