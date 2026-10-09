// Deux interfaces : « simple » (conversation d'abord, réglages repliés) et « avancée » (accueil
// en tableau de bord, toute la navigation). Le choix est enregistré dans les réglages.
const isAdvanced = () => settings.mode === 'avance';

function applyMode() {
  document.body.dataset.mode = isAdvanced() ? 'avance' : 'simple';
  $('mode-switch').textContent = isAdvanced() ? 'Passer en mode simple' : 'Passer en mode avancé';
  $('home-tab').hidden = !isAdvanced();
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

// Mode simple : sous la zone de saisie, le modèle conseillé pour le métier et son état.
function updateComposerAdvice() {
  const box = $('composer-advice');
  box.hidden = isAdvanced();
  if (box.hidden) return;
  const text = $('composer-advice-text');
  text.replaceChildren();
  const metier = currentMetier();
  const label = BENCH_METIERS[metier.id];
  const best = label ? metierAdvice(comparisons, label)?.best : null;
  rememberFullNames(comparisons);
  const active = $('model').value;
  if (best) {
    text.append(
      element('span', '', 'Modèle conseillé pour'),
      ' ' + metier.label + ' · ',
      element('span', 'composer-model', shortModel(best.model)),
    );
    const ready = installed(best.model) && active === best.model;
    text.append(element('span', ready ? 'state ready' : 'state', ready ? 'prêt' : 'non activé'));
  } else if (active) {
    text.append(
      element('span', '', 'Modèle actif'),
      ' · ',
      element('span', 'composer-model', active.replace(/^integre\//, '')),
    );
  }
}
$('composer-advanced').onclick = () =>
  setChatPanel(!$('chat-view').classList.contains('panel-open'));
$('model').addEventListener('change', updateComposerAdvice);
modelListeners.push(updateComposerAdvice);

// Accueil du mode avancé : actions, modèle conseillé, projets récents, état du système.
function lastActivity(project) {
  return [project.createdAt, ...project.notes.flatMap((n) => [n.createdAt, n.updatedAt])]
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
