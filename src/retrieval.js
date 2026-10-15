// Classement des passages des documents d'un projet selon la question.
// « mots » : nombre de mots de la question (4 lettres ou plus) présents dans le passage
// (méthode d'origine). « bm25 » : mots réduits à leur racine (pluies → pluie, pluvieux → pluvi),
// mots vides retirés, mots rares comptant davantage (BM25). Choix mesuré par
// scripts/mesure-recherche.cjs sur la banque du Benchmark.
const foldWords = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const STOP_WORDS = new Set(
  (
    'les des une est sont pour par avec dans sur aux ces cet cette que qui quoi quel quelle quels quelles ' +
    'dont mais donc car comme plus moins tres tout tous toute toutes son sans sous entre leur leurs elle ' +
    'elles ils nous vous selon chaque autre autres aussi ainsi alors etre avoir fait faire peut doit cite ' +
    'donne indique combien quand comment pourquoi document page pages section the and for with that this ' +
    'from are was were what which how many does did into than then there their have has been'
  ).split(' '),
);
// Suffixes retirés (le plus long d'abord), en gardant une racine de 4 lettres au moins.
const SUFFIXES = [
  'issements',
  'issement',
  'ablement',
  'ivement',
  'ements',
  'ement',
  'ations',
  'ation',
  'itions',
  'ition',
  'ences',
  'ence',
  'ances',
  'ance',
  'euses',
  'euse',
  'eux',
  'ives',
  'ive',
  'ifs',
  'if',
  'iques',
  'ique',
  'ables',
  'able',
  'ites',
  'ite',
  'ions',
  'ion',
  'aux',
  'ales',
  'ale',
  'al',
  'ees',
  'ee',
  'es',
  'er',
  'ez',
  'ing',
  'ed',
  'e',
  's',
];
function stem(word) {
  if (/^\d/.test(word)) return word;
  for (const suffix of SUFFIXES)
    if (word.endsWith(suffix) && word.length - suffix.length >= 4)
      return word.slice(0, -suffix.length);
  return word;
}
const stems = (text) =>
  (foldWords(text).match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP_WORDS.has(w)).map(stem);
const oldTerms = (text) => [...new Set(foldWords(text).match(/[a-z0-9]{4,}/g) || [])];

// Scores des passages (même ordre que « texts ») pour la question.
function scorePassages(texts, question, method = 'bm25') {
  // Hybride : somme des deux scores ramenés entre 0 et 1.
  if (method === 'hybride') {
    const scale = (list) => {
      const max = Math.max(...list, 0);
      return list.map((x) => (max ? x / max : 0));
    };
    const a = scale(scorePassages(texts, question, 'mots'));
    const b = scale(scorePassages(texts, question, 'bm25'));
    return a.map((x, i) => x + b[i]);
  }
  if (method === 'mots') {
    const asked = oldTerms(question);
    return texts.map((text) => {
      const own = foldWords(text);
      return asked.reduce((n, w) => n + (own.includes(w) ? 1 : 0), 0);
    });
  }
  const asked = [...new Set(stems(question))];
  if (!asked.length) return texts.map(() => 0);
  const docs = texts.map((text) => {
    const counts = new Map();
    const list = stems(text);
    for (const w of list) counts.set(w, (counts.get(w) || 0) + 1);
    return { counts, length: list.length };
  });
  const average = docs.reduce((n, d) => n + d.length, 0) / Math.max(1, docs.length) || 1;
  const k1 = 1.2;
  const b = 0.75;
  const idf = new Map(
    asked.map((w) => {
      const n = docs.filter((d) => d.counts.has(w)).length;
      return [w, Math.log(1 + (docs.length - n + 0.5) / (n + 0.5))];
    }),
  );
  return docs.map((d) =>
    asked.reduce((score, w) => {
      const f = d.counts.get(w) || 0;
      if (!f) return score;
      return score + (idf.get(w) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / average));
    }, 0),
  );
}

if (typeof module !== 'undefined') module.exports = { stem, stems, scorePassages };
