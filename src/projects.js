// Onglet « Projets » : mémoire par projet (notes écrites ou ajoutées par l'utilisateur).
let projects = [],
  projectsLoaded = false,
  openProjectId = null,
  editingNoteId = null;

const projectById = (id) => projects.find((p) => p.id === id) || null;
const noteSize = (p) => p.notes.reduce((n, x) => n + (x.title || '').length + x.text.length, 0);

async function loadProjects() {
  try {
    projects = await window.localia.loadProjects();
    projectsLoaded = true;
  } catch (error) {
    notice(error.message);
  }
  fillProjectSelect();
  renderProjects();
  return projectsLoaded;
}
async function persistProjects() {
  if (!projectsLoaded)
    throw new Error('Les projets n’ont pas pu être chargés : rien n’est enregistré.');
  projects = await window.localia.saveProjects(projects);
  fillProjectSelect();
  renderProjects();
}

// Menu « Projet » des conversations.
function fillProjectSelect() {
  if (typeof renderSimpleProjects === 'function') renderSimpleProjects();
  const select = $('project');
  const previous = select.value;
  select.replaceChildren(new Option('Aucun', ''));
  for (const p of projects) select.add(new Option(p.name, p.id));
  select.value = projectById(previous) ? previous : '';
  if (typeof syncComposerProject === 'function') syncComposerProject();
}

function renderProjects() {
  const list = $('projects-list');
  list.replaceChildren();
  if (!projects.length) list.append(element('p', 'muted', 'Aucun projet pour le moment.'));
  for (const p of projects) {
    const button = element(
      'button',
      'project-row' + (p.id === openProjectId ? ' selected' : ''),
      `${p.name} · ${p.notes.length} note(s)`,
    );
    button.type = 'button';
    button.onclick = () => {
      openProjectId = p.id;
      editingNoteId = null;
      closeNextForm();
      renderProjects();
    };
    list.append(button);
  }
  const project = projectById(openProjectId);
  $('project-detail').hidden = !project;
  if (!project) return;
  $('project-heading').textContent = project.name;
  renderOverview(project);
  if (document.activeElement !== $('project-title')) $('project-title').value = project.name;
  if (document.activeElement !== $('project-description'))
    $('project-description').value = project.description || '';
  const size = noteSize(project);
  $('project-budget').textContent =
    `Mémoire : ${size.toLocaleString('fr-FR')} caractères.` +
    (size > MEMORY_BUDGET
      ? ` Au-delà de ${MEMORY_BUDGET.toLocaleString('fr-FR')}, seules les notes les plus proches de chaque question sont envoyées au modèle.`
      : ` Tout est envoyé au modèle (limite : ${MEMORY_BUDGET.toLocaleString('fr-FR')} caractères).`);
  renderProjectDocuments(project);
  showReader();
  const notes = $('notes-list');
  notes.replaceChildren();
  if (!project.notes.length) notes.append(element('p', 'muted', 'Aucune note.'));
  for (const n of [...project.notes].reverse()) {
    const card = element('article', 'note-card');
    card.dataset.noteId = n.id;
    card.append(element('strong', '', n.title || 'Note'));
    const body = element('div', 'markdown');
    showMarkdown(body, n.text);
    card.append(body);
    card.append(
      element(
        'small',
        'muted',
        new Date(n.updatedAt || n.createdAt).toLocaleString('fr-FR') +
          (n.updatedAt ? ' (modifiée)' : ''),
      ),
    );
    if (n.source) card.append(provenanceLine(n.source));
    const row = element('div', 'input-row');
    const edit = element('button', '', 'Modifier');
    edit.type = 'button';
    edit.onclick = () => {
      editingNoteId = n.id;
      $('note-title').value = n.title || '';
      $('note-text').value = n.text;
      $('note-submit').textContent = 'Enregistrer la note';
      $('note-cancel').hidden = false;
      $('note-text').focus();
    };
    const remove = element('button', '', 'Supprimer');
    remove.type = 'button';
    remove.onclick = guard(async () => {
      if (!confirm('Supprimer définitivement cette note ?')) return;
      project.notes = project.notes.filter((x) => x !== n);
      await persistProjects();
    });
    row.append(edit, remove);
    card.append(row);
    notes.append(card);
  }
}

