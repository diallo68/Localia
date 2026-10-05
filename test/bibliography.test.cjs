const { test } = require('node:test');
const assert = require('node:assert/strict');
const b = require('../src/bibliography.js');

// Extrait inspiré d'un article réel : une citation erronée (Barbedo [24]) et un tableau aplati.
const pages = [
  {
    number: 1,
    text: 'Mohanty et al. [16] pioneered CNN deployment. Mahlein et al.\n[23] leveraged imaging; Barbedo\n[24] reviewed 80 studies. ResNet [11] and DenseNet [12] pioneered skip connections.',
  },
  {
    number: 2,
    text: 'TABLE III-B Ref. Year Architecture Dataset Metric [17] 2019 Hybrid LSTM + CNN',
  },
  {
    number: 3,
    text: 'REFERENCES [11] K. He, X. Zhang, S. Ren and J. Sun, “Deep Residual Learning,” 2016. [12] G. Huang, “Densely Connected Networks,” 2017. [16] S. P. Mohanty, D. P. Hughes and M. Salathé, “Using Deep Learning for Image-Based Plant Disease Detection,” Frontiers in Plant Science, 2016. [17] K. P. Ferentinos, “Deep learning models for plant disease detection,” 2018. [23] A. K. Mahlein, “Plant Disease Detection by Imaging Sensors,” 2016. [24] J. Boulent, S. Foucher, J. Théau and P.-L. St-Charles, “Convolutional Neural Networks for the Automatic Identification of Plant Diseases,” Frontiers in Plant Science, vol. 10, art. 941, 2019.',
  },
];

test('liste de références numérotées, avec leur page', () => {
  const { references } = b.parseReferences(pages);
  assert.deepEqual(
    references.map((r) => r.n),
    [11, 12, 16, 17, 23, 24],
  );
  assert.equal(references.at(-1).page, 3);
  assert.match(references.at(-1).text, /^J\. Boulent/);
  assert.deepEqual(
    b.parseReferences([{ number: 1, text: 'Pas de bibliographie.' }]).references,
    [],
  );
});

test('citation « Auteur [n] » comparée à la référence [n] : erreur réelle détectée', () => {
  const { references, citations } = b.checkCitations(pages);
  assert.equal(references, 6);
  assert.deepEqual(
    citations.map((c) => [c.name, c.n, c.page, c.ok]),
    [
      ['Mohanty et al.', 16, 1, true],
      ['Mahlein et al.', 23, 1, true],
      ['Barbedo', 24, 1, false],
    ],
  );
  assert.match(citations[2].reference, /Boulent/);
});

test('noms de modèles (ResNet, DenseNet) et en-têtes de tableaux (Metric [17] 2019) ignorés', () => {
  const names = b.checkCitations(pages).citations.map((c) => c.name);
  assert.ok(!names.includes('ResNet') && !names.includes('DenseNet') && !names.includes('Metric'));
});

test('référence comparée à une notice Crossref réelle', () => {
  const crossref = b.fromCrossref({
    title: ['Convolutional Neural Networks for the Automatic Identification of Plant Diseases'],
    author: [
      { given: 'Justine', family: 'Boulent' },
      { given: 'Samuel', family: 'Foucher' },
    ],
    issued: { 'date-parts': [[2019, 7, 23]] },
    'container-title': ['Frontiers in Plant Science'],
    DOI: '10.3389/FPLS.2019.00941',
  });
  assert.equal(crossref.doi, '10.3389/fpls.2019.00941');
  assert.equal(crossref.year, 2019);
  const reference = b.parseReferences(pages).references.at(-1).text;
  assert.equal(b.compareReference(reference, crossref).verdict, 'trouvée');
  // Même titre mais auteur attendu « Barbedo » : l'auteur ne correspond pas → à vérifier.
  assert.equal(
    b.compareReference(
      'Barbedo, Convolutional Neural Networks for the Automatic Identification of Plant Diseases, 2019',
      crossref,
    ).verdict,
    'à vérifier',
  );
  // Sous-titre de la notice absent de la référence : le titre cité est entièrement couvert.
  const mahlein = {
    title:
      'Plant Disease Detection by Imaging Sensors – Parallels and Specific Demands for Precision Agriculture and Plant Phenotyping',
    authors: ['Anne-Katrin Mahlein'],
    year: 2016,
  };
  assert.equal(
    b.compareReference(b.parseReferences(pages).references[4].text, mahlein).verdict,
    'trouvée',
  );
  assert.equal(
    b.compareReference('Smith, A study of rice yields, 2001', crossref).verdict,
    'introuvable',
  );
});

