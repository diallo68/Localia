// Accueil du mode simple : domaines (métier et profil), type de demande, modèle conseillé dans la
// zone de saisie, suggestions et projets à reprendre ; dans la colonne, Accueil, « Analyser votre
// PC » et projets. Le mode avancé garde son tableau de bord (home-view.js).

// Domaines de l'accueil → métier de Localia (et profil pour Enseignement / Recherche).
const MAIN_DOMAINS = [
  { id: 'general', label: 'Général', metier: 'general' },
  { id: 'enseignement', label: 'Enseignement', metier: 'enseignement', profil: 'Enseignant' },
  { id: 'finance', label: 'Finance', metier: 'finance' },
  { id: 'sante', label: 'Santé', metier: 'sante' },
];
const OTHER_DOMAINS = [
  { id: 'chercheur', label: 'Chercheur', metier: 'enseignement', profil: 'Chercheur' },
  { id: 'juridique', label: 'Juridique', metier: 'juridique' },
  { id: 'administration', label: 'Administration', metier: 'administration' },
  { id: 'entreprise', label: 'Entreprise et commerce', metier: 'entreprise' },
  { id: 'ingenierie', label: 'Ingénierie', metier: 'ingenierie' },
  { id: 'communication', label: 'Communication et journalisme', metier: 'communication' },
];

function currentDomain() {
  const metier = currentMetier().id;
  if (metier === 'enseignement')
    return settings.profil === 'Chercheur' ? 'chercheur' : 'enseignement';
  return metier;
}

async function chooseDomain(domain) {
  const changed = domain.metier !== currentMetier().id;
  const { profil, ...rest } = settings;
  settings = await window.localia.saveSettings({
    ...rest,
    metier: domain.metier,
    ...(domain.profil ? { profil: domain.profil } : {}),
  });
  if (changed) applyAutoModel();
  applyMetier();
}

// Ligne des domaines dans la copie de l'accueil ; « Autres » ouvre la liste des autres métiers.
function fillDomainBar(bar) {
  if (!bar) return;
  bar.replaceChildren(element('span', 'domain-label', 'Votre domaine'));
  const active = currentDomain();
  for (const domain of MAIN_DOMAINS) {
    const on = domain.id === active;
    const chip = element('button', 'domain-chip', domain.label);
    chip.type = 'button';
    chip.dataset.domain = domain.id;
    chip.setAttribute('aria-pressed', String(on));
    chip.onclick = guard(() => chooseDomain(domain));
    bar.append(chip);
  }
  const other = OTHER_DOMAINS.find((d) => d.id === active);
  const wrap = element('div', 'domain-more');
  const more = element('button', 'domain-chip', other ? other.label : 'Autres');
  more.type = 'button';
  more.setAttribute('aria-pressed', String(Boolean(other)));
  more.setAttribute('aria-expanded', 'false');
  more.append(Object.assign(element('i'), { className: 'domain-caret' }));
  const menu = element('div', 'domain-menu');
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', 'Autres domaines');
  menu.hidden = true;
  for (const domain of OTHER_DOMAINS) {
    const item = element('button', '', domain.label);
    item.type = 'button';
    item.dataset.domain = domain.id;
    item.setAttribute('aria-pressed', String(domain.id === active));
    item.onclick = guard(() => chooseDomain(domain));
    menu.append(item);
  }
  // « Autres » déplie une seconde ligne de domaines sous la première (Échap la replie).
  more.onclick = () => {
    menu.hidden = !menu.hidden;
    more.setAttribute('aria-expanded', String(!menu.hidden));
  };
  menu.onkeydown = (event) => {
    if (event.key !== 'Escape') return;
    menu.hidden = true;
    more.setAttribute('aria-expanded', 'false');
    more.focus();
  };
  wrap.append(more);
  bar.append(wrap, menu);
}

// Suggestions sous la zone de saisie (trois au plus, celles du profil choisi).
function fillWelcomeSuggestions(suggestions, apply) {
  const box = $('welcome-suggestions');
  box.replaceChildren();
  for (const s of suggestions.slice(0, 3)) {
    const chip = element('button', 'welcome-chip', s.title);
    chip.type = 'button';
    if (s.sub) chip.title = s.sub;
    chip.onclick = () => apply(s);
    box.append(chip);
  }
}

