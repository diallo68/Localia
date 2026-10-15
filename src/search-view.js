// Page « Rechercher » : conversations, notes et documents des projets, filtrables par projet et par
// type ; chaque résultat s'ouvre à son endroit (message, note, page du document).
let searchKind = '';
let searchRun = 0;

// Texte affiché avec les mots recherchés surlignés (<mark>), sans tenir compte des accents.
function markWords(container, text, words) {
  container.replaceChildren();
  const raw = String(text || '');
  const folded = foldText(raw);
  if (!words.length || folded.length !== raw.length) {
    container.textContent = raw;
    return;
  }
  const ranges = [];
  for (const w of words)
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + w.length))
      ranges.push([at, at + w.length]);
  ranges.sort((a, b) => a[0] - b[0]);
  let pos = 0;
  for (const [start, end] of ranges) {
    if (start < pos) continue;
    container.append(raw.slice(pos, start), element('mark', '', raw.slice(start, end)));
    pos = end;
  }
  container.append(raw.slice(pos));
}

function fillSearchProjects() {
  const select = $('search-project');
  const previous = select.value;
  select.replaceChildren(
    new Option(tr('Tous les projets'), ''),
    new Option(tr('Sans projet'), 'none'),
  );
  for (const p of projects) select.add(new Option(p.name, p.id));
  select.value = [...select.options].some((o) => o.value === previous) ? previous : '';
}

function openSearch(query) {
  fillSearchProjects();
  view('search');
  if (typeof query === 'string') $('search-input').value = query;
  $('search-input').focus();
  $('search-input').select();
  runSearch();
}

const KIND_LABELS = { conversation: 'Conversation', note: 'Note', document: 'Document' };
const KIND_ICONS = { conversation: 'message', note: 'pencil', document: 'file' };
function resultRow(result, words) {
  const row = element('button', 'search-result');
  row.type = 'button';
  const icon = element('span', 'search-icon');
  icon.innerHTML = iconSvg(KIND_ICONS[result.kind]);
  const body = element('span', 'search-body');
  const head = element('span', 'search-head');
  const project =
    result.projectName || (result.projectId && projectById(result.projectId)?.name) || '';
  let title = result.title;
  if (result.kind === 'document') {
    const place = PLACES[result.type] || 'section';
    title =
      result.type === 'image' ? result.name : `${result.name} — ${tr(place)} ${result.number}`;
  }
  head.append(element('small', 'search-kind', tr(KIND_LABELS[result.kind])));
  head.append(element('strong', '', title));
  if (project) head.append(element('small', 'muted', project));
  if (result.at) head.append(element('small', 'muted', shortDate(result.at)));
  const excerpt = element('span', 'search-excerpt');
  markWords(excerpt, result.excerpt, words);
  body.append(head, excerpt);
  row.append(icon, body);
  row.onclick = guard(() => openResult(result, words));
  return row;
}

async function openResult(result, words) {
  if (result.kind === 'conversation') {
    const c = conversations.find((x) => x.id === result.conversationId);
    if (!c) throw new Error('Cette conversation n’existe plus.');
    openConversation(c);
    const node = result.index == null ? null : $('messages').children[result.index];
    if (node) flash(node);
    return;
  }
  const project = projectById(result.projectId);
  if (!project) throw new Error('Ce projet n’existe plus.');
  openProjectId = project.id;
  editingNoteId = null;
  view('projects');
  renderProjects();
  if (result.kind === 'note') {
    const card = document.querySelector(`.note-card[data-note-id="${CSS.escape(result.noteId)}"]`);
    if (card) flash(card);
  } else await openDocumentReader(project, result.docId, result.number, words);
}
// Élément mis en évidence quelques secondes après l'ouverture d'un résultat.
function flash(node) {
  node.scrollIntoView({ block: 'center' });
  node.classList.add('search-hit');
  setTimeout(() => node.classList.remove('search-hit'), 2500);
}

async function runSearch() {
  const run = ++searchRun;
  const words = searchWords($('search-input').value);
  const filter = $('search-project').value;
  const box = $('search-results');
  const status = $('search-status');
  if (!words.length) {
    box.replaceChildren();
    status.textContent = tr('Tapez au moins un mot de deux lettres.');
    return;
  }
  const wants = (kind) => !searchKind || searchKind === kind;
  const found = {
    conversation: wants('conversation') ? searchConversations(conversations, words, filter) : [],
    note: wants('note') ? searchNotes(projects, words, filter) : [],
    document: [],
  };
  let documentError = '';
  if (wants('document') && filter !== 'none') {
    status.textContent = tr('Recherche dans les documents…');
    try {
      found.document = await window.localia.searchDocuments(words.join(' '), filter);
    } catch (error) {
      documentError = error.message;
    }
    if (run !== searchRun) return; // une recherche plus récente a commencé
  }
  box.replaceChildren();
  const total = found.conversation.length + found.note.length + found.document.length;
  status.textContent = total
    ? `${total} ${tr('résultat(s)')}` +
      (Object.values(found).some((list) => list.length >= SEARCH_LIMIT)
        ? ` — ${tr('seuls les 50 premiers de chaque type sont affichés : précisez la recherche.')}`
        : '')
    : tr('Aucun résultat. Essayez d’autres mots ou un autre projet.');
  if (documentError) status.textContent += ` ${tr('Documents non consultés :')} ${documentError}`;
  const groups = [
    ['conversation', 'Conversations'],
    ['note', 'Notes des projets'],
    ['document', 'Documents des projets'],
  ];
  for (const [kind, label] of groups) {
    if (!found[kind].length) continue;
    const group = element('section', 'search-group');
    group.append(element('h3', '', `${tr(label)} (${found[kind].length})`));
    for (const result of found[kind]) group.append(resultRow(result, words));
    box.append(group);
  }
}

let searchTimer;
$('search-input').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(guard(runSearch), 250);
};
$('search-form').onsubmit = (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  guard(runSearch)();
};
$('search-project').onchange = guard(runSearch);
for (const button of $('search-kinds').querySelectorAll('button'))
  button.onclick = () => {
    searchKind = button.dataset.kind;
    for (const b of $('search-kinds').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b === button));
    guard(runSearch)();
  };
$('search-tab').onclick = () => openSearch();
// ⌘K (Ctrl+K hors macOS) : ouvre la recherche depuis n'importe quel écran.
document.addEventListener('keydown', (event) => {
  if (
    (ON_MAC ? event.metaKey : event.ctrlKey) &&
    !event.altKey &&
    event.key.toLowerCase() === 'k'
  ) {
    event.preventDefault();
    openSearch();
  }
});
