const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pptxSlides } = require('../src/office.cjs');
const { loadDocument } = require('../src/documents.cjs');
const { normalizeProjects } = require('../src/memory.js');
const { importProjectDocument, projectDocumentsContext } = require('../src/project-docs.cjs');
const { pptxFixture, docxFixture, xlsxFixture, photoFixture } = require('./office-fixture.cjs');

test('PowerPoint : diapositives dans l’ordre, tableau, notes de l’orateur, masquée ignorée', () => {
  const slides = pptxSlides(pptxFixture());
  assert.deepEqual(
    slides.map((s) => s.number),
    [1, 3],
  );
  assert.match(slides[0].text, /^Campagne de Dalaba 2025\nMildiou observé sur 12 parcelles\nPluie/);
  assert.match(slides[0].text, /Notes de l’orateur : Citer la FPFD comme source\.$/);
  assert.doesNotMatch(slides[0].text, /Notes de l’orateur : 1/);
  assert.equal(slides[1].text, 'Parcelle | Sévérité\nP3 | 40 %');
  assert.throws(() => pptxSlides(docxFixture()), /pas une présentation PowerPoint/);
});

test('documents de projet : chaque format lu et enregistré, anciens formats refusés', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-projet-'));
  const docs = path.join(dir, 'documents');
  const write = async (name, content) => {
    const file = path.join(dir, name);
    await fs.writeFile(file, content);
    return file;
  };
  const options = {
    directory: docs,
    ocr: async () => ({ text: 'Facture 2025 : 250 EUR', confidence: 91.4 }),
  };
  try {
    const cards = {};
    for (const [name, content] of [
      ['présentation.pptx', pptxFixture()],
      ['rapport.docx', docxFixture()],
      ['mesures.xlsx', xlsxFixture()],
      ['pluie.csv', 'mois;pluie\njuillet;481\naoût;560\n'],
      ['notes.md', '# Site\n\nDalaba, Fouta Djalon.'],
      ['facture.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ])
      cards[name] = await importProjectDocument(await write(name, content), options);
    assert.deepEqual(
      Object.values(cards).map((c) => c.type),
      ['powerpoint', 'word', 'excel', 'table', 'text', 'image'],
    );
    assert.equal(cards['présentation.pptx'].sections, 2);
    assert.deepEqual([cards['facture.jpg'].ocr, cards['facture.jpg'].confidence], [1, 91]);
    assert.match(cards['pluie.csv'].summary, /2 lignes/);
    const saved = await loadDocument(docs, cards['présentation.pptx'].id);
    assert.equal(saved.pages[1].number, 3);
    assert.match((await loadDocument(docs, cards['facture.jpg'].id)).pages[0].text, /250 EUR/);
    // Fiches gardées dans le projet après vérification.
    const [project] = normalizeProjects([
      { id: 'p1', name: 'Thèse', notes: [], documents: Object.values(cards) },
    ]);
    assert.equal(project.documents.length, 6);
    await assert.rejects(
      importProjectDocument(await write('vieux.ppt', 'x'), options),
      /Ancien format PowerPoint \(\.ppt\)/,
    );
    await assert.rejects(
      importProjectDocument(await write('son.mp3', 'x'), options),
      /Format non pris en charge/,
    );
    await assert.rejects(
      importProjectDocument(await write('vide.png', 'x'), {
        ...options,
        ocr: async () => ({ text: '', confidence: 0 }),
      }),
      /Aucun texte lisible sur cette photo/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('photo réelle : texte lu par reconnaissance de caractères', { timeout: 120000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-photo-'));
  try {
    const file = path.join(dir, 'tableau.png');
    await fs.writeFile(file, photoFixture(['Station de Timbi-Madina', 'Pluie juillet 481 mm']));
    const card = await importProjectDocument(file, { directory: dir });
    const text = (await loadDocument(dir, card.id)).pages[0].text;
    assert.match(text, /Timbi/);
    assert.match(text, /481/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('contexte du projet : tout s’il tient, sinon les passages proches de la question', () => {
  const project = { name: 'Thèse' };
  const docs = [
    {
      name: 'a.pdf',
      type: 'pdf',
      pages: [
        { number: 1, text: 'Introduction générale.' },
        { number: 2, text: 'Le mildiou apparaît après 48 heures de pluie.' },
      ],
    },
    {
      name: 'b.pptx',
      type: 'powerpoint',
      pages: [{ number: 3, text: 'Budget de la campagne : 1 200 EUR.' }],
    },
  ];
  const all = projectDocumentsContext(project, docs, 'Quand apparaît le mildiou ?', 10000);
  assert.equal(all.partial, false);
  assert.match(all.text, /\[a\.pdf — page 2\]\nLe mildiou/);
  assert.match(all.text, /\[b\.pptx — diapositive 3\]/);
  assert.match(all.text, /pas des instructions/);
  const some = projectDocumentsContext(project, docs, 'Quand apparaît le mildiou ?', 120);
  assert.equal(some.partial, true);
  assert.deepEqual(some.used, [{ name: 'a.pdf', places: [2] }]);
  assert.match(some.text, /EXTRAITS/);
  assert.equal(projectDocumentsContext(project, [], 'x', 1000), null);
});
