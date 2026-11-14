const test = require('node:test');
const assert = require('node:assert/strict');
const { findLoop, loopWatcher } = require('../src/repetition.cjs');

const debut =
  'Voici le schéma.\n\n```\n        [Entrée]\n            |\n            v\n        +-------+\n';

test('schéma en caractères qui boucle (cas réel du 14 nov.) : coupé après la première ligne répétée', () => {
  const texte = debut + '        |       |\n'.repeat(40) + '        |   ';
  const r = findLoop(texte);
  assert.ok(r);
  assert.equal(texte.slice(0, r.cut), debut + '        |       |\n');
});

test('phrase répétée sans fin : coupée après une occurrence', () => {
  const phrase = 'Le filtre passe-bas laisse passer les basses fréquences. ';
  const texte = 'Introduction. ' + phrase.repeat(15);
  const r = findLoop(texte);
  assert.ok(r);
  assert.equal(texte.slice(0, r.cut), 'Introduction. ' + phrase);
});

test('textes normaux : pas de boucle', () => {
  const tableau =
    '| Filtre | Coupure |\n|---|---|\n' +
    Array.from({ length: 30 }, (_, i) => `| F${i} | ${i * 100} Hz |\n`).join('');
  assert.equal(findLoop(tableau), null);
  const liste = Array.from({ length: 40 }, (_, i) => `- Point ${i + 1} : à vérifier.\n`).join('');
  assert.equal(findLoop(liste), null);
  assert.equal(findLoop('|       |\n'.repeat(8)), null); // un vrai schéma court reste entier
  assert.equal(findLoop(' '.repeat(400)), null); // espaces seuls : pas une boucle
  assert.equal(findLoop(''), null);
});

test('surveillance du flux : vérifie par paliers et trouve la boucle en cours d’écriture', () => {
  const regarder = loopWatcher();
  let texte = debut;
  let trouve = null;
  for (let i = 0; i < 100 && !trouve; i++) {
    texte += '        |       |\n';
    trouve = regarder(texte);
  }
  assert.ok(trouve);
  assert.ok(texte.length < debut.length + 19 * 25); // arrêtée tôt, pas après des centaines de lignes
});