// Type de demande : texte d'aide de la zone de saisie ; « Analyser un document » ouvre le choix
// du fichier s'il n'y en a pas encore.
const COMPOSE_PLACEHOLDERS = {
  question: 'Comment puis-je vous aider aujourd’hui ?',
  document: 'Joignez un PDF, un Word ou un Excel, puis dites ce que vous voulez en savoir…',
  idee: 'Décrivez votre idée : Localia la structure, en relève les forces et les points à vérifier…',
};
let composeMode = 'question';
// Texte d'aide sans tâche ni compétence choisie (showTaskAdvice, renderer.js).
const composePlaceholder = () =>
  tr(
    isAdvanced()
      ? 'Posez votre question, ou collez l’adresse d’une page web…'
      : COMPOSE_PLACEHOLDERS[composeMode],
  );
function setComposeMode(mode) {
  composeMode = mode;
  for (const button of document.querySelectorAll('[data-compose]'))
    button.setAttribute('aria-pressed', String(button.dataset.compose === mode));
  if (!$('task').value && !$('skill').value) $('prompt').placeholder = composePlaceholder();
}
for (const button of document.querySelectorAll('[data-compose]'))
  button.onclick = () => {
    setComposeMode(button.dataset.compose);
    if (button.dataset.compose === 'document' && !current?.document && !$('attach').disabled)
      $('attach').click();
    $('prompt').focus();
  };

// Projets : colonne (liste) et accueil (« Reprendre un projet »).
const projectConversations = (project) =>
  conversations.filter((c) => c.projectId === project.id).length;
const recentProjects = () =>
  [...projects].sort((a, b) => String(lastActivity(b)).localeCompare(String(lastActivity(a))));
const openProject = (project) => {
  openProjectId = project.id;
  $('projects-tab').click();
};
function newProject() {
  $('projects-tab').click();
  $('project-name').focus();
}

function renderSimpleProjects() {
  const list = $('simple-project-list');
  list.replaceChildren();
  for (const project of recentProjects().slice(0, 5)) {
    const button = element('button', 'nav');
    button.type = 'button';
    button.innerHTML = '<i data-icon="folder"></i>';
    button.append(element('span', '', project.name));
    button.title = project.name;
    button.onclick = () => openProject(project);
    list.append(button);
  }
  const cards = $('resume-cards');
  cards.replaceChildren();
  for (const project of recentProjects().slice(0, 2)) {
    const card = element('button', 'resume-card');
    card.type = 'button';
    const n = projectConversations(project);
    const docs = project.documents.length;
    const foot = element('span', 'resume-foot');
    foot.append(
      element(
        'span',
        '',
        `${docs} document${docs > 1 ? 's' : ''} · ${n} conversation${n > 1 ? 's' : ''}`,
      ),
      element('span', '', shortDate(lastActivity(project))),
    );
    card.append(element('strong', '', project.name), foot);
    card.onclick = () => openProject(project);
    cards.append(card);
  }
  const create = element('button', 'resume-card resume-new');
  create.type = 'button';
  create.innerHTML = '<span class="resume-plus"><i data-icon="plus"></i></span>';
  create.append(
    element('strong', '', 'Nouveau projet'),
    element('span', 'muted', 'Documents, consignes et conversations au même endroit.'),
  );
  create.onclick = newProject;
  cards.append(create);
  placeIcons(list);
  placeIcons(cards);
}

// État du moteur en haut à droite : « Prêt » quand un modèle peut répondre.
function updateReadyPill() {
  const pill = $('ready-pill');
  const ready = models.length > 0 && $('engine-state').classList.contains('ready');
  pill.classList.toggle('ready', ready);
  pill.textContent = ready ? 'Prêt' : models.length ? 'Démarrage…' : 'Aucun modèle';
}

// Modèle actif dans la zone de saisie, avec « Conseillé » s'il s'agit du modèle conseillé.
function updateModelPill(choice) {
  const pill = $('model-pill');
  const active = $('model').value;
  pill.hidden = isAdvanced() || !active;
  if (pill.hidden) return;
  $('model-pill-name').textContent = shortModel(active);
  const advised = choice && choice.name === active;
  $('model-pill-badge').textContent = advised ? 'Conseillé' : 'Votre choix';
  $('model-pill-badge').classList.toggle('mine', !advised);
  pill.title = advised ? choice.why : 'Modèle choisi par vous. Cliquez pour en changer.';
  pill.setAttribute(
    'aria-label',
    `${shortModel(active)}, ${advised ? 'conseillé' : 'votre choix'} : changer de modèle`,
  );
}
$('model-pill').onclick = () => openModelPicker();

$('simple-home').onclick = () => {
  if (current?.messages.length) $('new').click();
  view('chat');
  setComposeMode('question');
  $('prompt').focus();
};
$('simple-pc').onclick = () => $('performance-tab').click();
$('simple-new-project').onclick = newProject;
$('resume-all').onclick = () => $('projects-tab').click();
modelListeners.push(updateReadyPill);
