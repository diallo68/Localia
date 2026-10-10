const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const appleFm = require('../src/apple-fm.cjs');

const fake = path.join(__dirname, 'fixtures', 'fake-apple-fm.cjs');
const env = (mode) => ({ ...process.env, LOCALIA_APPLE_FM: fake, FAKE_APPLE_FM: mode || '' });
const unix = process.platform !== 'win32';

test('conversation → consigne et demande unique pour le modèle d’Apple', () => {
  assert.deepEqual(appleFm.toPrompt([{ role: 'user', content: 'Bonjour' }]), {
    instructions: null,
    prompt: 'Bonjour',
  });
  const { instructions, prompt } = appleFm.toPrompt([
    { role: 'system', content: 'Réponds en français.' },
    { role: 'user', content: 'Une question' },
    { role: 'assistant', content: 'Une réponse' },
    { role: 'user', content: 'La suite' },
  ]);
  assert.equal(instructions, 'Réponds en français.');
  assert.match(prompt, /Utilisateur : Une question/);
  assert.match(prompt, /Assistant : Une réponse/);
  assert.match(prompt, /Nouvelle demande :\nLa suite$/);
});

test('disponibilité : raison donnée en clair', { skip: !unix }, async () => {
  assert.deepEqual(await appleFm.status(env()), { available: true, reason: null });
  const off = await appleFm.status(env('unavailable'));
  assert.equal(off.available, false);
  assert.match(off.reason, /Apple Intelligence n’est pas activé/);
  assert.deepEqual(await appleFm.status({ LOCALIA_APPLE_FM: '/nulle/part' }), {
    available: false,
    reason: null,
  });
});

test('réponse en flux au format d’Ollama, erreurs d’Apple traduites', { skip: !unix }, async () => {
  const events = [];
  await appleFm.chat({
    body: {
      messages: [
        { role: 'system', content: 'Consigne' },
        { role: 'user', content: 'Salut' },
      ],
      options: { temperature: 0.2, num_predict: 50 },
    },
    onData: (d) => events.push(d),
    env: env(),
  });
  assert.equal(
    events.map((e) => e.message?.content || '').join(''),
    'Réponse d’**Apple** (consigne).',
  );
  const done = events.at(-1);
  assert.equal(done.done, true);
  assert.ok(done.eval_count > 0);
  await assert.rejects(
    appleFm.chat({
      body: { messages: [{ role: 'user', content: 'Long' }] },
      onData: () => {},
      env: env('context'),
    }),
    /4 096 jetons/,
  );
  await assert.rejects(
    appleFm.chat({
      body: { messages: [{ role: 'user', content: 'x', images: ['a'] }] },
      onData: () => {},
    }),
    /photos/,
  );
});
