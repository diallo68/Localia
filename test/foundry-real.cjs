// Essai avec le vrai Foundry Local (Windows, Linux ou Mac Apple Silicon), par le même code que
// Localia : adresse du service, modèles téléchargés, réponse en flux et statistiques.
// Prérequis : Foundry Local installé et un modèle téléchargé (ex. foundry model download qwen2.5-0.5b).
const assert = require('node:assert/strict');
const foundry = require('../src/foundry.cjs');

(async () => {
  const base = await foundry.endpoint({ start: true });
  assert.ok(base, 'Foundry Local introuvable ou arrêté');
  const models = await foundry.listModels(base);
  console.log('Service :', base, '| modèles :', models.map((m) => m.name).join(', ') || 'aucun');
  assert.ok(models.length, 'aucun modèle téléchargé dans Foundry Local');
  let text = '';
  let done = null;
  await foundry.chat({
    base,
    model: models[0].name,
    body: {
      messages: [
        { role: 'user', content: 'Réponds en une phrase : quelle est la capitale de la Guinée ?' },
      ],
      options: { temperature: 0, num_predict: 60 },
      keep_alive: 0,
    },
    onData: (d) => {
      text += d.message?.content || '';
      if (d.done) done = d;
    },
  });
  assert.ok(text.trim(), 'réponse vide');
  assert.ok(done?.done);
  const seconds = done.eval_duration / 1e9;
  console.log(
    `PASS Foundry Local réel (${models[0].name}) : ${done.eval_count} jetons en ${seconds.toFixed(1)} s — « ${text.trim().slice(0, 120)} »`,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
