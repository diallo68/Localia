const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../src/benchmark-stats.js');

const stats = (totalMs, outputTokens, outputMs, extra = {}) => ({
  totalMs,
  loadMs: 1000,
  promptTokens: 100,
  promptMs: 2000,
  outputTokens,
  outputMs,
  doneReason: 'stop',
  ...extra,
});
const grade = (verdict, rating, invention = false) => ({ verdict, rating, invention });
// Deux répétitions d'une série de 2 questions sur 2 modèles.
function series(repetition, texts, grades) {
  return {
    id: 'r' + repetition,
    groupId: 'g',
    repetition,
    models: ['a', 'b'],
    questions: [
      { label: 'Q1', prompt: 'p1', category: 'Extraction' },
      { label: 'Q2', prompt: 'p2', category: 'Calcul' },
    ],
    results: [
      {
        q: 0,
        model: 'a',
        status: 'done',
        text: texts[0],
        stats: stats(10000, 50, 5000),
        grades: grades[0],
      },
      {
        q: 1,
        model: 'a',
        status: 'done',
        text: texts[1],
        stats: stats(20000, 50, 5000),
        grades: grades[1],
      },
      {
        q: 0,
        model: 'b',
        status: 'done',
        text: texts[2],
        stats: stats(40000, 20, 10000),
        grades: grades[2],
      },
      { q: 1, model: 'b', status: 'error', error: 'x' },
    ],
  };
}
const run1 = series(
  1,
  ['x', 'y', 'z'],
  [
    { Vous: grade('correct', 5) },
    { Vous: grade('faux', 1, true), Claude: grade('partiel', 2) },
    { Vous: grade('partiel', 3), Claude: grade('partiel', 3) },
  ],
);
const run2 = series(
  2,
  ['x', 'autre', 'z'],
  [{ Vous: grade('correct', 5) }, { Vous: grade('correct', 4) }, { Vous: grade('faux', 2) }],
);

