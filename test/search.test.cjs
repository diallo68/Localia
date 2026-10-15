const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  searchWords,
  searchExcerpt,
  searchConversations,
  searchNotes,
  searchPages,
} = require('../src/search.js');

const conversations = [
  {
    id: 'c1',
    title: 'Pluies à Dalaba',
    projectId: 'p1',
    updatedAt: '2026-10-10T10:00:00Z',
    messages: [
      { role: 'user', content: 'Quelle pluie en juillet ?' },
      { role: 'assistant', content: 'En juillet, 481 mm de pluie à Dalaba.' },
    ],
  },
  {
    id: 'c2',
    title: 'Mildiou',
    updatedAt: '2026-10-12T10:00:00Z',
    messages: [{ role: 'user', content: 'Le MILDIOU de la pomme de terre à Dalaba' }],
  },
];
const projects = [
  {
    id: 'p1',
    name: 'Thèse',
    notes: [
      { id: 'n1', title: 'Site', text: 'Dalaba, Fouta Djalon', createdAt: '2026-10-01' },
      { id: 'n2', title: 'Modèle', text: 'ResNet-50', createdAt: '2026-10-02' },
    ],
  },
];

test('mots de la recherche : sans accents ni majuscules, sans doublons', () => {
  assert.deepEqual(searchWords('  Mildiou  DALABA mildiou é'), ['mildiou', 'dalaba']);
  assert.deepEqual(searchWords('Thèse 2025'), ['these', '2025']);
});

test('conversations : un résultat par message, tous les mots requis, filtre par projet', () => {
  const all = searchConversations(conversations, searchWords('dalaba'));
  assert.deepEqual(
    all.map((r) => [r.conversationId, r.index]),
    [
      ['c2', 0],
      ['c1', 1],
    ],
  );
  assert.equal(searchConversations(conversations, searchWords('dalaba juillet')).length, 1);
  assert.deepEqual(
    searchConversations(conversations, searchWords('dalaba'), 'none').map((r) => r.conversationId),
    ['c2'],
  );
  assert.deepEqual(
    searchConversations(conversations, searchWords('dalaba'), 'p1').map((r) => r.conversationId),
    ['c1'],
  );
  // Titre seulement : la conversation est trouvée sans message précis.
  const title = searchConversations(conversations, searchWords('pluies'));
  assert.equal(title[0].index, null);
});

test('notes : titre et texte, projet indiqué ; aucune note pour « sans projet »', () => {
  const found = searchNotes(projects, searchWords('fouta'));
  assert.equal(found.length, 1);
  assert.equal(found[0].projectName, 'Thèse');
  assert.equal(found[0].noteId, 'n1');
  assert.equal(searchNotes(projects, searchWords('modele resnet')).length, 1);
  assert.deepEqual(searchNotes(projects, searchWords('dalaba'), 'none'), []);
});

test('documents : une page par résultat, avec son numéro', () => {
  const docs = [
    {
      id: 'd1',
      name: 'rapport.pdf',
      type: 'pdf',
      projectId: 'p1',
      projectName: 'Thèse',
      pages: [
        { number: 1, text: 'Introduction' },
        { number: 2, text: 'Relevés de Dalaba : 481 mm en juillet.' },
      ],
    },
  ];
  const found = searchPages(docs, searchWords('Dalaba juillet'));
  assert.equal(found.length, 1);
  assert.equal(found[0].number, 2);
  assert.match(found[0].excerpt, /481 mm/);
});

test('extrait : centré sur le mot trouvé, coupé aux espaces', () => {
  const text = 'mot '.repeat(100) + 'Dalaba ' + 'fin '.repeat(100);
  const excerpt = searchExcerpt(text, ['dalaba'], 60);
  assert.match(excerpt, /^….*Dalaba.*…$/);
  assert.ok(excerpt.length <= 64);
});
