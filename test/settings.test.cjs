const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, modelContext } = require('../src/settings.cjs');

test('réglages valides conservés, valeurs vides ignorées', () => {
  const settings = normalizeSettings({
    lastModel: 'qwen3:8b',
    models: {
      'qwen3:8b': {
        options: { temperature: '0.4', num_ctx: 16384, top_k: '', seed: null },
        system: '  Réponds en français.  ',
        keepAlive: '30m',
        think: 'false',
      },
      'gemma3:12b': { options: {} },
    },
  });
  assert.deepEqual(settings, {
    lastModel: 'qwen3:8b',
    models: {
      'qwen3:8b': {
        options: { temperature: 0.4, num_ctx: 16384 },
        system: 'Réponds en français.',
        keepAlive: '30m',
        think: 'false',
      },
    },
    online: { bibliography: false },
    remote: { enabled: false },
  });
});

test('réglages invalides refusés avec un message explicite', () => {
  const bad = (model) => () => normalizeSettings({ models: { 'qwen3:8b': model } });
  assert.throws(bad({ options: { temperature: 3 } }), /temperature.*hors limites/);
  assert.throws(bad({ options: { num_ctx: 1000.5 } }), /entier/);
  assert.throws(bad({ options: { top_p: 'abc' } }), /top_p/);
  assert.throws(bad({ keepAlive: 'toString' }), /maintien/);
  assert.throws(bad({ think: 'peut-être' }), /réflexion/);
  assert.throws(bad({ system: 'x'.repeat(4001) }), /4 000/);
  assert.throws(() => normalizeSettings({ models: { 'x:cloud': {} } }), /modèle local/);
  assert.throws(() => normalizeSettings({ lastModel: 'https://hôte/modèle' }), /modèle local/);
});

test('fichier absent ou vide : réglages par défaut', () => {
  assert.deepEqual(normalizeSettings(undefined), {
    lastModel: null,
    models: {},
    online: { bibliography: false },
    remote: { enabled: false },
  });
  assert.deepEqual(normalizeSettings({}), {
    lastModel: null,
    models: {},
    online: { bibliography: false },
    remote: { enabled: false },
  });
  assert.equal(normalizeSettings({ online: { bibliography: 'oui' } }).online.bibliography, false);
  assert.equal(normalizeSettings({ online: { bibliography: true } }).online.bibliography, true);
});

test('contexte lu dans les paramètres du Modelfile', () => {
  assert.equal(
    modelContext('top_p 0.95\nnum_ctx                        8192\nstop "<|im_end|>"'),
    8192,
  );
  assert.equal(modelContext(''), null);
  assert.equal(modelContext(undefined), null);
});

test('réglages : métier et langue connus seulement', () => {
  const { normalizeSettings } = require('../src/settings.cjs');
  assert.equal(normalizeSettings({ metier: 'finance', lang: 'en' }).metier, 'finance');
  assert.equal(normalizeSettings({ metier: 'finance', lang: 'en' }).lang, 'en');
  assert.equal(normalizeSettings({ metier: 'pirate', lang: 'de' }).metier, undefined);
  assert.equal(normalizeSettings({ metier: 'pirate', lang: 'de' }).lang, undefined);
});
