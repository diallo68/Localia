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

test('séries par métier : 5 questions sans document et 6 sur un document fictif, par métier', async () => {
  const metiers = path.join(dir, 'metiers');
  const labels = new Set();
  const files = fs
    .readdirSync(metiers)
    .filter(
      (f) =>
        /^serie-.*\.txt$/.test(f) &&
        !['serie-metiers-complete.txt', 'serie-metiers-nouveaux.txt'].includes(f),
    );
  // 11 métiers : les 8 de la série du 7 octobre, puis Recherche, Codage et Télécommunications.
  assert.equal(files.length, 22);
  // Série complète : les 88 questions, chaque question sur document avec son PDF.
  const all = parseQuestions(
    fs.readFileSync(path.join(metiers, 'serie-metiers-complete.txt'), 'utf8'),
  );
  assert.equal(all.length, 88);
  assert.equal(all.filter((q) => q.document).length, 48);
  for (const q of all.filter((x) => x.document))
    assert.ok(fs.existsSync(path.join(metiers, 'documents', q.document)), q.document);
  // Nouveaux métiers : 33 questions dans un seul fichier, dont 18 sur leur document.
  const nouveaux = parseQuestions(
    fs.readFileSync(path.join(metiers, 'serie-metiers-nouveaux.txt'), 'utf8'),
  );
  assert.equal(nouveaux.length, 33);
  assert.equal(nouveaux.filter((q) => q.document).length, 18);
  for (const q of nouveaux.filter((x) => x.document))
    assert.ok(fs.existsSync(path.join(metiers, 'documents', q.document)), q.document);
  const pdfs = fs.readdirSync(path.join(metiers, 'documents'));
  for (const file of files) {
    const withDocument = file.endsWith('-document.txt');
    const questions = parseQuestions(fs.readFileSync(path.join(metiers, file), 'utf8'));
    assert.equal(questions.length, withDocument ? 6 : 5, file);
    for (const q of questions) {
      assert.ok(categories.has(q.category), `${file} ${q.label} : catégorie « ${q.category} »`);
      assert.ok(q.expected?.length > 10, `${file} ${q.label} : réponse attendue`);
      assert.ok(!labels.has(q.label), `${q.label} en double`);
      labels.add(q.label);
    }
    if (withDocument) {
      const metier = file.replace(/^serie-/, '').replace(/-document\.txt$/, '');
      assert.ok(
        pdfs.some((p) => p.startsWith(`doc-${metier}-`)),
        `${file} : document absent`,
      );
    }
  }
  for (const name of pdfs) {
    const doc = await extractPdf(path.join(metiers, 'documents', name));
    for (const page of doc.pages)
      assert.match(page.text, /Document fictif/, `${name} p.${page.number}`);
  }
});
