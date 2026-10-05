const { test } = require('node:test');
const assert = require('node:assert/strict');
const w = require('../src/watch.js');
const { toZoteroItem } = require('../src/bibliography.js');

const now = new Date('2026-10-05T20:00:00Z');
const work = (id, doi = null) => ({
  id,
  title: `Article ${id}`,
  authors: ['A. Auteur'],
  year: 2026,
  venue: '',
  doi,
});

test('sujets : ajout, doublon refusé, fréquence vérifiée', () => {
  const watch = w.normalizeWatch({});
  const topic = w.addTopic(watch, '  late blight forecasting ', 'weekly', now);
  assert.equal(topic.query, 'late blight forecasting');
  assert.throws(() => w.addTopic(watch, 'Late Blight Forecasting', 'daily', now), /déjà suivi/);
  assert.throws(() => w.addTopic(watch, 'x', 'hourly', now), /Fréquence/);
  assert.throws(() => w.normalizeWatch({ topics: 'x' }), /illisible/);
});

test('échéances : jamais lancé, puis selon la fréquence', () => {
  const watch = w.normalizeWatch({});
  const weekly = w.addTopic(watch, 'mildiou', 'weekly', now);
  const daily = w.addTopic(watch, 'phytophthora', 'daily', now);
  assert.equal(w.dueTopics(watch, now).length, 2);
  weekly.lastRun = daily.lastRun = now.toISOString();
  const tomorrow = new Date(now.getTime() + 86400000);
  assert.deepEqual(
    w.dueTopics(watch, tomorrow).map((t) => t.query),
    ['phytophthora'],
  );
  assert.equal(w.dueTopics(watch, new Date(now.getTime() + 7 * 86400000)).length, 2);
  // Première recherche : un mois en arrière ; ensuite une semaine avant la précédente.
  assert.equal(w.sinceDate({ lastRun: null }, now), '2026-09-05');
  assert.equal(w.sinceDate({ lastRun: now.toISOString() }, now), '2026-09-28');
});

test('nouveaux articles seulement : même identifiant ou même DOI ignorés, tous sujets confondus', () => {
  const watch = w.normalizeWatch({});
  const a = w.addTopic(watch, 'mildiou', 'weekly', now);
  const b = w.addTopic(watch, 'late blight', 'weekly', now);
  assert.equal(w.mergeResults(watch, a, [work('W1', '10.1/x'), work('W2')], now).length, 2);
  const again = w.mergeResults(watch, b, [work('W1'), work('W3', '10.1/x'), work('W4')], now);
  assert.deepEqual(
    again.map((i) => i.id),
    ['W4'],
  );
  assert.equal(b.lastRun, now.toISOString());
  // Même titre sous un autre identifiant (dépôt en double) : ignoré.
  assert.equal(w.mergeResults(watch, b, [{ ...work('W9'), title: 'ARTICLE W2' }], now).length, 0);
  assert.equal(watch.items.length, 3);
  // Relu depuis le disque : éléments d'un sujet supprimé écartés.
  const reread = w.normalizeWatch({ topics: [a], items: watch.items });
  assert.deepEqual(reread.items.map((i) => i.id).sort(), ['W1', 'W2']);
});

test('limite : les articles déjà traités partent avant les nouveaux', () => {
  const watch = w.normalizeWatch({});
  const topic = w.addTopic(watch, 'mildiou', 'weekly', now);
  w.mergeResults(
    watch,
    topic,
    Array.from({ length: 300 }, (_, i) => work(`A${i}`)),
    now,
  );
  for (const item of watch.items) item.status = 'seen';
  w.mergeResults(
    watch,
    topic,
    Array.from({ length: 300 }, (_, i) => work(`B${i}`)),
    now,
  );
  assert.equal(watch.items.length, 500);
  assert.equal(watch.items.filter((i) => i.status === 'new').length, 300);
});

test('notice pour Zotero (connecteur)', () => {
  const item = toZoteroItem(
    {
      title: 'T',
      authors: ['Sharada P. Mohanty', 'CIRAD'],
      year: 2016,
      venue: 'Front.',
      doi: '10.3389/x',
    },
    ['Veille Localia'],
  );
  assert.deepEqual(item.creators[0], {
    firstName: 'Sharada P.',
    lastName: 'Mohanty',
    creatorType: 'author',
  });
  assert.equal(item.creators[1].fieldMode, 1);
  assert.equal(item.url, 'https://doi.org/10.3389/x');
  assert.deepEqual(item.tags, [{ tag: 'Veille Localia' }]);
});
