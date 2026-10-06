const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendStarter, enoughDisk } = require('../src/setup.js');

test('modèle de départ selon la mémoire de l’ordinateur', () => {
  const name = (gb) => recommendStarter(gb).best.name;
  assert.equal(name(4), 'gemma3:1b');
  assert.equal(name(8), 'gemma3:4b');
  assert.equal(name(12), 'qwen3:8b');
  assert.equal(name(16), 'gemma3:12b');
  assert.equal(name(64), 'gemma3:12b');
  assert.equal(name(null), 'gemma3:1b');
  assert.deepEqual(
    recommendStarter(16).alternatives.map((m) => m.name),
    ['qwen3:8b', 'gemma3:4b'],
  );
});

test('place libre : le modèle et 2 Go de marge', () => {
  const model = recommendStarter(16).best; // 8,1 Go
  assert.equal(enoughDisk(model, 9), false);
  assert.equal(enoughDisk(model, 11), true);
  assert.equal(enoughDisk(model, null), true, 'inconnue : pas de blocage');
});
