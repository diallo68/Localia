// Veille bibliographique : sujets suivis, échéances et nouveaux articles (sans doublons).
// Aucun accès réseau ni disque ici : chargé par le processus principal et les tests.
const FREQUENCIES = { daily: 86400000, weekly: 7 * 86400000 };
const MAX_TOPICS = 20;
const MAX_ITEMS = 500;
const ITEM_STATUSES = ['new', 'seen', 'zotero', 'project'];

function normalizeWatch(raw) {
  const watch = { topics: [], items: [] };
  if (!raw || typeof raw !== 'object') return watch;
  const { topics = [], items = [] } = raw; // veille vide : premier lancement
  if (!Array.isArray(topics) || !Array.isArray(items))
    throw new Error('Veille bibliographique illisible.');
  for (const t of topics.slice(0, MAX_TOPICS)) {
    if (typeof t?.id !== 'string' || typeof t.query !== 'string' || !t.query.trim()) continue;
    watch.topics.push({
      id: t.id,
      query: t.query.trim().slice(0, 300),
      frequency: Object.hasOwn(FREQUENCIES, t.frequency) ? t.frequency : 'weekly',
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      lastRun: typeof t.lastRun === 'string' ? t.lastRun : null,
      lastError: typeof t.lastError === 'string' ? t.lastError : null,
    });
  }
  const topicIds = new Set(watch.topics.map((t) => t.id));
  for (const item of items.slice(0, MAX_ITEMS)) {
    if (typeof item?.id !== 'string' || !topicIds.has(item.topicId) || !item.work) continue;
    watch.items.push({
      id: item.id,
      topicId: item.topicId,
      foundAt: item.foundAt,
      status: ITEM_STATUSES.includes(item.status) ? item.status : 'new',
      work: item.work,
    });
  }
  return watch;
}

function addTopic(watch, query, frequency, now = new Date()) {
  const text = String(query || '').trim();
  if (!text || text.length > 300)
    throw new Error('Sujet vide ou trop long (300 caractères au plus).');
  if (!Object.hasOwn(FREQUENCIES, frequency)) throw new Error('Fréquence inconnue.');
  if (watch.topics.length >= MAX_TOPICS) throw new Error(`${MAX_TOPICS} sujets au plus.`);
  if (watch.topics.some((t) => t.query.toLowerCase() === text.toLowerCase()))
    throw new Error('Ce sujet est déjà suivi.');
  const topic = {
    id: `t-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    query: text,
    frequency,
    createdAt: now.toISOString(),
    lastRun: null,
    lastError: null,
  };
  watch.topics.push(topic);
  return topic;
}

// Sujets à interroger : jamais lancés, ou dernière recherche plus ancienne que leur fréquence.
const dueTopics = (watch, now = new Date()) =>
  watch.topics.filter(
    (t) => !t.lastRun || now - new Date(t.lastRun) >= FREQUENCIES[t.frequency] - 60000,
  );

// Date de publication minimale demandée : un mois avant la première recherche, sinon une semaine
// avant la précédente (les articles sont souvent indexés après leur date de publication).
function sinceDate(topic, now = new Date()) {
  const base = topic.lastRun ? new Date(topic.lastRun) : new Date(now - 23 * 86400000);
  return new Date(base - 7 * 86400000).toISOString().slice(0, 10);
}

// Ajoute les articles jamais vus (même identifiant ou même DOI, tous sujets confondus) ; les plus
// anciens éléments déjà traités sont retirés au-delà de la limite.
function mergeResults(watch, topic, works, now = new Date()) {
  const ids = new Set(watch.items.map((i) => i.id));
  const dois = new Set(watch.items.map((i) => i.work.doi).filter(Boolean));
  // Même article déposé deux fois sous deux identifiants : même titre.
  const titleKey = (work) =>
    String(work.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const titles = new Set(watch.items.map((i) => titleKey(i.work)).filter(Boolean));
  const added = [];
  for (const work of works) {
    const id = work.id || (work.doi ? `doi:${work.doi}` : null);
    const title = titleKey(work);
    if (!id || ids.has(id) || (work.doi && dois.has(work.doi)) || (title && titles.has(title)))
      continue;
    ids.add(id);
    if (title) titles.add(title);
    if (work.doi) dois.add(work.doi);
    const item = { id, topicId: topic.id, foundAt: now.toISOString(), status: 'new', work };
    watch.items.unshift(item);
    added.push(item);
  }
  topic.lastRun = now.toISOString();
  topic.lastError = null;
  if (watch.items.length > MAX_ITEMS) {
    const keepNew = watch.items.filter((i) => i.status === 'new');
    const handled = watch.items.filter((i) => i.status !== 'new');
    watch.items = [...keepNew, ...handled].slice(0, MAX_ITEMS);
  }
  return added;
}

if (typeof module !== 'undefined')
  module.exports = {
    FREQUENCIES,
    ITEM_STATUSES,
    normalizeWatch,
    addTopic,
    dueTopics,
    sinceDate,
    mergeResults,
  };
