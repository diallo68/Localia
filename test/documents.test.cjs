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
  documentsContext,
  looksLikeReferences,
  printedPages,
  wantsOverview,
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
  assert.match(context.text, /extraits des pages [\d, ]+ sur 40/);
  assert.match(context.text, /Réponds avec ces extraits/);
  assert.doesNotMatch(context.text, /aucune vérification/);
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

test('PDF joint long : clause d’exclusion en tête de page retenue, notes répétées envoyées une fois', () => {
  const notes =
    '(1) Les prestations dans le réseau et hors réseau ne sont pas cumulatives. ' +
    '(2) Dans la limite des frais réellement engagés. '.repeat(6);
  const exclusions =
    'Exclusions et limitations de mes garanties. Qu’est-ce que nous ne prenons pas en charge ? ' +
    'Les actes non remboursés par la Sécurité sociale, sauf mention au tableau des garanties. ';
  const doc = {
    name: 'mutuelle.pdf',
    emptyPages: [],
    pages: [
      {
        number: 7,
        text: 'Analyses et examens de laboratoire : 100 % BR. Consultation : 100 % BR.',
      },
      ...[8, 9, 10].map((number) => ({
        number,
        text: 'Lentilles, prothèses et implants non remboursés par la Sécurité sociale : forfait par an. '.repeat(
          6,
        ),
      })),
      { number: 11, text: notes },
      { number: 17, text: notes },
      {
        number: 18,
        text:
          exclusions.padEnd(1400, ' Les soins effectués avant la date d’inscription.') +
          'Chambre particulière : frais de téléphone non remboursés par la Sécurité sociale, ' +
          'hors nomenclature, analyses de confort et laboratoire privé exclus.',
      },
    ],
  };
  const question =
    'Ma mutuelle rembourse-t-elle les analyses de laboratoire hors nomenclature, non remboursées par la Sécurité sociale ?';
  const context = documentContext(doc, question, 3200);
  assert.equal(context.partial, true);
  assert.match(context.text, /Les actes non remboursés par la Sécurité sociale, sauf mention/);
  assert.match(context.text, /Analyses et examens de laboratoire : 100 % BR/);
  assert.equal(context.text.split('(1) Les prestations').length - 1, 1);
  assert.match(context.text, /\[Page 11, extrait 1 ; même texte : page 17\]/);
  assert.ok(context.pages.includes(11) && context.pages.includes(17));
});

test('plusieurs documents joints : extraits nommés, couverture par document', () => {
  const { documentsContext } = require('../src/documents.cjs');
  const a = {
    name: 'contrat.pdf',
    emptyPages: [],
    pages: Array.from({ length: 6 }, (_, i) => ({
      number: i + 1,
      text: i === 4 ? 'Pénalité de retard : 400 euros par jour.' : 'Clause générale '.repeat(90),
    })),
  };
  const b = {
    name: 'facture.pdf',
    emptyPages: [],
    pages: [{ number: 1, text: 'Facture : retard de 3 jours, pénalité facturée 1 500 euros.' }],
  };
  const context = documentsContext([a, b], 'Quelle pénalité de retard ?', 3000);
  assert.equal(context.partial, true);
  assert.match(context.text, /Documents joints \(2\)/);
  assert.match(context.text, /\[contrat\.pdf — Page 5, extrait 1\]\nPénalité de retard/);
  assert.match(context.text, /\[facture\.pdf — Page 1, extrait 1\]/);
  assert.match(
    context.text,
    /- facture\.pdf : tout le texte extractible|- facture\.pdf : extraits/,
  );
  assert.deepEqual(
    context.documents.map((d) => d.name),
    ['contrat.pdf', 'facture.pdf'],
  );
  // Un seul document : même résultat que documentContext.
  const one = documentsContext([b], 'pénalité', 3000);
  assert.match(one.text, /^Document : facture\.pdf/);
});

// Bibliographie au format des revues (PLOS ONE, Frontiers) : ni [n] ni « (2020). ».
const PLOS_REFERENCES =
  '13. Viel JF, Challier B. Bladder cancer among French farmers. Occup Environ Med. 1995; 52: 587-592. https://doi.org/10.1136/oem.52.9.587 ' +
  '14. Chen M, Brun F, Raynal M, Makowski D. Timing of grape downy mildew onset. Plant Dis. 2019; 103: 1-10. https://doi.org/10.1094/PDIS ' +
  '15. Gessler C, Pertot I, Perazzolli M. Plasmopara viticola: a review. Phytopathol Mediterr. 2011; 50: 3-44. https://doi.org/10.14601/x ' +
  '16. Rossi V, Caffi T, Gobbin D. Contribution of molecular studies. Eur J Plant Pathol. 2013; 135: 641-654.';
