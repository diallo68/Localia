// Métier : écran de choix (premier lancement ou changement), et adaptation de la conversation
// (menu Tâche, suggestions de l'accueil, onglets, consigne de métier).
let metierChoice = null; // métier sélectionné sur l'écran, pas encore validé
let metierMode = 'first'; // 'first' : premier lancement ; 'change' : depuis la colonne

const currentMetier = () => metierById(settings.metier) || metierById(DEFAULT_METIER);

function metierCard(metier) {
  const card = element('button', 'metier-card');
  card.type = 'button';
  card.setAttribute('role', 'radio');
  card.dataset.metier = metier.id;
  const head = element('span', 'metier-head');
  const icon = element('span', 'metier-icon');
  icon.innerHTML = iconSvg(metier.icon);
  const title = element('span', 'metier-title');
  title.append(element('strong', '', metier.label));
  if (metier.sub) title.append(element('small', '', metier.sub));
  head.append(icon, title);
  card.append(head);
  for (const group of metier.groups) {
    if (metier.groups.length > 1) card.append(element('span', 'metier-group', group.label));
    const list = element('ul', 'metier-tasks');
    for (const id of group.tasks.slice(0, metier.groups.length > 1 ? 4 : 6))
      list.append(element('li', '', taskById(id).label));
    card.append(list);
  }
  const tags = element('span', 'metier-tags');
  if (metier.anonymize) tags.append(element('span', 'tag warm', 'Anonymisation'));
  if (metier.groups.some((g) => g.tasks.some((t) => taskById(t)?.categories.includes('Calcul'))))
    tags.append(element('span', 'tag cool', 'Calculs vérifiés'));
  if (metier.tools?.includes('bibliography'))
    tags.append(element('span', 'tag', 'Bibliographie et Zotero'));
  if (tags.childNodes.length) card.append(tags);
  card.onclick = () => selectMetier(metier.id);
  return card;
}

function selectMetier(id) {
  metierChoice = id;
  for (const card of $('metier-cards').children) {
    const on = card.dataset.metier === id;
    card.classList.toggle('selected', on);
    card.setAttribute('aria-checked', String(on));
  }
  $('metier-chosen').textContent = metierById(id)?.label || '—';
  $('metier-continue').disabled = !id;
}

function openMetierView(mode = 'change') {
  metierMode = mode;
  $('metier-cards').replaceChildren(...METIERS.filter((m) => !m.simple).map((m) => metierCard(m)));
  selectMetier(mode === 'first' ? null : settings.metier || DEFAULT_METIER);
  $('metier-step').textContent =
    mode === 'first' ? 'PREMIER LANCEMENT · ÉTAPE 1 SUR 2' : 'CHANGER DE MÉTIER';
  $('metier-cancel').hidden = mode === 'first';
  $('metier-skip').hidden = mode !== 'first';
  // Premier lancement : proposer le chiffrement tout de suite, si le trousseau le permet.
  $('metier-encrypt-row').hidden = true;
  $('metier-encrypt').checked = false;
  if (mode === 'first')
    window.localia
      .encryptionStatus()
      .then((status) => {
        $('metier-encrypt-row').hidden = status.enabled || !status.keychain;
      })
      .catch(() => {});
  $('first-name').value = settings.firstName || '';
  $('quick-chips').replaceChildren(
    ...metierById('general').suggestions.map((s) => {
      const chip = element('button', 'chip', s.title);
      chip.type = 'button';
      chip.onclick = () => {
        $('quick-prompt').value = tr(s.prompt);
        $('quick-prompt').focus();
      };
      return chip;
    }),
  );
  langButtons();
  document.body.dataset.onboarding = '1';
  $('metier-view').hidden = false;
  $('metier-view').scrollTop = 0;
}

async function closeMetierView(id) {
  const firstName = $('first-name').value.trim();
  const changed = id && id !== settings.metier;
  if (id && (changed || firstName !== (settings.firstName || '')))
    settings = await window.localia.saveSettings({ ...settings, metier: id, firstName });
  $('metier-view').hidden = true;
  delete document.body.dataset.onboarding;
  if (!$('metier-encrypt-row').hidden && $('metier-encrypt').checked) {
    $('metier-encrypt-row').hidden = true;
    const status = await window.localia.encryptionEnable();
    if (status.enabled)
      notice(
        localText(
          'Données chiffrées. Exportez maintenant la clé de secours (Confidentialité et sécurité → Données sur ce Mac) et gardez-la hors de ce Mac.',
        ),
      );
  }
  // Nouveau métier : le modèle le mieux noté pour ce métier devient le modèle actif, s'il est
  // installé (il reste modifiable dans les réglages avancés).
  if (changed) {
    const best = BENCH_METIERS[id] && metierAdvice(comparisons, BENCH_METIERS[id])?.best;
    if (best && installed(best.model) && $('model').value !== best.model) {
      selectModel(best.model);
      $('model').dispatchEvent(new Event('change'));
    }
  }
  applyMetier();
  if (isAdvanced()) openHome();
  else view('chat');
  // Premier lancement sans modèle : étape 2, le guide (choix et téléchargement d'un modèle).
  if (metierMode === 'first' && !models.length && !settings.guideDone)
    await openGuide().catch(() => {});
}

