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

// Accueil du mode avancé, dans l'ordre : actions, reprendre, à traiter, activité, état technique.
// Dernière activité d'un projet : création, notes, documents et conversations liées.
function lastActivity(project) {
  return [
    project.createdAt,
    ...project.notes.flatMap((n) => [n.createdAt, n.updatedAt]),
    ...(project.documents || []).map((d) => d.addedAt),
    ...conversations.filter((c) => c.projectId === project.id).map((c) => c.updatedAt),
  ]
    .filter(Boolean)
    .sort()
    .pop();
}
// Ligne cliquable des zones « À traiter » et « Activité ».
function homeItem(box, icon, title, detail, onclick, level = '') {
  const row = element(onclick ? 'button' : 'div', `home-item ${level}`);
  if (onclick) {
    row.type = 'button';
    row.onclick = onclick;
  }
  row.innerHTML = iconSvg(icon);
  const text = element('span');
  text.append(element('strong', '', title));
  if (detail) text.append(element('small', 'muted', detail));
  row.append(text);
  box.append(row);
}
let watchNew = 0; // nouveaux articles de la veille, relus au démarrage et après chaque recherche

function renderHome() {
  greeting($('home-greeting'));
  const ready = $('engine-state').classList.contains('ready');
  const pill = $('home-engine');
  pill.className = 'home-pill' + (ready ? ' ready' : '');
  pill.textContent = ready ? 'Moteur local connecté' : $('engine-state').textContent;

  // Reprendre : dernière conversation, dernier document analysé, puis projets actifs.
  const resume = $('home-continue');
  resume.replaceChildren();
  const byDate = [...conversations].sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
  const lastConversation = byDate.find((c) => c.messages?.length);
  const withDocument = byDate.find((c) => c.document);
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
      () => openConversation(lastConversation),
    );
  if (withDocument && withDocument !== lastConversation)
    tile('file', 'Dernier document analysé', withDocument.document.name, withDocument.title, () =>
      openConversation(withDocument),
    );
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
    const name = element('span', 'home-row-name');
    name.append(element('strong', '', project.name));
    if (project.nextStep) name.append(element('small', 'muted', `→ ${project.nextStep}`));
    row.append(name, element('span', 'muted', shortDate(lastActivity(project))));
    row.onclick = () => {
      openProjectId = project.id;
      $('projects-tab').click();
    };
    list.append(row);
  }

  // À traiter : seulement des événements enregistrés (résultats de routines, erreurs, veille,
  // départ programmé manqué).
  const todo = $('home-todo');
  todo.replaceChildren();
  const review = typeof runsToReview === 'function' ? runsToReview() : [];
  for (const run of review.slice(-6).reverse())
    homeItem(
      todo,
      run.state === 'erreur' ? 'refresh' : 'file',
      runTitle(run),
      run.state === 'erreur'
        ? `${tr('Erreur')} : ${run.error || ''}`
        : `${tr('À relire')} · ${projectById(run.projectId)?.name || ''}`,
      () => openRun(run.id),
      run.state === 'erreur' ? 'warn' : '',
    );
  if (review.length > 6)
    homeItem(todo, 'routine', `${review.length - 6} autre(s) résultat(s)`, '', () =>
      $('routines-tab').click(),
    );
  const missed = typeof missedSchedule === 'function' ? missedSchedule() : null;
  if (missed)
    homeItem(
      todo,
      'chart',
      'Départ programmé manqué',
      `Série du Benchmark prévue ${new Date(missed.at).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} : Localia était fermée. Cliquez pour la lancer maintenant.`,
      guard(runMissedSchedule),
      'warn',
    );
  if (watchNew)
    homeItem(todo, 'book', `${watchNew} nouvel(s) article(s) de la veille`, '', () =>
      $('bibliography-tab').click(),
    );
  if (!todo.childNodes.length) todo.append(element('p', 'muted', 'Rien à traiter.'));

  // Activité : traitements en cours et prochains départs (zone masquée s'il n'y en a pas).
  const activity = $('home-activity');
  activity.replaceChildren();
  if (typeof routineRunning !== 'undefined' && routineRunning)
    homeItem(
      activity,
      'routine',
      `${runTitle(routineRunning)}`,
      `${tr('En cours')} — ${tr(STEP_LABELS[routineRunning.step] || 'préparation')}…`,
      () => openRun(routineRunning.id),
    );
  const waiting =
    typeof routinesData === 'undefined'
      ? 0
      : routinesData.runs.filter((r) => r.state === 'en-attente').length;
  if (waiting)
    homeItem(
      activity,
      'clock',
      `${waiting} ${tr('en attente')}`,
      routinesData.paused ? tr('Routines suspendues') : '',
      () => $('routines-tab').click(),
    );
  if (typeof scheduledStart !== 'undefined' && scheduledStart)
    homeItem(
      activity,
      'chart',
      'Série du Benchmark programmée',
      scheduledStart.at.toLocaleString('fr-FR', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }),
      () => $('bench-nav').click(),
    );
  if (comparing)
    homeItem(activity, 'chart', 'Série du Benchmark en cours', '', () => $('bench-nav').click());
  $('home-activity-card').hidden = !activity.childNodes.length;

  // État technique, replié : moteur, modèles, mémoire, modèle conseillé.
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
  $('home-tech-summary').textContent =
    `${ready ? 'moteur prêt' : 'moteur non prêt'} · ${models.length + (models.length > 1 ? ' modèles' : ' modèle')}`;
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
  placeIcons($('home-view'));
}
// État technique : ouvert ou replié, retenu sur cet ordinateur.
try {
  $('home-tech').open = localStorage.getItem('localia.homeTech') === 'open';
} catch {
  // Stockage indisponible : replié.
}
$('home-tech').ontoggle = () => {
  try {
    localStorage.setItem('localia.homeTech', $('home-tech').open ? 'open' : 'closed');
  } catch {
    // Stockage indisponible : l'état n'est pas retenu.
  }
};
$('home-routines').onclick = () => $('routines-tab').click();
function refreshWatchCount() {
  window.localia
    .watchLoad()
    .then((w) => {
      const count = w.items.filter((i) => i.status === 'new').length;
      if (count === watchNew) return;
      watchNew = count;
      if (!$('home-view').hidden) renderHome();
    })
    .catch(() => {});
}
refreshWatchCount();
window.localia.onProgress(({ kind }) => {
  if (kind === 'watch') refreshWatchCount();
});

function openHome() {
  view('home');
  renderHome();
  refreshWatchCount();
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
