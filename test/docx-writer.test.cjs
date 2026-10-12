const { test } = require('node:test');
const assert = require('node:assert/strict');
const { answerDocx } = require('../src/docx-writer.cjs');
const { docxText, readZip } = require('../src/office.cjs');

const blocks = [
  { type: 'heading', level: 2, runs: [{ text: 'Pluie à Timbi-Madina' }] },
  {
    type: 'paragraph',
    runs: [{ text: 'Total de ' }, { text: '481 mm', bold: true }, { text: ' en juillet & <août>' }],
  },
  { type: 'list', ordered: true, items: [[{ text: 'Juillet' }], [{ text: 'Août', italic: true }]] },
  { type: 'code', text: 'df["pluie"].sum()\nprint(total)' },
  {
    type: 'table',
    rows: [
      ['Mois', 'Pluie'],
      ['Juillet', '481'],
    ],
  },
  { type: 'paragraph', runs: [{ text: 'Caractère interdit \u0001 retiré' }] },
];

test('export Word : document lisible, mise en forme et texte conservés', () => {
  const file = answerDocx({
    title: 'Bilan',
    date: '12 octobre 2026',
    question: 'Quelle pluie ?',
    blocks,
    model: 'integre/gemma-4-e4b',
  });
  const text = docxText(file);
  assert.match(text, /^Bilan\n\nLocalia · 12 octobre 2026\n\nQuestion : Quelle pluie \?/);
  assert.match(text, /Pluie à Timbi-Madina\n\nTotal de 481 mm en juillet & <août>/);
  assert.match(text, /1\. Juillet\n\n2\. Août/);
  assert.match(text, /df\["pluie"\]\.sum\(\)\nprint\(total\)/);
  assert.match(text, /Mois \| Pluie\nJuillet \| 481/);
  assert.match(text, /Caractère interdit  retiré/);
  assert.match(text, /par integre\/gemma-4-e4b, sans Internet/);
  const document = readZip(file).read('word/document.xml');
  assert.match(document, /<w:pStyle w:val="Titre2"\/>/);
  assert.match(document, /<w:b\/><\/w:rPr><w:t xml:space="preserve">481 mm/);
  assert.ok(readZip(file).read('word/styles.xml').includes('heading 2'));
});

test('export Word : réponse invalide ou démesurée refusée', () => {
  assert.throws(() => answerDocx({ blocks: 'texte' }), /invalide/);
  assert.throws(() => answerDocx({ blocks: Array(5001).fill({}) }), /invalide/);
  assert.throws(
    () => answerDocx({ blocks: [{ type: 'code', text: 'x'.repeat(2_000_001) }] }),
    /trop longue/,
  );
});
