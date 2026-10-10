#!/usr/bin/env node
// Fausse aide Apple Intelligence (tests) : mêmes lignes JSON que native/apple-fm/main.swift.
// FAKE_APPLE_FM=unavailable : modèle indisponible ; =context : dépassement de la fenêtre.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const request = JSON.parse(raw);
  const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');
  const mode = process.env.FAKE_APPLE_FM;
  if (request.action === 'status')
    return say(
      mode === 'unavailable'
        ? { type: 'status', available: false, reason: 'appleIntelligenceNotEnabled' }
        : { type: 'status', available: true },
    );
  if (mode === 'context')
    return say({ type: 'error', code: 'exceededContextWindowSize', message: 'x' });
  say({ type: 'delta', text: 'Réponse ' });
  say({
    type: 'delta',
    text: 'd’**Apple** (' + (request.instructions ? 'consigne' : 'sans consigne') + ').',
  });
  say({ type: 'done' });
});
