const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TASKS, taskById, recommendModels } = require('../src/tasks.js');
const { gradeValues, ALL_GRADERS } = require('../src/benchmark-stats.js');

const valuesOf = (r) => gradeValues(r, ALL_GRADERS);
const answer = (q, model, verdict, invention, seconds) => ({
  q,
  model,
  status: 'done',
  stats: { totalMs: seconds * 1000 },
  grades: { Claude: { verdict, invention, rating: 3 } },
});
// Deux questions d'extraction, une de calcul ; trois modèles.
const records = [
  {
    questions: [
      { label: 'A1', category: 'Extraction' },
      { label: 'A2', category: 'Extraction' },
      { label: 'B1', category: 'Calcul' },
    ],
    results: [
      answer(0, 'lent', 'correct', false, 400),
      answer(1, 'lent', 'correct', false, 420),
      answer(0, 'rapide', 'correct', false, 100),
      answer(1, 'rapide', 'partiel', false, 90),
      answer(0, 'inventif', 'correct', true, 150),
      answer(1, 'inventif', 'correct', true, 160),
      answer(2, 'lent', 'faux', true, 300),
      answer(0, 'sobre', 'correct', false, 120),
      answer(1, 'sobre', 'correct', false, 130),
    ],
  },
];

test('les types de tâches ont un identifiant, des catégories et une consigne', () => {
  assert.ok(TASKS.length >= 6);
  for (const task of TASKS) {
    assert.ok(task.id && task.label && task.instruction && task.categories.length);
  }
  assert.equal(taskById('calcul').label, 'Calculer ou vérifier un calcul');
  assert.equal(taskById('inconnue'), null);
});

test('conseil : le plus précis, puis le moins inventif ; alternative rapide fiable', () => {
  const extraction = recommendModels(
    records,
    ['lent', 'rapide', 'inventif', 'sobre'],
    valuesOf,
  ).find((r) => r.task.id === 'extraction');
  // lent, inventif et sobre : 100 % ; lent et sobre n'inventent pas ; sobre plus rapide → conseillé.
  assert.equal(extraction.best.model, 'sobre');
  assert.equal(extraction.best.medianSeconds, 125);
  assert.equal(
    extraction.fast,
    null,
    'aucun autre modèle à la fois fiable et nettement plus rapide',
  );
  const withoutSober = recommendModels(records, ['lent', 'rapide', 'inventif'], valuesOf).find(
    (r) => r.task.id === 'extraction',
  );
  assert.equal(withoutSober.best.model, 'lent');
  assert.equal(withoutSober.best.invention, 0);
  // inventif est plus rapide et aussi précis, mais invente : jamais proposé comme alternative.
  assert.equal(withoutSober.fast, null);
  assert.equal(withoutSober.reliable, false, 'moins de 10 réponses notées');
});

test('pas de conseil sans assez de réponses notées, ni pour un modèle non installé', () => {
  const all = recommendModels(records, ['lent', 'rapide'], valuesOf);
  assert.equal(all.find((r) => r.task.id === 'calcul').best, null, 'une seule réponse en calcul');
  assert.equal(all.find((r) => r.task.id === 'code').best, null);
  const onlyFast = recommendModels(records, ['rapide'], valuesOf).find(
    (r) => r.task.id === 'extraction',
  );
  assert.equal(onlyFast.best.model, 'rapide');
  assert.equal(onlyFast.fast, null);
});

test('une question répétée ne compte qu’une fois (répétitions moyennées)', () => {
  const twice = [records[0], JSON.parse(JSON.stringify(records[0]))];
  const extraction = recommendModels(twice, ['lent'], valuesOf).find(
    (r) => r.task.id === 'extraction',
  );
  assert.equal(extraction.best.n, 2, 'deux questions distinctes, pas quatre réponses');
  assert.equal(extraction.best.correct, 1);
});