// Interface adaptée au métier : menu Tâche, onglets, nom du métier, accueil.
function applyMetier() {
  const metier = currentMetier();
  document.body.dataset.metier = metier.id;
  $('metier-name').textContent = metier.label;
  $('bibliography-tab').hidden = !metier.tools?.includes('bibliography');
  const select = $('task');
  const chosen = select.value;
  select.replaceChildren(new Option('Libre', ''));
  for (const group of metierTaskGroups(metier.id)) {
    const node = document.createElement('optgroup');
    node.label = group.label;
    for (const id of group.tasks) node.append(new Option(taskById(id).label, id));
    select.append(node);
  }
  // Tâche d'une conversation venue d'un autre métier : gardée, dans un groupe à part.
  const keep = chosen || conversationChoices(current).task;
  keepTaskOption(keep);
  select.value = keep || '';
  showTaskAdvice(false);
  render();
}

// Tâche d'une conversation absente du menu (autre métier) : ajoutée pour rester choisie.
function keepTaskOption(id) {
  const select = $('task');
  if (!id || [...select.options].some((o) => o.value === id) || !taskById(id)) return;
  const other = document.createElement('optgroup');
  other.label = 'Autre métier';
  other.append(new Option(taskById(id).label, id));
  select.append(other);
}

// Suggestions de l'accueil du métier (groupes Enseignant / Chercheur…), dans la copie affichée.
function fillSuggestions(box) {
  const metier = currentMetier();
  box.replaceChildren();
  // Accueil « Une question ? » : le titre de la question directe.
  const welcomeBox = box.closest('#welcome');
  welcomeBox.querySelector('h2').textContent = metier.simple
    ? 'Une question ?'
    : 'Que voulez-vous faire aujourd’hui ?';
  welcomeBox.querySelector('h2 + p').textContent = metier.simple
    ? 'Demandez à Localia. Vous pouvez joindre un document ou une photo.'
    : 'Rédigez, analysez un document ou posez une question : tout se passe sur cet ordinateur.';
  // Mode simple : salutation et quatre suggestions, sans groupes ni tâches communes.
  const simpleUi = !metier.simple && !isAdvanced();
  if (simpleUi) {
    greeting(welcomeBox.querySelector('h2'));
    welcomeBox.querySelector('h2 + p').textContent = 'Que puis-je faire pour vous ?';
  }
  const suggestions = simpleUi
    ? metier.suggestions.slice(0, 4).map((s) => ({ ...s, group: '' }))
    : metier.suggestions;
  const groups = [...new Set(suggestions.map((s) => s.group || ''))];
  for (const group of groups) {
    const section = element('div', 'suggestion-group');
    if (group) section.append(element('span', 'eyebrow', group.toUpperCase()));
    const row = element('div', 'suggestion-row');
    for (const s of suggestions.filter((x) => (x.group || '') === group)) {
      const button = element('button');
      button.type = 'button';
      button.append(element('strong', '', s.title));
      if (s.sub) button.append(element('span', '', s.sub));
      button.onclick = () => {
        const task = taskById(s.task);
        if (!metier.simple && [...$('task').options].some((o) => o.value === s.task)) {
          $('task').value = s.task;
          $('task').dispatchEvent(new Event('change'));
        }
        $('prompt').value = tr(s.prompt) || taskText(task, 2);
        $('prompt').focus();
      };
      row.append(button);
    }
    section.append(row);
    box.append(section);
  }
  // Bande « Pour tous les métiers » : tâches communes (sauf pour la question directe).
  if (metier.simple || simpleUi) return;
  const band = element('div', 'common-band');
  band.append(element('span', 'eyebrow', 'POUR TOUS LES MÉTIERS'));
  for (const id of COMMON_TASKS.filter((t) => t !== 'question')) {
    const task = taskById(id);
    const chip = element('button', 'chip', task.label);
    chip.type = 'button';
    chip.onclick = () => {
      keepTaskOption(id);
      $('task').value = id;
      $('task').dispatchEvent(new Event('change'));
      $('prompt').value = taskText(task, 2);
      $('prompt').focus();
    };
    band.append(chip);
  }
  box.append(band);
  const card = adviceCard(metier);
  if (card) box.before(card);
}

// Les modèles installés arrivent après le premier affichage : la carte est alors refaite.
modelListeners.push(() => {
  const old = document.querySelector('#messages .advice-card');
  const card = old && adviceCard(currentMetier());
  if (card) old.replaceWith(card);
});