function resetNoteForm() {
  editingNoteId = null;
  $('note-form').reset();
  $('note-submit').textContent = 'Ajouter la note';
  $('note-cancel').hidden = true;
}

$('projects-tab').onclick = () => {
  view('projects');
  renderProjects();
};
$('project-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const name = $('project-name').value.trim();
  if (!name) return;
  const project = {
    id: crypto.randomUUID(),
    name,
    description: '',
    createdAt: new Date().toISOString(),
    notes: [],
    documents: [],
  };
  projects.push(project);
  openProjectId = project.id;
  $('project-form').reset();
  await persistProjects();
});
$('project-save').onclick = guard(async () => {
  const project = projectById(openProjectId);
  if (!project) return;
  project.name = $('project-title').value.trim() || project.name;
  project.description = $('project-description').value.trim();
  await persistProjects();
  notice('');
});
$('project-delete').onclick = guard(async () => {
  const project = projectById(openProjectId);
  $('project-menu').open = false;
  if (!project) return;
  if (
    !confirm(
      `Supprimer le projet « ${project.name} », ses ${project.notes.length} note(s) et ses ${project.documents.length} document(s) ? Les conversations sont conservées.`,
    )
  )
    return;
  for (const d of project.documents) await window.localia.deleteDocument(d.id).catch(() => {});
  projects = projects.filter((p) => p !== project);
  openProjectId = null;
  for (const c of conversations) if (c.projectId === project.id) delete c.projectId;
  await persist();
  await persistProjects();
});
$('note-cancel').onclick = resetNoteForm;
$('note-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const project = projectById(openProjectId);
  const text = $('note-text').value.trim();
  if (!project || !text) return;
  const title = $('note-title').value.trim();
  const existing = project.notes.find((n) => n.id === editingNoteId);
  if (existing) Object.assign(existing, { title, text, updatedAt: new Date().toISOString() });
  else
    project.notes.push({
      id: crypto.randomUUID(),
      title,
      text,
      createdAt: new Date().toISOString(),
    });
  resetNoteForm();
  await persistProjects();
});