const FRONTIERS_REFERENCES =
  'Bochkovskiy, A., Wang, C. Y., and Liao, H. Y. M. (2020). YOLOv4: optimal speed. arXiv. doi: 10.48550/arXiv.2004.10934 ' +
  'Hu, J., Shen, L., and Sun, G. (2018). Squeeze-and-excitation networks. CVPR. doi: 10.1109/CVPR.2018.00745 ' +
  'Ren, S., He, K., Girshick, R., and Sun, J. (2017). Faster R-CNN. IEEE TPAMI 39, 1137-1149. doi: 10.1109/TPAMI.2016.2577031';

test('bibliographie au format des revues reconnue ; texte de résultats avec des années, non', () => {
  assert.ok(looksLikeReferences(PLOS_REFERENCES));
  assert.ok(looksLikeReferences(FRONTIERS_REFERENCES));
  assert.ok(
    !looksLikeReferences(
      'Results. Between 2010 and 2018, onset varied across years: early in 2012 and 2016, late in 2011 and 2017. ' +
        'The highest AUC (0.86) is obtained with gradient boosting, as in Chen et al. https://doi.org/10.1371/journal.pone.0230254',
    ),
  );
});

test('demande sur tout le document : détectée (résumé, synthèse, bibliographie, état de l’art)', () => {
  for (const q of [
    'Résume ce document',
    'Fais une synthèse des deux articles',
    'Rédige une étude bibliographique sur le mildiou',
    'Rédige un état de l’art',
    'Write a literature review of these papers',
  ])
    assert.ok(wantsOverview(q), q);
  for (const q of ['Quelle AUC obtient le meilleur modèle ?', 'Combien de parcelles ?', undefined])
    assert.ok(!wantsOverview(q), String(q));
});

test('pages de références écartées même si leurs titres partagent les mots de la question', () => {
  const filler = (k) => `Page ${k}. Le modèle est entraîné sur des parcelles de vigne. `.repeat(20);
  const doc = {
    name: 'chen.pdf',
    emptyPages: [],
    pages: [
      {
        number: 1,
        text: 'Résumé. Prédiction du mildiou de la vigne par apprentissage automatique.',
      },
      ...Array.from({ length: 6 }, (_, i) => ({ number: i + 2, text: filler(i + 2) })),
      { number: 8, text: 'Results. The highest AUC (0.86) is obtained with gradient boosting.' },
      { number: 9, text: PLOS_REFERENCES },
    ],
  };
  const question =
    'Pour chaque étude, donne les auteurs, l’année, le titre, la revue, la culture et le meilleur résultat (mildiou, vigne).';
  const plain = documentContext(doc, question, 600);
  assert.ok(!plain.pages.includes(9), 'références non transmises');
  const overview = documentContext(doc, question + ' Fais une bibliographie.', 600, {
    summary: true,
  });
  assert.ok(
    overview.pages.includes(8) && !overview.pages.includes(9),
    'résultats, sans références',
  );
  const asked = documentContext(doc, 'Donne la liste des références citées par l’article.', 600);
  assert.ok(asked.pages.includes(9), 'références transmises quand la question les demande');
});

test('demande sur plusieurs documents : chacun reçoit sa part', () => {
  const english = (k) =>
    `Grape downy mildew detection with deep learning, machine learning, YOLO detection page ${k}. `.repeat(
      15,
    );
  const french = (k) =>
    `Page ${k}. Observations des parcelles bordelaises et traitements. `.repeat(20);
  const a = {
    name: 'a.pdf',
    emptyPages: [],
    pages: Array.from({ length: 8 }, (_, i) => ({ number: i + 1, text: english(i + 1) })),
  };
  const b = {
    name: 'b.pdf',
    emptyPages: [],
    pages: Array.from({ length: 8 }, (_, i) => ({ number: i + 1, text: french(i + 1) })),
  };
  const question = 'Rédige une étude bibliographique : detection, deep learning, machine learning.';
  const plain = documentsContext([a, b], question, 6000);
  const fair = documentsContext([a, b], question, 6000, { summary: true });
  const count = (ctx, name) => (ctx.text.match(new RegExp(`\\[${name} — Page`, 'g')) || []).length;
  assert.ok(count(plain, 'b.pdf') < count(plain, 'a.pdf'), 'sans équilibre, a.pdf prend la place');
  assert.ok(Math.abs(count(fair, 'a.pdf') - count(fair, 'b.pdf')) <= 1, 'part égale');
});