test('meilleure notice et mise en forme d’une référence OpenAlex', () => {
  const work = b.fromOpenAlex({
    display_name: 'Using Deep Learning for Image-Based Plant Disease Detection',
    authorships: [
      { author: { display_name: 'Sharada P. Mohanty' } },
      { author: { display_name: 'David P. Hughes' } },
    ],
    publication_year: 2016,
    doi: 'https://doi.org/10.3389/fpls.2016.01419',
    primary_location: { source: { display_name: 'Frontiers in Plant Science' } },
    cited_by_count: 5000,
  });
  const other = { title: 'Rice yields', authors: ['A. Smith'], year: 2001, venue: '', doi: null };
  const match = b.bestMatch(b.parseReferences(pages).references[2].text, [other, work]);
  assert.equal(match.work, work);
  assert.equal(match.verdict, 'trouvée');
  assert.equal(
    b.formatReference(work),
    'Sharada P. Mohanty, David P. Hughes (2016). Using Deep Learning for Image-Based Plant Disease Detection. Frontiers in Plant Science. https://doi.org/10.3389/fpls.2016.01419',
  );
  assert.equal(b.bestMatch('x', []).verdict, 'introuvable');
});

test('élément Zotero (API locale) : auteurs, année, revue, PDF', () => {
  const work = b.fromZotero({
    key: 'ABCD1234',
    meta: { numChildren: 1, parsedDate: '2019-07-23' },
    data: {
      itemType: 'journalArticle',
      title: 'Convolutional Neural Networks for the Automatic Identification of Plant Diseases',
      creators: [
        { creatorType: 'author', firstName: 'Justine', lastName: 'Boulent' },
        { creatorType: 'author', name: 'CIRAD' },
        { creatorType: 'reviewedAuthor', lastName: 'Ignoré' },
      ],
      publicationTitle: 'Frontiers in Plant Science',
      DOI: '10.3389/FPLS.2019.00941',
    },
  });
  assert.deepEqual(work.authors, ['Justine Boulent', 'CIRAD']);
  assert.equal(work.year, 2019);
  assert.equal(work.doi, '10.3389/fpls.2019.00941');
  assert.equal(work.attachments, 1);
  assert.equal(
    b.compareReference(b.parseReferences(pages).references.at(-1).text, work).verdict,
    'trouvée',
  );
  // Année tirée du champ « date » libre quand Zotero ne l'a pas analysée.
  assert.equal(b.fromZotero({ key: 'K', data: { title: 'T', date: 'Septembre 2022' } }).year, 2022);
});

test('mots communs ou nom partiel : pas de rapprochement abusif', () => {
  const survey = {
    title: 'A Survey of Convolutional Neural Networks: Analysis, Applications, and Prospects',
    authors: ['Zewen Li'],
    year: 2022,
  };
  const densenet =
    'G. Huang, Z. Liu, L. Van der Maaten and K. Q. Weinberger, “Densely Connected Convolutional Networks,” in Proc. IEEE CVPR, 2017.';
  const result = b.compareReference(densenet, survey);
  assert.equal(result.authorMatch, false, '« Li » n’est pas « Liu »');
  assert.equal(result.verdict, 'introuvable');
});
