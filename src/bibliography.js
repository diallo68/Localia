// Bibliographie : citations « Auteur [n] » d'un document comparées à sa liste de références
// (hors ligne), et comparaison d'une référence avec une notice bibliographique (Crossref, OpenAlex).
// Chargé par le processus principal, l'interface et les tests.
const fold = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (text) => fold(text).match(/[a-z0-9]{3,}/g) || [];
// Mots qui précèdent souvent un numéro de référence sans être des noms d'auteurs.
const NOT_AUTHORS = new Set(
  (
    'table tableau fig figure section ref refs reference references see voir also aussi only note eq ' +
    'equation the les des and et in dans as comme by par from with avec for pour this ce cette study ' +
    'studies etude etudes work travaux model models modele approach approche dataset'
  ).split(' '),
);

// Texte complet avec la position de début de chaque page.
function joinPages(pages) {
  let text = '';
  const starts = [];
  for (const page of pages) {
    starts.push({ number: page.number, start: text.length });
    text += page.text + '\n';
  }
  const pageAt = (offset) => [...starts].reverse().find((s) => s.start <= offset)?.number ?? null;
  return { text, pageAt };
}

// Liste de références numérotées « [n] … » après le dernier titre « Références » ou « Bibliographie ».
function parseReferences(pages) {
  const { text, pageAt } = joinPages(pages);
  const headings = [
    ...text.matchAll(
      /\b(?:REFERENCES|R[ÉE]F[ÉE]RENCES|References|Références|Bibliograph(?:y|ie))\b/g,
    ),
  ];
  if (!headings.length) return { start: -1, references: [] };
  const start = headings.at(-1).index;
  const body = text.slice(start);
  const marks = [...body.matchAll(/\[(\d{1,3})\]\s*/g)];
  const references = marks.map((m, i) => ({
    n: Number(m[1]),
    page: pageAt(start + m.index),
    text: body
      .slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined)
      .replace(/\s+/g, ' ')
      .replace(/\s*\d{3}-\d-\d{4}-\d{4}-\d\/\d{2}\/\$\d+\.\d{2}.*$/, '') // pied de page d'éditeur
      .trim(),
  }));
  return { start, references };
}

