const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/calculator.cjs');
const { checkCalculations } = require('../src/verify.js');

test('calcul faux trouvé par verify.js → résultat exact renvoyé au modèle', () => {
  const wrong = checkCalculations('Remise : 1 250 × 0,18 = 230 €\nTotal : 40 × 25 = 1 000').filter(
    (c) => !c.ok,
  );
  assert.equal(wrong.length, 1);
  const request = calc.correctionRequest(wrong, 'fr');
  assert.match(request, /1 250 × 0,18 = 225 \(et non 230\)/);
  assert.match(request, /Réécris ta réponse avec la même présentation/);
  assert.doesNotMatch(request, /40 × 25/);
  const en = calc.correctionRequest([{ expression: '7 × 8 = 54', expected: 56 }], 'en');
  assert.match(en, /- 7 × 8 = 56 \(not 54\)/);
  assert.match(en, /Rewrite your answer with the same presentation/);
});

test('résultats décimaux arrondis, entrées invalides ignorées', () => {
  const lines = calc.correctedLines(
    [
      { expression: '10 / 3 = 3,5', expected: 10 / 3 },
      { expression: 'x', expected: NaN },
      { expression: 42, expected: 1 },
      null,
    ],
    'fr',
  );
  assert.deepEqual(lines, ['- 10 / 3 = 3,3333 (et non 3,5)']);
  assert.equal(calc.correctionRequest([], 'fr'), null);
  assert.equal(calc.correctionRequest('rien', 'fr'), null);
  const many = Array.from({ length: 30 }, (_, i) => ({
    expression: `${i} + 1 = 0`,
    expected: i + 1,
  }));
  assert.equal(calc.correctedLines(many, 'fr').length, 20);
});
