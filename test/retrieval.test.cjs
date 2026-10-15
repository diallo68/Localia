const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stem, scorePassages } = require('../src/retrieval.js');

test('racines : pluriels et dérivés ramenés à la même forme, nombres intacts', () => {
  assert.equal(stem('pluies'), stem('pluie'));
  assert.equal(stem('parcelles'), stem('parcelle'));
  assert.equal(stem('2025'), '2025');
});

test('classement : passage contenant les mots de la question en premier, toutes méthodes', () => {
  const texts = [
    'Introduction générale du rapport.',
    'Les parcelles ont reçu 481 mm de pluie en juillet.',
    'Conclusion et perspectives.',
  ];
  for (const method of ['mots', 'bm25', 'hybride']) {
    const scores = scorePassages(texts, 'Combien de pluie sur les parcelles en juillet ?', method);
    assert.equal(scores.indexOf(Math.max(...scores)), 1, method);
  }
  // BM25 : « pluies » retrouve « pluie » grâce aux racines.
  const scores = scorePassages(texts, 'Quelles pluies ?', 'bm25');
  assert.ok(scores[1] > 0);
});
