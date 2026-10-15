const { test } = require('node:test');
const assert = require('node:assert/strict');
const { packBackup, unpackBackup } = require('../src/backup.cjs');

const data = {
  files: { 'projects.json': '[{"id":"p1"}]', 'settings.json': '{"lang":"fr"}' },
  documents: { '0b1a2c3d-0000-4000-8000-000000000000': '{"pages":[]}' },
  version: '0.6.0',
};
const passphrase = 'phrase de passe longue';

test('sauvegarde : relue à l’identique avec la bonne phrase de passe, illisible sans', () => {
  const packed = packBackup(data, passphrase);
  assert.ok(!packed.includes(Buffer.from('projects.json')), 'contenu chiffré');
  const back = unpackBackup(packed, passphrase);
  assert.deepEqual(back.files, data.files);
  assert.deepEqual(back.documents, data.documents);
  assert.equal(back.version, '0.6.0');
  assert.throws(
    () => unpackBackup(packed, 'mauvaise phrase de passe'),
    /Phrase de passe incorrecte/,
  );
});

test('sauvegarde : fichier modifié, tronqué ou étranger refusé ; phrase de passe courte refusée', () => {
  const packed = packBackup(data, passphrase);
  const altered = Buffer.from(packed);
  altered[altered.length - 5] ^= 1;
  assert.throws(() => unpackBackup(altered, passphrase), /modifié ou incomplet/);
  assert.throws(
    () => unpackBackup(packed.subarray(0, packed.length - 20), passphrase),
    /incomplet/,
  );
  assert.throws(() => unpackBackup(Buffer.from('bonjour'), passphrase), /pas une sauvegarde/);
  assert.throws(() => packBackup(data, 'court'), /trop courte/);
});
