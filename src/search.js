// Recherche commune : conversations, notes des projets et documents des projets.
// Sans tenir compte des accents ni des majuscules ; tous les mots de la recherche doivent figurer.
// Chargé par le processus principal (documents), l'interface (conversations, notes) et les tests.
const SEARCH_LIMIT = 50; // résultats au plus par type

const foldText = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const searchWords = (query) => [...new Set(foldText(query).match(/[\p{L}\p{N}]{2,}/gu) || [])];
const containsAll = (folded, words) => words.length > 0 && words.every((w) => folded.includes(w));

// Extrait autour du premier mot trouvé, coupé aux espaces (la casse et les accents gardés :
// la normalisation NFD d'un texte déjà composé garde la même longueur une fois les accents retirés,
// sauf rares ligatures ; l'extrait est alors simplement le début du texte).
function searchExcerpt(text, words, size = 180) {
  const raw = String(text || '').replace(/\s+/g, ' ');
  const folded = foldText(raw);
  const at = folded.length === raw.length ? Math.max(0, folded.indexOf(words[0] || '')) : 0;
  let start = Math.max(0, at - Math.floor(size / 3));
  let end = Math.min(raw.length, start + size);
  if (start > 0) start = raw.indexOf(' ', start) + 1 || start;
  if (end < raw.length) end = raw.lastIndexOf(' ', end) > start ? raw.lastIndexOf(' ', end) : end;
  return (start > 0 ? '…' : '') + raw.slice(start, end).trim() + (end < raw.length ? '…' : '');
}

// Texte des réponses sans la mise en forme Markdown (gras, titres, tableaux, code), pour les extraits.
const plainText = (text) =>
  String(text || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/^\s{0,3}(#{1,6}\s+|[-*]\s+|>\s?)/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, '')
    .replace(/\s*\|\s*/g, ' · ');

// Filtre de projet : '' = tous, 'none' = sans projet, sinon l'identifiant du projet.
const inProject = (projectId, filter) =>
  !filter || (filter === 'none' ? !projectId : projectId === filter);

// Messages des conversations : un résultat par message, les conversations récentes d'abord.
function searchConversations(conversations, words, filter = '') {
  const results = [];
  const list = [...conversations].sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
  for (const c of list) {
    if (!inProject(c.projectId, filter)) continue;
    const titleMatch = containsAll(foldText(c.title), words);
    let found = false;
    (c.messages || []).forEach((m, index) => {
      if (results.length >= SEARCH_LIMIT || typeof m.content !== 'string') return;
      if (!containsAll(foldText(m.content), words)) return;
      found = true;
      results.push({
        kind: 'conversation',
        conversationId: c.id,
        title: c.title,
        projectId: c.projectId || null,
        index,
        role: m.role,
        at: c.updatedAt || null,
        excerpt: searchExcerpt(plainText(m.content), words),
      });
    });
    if (titleMatch && !found && results.length < SEARCH_LIMIT)
      results.push({
        kind: 'conversation',
        conversationId: c.id,
        title: c.title,
        projectId: c.projectId || null,
        index: null,
        at: c.updatedAt || null,
        excerpt: searchExcerpt(plainText(c.messages?.[0]?.content), words),
      });
  }
  return results;
}

// Notes des projets (titre et texte), les plus récentes d'abord.
function searchNotes(projects, words, filter = '') {
  const results = [];
  if (filter === 'none') return results;
  for (const p of projects) {
    if (!inProject(p.id, filter)) continue;
    for (const n of p.notes || []) {
      if (!containsAll(foldText((n.title || '') + '\n' + n.text), words)) continue;
      results.push({
        kind: 'note',
        projectId: p.id,
        projectName: p.name,
        noteId: n.id,
        title: n.title || 'Note',
        at: n.updatedAt || n.createdAt || null,
        excerpt: searchExcerpt(plainText(n.text), words),
      });
    }
  }
  results.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return results.slice(0, SEARCH_LIMIT);
}

// Pages des documents : un résultat par page (ou section, diapositive) contenant tous les mots.
// docs : [{ id, name, type, projectId, projectName, pages: [{ number, text }] }]
function searchPages(docs, words, limit = SEARCH_LIMIT) {
  const results = [];
  for (const doc of docs)
    for (const page of doc.pages || []) {
      if (results.length >= limit) return results;
      if (!containsAll(foldText(page.text), words)) continue;
      results.push({
        kind: 'document',
        projectId: doc.projectId,
        projectName: doc.projectName,
        docId: doc.id,
        name: doc.name,
        type: doc.type,
        number: page.number,
        excerpt: searchExcerpt(page.text, words),
      });
    }
  return results;
}

if (typeof module !== 'undefined')
  module.exports = {
    SEARCH_LIMIT,
    foldText,
    searchWords,
    searchExcerpt,
    searchConversations,
    searchNotes,
    searchPages,
  };
