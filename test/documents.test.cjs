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
  printedPages,
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
test('numéros imprimés : décalage majoritaire, chiffres romains, jamais devinés', () => {
  const footer = (n) => `Auteur (2024)   ${n}   Thèse de doctorat`;
  const pages = [{ number: 1, text: 'COUVERTURE\nUniversité' }];
  for (let n = 2; n <= 6; n++)
    pages.push({
      number: n,
      text: `Remerciements\n${footer(['i', 'ii', 'iii', 'iv', 'v'][n - 2])}`,
    });
  for (let n = 7; n <= 30; n++)
    pages.push({ number: n, text: `Chapitre\nEn 2022, 862 images.\n${footer(n - 6)}` });
  pages.push({ number: 31, text: 'Annexe sans numéro\n12' });
  const doc = { name: 'these.pdf', emptyPages: [], pages };
  const labels = printedPages(doc);
  assert.equal(labels.get(1), undefined);
  assert.equal(labels.get(2), 'i');
  assert.equal(labels.get(6), 'v');
  assert.equal(labels.get(7), '1');
  assert.equal(labels.get(30), '24');
  // « 12 » ne suit pas le décalage (31 − 6 = 25) : pas de numéro imprimé inventé.
  assert.equal(labels.get(31), undefined);
  const context = documentContext(doc, 'Combien d’images en 2022 ?', 100000);
  assert.match(context.text, /\[Page 7, extrait 1 — page imprimée 1\]/);
  assert.match(context.text, /position dans le fichier PDF/);
  // Numérotation identique à la position : rien n'est ajouté.
  const plain = {
    name: 'article.pdf',
    emptyPages: [],
    pages: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, text: `Texte\n${i + 1}` })),
  };
  assert.equal(printedPages(plain).size, 0);
  assert.doesNotMatch(documentContext(plain, 'Texte').text, /imprimée/);
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
test('demande de résumé : résumé et conclusions avant le reste, ni sommaire ni bibliographie', () => {
  const filler = 'Méthode expérimentale détaillée sur les images de mangues. '.repeat(25);
  const pages = [
    {
      number: 1,
      text: 'Table des matières\nRésumé . . . . . . . . 2\nConclusion générale . . . . . . 9',
    },
    { number: 2, text: 'Résumé\nCette thèse propose un jeu de données de 862 images.' },
    ...Array.from({ length: 6 }, (_, i) => ({ number: i + 3, text: filler })),
    { number: 9, text: 'Conclusion générale\nLes résultats montrent une précision de 98 %.' },
    {
      number: 10,
      text: '[1] Auteur A. (2020). Une conclusion.\n[2] Auteur B. (2021). Introduction.\n[3] Auteur C. (2019). Résumé.',
    },
  ];
  const doc = { name: 'these.pdf', emptyPages: [], pages };
  const question = 'Résume ce document en cinq points.';
  const plain = documentContext(doc, question, 250);
  const summary = documentContext(doc, question, 250, { summary: true });
  assert.ok(!plain.pages.includes(9), 'sans le mode résumé, la conclusion n’est pas choisie');
  assert.deepEqual(summary.pages, [2, 9], 'résumé et conclusion, sans sommaire ni bibliographie');
});
