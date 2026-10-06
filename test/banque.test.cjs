const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseQuestions } = require('../src/questions.js');
const { TASKS } = require('../src/tasks.js');
const { extractPdf } = require('../src/documents.cjs');

const dir = path.join(__dirname, '..', 'benchmark', 'banque');
const series = fs.readdirSync(dir).filter((f) => /^serie-.*\.txt$/.test(f));
const categories = new Set(TASKS.flatMap((t) => t.categories));

test('banque de questions : chaque question a une catégorie connue et une réponse attendue', () => {
  const labels = new Set();
  let total = 0;
  for (const file of series) {
    for (const q of parseQuestions(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      total++;
      assert.ok(categories.has(q.category), `${file} ${q.label} : catégorie « ${q.category} »`);
      assert.ok(q.expected?.length > 10, `${file} ${q.label} : réponse attendue`);
      assert.ok(!labels.has(q.label), `${q.label} en double`);
      labels.add(q.label);
    }
  }
  assert.equal(total, 147);
});

test('documents fictifs : lisibles par Localia et signalés comme fictifs à chaque page', async () => {
  for (const name of fs.readdirSync(path.join(dir, 'documents'))) {
    const doc = await extractPdf(path.join(dir, 'documents', name));
    assert.ok(doc.pageCount >= 2, name);
    for (const page of doc.pages)
      assert.match(page.text, /Document fictif/, `${name} p.${page.number}`);
  }
});
