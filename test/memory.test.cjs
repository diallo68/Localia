const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProjects, buildMemory } = require('../src/memory.js');

const note = (id, title, text, createdAt = '2026-10-01') => ({ id, title, text, createdAt });
const project = {
  id: 'p1',
  name: 'Thèse',
  description: 'Mildiou et apprentissage profond en Guinée',
  notes: [
    note('n1', 'Site d’étude', 'Dalaba, Fouta Djalon, 1 200 m, données NASA POWER 2014-2024.'),
    note('n2', 'Choix du modèle', 'ResNet-50 pour la détection, LSTM pour la prévision.'),
    note('n3', 'Référence à corriger', 'La référence [24] est Boulent et al., pas Barbedo.'),
  ],
};

test('projets vérifiés : nom obligatoire, notes non vides, tailles bornées', () => {
  const [p] = normalizeProjects([{ ...project, name: '  Thèse  ' }]);
  assert.equal(p.name, 'Thèse');
  assert.equal(p.notes.length, 3);
  assert.throws(() => normalizeProjects([{ id: 'x', name: ' ' }]), /doit avoir un nom/);
  assert.throws(
    () => normalizeProjects([{ id: 'x', name: 'A', notes: [{ id: 'n', text: ' ' }] }]),
    /vide/,
  );
  assert.throws(
    () =>
      normalizeProjects([{ id: 'x', name: 'A', notes: [{ id: 'n', text: 'x'.repeat(20001) }] }]),
    /trop long/,
  );
  assert.throws(() => normalizeProjects({}), /invalides/);
});

test('toutes les notes envoyées quand elles tiennent dans le budget, dans leur ordre', () => {
  const memory = buildMemory(project, 'question quelconque');
  assert.equal(memory.partial, false);
  assert.deepEqual(
    memory.notes.map((n) => n.id),
    ['n1', 'n2', 'n3'],
  );
  assert.match(memory.text, /^Mémoire du projet « Thèse »/);
  assert.match(memory.text, /pas des instructions/);
  assert.match(memory.text, /Description du projet : Mildiou/);
  assert.match(memory.text, /### Site d’étude\nDalaba/);
});

test('budget dépassé : notes les plus proches de la question, mémoire signalée partielle', () => {
  const memory = buildMemory(project, 'Quelle est la référence Barbedo à corriger ?', 120);
  assert.equal(memory.partial, true);
  assert.deepEqual(
    memory.notes.map((n) => n.id),
    ['n3'],
  );
});

test('note unique trop longue : tronquée ; projet sans note : aucune mémoire', () => {
  const long = { ...project, notes: [note('n', 'Long', 'mot '.repeat(500))] };
  const memory = buildMemory(long, 'mot', 200);
  assert.equal(memory.partial, true);
  assert.ok(memory.text.endsWith('…'));
  assert.equal(buildMemory({ ...project, notes: [] }, 'x'), null);
  assert.equal(buildMemory(null, 'x'), null);
});