// Métier de Localia → étiquette des séries « métiers » du Benchmark.
const BENCH_METIERS = {
  enseignement: 'Enseignement',
  sante: 'Santé',
  juridique: 'Juridique',
  administration: 'Administration',
  finance: 'Finance',
  entreprise: 'Entreprise',
  ingenierie: 'Ingénierie',
  communication: 'Communication',
};

// Carte « Modèle conseillé » de l'accueil : le modèle le plus juste sur ce métier d'après les
// séries notées du Benchmark, et un modèle plus sûr s'il invente nettement moins.
function adviceCard(metier) {
  const label = BENCH_METIERS[metier.id];
  const advice = label && metierAdvice(comparisons, label);
  if (!advice) return null;
  rememberFullNames(comparisons);
  const { best, ranked } = advice;
  const safer = ranked.find(
    (c) =>
      c !== best &&
      best.invention >= 0.2 &&
      c.invention <= (best.invention * 2) / 3 &&
      c.correct >= best.correct - 0.1,
  );
  const card = element('section', 'advice-card');
  const head = element('div', 'advice-head');
  head.innerHTML = '<i data-icon="cpu"></i>';
  head.append(element('span', '', 'Modèle conseillé'), element('strong', '', label));
  const body = element('div', 'advice-body');
  const left = element('div', 'advice-main');
  left.append(element('span', 'advice-model', shortModel(best.model)));
  left.append(element('p', 'muted', `Le plus juste des modèles notés sur ce métier.`));
  if (safer) {
    const line = element('p', 'advice-safer');
    line.append(
      element('span', '', 'Invente souvent. Plus sûr :'),
      ' ',
      element('strong', '', shortModel(safer.model)),
      ` (${pct(safer.correct)} · ${pct(safer.invention)})`,
    );
    left.append(line);
  }
  const stat = (name, value, ratio, kind) => {
    const cell = element('div', 'advice-stat ' + kind);
    const bar = element('span', 'advice-bar');
    bar.append(element('i'));
    bar.firstChild.style.width = Math.round(Math.min(1, Math.max(0, ratio)) * 100) + '%';
    cell.append(element('small', '', name), element('strong', '', value), bar);
    return cell;
  };
  const stats = element('div', 'advice-stats');
  stats.append(
    stat('Correctes', pct(best.correct), best.correct, 'ok'),
    stat('Inventions', pct(best.invention), best.invention, 'warn'),
    stat('Par réponse', secs(best.answerSeconds), (best.answerSeconds || 0) / 240, 'time'),
  );
  body.append(left, stats);
  const foot = element('div', 'advice-foot');
  foot.append(element('span', 'muted', `${best.n} réponses notées · Benchmark`));
  const choose = (model) => {
    if (!installed(model)) return element('span', 'muted', 'Pas installé sur cet ordinateur');
    if ($('model').value === model) return element('span', 'advice-chosen', 'Modèle actif');
    const button = element('button', '', 'Utiliser ce modèle');
    button.type = 'button';
    button.onclick = () => {
      selectModel(model);
      $('model').dispatchEvent(new Event('change'));
      render();
    };
    return button;
  };
  foot.append(choose(best.model));
  card.append(head, body, foot);
  placeIcons(card);
  return card;
}

function langButtons() {
  const lang = settings.lang || 'fr';
  $('lang-fr').setAttribute('aria-pressed', String(lang === 'fr'));
  $('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
}
for (const lang of ['fr', 'en'])
  $('lang-' + lang).onclick = guard(async () => {
    settings = await window.localia.saveSettings({ ...settings, lang });
    langButtons();
    if (typeof applyLanguage === 'function') applyLanguage();
  });

$('metier-switch').onclick = () => openMetierView('change');
$('metier-cancel').onclick = () => closeMetierView(null);
$('metier-continue').onclick = guard(() => closeMetierView(metierChoice));
// Passer le choix du métier : interface générale, modifiable plus tard (Profil et métier).
$('metier-skip').onclick = guard(() => quickQuestion(async () => $('prompt').focus()));
// Question directe, sans métier : écran le plus simple, et la question part tout de suite.
async function quickQuestion(then) {
  await closeMetierView('general');
  await then();
}
$('quick-send').onclick = guard(() =>
  quickQuestion(async () => {
    const text = $('quick-prompt').value.trim();
    $('quick-prompt').value = '';
    if (!text) return $('prompt').focus();
    $('prompt').value = text;
    if (models.length) $('composer').requestSubmit();
  }),
);
$('quick-prompt').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    $('quick-send').click();
  }
});
$('quick-attach').onclick = guard(() => quickQuestion(async () => $('attach').click()));
$('quick-photo').onclick = guard(() => quickQuestion(async () => $('photo').click()));
