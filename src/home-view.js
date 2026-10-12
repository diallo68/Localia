// Deux interfaces : « simple » (conversation d'abord, réglages repliés) et « avancée » (accueil
// en tableau de bord, toute la navigation). Le choix est enregistré dans les réglages.
const isAdvanced = () => settings.mode === 'avance';

function applyMode() {
  document.body.dataset.mode = isAdvanced() ? 'avance' : 'simple';
  $('mode-switch').textContent = isAdvanced() ? 'Passer en mode simple' : 'Passer en mode avancé';
  $('home-tab').hidden = !isAdvanced();
  setComposeMode('question');
  updateComposerAdvice();
}

$('mode-switch').onclick = guard(async () => {
  settings = await window.localia.saveSettings({
    ...settings,
    mode: isAdvanced() ? 'simple' : 'avance',
  });
  applyMode();
  render();
  if (isAdvanced()) openHome();
  else view('chat');
});

// Salutation de l'accueil, avec le prénom s'il a été donné.
function greeting(node) {
  node.replaceChildren('Bonjour', settings.firstName ? ' ' + settings.firstName : '');
}

// Mode simple : sous la zone de saisie, le modèle conseillé (selon le Benchmark, l'ordinateur et
// le métier), le modèle actif s'il est différent, et de quoi en changer.
function updateComposerAdvice() {
  const box = $('composer-advice');
  box.hidden = isAdvanced();
  if (typeof updateModelPill === 'function')
    updateModelPill(
      isAdvanced() || typeof recommendedModel !== 'function' ? null : recommendedModel(),
    );
  if (box.hidden) return;
  const text = $('composer-advice-text');
  text.replaceChildren();
  const metier = currentMetier();
  rememberFullNames(comparisons);
  const active = $('model').value;
  const choice = typeof recommendedModel === 'function' ? recommendedModel() : null;
  // Modèle conseillé déjà actif : la pastille de la zone de saisie suffit.
  if (choice && active !== choice.name) {
    const advice = element('span', 'composer-choice');
    advice.title = choice.why;
    advice.append(
      element('span', '', 'Modèle conseillé pour'),
      ' ' + metier.label + ' · ',
      element('span', 'composer-model', shortModel(choice.name)),
    );
    advice.append(element('span', 'state', 'non activé'));
    text.append(advice);
  }
  if (active && active !== choice?.name)
    text.append(
      element('span', '', choice ? ' · Modèle choisi' : 'Modèle actif'),
      ' · ',
      element('span', 'composer-model', active.replace(/^integre\//, '')),
    );
  if (models.length) {
    const change = element('button', 'link-button', 'Changer de modèle');
    change.type = 'button';
    change.onclick = () => openModelPicker();
    text.append(' ', change);
  }
  if (choice && active !== choice.name && settings.modelChoice === 'manuel') {
    const back = element('button', 'link-button', 'Revenir au modèle conseillé');
    back.type = 'button';
    back.onclick = guard(useRecommendedModel);
    text.append(' ', back);
  }
}
$('composer-advanced').onclick = () =>
  setChatPanel(!$('chat-view').classList.contains('panel-open'));
$('model').addEventListener('change', updateComposerAdvice);
modelListeners.push(updateComposerAdvice);

// Accueil du mode avancé : actions, modèle conseillé, projets récents, état du système.
function lastActivity(project) {
  return [
    project.createdAt,
    ...project.notes.flatMap((n) => [n.createdAt, n.updatedAt]),
    ...(project.documents || []).map((d) => d.addedAt),
  ]
    .filter(Boolean)
    .sort()
    .pop();
}

function renderHome() {
  greeting($('home-greeting'));
  const ready = $('engine-state').classList.contains('ready');
  const pill = $('home-engine');
  pill.className = 'home-pill' + (ready ? ' ready' : '');
  pill.textContent = ready ? 'Moteur local connecté' : $('engine-state').textContent;

  const advice = $('home-advice');
  advice.replaceChildren();
  const card = adviceCard(currentMetier());
  if (card) {
    const compare = element('button', '', 'Comparer');
    compare.type = 'button';
    compare.onclick = () => $('bench-nav').click();
    card.querySelector('.advice-foot').append(compare);
    advice.append(card);
  }

  // Continuer : dernière conversation, dernier document analysé, dernier projet.
  const resume = $('home-continue');
  resume.replaceChildren();
  const byDate = [...conversations].sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
  const lastConversation = byDate.find((c) => c.messages?.length);
  const withDocument = byDate.find((c) => c.document);
  const lastProject = [...projects].sort((a, b) =>
    String(lastActivity(b)).localeCompare(String(lastActivity(a))),
  )[0];
  const openConversation = (c) => () =>
    document.querySelector(`#history button[data-id="${CSS.escape(c.id)}"]`)?.click();
  const tile = (icon, kind, title, detail, onclick) => {
    const button = element('button', 'home-resume');
    button.type = 'button';
    button.innerHTML = `<i data-icon="${icon}"></i>`;
    const text = element('span');
    text.append(element('small', 'muted', kind), element('strong', '', title));
    if (detail) text.append(element('span', 'muted', detail));
    button.append(text);
    button.onclick = onclick;
    resume.append(button);
  };
  if (lastConversation)
    tile(
      'message',
      'Dernière conversation',
      lastConversation.title,
      shortDate(lastConversation.updatedAt),
      openConversation(lastConversation),
    );
  if (withDocument)
    tile(
      'file',
      'Dernier document analysé',
      withDocument.document.name,
      withDocument.title,
      openConversation(withDocument),
    );
  if (lastProject)
    tile('folder', 'Dernier projet', lastProject.name, shortDate(lastActivity(lastProject)), () => {
      openProjectId = lastProject.id;
      $('projects-tab').click();
    });
  if (!resume.childNodes.length)
    resume.append(element('p', 'muted', 'Votre travail récent apparaîtra ici.'));

  const list = $('home-projects');
  list.replaceChildren();
  const recent = [...projects]
    .sort((a, b) => String(lastActivity(b)).localeCompare(String(lastActivity(a))))
    .slice(0, 4);
  if (!recent.length) list.append(element('p', 'muted', 'Aucun projet pour l’instant.'));
  for (const project of recent) {
    const row = element('button', 'home-row');
    row.type = 'button';
    row.append(
      element('strong', '', project.name),
      element('span', 'muted', shortDate(lastActivity(project))),
    );
    row.onclick = () => {
      openProjectId = project.id;
      $('projects-tab').click();
    };
    list.append(row);
  }

  const status = $('home-status');
  status.replaceChildren();
  const line = (ok, title, detail) => {
    const item = element('li', ok ? 'ok' : 'warn');
    item.append(element('strong', '', title), element('span', 'muted', detail));
    status.append(item);
  };
  line(ready, 'Moteur local', $('engine-state').textContent);
  line(
    models.length > 0,
    'Modèles disponibles',
    models.length + (models.length > 1 ? ' modèles installés' : ' modèle installé'),
  );
  if (!$('memory-gauge').hidden)
    line(
      $('memory-gauge').dataset.level === 'ok',
      'Mémoire utilisée',
      $('memory-text').textContent,
    );
  placeIcons($('home-view'));
}

function openHome() {
  view('home');
  renderHome();
}
$('home-tab').onclick = openHome;
$('home-ask').onclick = () => {
  $('new').click();
  view('chat');
  $('prompt').focus();
};
$('home-document').onclick = () => {
  view('chat');
  $('attach').click();
};
$('home-project').onclick = () => {
  $('projects-tab').click();
  $('project-name').focus();
};
$('home-compare').onclick = () => $('bench-nav').click();
$('home-all-projects').onclick = () => $('projects-tab').click();
modelListeners.push(() => {
  if (!$('home-view').hidden) renderHome();
});
