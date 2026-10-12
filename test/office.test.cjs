const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { docxText, xlsxSheets, serialDate } = require('../src/office.cjs');
const { prepareWorkbook } = require('../src/tables.js');
const { importWord, importPdf, loadDocument, documentContext } = require('../src/documents.cjs');
const { zipFixture, docxFixture, xlsxFixture, scannedPdfFixture } = require('./office-fixture.cjs');

test('Word : paragraphes, tabulation, tableau, texte supprimé ignoré', () => {
  const text = docxText(docxFixture());
  assert.match(text, /^Rapport & bilan de la campagne\n\nParcelle\tTimbi-Madina/);
  assert.match(text, /Mois \| Pluie \(mm\)\nJuillet \| 481/);
  assert.match(text, /Conclusion : traitement conseillé\.$/);
  assert.doesNotMatch(text, /supprimé/);
});

test('Word : enregistré comme document en sections, lu par documentContext', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-word-'));
  try {
    const file = path.join(dir, 'rapport.docx');
    await fs.writeFile(file, docxFixture());
    const meta = await importWord(file, path.join(dir, 'docs'));
    assert.equal(meta.word, true);
    assert.equal(meta.pageCount, 1);
    const doc = await loadDocument(path.join(dir, 'docs'), meta.id);
    assert.match(documentContext(doc, 'pluie juillet').text, /Juillet \| 481/);
    await fs.writeFile(file, zipFixture({ 'autre.xml': '<a/>' }));
    await assert.rejects(importWord(file, path.join(dir, 'docs')), /pas un document Word/);
    await fs.writeFile(file, 'pas une archive');
    await assert.rejects(importWord(file, path.join(dir, 'docs')), /abîmé/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('Excel : feuilles visibles, textes partagés, dates, booléens, formules', () => {
  const sheets = xlsxSheets(xlsxFixture());
  assert.deepEqual(
    sheets.map((s) => s.name),
    ['Météo', 'Notes'],
  );
  assert.deepEqual(sheets[0].rows, [
    ['Relevés 2022', '', ''],
    ['', '', ''],
    ['Date', 'Pluie', 'Station Timbi'],
    ['2022-07-01', '12.5', 'ok'],
    ['2022-07-02', '', 'VRAI'],
  ]);
  assert.deepEqual(sheets[1].rows, [['Total < 500', '1']]);
  assert.equal(serialDate(44743.5), '2022-07-01 12:00');
  assert.equal(serialDate(0, true), '1904-01-01');
});

test('Excel : portrait de chaque feuille, petite feuille transmise en entier', () => {
  const prepared = prepareWorkbook('meteo.xlsx', xlsxSheets(xlsxFixture()));
  assert.equal(prepared.kind, 'table');
  assert.equal(prepared.summary, '2 feuille(s), 2 ligne(s) de données');
  assert.match(
    prepared.content,
    /Feuille « Météo » du classeur Excel « meteo\.xlsx » : 2 lignes, 3 colonnes/,
  );
  assert.match(prepared.content, /Texte au-dessus du tableau : Relevés 2022/);
  assert.match(prepared.content, /- Date : date, de 2022-07-01 à 2022-07-02/);
  assert.match(prepared.content, /- Pluie : nombre/);
  assert.match(prepared.content, /2022-07-02\t\tVRAI/);
  assert.match(prepared.content, /\(Feuille transmise en entier\.\)/);
  // Grande feuille : seulement le portrait et les premières lignes.
  const big = {
    name: 'Grande',
    rows: [['n', 'x'], ...Array.from({ length: 500 }, (_, i) => [String(i), String(i * 2)])],
  };
  const large = prepareWorkbook('grand.xlsx', [big]);
  assert.doesNotMatch(large.content, /transmise en entier/);
  assert.match(large.content, /Dernières lignes/);
  assert.throws(() => prepareWorkbook('vide.xlsx', [{ name: 'A', rows: [] }]), /aucune donnée/);
});

test('archive piégée : partie décompressée trop volumineuse refusée', () => {
  const bomb = zipFixture({ 'word/document.xml': Buffer.alloc(1) });
  // Taille annoncée modifiée dans la table des contenus : 100 Mo.
  const central = bomb.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bomb.writeUInt32LE(100 * 1024 * 1024, central + 24);
  assert.throws(() => docxText(bomb), /trop volumineux/);
  assert.ok(zlib.crc32);
});

test(
  'PDF scanné : texte lu par reconnaissance de caractères (OCR)',
  { timeout: 120000 },
  async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-ocr-'));
    try {
      const file = path.join(dir, 'scan.pdf');
      await fs.writeFile(
        file,
        scannedPdfFixture(['Facture numéro 2026-118', 'Montant total : 1 250 000 GNF']),
      );
      const progress = [];
      const meta = await importPdf(file, path.join(dir, 'docs'), undefined, (p) =>
        progress.push(p),
      );
      assert.deepEqual(progress, [{ page: 1, pageCount: 1 }]);
      assert.equal(meta.ocrPages.length, 1);
      assert.deepEqual(meta.emptyPages, []);
      const doc = await loadDocument(path.join(dir, 'docs'), meta.id);
      assert.match(doc.pages[0].text, /Facture numéro 2026-118/);
      assert.match(doc.pages[0].text, /1 250 000 GNF/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);