test('moyenne, écart-type d’échantillon, médiane', () => {
  assert.equal(s.mean([1, 2, 3]), 2);
  assert.equal(s.sd([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), '2.1381');
  assert.equal(s.sd([3]), null);
  assert.equal(s.median([5, 1, 3]), 3);
  assert.equal(s.median([4, 1, 3, 2]), 2.5);
});

test('indicateurs par modèle : précision, invention, note et vitesses par répétition', () => {
  const [a, b] = s.modelMetrics([run1, run2], 'Vous');
  assert.equal(a.model, 'a');
  assert.equal(a.repetitions, 2);
  // Répétition 1 : correct + faux = 0,5 ; répétition 2 : 2 correctes = 1.
  assert.equal(a.correct.mean, 0.75);
  assert.equal(a.correct.sd.toFixed(4), '0.3536');
  assert.equal(a.invention.mean, 0.25);
  assert.equal(a.rating.mean, (3 + 4.5) / 2);
  assert.equal(a.generation.mean, 10); // 100 tokens en 10 s
  assert.equal(a.answerSeconds.mean, 15);
  assert.equal(a.loadSeconds.mean, 1);
  assert.equal(a.medianSeconds, 15);
  assert.equal(b.errors, 2);
  assert.equal(b.answered, 2);
  assert.equal(b.acceptable.mean, 0.5);
});

test('tous correcteurs : moyenne des correcteurs pour chaque réponse', () => {
  const values = s.gradeValues(run1.results[1], s.ALL_GRADERS);
  assert.equal(values.correct, 0);
  assert.equal(values.acceptable, 0.5);
  assert.equal(values.invention, 0.5);
  assert.equal(values.rating, 1.5);
  assert.equal(s.gradeValues({ grades: {} }, s.ALL_GRADERS), null);
  assert.deepEqual(s.gradersOf([run1, run2]), ['Claude', 'Vous']);
});

test('par catégorie', () => {
  const cells = s.categoryMetrics([run1, run2], 'Vous');
  const cell = (category, model) => cells.find((c) => c.category === category && c.model === model);
  assert.equal(cell('Extraction', 'a').correct, 1);
  assert.equal(cell('Calcul', 'a').correct, 0.5);
  assert.equal(cell('Extraction', 'b').n, 2);
  assert.equal(cell('Calcul', 'b'), undefined, 'réponse en erreur non comptée');
});

test('stabilité entre répétitions', () => {
  const [a, b] = s.stabilityMetrics([run1, run2], 'Vous');
  assert.equal(a.questions, 2);
  assert.equal(a.identical, 0.5);
  assert.equal(a.verdictChanges, 0.5);
  assert.equal(b.identical, 1);
  assert.equal(b.verdictChanges, 1);
  assert.deepEqual(s.stabilityMetrics([run1], 'Vous'), [], 'une seule répétition');
});

test('accord entre correcteurs (kappa de Cohen)', () => {
  const result = s.agreement([run1], 'Vous', 'Claude');
  assert.equal(result.pairs, 2);
  assert.equal(result.verdictAgreement, 0.5);
  assert.equal(result.ratingDifference, 0.5);
  // po = 0,5 ; pe = P(partiel)Vous 0,5 × P(partiel)Claude 1 = 0,5 → kappa 0.
  assert.equal(result.kappa, 0);
  const perfect = s.agreement([run2], 'Vous', 'Vous');
  assert.equal(perfect.kappa, 1);
});

test('CSV : écriture et lecture avec guillemets, retours à la ligne et BOM', () => {
  const rows = [
    ['a;b', 'dit "oui"', 'ligne\nsuivante'],
    ['', 'x', 'y'],
  ];
  assert.deepEqual(s.parseCsv('﻿' + s.toCsv(rows)), rows);
});

test('import de notes : appliquées, lignes invalides refusées avec leur raison', () => {
  const records = [JSON.parse(JSON.stringify(run1))];
  const csv = s.toCsv([
    ['Série', 'Question', 'Modèle', 'Correcteur', 'Verdict', 'Invention', 'Note', 'Commentaire'],
    ['r1', 'Q1', 'b', 'Claude', 'Faux', 'oui', '1', 'invente un chiffre'],
    ['r1', 'Q2', 'a', 'Claude', 'hors sujet', 'non', '', ''],
    ['r9', 'Q1', 'a', 'Claude', 'correct', '', '5', ''],
    ['r1', 'Q1', 'a', 'Claude', 'bof', '', '5', ''],
    ['r1', 'Q1', 'a', 'Claude', 'correct', '', '7', ''],
  ]);
  const { applied, rejected } = s.applyGrades(records, csv);
  assert.equal(applied, 2);
  assert.deepEqual(rejected, [
    'ligne 4 : série inconnue',
    'ligne 5 : verdict invalide (correct, partiel, faux, hors-sujet)',
    'ligne 6 : note invalide (1 à 5)',
  ]);
  const b = records[0].results[2].grades.Claude;
  assert.equal(b.verdict, 'faux');
  assert.equal(b.invention, true);
  assert.equal(b.rating, 1);
  assert.equal(
    records[0].results[2].grades.Vous.verdict,
    'partiel',
    'autres correcteurs conservés',
  );
  assert.equal(records[0].results[1].grades.Claude.verdict, 'hors-sujet');
  assert.throws(() => s.applyGrades(records, 'Série;Question\nx;y'), /Modèle/);
});

test('métier déduit du libellé des séries métiers', () => {
  const { metierOf } = require('../src/benchmark-stats.js');
  assert.equal(metierOf('E01 QCM sur un texte'), 'Enseignement');
  assert.equal(metierOf('MD6 Publication pour les réseaux sociaux'), 'Communication');
  assert.equal(metierOf('CD2 Ventes'), 'Entreprise');
  assert.equal(metierOf('Q1'), null);
  assert.equal(metierOf('A1 Résumé'), 'Administration');
  assert.equal(metierOf('Analyse libre'), null);
});

test('classement par métier : note, puis correctes, puis inventions', () => {
  const { metierMetrics, rankModels } = require('../src/benchmark-stats.js');
  const grade = (rating, verdict, invention = false) => ({ X: { rating, verdict, invention } });
  const result = (q, model, g) => ({ q, model, status: 'done', stats: {}, grades: g });
  const records = [
    {
      questions: [{ label: 'S01 Dose' }, { label: 'SD1 Compte rendu' }, { label: 'F01 TVA' }],
      results: [
        result(0, 'a', grade(4, 'correct')),
        result(1, 'a', grade(4, 'partiel')),
        result(0, 'b', grade(5, 'correct')),
        result(1, 'b', grade(3, 'correct', true)),
        result(2, 'a', grade(2, 'faux')),
        result(2, 'b', grade(5, 'correct')),
      ],
    },
  ];
  const cells = metierMetrics(records);
  const sante = rankModels(cells.filter((c) => c.metier === 'Santé'));
  // Égalité de note (4) : b a plus de réponses correctes.
  assert.deepEqual(
    sante.map((c) => c.model),
    ['b', 'a'],
  );
  const finance = rankModels(cells.filter((c) => c.metier === 'Finance'));
  assert.deepEqual(
    finance.map((c) => c.model),
    ['b', 'a'],
  );
  assert.equal(
    rankModels([{ model: 'x', rating: { mean: null }, correct: { mean: null } }]).length,
    0,
  );
});

test('classement : un modèle lent et juste passe devant un rapide qui invente', () => {
  const { rankModels } = require('../src/benchmark-stats.js');
  const ranked = rankModels([
    { model: 'rapide', correct: 0.6, invention: 0.3, rating: 3.5, answerSeconds: 20 },
    { model: 'lent', correct: 0.8, invention: 0.05, rating: 4.1, answerSeconds: 200 },
    { model: 'lent-egal', correct: 0.6, invention: 0.3, rating: 3.5, answerSeconds: 90 },
  ]);
  assert.deepEqual(
    ranked.map((m) => m.model),
    ['lent', 'rapide', 'lent-egal'],
  );
});

test('modèle conseillé par métier : le plus juste, avec son temps moyen', () => {
  const { metierAdvice } = require('../src/benchmark-stats.js');
  const grade = (verdict, invention = false) => ({ X: { verdict, invention } });
  const result = (q, model, g, totalMs) => ({
    q,
    model,
    status: 'done',
    stats: { totalMs },
    grades: g,
  });
  const records = [
    {
      questions: [{ label: 'S01 Dose' }, { label: 'S02 Protocole' }, { label: 'F01 TVA' }],
      results: [
        result(0, 'rapide', grade('correct', true), 10000),
        result(1, 'rapide', grade('faux'), 10000),
        result(0, 'juste', grade('correct'), 60000),
        result(1, 'juste', grade('correct'), 40000),
        result(2, 'rapide', grade('correct'), 5000),
      ],
    },
  ];
  const advice = metierAdvice(records, 'Santé');
  assert.equal(advice.best.model, 'juste');
  assert.equal(advice.best.correct, 1);
  assert.equal(advice.best.invention, 0);
  assert.equal(advice.best.answerSeconds, 50);
  assert.deepEqual(
    advice.ranked.map((c) => c.model),
    ['juste', 'rapide'],
  );
  assert.equal(metierAdvice(records, 'Juridique'), null);
});
