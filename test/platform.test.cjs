const { test } = require('node:test');
const assert = require('node:assert/strict');
const platform = require('../src/platform.cjs');

test('emplacements d’Ollama : Mac Intel, Apple Silicon, Windows', () => {
  const mac = platform.ollamaCandidates({}, 'darwin');
  assert.ok(mac.includes('/usr/local/bin/ollama') && mac.includes('/opt/homebrew/bin/ollama'));
  const win = platform.ollamaCandidates(
    { LOCALAPPDATA: 'C:\\Users\\Ama\\AppData\\Local' },
    'win32',
  );
  assert.equal(win[0], 'C:\\Users\\Ama\\AppData\\Local\\Programs\\Ollama\\ollama.exe');
});

test('dossiers interdits sous macOS', () => {
  const f = (root) => platform.forbiddenRoot(root, '/data', 'darwin', '/Users/ama');
  assert.match(f('/'), /trop large/);
  assert.match(f('/Users/ama'), /trop large/);
  assert.match(f('/System/Library'), /système/);
  assert.match(f('/private/etc'), /système/);
  assert.match(f('/Users/ama/Library/X'), /réglages/);
  assert.match(f('/data/documents'), /réglages/);
  assert.equal(f('/Users/ama/Documents/Thèse'), null);
  assert.equal(f('/private/var/folders/ab/T/x'), null);
  assert.equal(f('/Systemes-agricoles'), null, 'préfixe de nom, pas un sous-dossier');
});

test('dossiers interdits sous Windows (sans tenir compte des majuscules)', () => {
  const env = { SystemRoot: 'C:\\Windows', ProgramFiles: 'C:\\Program Files' };
  const f = (root) =>
    platform.forbiddenRoot(
      root,
      'C:\\Users\\Ama\\AppData\\Roaming\\Localia',
      'win32',
      'C:\\Users\\Ama',
      env,
    );
  assert.match(f('C:\\'), /trop large/);
  assert.match(f('c:\\users\\ama'), /trop large/);
  assert.match(f('C:\\Windows\\System32'), /système/);
  assert.match(f('C:\\Program Files\\Ollama'), /système/);
  assert.match(f('C:\\Users\\Ama\\AppData\\Local\\Temp'), /réglages/);
  assert.equal(f('C:\\Users\\Ama\\Documents\\These'), null);
  assert.equal(f('D:\\Recherche'), null);
  const g = (root) =>
    platform.forbiddenRoot(root, null, 'win32', 'C:\\Users\\Ama', {
      TEMP: 'C:\\Users\\Ama\\AppData\\Local\\Temp',
    });
  assert.equal(g('C:\\Users\\Ama\\AppData\\Local\\Temp\\localia-x'), null);
  assert.match(g('C:\\Users\\Ama\\AppData\\Local\\Temp'), /réglages/);
  // Dossier temporaire écrit en nom court (« AMADOU~1 ») : reconnu par son chemin réel.
  const h = (root) =>
    platform.forbiddenRoot(
      root,
      null,
      'win32',
      'C:\\Users\\Amadou Diallo',
      { TEMP: 'C:\\Users\\AMADOU~1\\AppData\\Local\\Temp' },
      () => 'C:\\Users\\Amadou Diallo\\AppData\\Local\\Temp',
    );
  assert.equal(h('C:\\Users\\Amadou Diallo\\AppData\\Local\\Temp\\localia-x'), null);
});