// Citations « Nom [n] » ou « Nom et al. [n] » dans le texte (avant les références), comparées à la
// référence [n] : le nom doit y figurer. Les noms à majuscule interne ou à chiffres (ResNet, LSTMs)
// sont des noms de modèles, pas d'auteurs : ignorés.
function checkCitations(pages) {
  const { text, pageAt } = joinPages(pages);
  const { start, references } = parseReferences(pages);
  if (start < 0 || !references.length) return { references: 0, citations: [] };
  const byNumber = new Map(references.map((r) => [r.n, r]));
  const citations = [];
  const seen = new Set();
  const body = text.slice(0, start);
  // Sans « et al. », le nom doit être suivi d'un mot en minuscules (un verbe : « Barbedo [24] reviewed »)
  // ou d'une ponctuation : écarte les en-têtes de tableaux aplatis (« Metric [17] 2019 »).
  for (const m of body.matchAll(
    /\b([A-ZÀ-Ý][a-zà-ÿ'’-]{2,})(\s+et\s+al\.?)?\s*\[(\d{1,3})\](?=(\s+[a-zà-ÿ]|\s*[,;:.)])|)/g,
  )) {
    const [, name, etAl, number, after] = m;
    if (!etAl && after === undefined) continue;
    if (NOT_AUTHORS.has(fold(name))) continue;
    const n = Number(number);
    const key = `${name}|${n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reference = byNumber.get(n);
    citations.push({
      name: name + (etAl ? ' et al.' : ''),
      n,
      page: pageAt(m.index),
      reference: reference?.text || null,
      ok: Boolean(reference && fold(reference.text).includes(fold(name))),
    });
  }
  return { references: references.length, citations };
}

// Comparaison d'une référence écrite avec une notice (titre, auteurs, année).
function compareReference(reference, work) {
  const refTokens = new Set(tokens(reference));
  const titleTokens = [...new Set(tokens(work.title || ''))];
  const covered = titleTokens.length
    ? titleTokens.filter((t) => refTokens.has(t)).length / titleTokens.length
    : 0;
  // Titre entre guillemets dans la référence : il peut être plus court que la notice (sous-titre
  // omis, « Plant Disease Detection by Imaging Sensors » pour « … – Parallels and Specificities… »).
  const quoted = String(reference).match(/[“"«]\s*([^”"»]{10,})[”"»]/)?.[1];
  const quotedTokens = [...new Set(tokens(quoted || ''))];
  const workTokens = new Set(titleTokens);
  const quotedCoverage =
    quotedTokens.length >= 3
      ? quotedTokens.filter((t) => workTokens.has(t)).length / quotedTokens.length
      : 0;
  const titleCoverage = Math.max(covered, quotedCoverage);
  const firstAuthor =
    fold(work.authors?.[0] || '')
      .split(/\s+/)
      .pop() || '';
  // Nom entier, pas un morceau de mot (« Li » ne doit pas correspondre à « Liu »).
  const escaped = firstAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const authorMatch =
    firstAuthor.length >= 2 && new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(fold(reference));
  const years = (String(reference).match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  const yearMatch = work.year != null && years.some((y) => Math.abs(y - work.year) <= 1);
  const verdict =
    titleCoverage >= 0.8 && authorMatch && yearMatch
      ? 'trouvée'
      : // Un titre en partie commun (« Convolutional Neural Networks ») ne suffit pas : il faut
        // aussi l'auteur ou l'année, sauf si le titre est presque entier.
        titleCoverage >= 0.8 ||
          (titleCoverage >= 0.5 && (authorMatch || yearMatch)) ||
          (authorMatch && yearMatch && titleCoverage >= 0.3)
        ? 'à vérifier'
        : 'introuvable';
  return { verdict, titleCoverage, authorMatch, yearMatch };
}

// Notice Crossref ou OpenAlex ramenée à une forme commune.
function fromCrossref(item) {
  return {
    title: item.title?.[0] || '',
    authors: (item.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')),
    year: item.issued?.['date-parts']?.[0]?.[0] ?? null,
    venue: item['container-title']?.[0] || '',
    doi: item.DOI ? item.DOI.toLowerCase() : null,
  };
}
function fromOpenAlex(work) {
  return {
    id: work.id || null,
    title: work.display_name || '',
    authors: (work.authorships || []).map((a) => a.author?.display_name).filter(Boolean),
    year: work.publication_year ?? null,
    venue: work.primary_location?.source?.display_name || '',
    doi: work.doi ? work.doi.replace(/^https:\/\/doi\.org\//, '').toLowerCase() : null,
    citedBy: work.cited_by_count ?? null,
    type: work.type || null,
  };
}
// Élément de la bibliothèque Zotero (API locale) : mêmes champs, plus sa clé et son PDF éventuel.
function fromZotero(item) {
  const d = item.data || {};
  const year =
    Number(item.meta?.parsedDate?.slice(0, 4)) ||
    Number(String(d.date || '').match(/\b(1[5-9]|20)\d{2}\b/)?.[0]) ||
    null;
  return {
    key: item.key,
    itemType: d.itemType,
    title: d.title || '',
    authors: (d.creators || [])
      .filter((c) => ['author', 'editor', 'contributor'].includes(c.creatorType))
      .map((c) => c.name || [c.firstName, c.lastName].filter(Boolean).join(' ')),
    year,
    venue: d.publicationTitle || d.proceedingsTitle || d.university || d.publisher || '',
    doi: d.DOI ? String(d.DOI).toLowerCase() : null,
    attachments: item.meta?.numChildren ?? 0,
  };
}
// Une notice par œuvre : même titre (versions successives d'un dépôt, doublons d'indexation),
// la plus citée est gardée, à sa place dans le classement.
function uniqueWorks(works) {
  const key = (w) =>
    String(w.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const best = new Map();
  for (const w of works) {
    const k = key(w) || w.id;
    const kept = best.get(k);
    if (!kept || (w.citedBy ?? 0) > (kept.citedBy ?? 0)) best.set(k, w);
  }
  const keep = new Set(best.values());
  return works.filter((w) => keep.has(w));
}
// Notice au format des convertisseurs Zotero (pour /connector/saveItems).
const ZOTERO_TYPES = {
  dataset: 'dataset',
  preprint: 'preprint',
  'book-chapter': 'bookSection',
  book: 'book',
  dissertation: 'thesis',
  'conference-paper': 'conferencePaper',
};
function toZoteroItem(work, tags = []) {
  return {
    itemType: ZOTERO_TYPES[work.type] || 'journalArticle',
    title: work.title,
    creators: work.authors.map((name) => {
      const parts = name.trim().split(/\s+/);
      return parts.length > 1
        ? { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1), creatorType: 'author' }
        : { lastName: name, creatorType: 'author', fieldMode: 1 };
    }),
    date: work.year ? String(work.year) : '',
    publicationTitle: work.venue || '',
    DOI: work.doi || '',
    url: work.doi ? `https://doi.org/${work.doi}` : '',
    tags: tags.map((tag) => ({ tag })),
    attachments: [],
  };
}
// Meilleure notice pour une référence (trouvée, puis à vérifier, puis titre le plus couvert).
function bestMatch(reference, works) {
  const rank = { trouvée: 2, 'à vérifier': 1, introuvable: 0 };
  return (
    works
      .map((work) => ({ work, ...compareReference(reference, work) }))
      .sort(
        (a, b) => rank[b.verdict] - rank[a.verdict] || b.titleCoverage - a.titleCoverage,
      )[0] || {
      work: null,
      verdict: 'introuvable',
      titleCoverage: 0,
      authorMatch: false,
      yearMatch: false,
    }
  );
}

function formatReference(work) {
  const authors =
    work.authors.length > 3
      ? `${work.authors.slice(0, 3).join(', ')} et al.`
      : work.authors.join(', ');
  return [
    authors && `${authors} (${work.year ?? 's. d.'}).`,
    work.title && `${work.title}.`,
    work.venue && `${work.venue}.`,
    work.doi && `https://doi.org/${work.doi}`,
  ]
    .filter(Boolean)
    .join(' ');
}

if (typeof module !== 'undefined')
  module.exports = {
    parseReferences,
    checkCitations,
    compareReference,
    fromCrossref,
    fromOpenAlex,
    fromZotero,
    toZoteroItem,
    uniqueWorks,
    bestMatch,
    formatReference,
  };
