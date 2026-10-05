const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  extractPdf,
  importPdf,
  loadDocument,
  deleteDocument,
  pruneDocuments,
  documentContext,
} = require('../src/documents.cjs');
const { pdfFixture } = require('./pdf-fixture.cjs');
test('PDF réel : extraction de chaque page, persistance et contexte sourcé', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-pdf-'));
  try {
    const file = path.join(dir, 'facture.pdf');
    await fs.writeFile(file, pdfFixture());
    const metadata = await importPdf(file, path.join(dir, 'docs'));
    assert.equal(metadata.pageCount, 2);
    const doc = await loadDocument(path.join(dir, 'docs'), metadata.id);
    assert.match(doc.pages[1].text, /110 EUR/);
    const context = documentContext(doc, 'Vérifie le total');
    assert.equal(context.partial, false);
    assert.match(context.text, /Page 2/);
    assert.match(context.text, /120 EUR/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test('PDF vide et fichier non PDF refusés explicitement', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-pdf-'));
  try {
    const file = path.join(dir, 'empty.pdf');
    await fs.writeFile(file, pdfFixture(['']));
    await assert.rejects(extractPdf(file), /OCR/);
    await fs.writeFile(file, 'pas un PDF');
    await assert.rejects(extractPdf(file), /PDF valide/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test('document long : extrait pertinent de fin et limite explicite', () => {
  const doc = {
    name: 'long.pdf',
    emptyPages: [],
    pages: Array.from({ length: 40 }, (_, i) => ({
      number: i + 1,
      text: i === 39 ? 'Montant pénalité 400 euros.' : 'Texte général '.repeat(100),
    })),
  };
  const context = documentContext(doc, 'Quelle pénalité ?', 3000);
  assert.equal(context.partial, true);
  assert.ok(context.pages.includes(40));
  assert.match(context.text, /EXTRAITS SEULEMENT/);
  assert.match(context.text, /400 euros/);
});
test('identifiant de document ne permet pas de parcourir le disque', async () => {
  await assert.rejects(loadDocument('/tmp', '../../etc/passwd'), /invalide/);
});
test('suppression d’un document et nettoyage des textes non référencés', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-pdf-'));
  try {
    const keep = '11111111-1111-1111-1111-111111111111';
    const orphan = '22222222-2222-2222-2222-222222222222';
    for (const id of [keep, orphan]) await fs.writeFile(path.join(dir, id + '.json'), '{}');
    await fs.writeFile(path.join(dir, 'notes.txt'), 'autre fichier');
    assert.equal(await pruneDocuments(dir, [keep]), 1);
    assert.deepEqual((await fs.readdir(dir)).sort(), [keep + '.json', 'notes.txt']);
    await deleteDocument(dir, keep);
    await deleteDocument(dir, keep);
    assert.deepEqual(await fs.readdir(dir), ['notes.txt']);
    await assert.rejects(deleteDocument(dir, '../conversations'), /invalide/);
    assert.equal(await pruneDocuments(path.join(dir, 'absent'), []), 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
