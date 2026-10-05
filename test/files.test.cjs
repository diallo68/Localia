const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const files = require('../src/files.cjs');

async function folder() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'localia-files-')));
  await fs.mkdir(path.join(root, 'Articles'));
  await fs.writeFile(path.join(root, 'Articles', 'vieux.pdf'), 'pdf');
  await fs.writeFile(path.join(root, 'mildiou-2019.pdf'), 'pdf 2019');
  await fs.writeFile(path.join(root, 'notes.txt'), 'notes');
  await fs.writeFile(path.join(root, '.cache'), 'caché');
  return root;
}
// Corbeille simulée : déplace dans un dossier à part.
function fakeTrash(root) {
  const trashed = [];
  return {
    trashed,
    trash: async (file) => {
      const target = path.join(root + '-corbeille', path.basename(file));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(file, target);
      trashed.push(file);
    },
  };
}
const exists = (file) =>
  fs.lstat(file).then(
    () => true,
    () => false,
  );

test('contenu listé sans fichiers cachés ni liens symboliques', async () => {
  const root = await folder();
  // Lien vers l'extérieur (jonction sous Windows : pas de droits administrateur nécessaires).
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-lien-'));
  await fs.symlink(outside, path.join(root, 'lien'), 'junction');
  const { entries } = await files.listFolder(root);
  assert.deepEqual(
    entries.map((e) => `${e.type}:${e.path}`),
    ['folder:Articles', 'file:Articles/vieux.pdf', 'file:mildiou-2019.pdf', 'file:notes.txt'],
  );
  assert.equal(entries[2].size, 8);
});

test('plan appliqué puis annulé : le dossier revient à son état initial', async () => {
  const root = await folder();
  const { trash, trashed } = fakeTrash(root);
  const results = await files.applyActions(
    root,
    [
      { type: 'create_folder', path: '2019' },
      { type: 'move', from: 'mildiou-2019.pdf', to: '2019/mildiou-2019.pdf' },
      { type: 'create_file', path: '2019/README.md', content: '# 2019' },
      { type: 'move', from: 'notes.txt', to: 'notes-these.txt' },
      { type: 'create_folder', path: 'Dalaba/2023/brut' },
    ],
    { trash },
  );
  assert.ok(results.every((r) => r.done));
  assert.equal(await fs.readFile(path.join(root, '2019', 'mildiou-2019.pdf'), 'utf8'), 'pdf 2019');
  assert.equal(await fs.readFile(path.join(root, '2019', 'README.md'), 'utf8'), '# 2019');
  assert.ok(await exists(path.join(root, 'notes-these.txt')));
  assert.ok(await exists(path.join(root, 'Dalaba', '2023', 'brut')));
  assert.equal(results[2].content, undefined); // contenu non conservé dans le journal

  await files.undoActions(root, results, { trash });
  assert.ok(results.every((r) => r.undone));
  assert.equal(trashed.length, 1); // le fichier créé va à la corbeille
  assert.ok(await exists(path.join(root, 'mildiou-2019.pdf')));
  assert.ok(await exists(path.join(root, 'notes.txt')));
  assert.ok(!(await exists(path.join(root, '2019'))));
  assert.ok(!(await exists(path.join(root, 'Dalaba'))));
});

test('plan revérifié sur le disque : action impossible → rien n’est modifié', async () => {
  const root = await folder();
  const { trash } = fakeTrash(root);
  await assert.rejects(
    files.applyActions(
      root,
      [
        { type: 'create_folder', path: 'Nouveau' },
        { type: 'move', from: 'notes.txt', to: 'Articles/vieux.pdf' },
      ],
      { trash },
    ),
    /Plan refusé : « Articles\/vieux\.pdf » existe déjà\. Rien n’a été modifié/,
  );
  assert.ok(!(await exists(path.join(root, 'Nouveau'))));
  await assert.rejects(
    files.applyActions(root, [{ type: 'trash', path: '.cache' }], { trash }),
    /fichier caché refusé/,
  );
});

test('lien symbolique vers l’extérieur : aucune écriture hors du dossier', async () => {
  const root = await folder();
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'localia-dehors-')));
  await fs.symlink(outside, path.join(root, 'Sortie'), 'junction');
  await assert.rejects(files.resolveInside(root, 'Sortie/x.md'), /hors du dossier autorisé/);
  // Le lien n'est pas listé : un plan qui l'utilise est refusé avant toute écriture.
  await assert.rejects(
    files.applyActions(root, [{ type: 'create_file', path: 'Sortie/x.md', content: 'x' }], {
      trash: async () => {},
    }),
    /Plan refusé/,
  );
  assert.deepEqual(await fs.readdir(outside), []);
});

test('corbeille : jamais de suppression définitive ; annulation signalée comme impossible', async () => {
  const root = await folder();
  const { trash, trashed } = fakeTrash(root);
  const results = await files.applyActions(root, [{ type: 'trash', path: 'Articles' }], { trash });
  assert.ok(results[0].done);
  assert.equal(trashed.length, 1);
  assert.ok(await exists(path.join(root + '-corbeille', 'Articles', 'vieux.pdf')));
  await files.undoActions(root, results, { trash });
  assert.match(results[0].undoError, /Corbeille/);
});

test('une action échoue en cours de route : les suivantes ne sont pas exécutées', async () => {
  const root = await folder();
  const results = await files.applyActions(
    root,
    [
      { type: 'move', from: 'notes.txt', to: 'notes2.txt' },
      { type: 'trash', path: 'mildiou-2019.pdf' },
      { type: 'create_folder', path: 'Après' },
    ],
    {
      trash: async () => {
        throw new Error('Corbeille indisponible');
      },
    },
  );
  assert.deepEqual(
    results.map((r) => r.done),
    [true, false, false],
  );
  assert.equal(results[1].error, 'Corbeille indisponible');
  assert.match(results[2].error, /non exécutée/);
  assert.ok(!(await exists(path.join(root, 'Après'))));
});
