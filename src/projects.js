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
  const select = $('project');
  const previous = select.value;
  select.replaceChildren(new Option('Aucun', ''));
  for (const p of projects) select.add(new Option(p.name, p.id));
  select.value = projectById(previous) ? previous : '';
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
      renderProjects();
    };
    list.append(button);
  }
  const project = projectById(openProjectId);
  $('project-detail').hidden = !project;
  if (!project) return;
  if (document.activeElement !== $('project-title')) $('project-title').value = project.name;
  if (document.activeElement !== $('project-description'))
    $('project-description').value = project.description || '';
  const size = noteSize(project);
  $('project-budget').textContent =
    `Mémoire : ${size.toLocaleString('fr-FR')} caractères.` +
    (size > MEMORY_BUDGET
      ? ` Au-delà de ${MEMORY_BUDGET.toLocaleString('fr-FR')}, seules les notes les plus proches de chaque question sont envoyées au modèle.`
      : ` Tout est envoyé au modèle (limite : ${MEMORY_BUDGET.toLocaleString('fr-FR')} caractères).`);
  const notes = $('notes-list');
  notes.replaceChildren();
  if (!project.notes.length) notes.append(element('p', 'muted', 'Aucune note.'));
  for (const n of [...project.notes].reverse()) {
    const card = element('article', 'note-card');
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
  if (!project) return;
  if (
    !confirm(
      `Supprimer le projet « ${project.name} » et ses ${project.notes.length} note(s) ? Les conversations sont conservées.`,
    )
  )
    return;
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

// « ＋ Mémoire du projet » sous une réponse : la réponse devient une note du projet de la conversation.
async function addToMemory(text, question) {
  const project = projectById(current?.projectId || $('project').value);
  if (!project) {
    notice(
      'Choisissez d’abord un projet pour cette conversation (menu « Projet »), ou créez-en un dans l’onglet Projets.',
    );
    return;
  }
  const title = question ? question.replace(/\s+/g, ' ').slice(0, 80) : 'Réponse enregistrée';
  project.notes.push({ id: crypto.randomUUID(), title, text, createdAt: new Date().toISOString() });
  await persistProjects();
  notice(
    `Réponse ajoutée à la mémoire du projet « ${project.name} ». Relisez-la et corrigez-la si besoin dans l’onglet Projets.`,
  );
}
