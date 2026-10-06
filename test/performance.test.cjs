const { test } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../src/performance.js');

const intelMac = {
  platform: 'darwin',
  arch: 'x64',
  memoryGB: 16,
  gpus: [{ name: 'Radeon Pro 560X', vramGB: 4 }],
};
const appleMac = {
  platform: 'darwin',
  arch: 'arm64',
  memoryGB: 16,
  gpus: [{ name: 'Apple M2', vramGB: null }],
};
const nvidiaPc = {
  platform: 'win32',
  arch: 'x64',
  memoryGB: 32,
  gpus: [{ name: 'NVIDIA GeForce RTX 4060', vramGB: 8 }],
};

test('accélération : Mac Intel sur processeur, puce Apple, carte NVIDIA', () => {
  assert.equal(p.acceleration(intelMac).kind, 'cpu');
  assert.match(p.acceleration(intelMac).label, /n’utilise pas ces cartes graphiques/);
  assert.equal(p.acceleration(appleMac).kind, 'apple');
  assert.equal(p.acceleration(nvidiaPc).kind, 'gpu');
  assert.equal(
    p.acceleration({ platform: 'win32', arch: 'x64', memoryGB: 8, gpus: [] }).kind,
    'cpu',
  );
});

test('verdict selon la taille du modèle et la mémoire', () => {
  assert.equal(p.assessModel(2.5e9, intelMac).level, 'confortable');
  assert.equal(p.assessModel(8.1e9, intelMac).level, 'possible');
  assert.match(p.assessModel(8.1e9, intelMac).detail, /Fermez les autres applications/);
  assert.equal(p.assessModel(20e9, intelMac).level, 'trop-gros');
  assert.match(p.assessModel(5e9, nvidiaPc).detail, /Tient dans la carte graphique/);
  assert.match(p.assessModel(9e9, nvidiaPc).detail, /Dépasse la mémoire de la carte graphique/);
  assert.match(p.assessModel(5e9, appleMac).detail, /puce Apple/);
});

test('vitesses : libellés et médiane des séries du Benchmark', () => {
  assert.match(p.speedLabel(20), /rapide/);
  assert.match(p.speedLabel(7), /vitesse de lecture/);
  assert.match(p.speedLabel(2.8), /^2,8 tokens\/s — lent/);
  assert.equal(p.speedLabel(null), null);
  const records = [
    {
      results: [
        { model: 'a', status: 'done', stats: { outputTokens: 30, outputMs: 10000 } },
        { model: 'a', status: 'done', stats: { outputTokens: 50, outputMs: 10000 } },
        { model: 'a', status: 'error', stats: { outputTokens: 999, outputMs: 1 } },
        { model: 'b', status: 'done', stats: null },
      ],
    },
  ];
  assert.deepEqual(p.benchmarkSpeeds(records), { a: { tokensPerSecond: 4, answers: 2 } });
});