// « ＋ Mémoire du projet » sous une réponse, ou proposition de Localia : le texte est relu, corrigé
// au besoin, puis enregistré comme note avec sa provenance ; rien n'est enregistré sans accord.
function memoryProject() {
  const project = projectById(current?.projectId || $('project').value);
  if (!project)
    notice(
      'Choisissez d’abord un projet pour cette conversation (menu « Projet »), ou créez-en un dans l’onglet Projets.',
    );
  return project;
}
function sourceOf(kind, question, message) {
  return {
    kind,
    conversationId: current?.id,
    conversationTitle: current?.title,
    question: question ? question.replace(/\s+/g, ' ').slice(0, 300) : undefined,
    model: message?.model || current?.model,
    at: new Date().toISOString(),
  };
}
async function saveMemoryNote(project, title, text, source) {
  project.notes.push({
    id: crypto.randomUUID(),
    title,
    text,
    createdAt: new Date().toISOString(),
    source,
  });
  await persistProjects();
  notice(`Note ajoutée à la mémoire du projet « ${project.name} ».`);
}
// Fenêtre de relecture : renvoie true si la note a été enregistrée.
function reviewMemory(project, title, text, source) {
  const dialog = $('memory-dialog');
  $('memory-dialog-title').textContent = `Ajouter à la mémoire du projet « ${project.name} »`;
  $('memory-provenance').textContent = provenanceText(source);
  $('memory-note-title').value = title;
  $('memory-note-text').value = text;
  dialog.returnValue = '';
  dialog.showModal();
  $('memory-note-text').focus();
  return new Promise((resolve) => {
    dialog.onclose = guard(async () => {
      const body = $('memory-note-text').value.trim();
      if (dialog.returnValue !== 'save' || !body) return resolve(false);
      await saveMemoryNote(project, $('memory-note-title').value.trim(), body, source);
      resolve(true);
    });
  });
}
async function addToMemory(text, question, message) {
  const project = memoryProject();
  if (!project) return;
  const title = question ? question.replace(/\s+/g, ' ').slice(0, 80) : 'Réponse enregistrée';
  await reviewMemory(project, title, text, sourceOf('reponse', question, message));
}
// Provenance affichée : conversation d'origine (ouvrable), question, modèle, date.
function provenanceText(source) {
  const parts = [
    { proposition: 'Proposée par Localia', routine: 'Synthèse d’une routine' }[source.kind] ||
      'Réponse enregistrée',
    source.conversationTitle ? `conversation « ${source.conversationTitle} »` : '',
    source.model ? `modèle ${source.model}` : '',
    source.at ? new Date(source.at).toLocaleString('fr-FR') : '',
  ];
  return 'Provenance : ' + parts.filter(Boolean).join(' · ');
}
function provenanceLine(source) {
  const line = element('small', 'note-source', provenanceText(source));
  const c = conversations.find((x) => x.id === source.conversationId);
  if (c) {
    const open = element('button', 'link-button', 'Ouvrir la conversation');
    open.type = 'button';
    open.onclick = () => openConversation(c);
    line.append(' ', open);
  }
  return line;
}

// Vue de synthèse du projet : prochaine étape, conversations liées, résultats conservés, documents.
function renderOverview(project) {
  const next = project.nextStep || '';
  $('project-next-text').textContent = next || tr('Aucune étape notée.');
  $('project-next-text').classList.toggle('muted', !next);
  $('project-next-edit').textContent = tr(next ? 'Modifier' : 'Noter la prochaine étape');
  const linked = conversations
    .filter((c) => c.projectId === project.id)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const list = (box, items, empty) => {
    box.replaceChildren();
    if (!items.length) box.append(element('p', 'muted', empty));
    for (const item of items) box.append(item);
  };
  const row = (title, detail, onclick) => {
    const b = element('button', 'overview-row');
    b.type = 'button';
    b.append(element('strong', '', title), element('small', 'muted', detail));
    b.onclick = onclick;
    return b;
  };
  const shownConversations = linked
    .slice(0, 4)
    .map((c) => row(c.title, shortDate(c.updatedAt), () => openConversation(c)));
  if (linked.length > 4) {
    const all = element('button', 'link-button', `Voir les ${linked.length} conversations`);
    all.type = 'button';
    all.onclick = () => {
      fillSearchProjects();
      $('search-project').value = project.id;
      $('search-kinds').querySelector('[data-kind=""]').click();
      openSearch('');
    };
    shownConversations.push(all);
  }
  list($('project-conversations'), shownConversations, 'Aucune conversation reliée à ce projet.');
  const kept = project.notes
    .filter((n) => n.source)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 3)
    .map((n) =>
      row(n.title || 'Note', shortDate(n.createdAt), () => {
        const card = document.querySelector(`.note-card[data-note-id="${CSS.escape(n.id)}"]`);
        if (card) flash(card);
      }),
    );
  list($('project-kept'), kept, 'Les réponses ajoutées à la mémoire apparaîtront ici.');
  const docs = [...project.documents]
    .sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
    .slice(0, 3)
    .map((d) =>
      row(
        d.name,
        shortDate(d.addedAt),
        guard(() => openDocumentReader(project, d.id, 1)),
      ),
    );
  list($('project-recent-docs'), docs, 'Aucun document pour l’instant.');
}
$('project-next-edit').onclick = () => {
  const project = projectById(openProjectId);
  $('project-next-input').value = project?.nextStep || '';
  $('project-next-form').hidden = false;
  $('project-next-edit').hidden = true;
  $('project-next-input').focus();
};
const closeNextForm = () => {
  $('project-next-form').hidden = true;
  $('project-next-edit').hidden = false;
};
$('project-next-cancel').onclick = closeNextForm;
$('project-next-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const project = projectById(openProjectId);
  if (!project) return;
  project.nextStep = $('project-next-input').value.trim() || undefined;
  closeNextForm();
  await persistProjects();
});
$('project-search').onclick = () => {
  fillSearchProjects();
  $('search-project').value = openProjectId;
  openSearch('');
};
$('project-settings-open').onclick = () => {
  $('project-menu').open = false;
  $('project-settings').open = true;
  $('project-settings').scrollIntoView({ block: 'nearest' });
  $('project-title').focus();
};

