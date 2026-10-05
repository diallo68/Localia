const { test } = require('node:test');
const assert = require('node:assert/strict');
const t = require('../src/tables.js');

const power = [
  '-BEGIN HEADER-',
  'NASA/POWER Source Native Resolution Daily Data',
  'Dates (month/day/year): 01/01/2024 through 01/05/2024 in UTC',
  'Location: latitude  10.70   longitude -12.27',
  'The value for missing source data that cannot be computed or is outside of the sources availability range: -999',
  '-END HEADER-',
  'YEAR,DOY,T2M,RH2M,PRECTOTCORR',
  '2024,1,23.5,45.9,0.0',
  '2024,2,23.6,48.2,-999',
  '2024,3,23.1,46.7,0.4',
  '2024,3,23.1,46.7,0.4',
  '2024,5,25.0,45.3,586.7',
].join('\r\n');

test('NASA POWER : en-tête sauté, -999 signalé, doublon compté, colonnes exactes', () => {
  const a = t.prepareAttachment('dalaba.csv', Buffer.from(power));
  assert.equal(a.kind, 'table');
  assert.equal(a.summary, '5 lignes, 5 colonnes');
  assert.match(a.content, /6 ligne\(s\) d'en-tête .*skiprows=6\)\. Format NASA POWER\./);
  assert.match(a.content, /- YEAR : nombre, min 2024, max 2024/);
  assert.match(a.content, /- PRECTOTCORR : nombre, min 0, max 586\.7.*1 valeur\(s\) -999/);
  assert.match(a.content, /1 ligne\(s\) en double/);
  assert.match(a.content, /^YEAR,DOY,T2M,RH2M,PRECTOTCORR$/m);
  assert.match(a.content, /format='%Y%j'/, 'jour de l’année : %j, pas %d');
});

test('export Excel français : point-virgule, virgule décimale, accents Windows-1252, dates', () => {
  const csv =
    'Date;Température (°C);Station\n01/06/2025;21,5;Dalaba\n02/06/2025;;Dalaba\n03/06/2025;22,1;Labé\n';
  const latin1 = Buffer.from(csv, 'latin1');
  const a = t.prepareAttachment('meteo.csv', latin1);
  assert.match(a.content, /séparateur point-virgule, virgule décimale probable/);
  assert.match(a.content, /- Température \(°C\) : nombre, min 21\.5, max 22\.1.*1 vide/);
  assert.match(a.content, /- Date : date, de 01\/06\/2025 à 03\/06\/2025/);
  assert.match(a.content, /- Station : texte, 2 valeur\(s\) distincte\(s\), ex\. Dalaba ; Labé/);
});

test('consignes et code : texte transmis, tronqué au-delà de la limite ; type refusé', () => {
  const md = t.prepareAttachment('consignes.md', Buffer.from('# Nettoyage\n1. Lire le CSV'));
  assert.equal(md.kind, 'text');
  assert.equal(md.partial, false);
  const long = t.prepareAttachment('script.py', Buffer.from('x'.repeat(20)), { maxText: 10 });
  assert.equal(long.content.length, 10);
  assert.match(long.summary, /seuls les 10 premiers transmis/);
  assert.throws(() => t.prepareAttachment('photo.jpg', Buffer.from('x')), /non pris en charge/);
  const block = t.attachmentsBlock([
    { name: 'consignes.md', kind: 'text', content: '# Nettoyage' },
    { name: 'dalaba.csv', kind: 'table', content: 'Tableau « dalaba.csv »' },
  ]);
  assert.match(block, /n'invente aucune valeur/);
  assert.match(block, /### Fichier : consignes\.md\n```\n# Nettoyage\n```/);
  assert.match(block, /### Tableau : dalaba\.csv/);
  assert.equal(t.attachmentsBlock([]), '');
});
