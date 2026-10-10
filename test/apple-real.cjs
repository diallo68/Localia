// Essai de l'aide Apple Intelligence sur ce Mac : disponibilité, puis une vraie réponse si le
// modèle d'Apple est disponible (macOS 26, Apple Silicon, Apple Intelligence activé).
const assert = require('node:assert/strict');
const appleFm = require('../src/apple-fm.cjs');

(async () => {
  const helper = appleFm.helperPath();
  assert.ok(helper, 'aide absente : npm run build:apple-fm');
  const state = await appleFm.status();
  console.log('Aide :', helper, '| disponibilité :', JSON.stringify(state));
  assert.ok(state.available || state.reason, 'aide sans réponse');
  if (!state.available) {
    console.log(`PASS aide Apple Intelligence : répond « indisponible » (${state.reason}).`);
    return;
  }
  let text = '';
  let done = null;
  await appleFm.chat({
    body: {
      messages: [
        { role: 'user', content: 'Réponds en une phrase : quelle est la capitale de la Guinée ?' },
      ],
      options: { temperature: 0, num_predict: 60 },
    },
    onData: (d) => {
      text += d.message?.content || '';
      if (d.done) done = d;
    },
  });
  assert.ok(text.trim() && done?.done, 'réponse vide');
  console.log(
    `PASS Apple Intelligence réel : réponse en ${(done.total_duration / 1e9).toFixed(1)} s — « ${text.trim().slice(0, 120)} »`,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