// Documents du projet : liste, ajout (bouton ou dépôt de plusieurs fichiers), retrait.
const DOC_TYPES = {
  pdf: ['PDF', 'file'],
  word: ['Word', 'file'],
  excel: ['Excel', 'grid'],
  powerpoint: ['PowerPoint', 'chart'],
  table: ['Tableau', 'grid'],
  text: ['Texte', 'pencil'],
  image: ['Photo', 'camera'],
};
const PLACES = { pdf: 'page', powerpoint: 'diapositive' };
function documentDetail(d) {
  const [label] = DOC_TYPES[d.type] || ['Document'];
  const place = PLACES[d.type] || 'section';
  const parts = [label];
  if (d.type !== 'image' && d.sections)
    parts.push(`${d.sections} ${place}${d.sections > 1 ? 's' : ''}`);
  if (d.characters) parts.push(`${d.characters.toLocaleString('fr-FR')} caractères`);
  if (d.summary) parts.push(d.summary);
  if (d.type === 'image') parts.push('texte lu par reconnaissance de caractères');
  else if (d.ocr)
    parts.push(
      `${d.ocr} page${d.ocr > 1 ? 's' : ''} scannée${d.ocr > 1 ? 's' : ''} lue${d.ocr > 1 ? 's' : ''} par reconnaissance de caractères`,
    );
  return parts.join(' · ');
}
function renderProjectDocuments(project) {
  const list = $('project-docs');
  list.replaceChildren();
  if (!project.documents.length)
    list.append(element('p', 'muted', 'Aucun document pour l’instant.'));
  for (const d of [...project.documents].reverse()) {
    const row = element('article', 'project-doc');
    const icon = element('span', 'project-doc-icon');
    icon.innerHTML = `<i data-icon="${(DOC_TYPES[d.type] || [, 'file'])[1]}"></i>`;
    const text = element('span', 'project-doc-text');
    text.append(element('strong', '', d.name), element('small', 'muted', documentDetail(d)));
    if (d.alerts)
      text.append(
        element(
          'small',
          'project-doc-alert',
          'Contient des phrases adressées à une IA : relisez ce document, il pourrait chercher à détourner les réponses.',
        ),
      );
    const remove = element('button', 'link-button', 'Retirer');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Retirer ${d.name} du projet`);
    remove.onclick = guard(async () => {
      if (!confirm(`Retirer « ${d.name} » du projet ? Le fichier d’origine n’est pas touché.`))
        return;
      project.documents = project.documents.filter((x) => x !== d);
      await persistProjects();
      await window.localia.deleteDocument(d.id).catch(() => {});
    });
    const read = element('button', 'link-button', 'Lire');
    read.type = 'button';
    read.setAttribute('aria-label', `Lire ${d.name}`);
    read.onclick = guard(() => openDocumentReader(project, d.id, 1));
    row.dataset.docId = d.id;
    row.append(icon, text, element('small', 'muted', shortDate(d.addedAt)), read, remove);
    list.append(row);
  }
  placeIcons(list);
}

let addingDocuments = false;
async function addProjectDocuments(run) {
  const project = projectById(openProjectId);
  if (!project || addingDocuments) return;
  const room = 100 - project.documents.length;
  if (room <= 0) throw new Error('Un projet garde 100 documents au plus.');
  addingDocuments = true;
  $('project-add-docs').disabled = true;
  const status = $('project-docs-status');
  try {
    const result = await run();
    if (!result) return;
    const added = result.added.slice(0, room);
    project.documents.push(...added);
    await persistProjects();
    if (added.length) await queueDocumentRoutines(project.id, added);
    const failed = result.errors.map((e) => `${e.name} : ${e.error}`);
    status.textContent =
      `${added.length} document${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''}.` +
      (failed.length ? ` Non ajouté${failed.length > 1 ? 's' : ''} : ${failed.join(' ; ')}` : '');
    status.classList.toggle('warn', failed.length > 0);
  } finally {
    addingDocuments = false;
    $('project-add-docs').disabled = false;
  }
}
$('project-add-docs').onclick = guard(() =>
  addProjectDocuments(() => window.localia.projectDocumentsAdd()),
);
window.localia.onProgress(({ kind, data }) => {
  if (kind === 'project-document' && addingDocuments)
    $('project-docs-status').textContent =
      `Lecture de ${data.name} (${data.index + 1} sur ${data.total})…`;
  if (kind === 'ocr' && addingDocuments && data.pageCount)
    $('project-docs-status').textContent =
      `Reconnaissance de caractères : page ${data.page} sur ${data.pageCount}…`;
  if (kind === 'ocr' && addingDocuments && data.photo)
    $('project-docs-status').textContent = `Reconnaissance de caractères : ${data.photo}…`;
});
const drop = $('project-drop');
drop.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  drop.classList.add('dragging');
});
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener(
  'drop',
  guard(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.remove('dragging');
    const files = [...(event.dataTransfer?.files || [])].slice(0, 50);
    if (!files.length) return;
    const big = files.find((f) => f.size > 50 * 1024 * 1024);
    if (big) throw new Error(`${big.name} : fichier limité à 50 Mo.`);
    const items = [];
    for (const f of files)
      items.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    await addProjectDocuments(() => window.localia.projectDocumentsDrop(items));
  }),
);

// Lecteur d'un document du projet : une page (section, diapositive) à la fois, mots recherchés
// surlignés ; ouvert depuis la liste des documents ou un résultat de la recherche.
let reader = null;
async function openDocumentReader(project, docId, number, words = []) {
  const page = await window.localia.documentPage(project.id, docId, number);
  reader = { projectId: project.id, docId, words, ...page };
  showReader();
  $('project-reader').scrollIntoView({ block: 'nearest' });
  $('reader-text').focus({ preventScroll: true });
}
function showReader() {
  const box = $('project-reader');
  box.hidden = !reader || reader.projectId !== openProjectId;
  if (box.hidden) return;
  const place = PLACES[reader.type] || 'section';
  $('reader-title').textContent =
    `${reader.name} — ${tr(place)} ${reader.number} ${tr('sur')} ${reader.count}`;
  markWords($('reader-text'), reader.text, reader.words);
  $('reader-prev').disabled = reader.number <= 1;
  $('reader-next').disabled = reader.number >= reader.count;
  $('reader-text').querySelector('mark')?.scrollIntoView({ block: 'center' });
}
const turnPage = (step) =>
  guard(async () => {
    const project = projectById(reader?.projectId);
    if (project)
      await openDocumentReader(project, reader.docId, reader.number + step, reader.words);
  });
$('reader-prev').onclick = turnPage(-1);
$('reader-next').onclick = turnPage(1);
$('reader-close').onclick = () => {
  reader = null;
  showReader();
};
