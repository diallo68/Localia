const { test } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../src/storage.cjs');

const text = JSON.stringify([
  { title: 'Thèse', messages: [{ role: 'user', content: 'Mildiou à Dalaba' }] },
]);

test('chiffré puis déchiffré à l’identique ; le texte n’apparaît pas dans le fichier', () => {
  const key = storage.newKey();
  const sealed = storage.encrypt(text, key);
  assert.ok(storage.isEncrypted(sealed));
  assert.ok(!sealed.includes(Buffer.from('Dalaba')));
  assert.equal(storage.decrypt(sealed, key), text);
  // Vecteur aléatoire : deux chiffrements du même texte diffèrent.
  assert.notDeepEqual(storage.encrypt(text, key), sealed);
});

test('fichier en clair (données d’avant le chiffrement) lu tel quel', () => {
  assert.equal(storage.decrypt(Buffer.from(text), null), text);
  assert.equal(storage.isEncrypted(Buffer.from(text)), false);
});

test('clé absente, mauvaise clé ou fichier modifié : refus explicite', () => {
  const key = storage.newKey();
  const sealed = storage.encrypt(text, key);
  assert.throws(() => storage.decrypt(sealed, null), /clé de secours/);
  assert.throws(
    () => storage.decrypt(sealed, storage.newKey()),
    /clé différente ou fichier modifié/,
  );
  const tampered = Buffer.from(sealed);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => storage.decrypt(tampered, key), /fichier modifié/);
});

test('clé de secours : exportée puis relue dans un texte', () => {
  const key = storage.newKey();
  const file = `Clé de secours de Localia\n\n${storage.recoveryText(key)}\n`;
  assert.deepEqual(storage.parseRecovery(file), key);
  assert.throws(() => storage.parseRecovery('rien'), /pas de clé de secours/);
});
