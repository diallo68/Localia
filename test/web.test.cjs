const { test } = require('node:test');
const assert = require('node:assert/strict');
const w = require('../src/web.cjs');

test('adresses acceptées : http(s) public, sans identifiants ni port inhabituel', () => {
  assert.equal(w.checkUrl(' https://www.fao.org/page#x ').href, 'https://www.fao.org/page');
  assert.throws(() => w.checkUrl('file:///etc/passwd'), /http et https/);
  assert.throws(() => w.checkUrl('javascript:alert(1)'), /http et https/);
  assert.throws(() => w.checkUrl('https://user:pass@exemple.org'), /identifiants/);
  assert.throws(() => w.checkUrl('http://exemple.org:11434/'), /Port inhabituel/);
  assert.throws(() => w.checkUrl('http://localhost/'), /réseau local/);
  assert.throws(() => w.checkUrl('pas une adresse'), /invalide/);
});

test('adresses IP privées, locales ou réservées refusées', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.1',
    '172.20.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:192.168.0.1',
  ])
    assert.equal(w.isPrivateAddress(ip), true, ip);
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111'])
    assert.equal(w.isPrivateAddress(ip), false, ip);
});

test('jeu de caractères de la page : en-tête, balise meta, sinon UTF-8', () => {
  const latin1 = Buffer.from('<meta charset="iso-8859-1"><p>Récolte à Labé</p>', 'latin1');
  assert.match(w.decodeHtml(latin1, 'text/html'), /Récolte à Labé/);
  assert.match(w.decodeHtml(Buffer.from('<p>Été</p>'), 'text/html; charset=utf-8'), /Été/);
});

test('sections : coupées entre paragraphes, aucun texte perdu', () => {
  const text = Array.from({ length: 12 }, (_, i) => `Paragraphe ${i} ${'mot '.repeat(80)}`).join(
    '\n\n',
  );
  const sections = w.splitSections(text);
  assert.ok(sections.length > 1);
  assert.ok(sections.every((s) => s.text.length <= 2500 + 400));
  assert.equal(
    sections
      .map((s) => s.text)
      .join('\n\n')
      .replace(/\s+/g, ' ')
      .trim(),
    text.replace(/\s+/g, ' ').trim(),
  );
  assert.deepEqual(
    sections.map((s) => s.number),
    sections.map((_, i) => i + 1),
  );
});
