const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendFor } = require('../src/catalog.js');

const pick = (computer) => {
  const r = recommendFor(computer);
  return [r.best.id, ...r.alternatives.map((m) => m.id)];
};

test('choix selon le métier : Qwen 3.5 9B en Ingénierie sur un Mac Apple Silicon', () => {
  const r = recommendFor({ memoryGB: 16, platform: 'darwin', arch: 'arm64', metier: 'ingenierie' });
  assert.equal(r.best.id, 'qwen3.5-9b');
  assert.match(r.reasons.join(' '), /Ingénierie/);
  assert.equal(
    pick({ memoryGB: 16, platform: 'darwin', arch: 'arm64', metier: 'sante' })[0],
    'gemma-4-e4b',
  );
});

test('choix selon l’ordinateur : sans puce Apple, modèles de moins de 5 Go', () => {
  const intel = recommendFor({
    memoryGB: 16,
    platform: 'darwin',
    arch: 'x64',
    metier: 'ingenierie',
  });
  assert.equal(intel.best.id, 'gemma-4-e4b');
  assert.match(intel.reasons.join(' '), /moins de 5 Go/);
  assert.ok(intel.alternatives.every((m) => m.size <= 5e9));
  assert.equal(
    pick({ memoryGB: 32, platform: 'win32', arch: 'x64', metier: 'ingenierie' })[0],
    'qwen3.5-9b',
  );
});

test('petite mémoire et peu de place : modèle léger, jamais MedGemma d’office', () => {
  assert.equal(
    pick({ memoryGB: 8, platform: 'linux', arch: 'x64', metier: 'sante' })[0],
    'gemma-4-e2b',
  );
  assert.equal(pick({ memoryGB: 4, platform: 'win32', arch: 'x64' })[0], 'gemma-3-1b');
  const full = recommendFor({ memoryGB: 16, platform: 'darwin', arch: 'arm64', freeDiskGB: 3 });
  assert.equal(full.best.id, 'gemma-3-1b');
  assert.match(full.reasons.join(' '), /place libre/);
  for (const metier of ['sante', 'juridique', 'enseignement', 'ingenierie', undefined])
    for (const memoryGB of [4, 8, 16, 64])
      assert.ok(
        !pick({ memoryGB, platform: 'darwin', arch: 'arm64', metier }).includes('medgemma-1.5-4b'),
      );
});
