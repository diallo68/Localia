// Écran « Mon profil » : domaines d'activité (plusieurs, dont un principal), sujets, attentes et
// priorité. Rien n'est changé avant « Enregistrer » ; « Annuler » revient au profil enregistré.
// Le domaine principal est le métier de Localia (tâches, modèle conseillé, accueil).
const PROFILE_GOAL_LABELS = [
  ['rediger', 'Rédiger'],
  ['resumer', 'Résumer'],
  ['verifier', 'Vérifier'],
  ['chercher', 'Chercher dans mes documents'],
  ['traduire', 'Traduire'],
  ['calculer', 'Calculer'],
  ['coder', 'Coder'],
];
const PROFILE_PRIORITY_LABELS = [
  ['rapidite', 'Rapidité'],
  ['equilibre', 'Équilibre'],
  ['qualite', 'Qualité'],
];
let profileDraft = null;

// Profil enregistré, complété par le métier et le prénom déjà connus.
function savedProfile() {
  const p = settings.profile || {};
  // Sans profil : le métier de la session sert de point de départ (sauf « Général »).
  const domains = p.domains?.length
    ? p.domains
    : settings.metier && settings.metier !== 'general'
      ? [settings.metier]
      : [];
  return {
    firstName: settings.firstName || '',
    domains: [...domains],
    topics: p.topics || '',
    goals: [...(p.goals || [])],
    priority: p.priority || 'equilibre',
  };
}
const profileDomains = () => METIERS.filter((m) => !m.simple && m.id !== 'general');
const sameProfile = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function chip(label, pressed, onClick) {
  const b = element('button', 'profile-chip', tr(label));
  b.type = 'button';
  b.setAttribute('aria-pressed', String(pressed));
  b.onclick = onClick;
  return b;
}

function renderProfile() {
  const d = profileDraft;
  $('profile-name').value = d.firstName;
  $('profile-topics').value = d.topics;
  $('profile-domains').replaceChildren(
    ...profileDomains().map((m) =>
      chip(m.label, d.domains.includes(m.id), () => {
        d.domains = d.domains.includes(m.id)
          ? d.domains.filter((x) => x !== m.id)
          : [...d.domains, m.id];
        renderProfile();
      }),
    ),
  );
  const main = $('profile-main');
  main.replaceChildren(
    ...(d.domains.length
      ? d.domains.map((id) => new Option(tr(metierById(id).label), id))
      : [new Option(tr('Choisissez au moins un domaine'), '')]),
  );
  main.value = d.domains[0] || '';
  main.disabled = d.domains.length < 2;
  $('profile-goals').replaceChildren(
    ...PROFILE_GOAL_LABELS.map(([id, label]) =>
      chip(label, d.goals.includes(id), () => {
        d.goals = d.goals.includes(id) ? d.goals.filter((x) => x !== id) : [...d.goals, id];
        renderProfile();
      }),
    ),
  );
  $('profile-priority').replaceChildren(
    ...PROFILE_PRIORITY_LABELS.map(([id, label]) =>
      chip(label, d.priority === id, () => {
        d.priority = id;
        renderProfile();
      }),
    ),
  );
  const dirty = !sameProfile(d, savedProfile());
  $('profile-dirty').hidden = !dirty;
  $('profile-save').disabled = !dirty || !d.domains.length;
  $('profile-cancel').disabled = !dirty;
  renderProfileModels();
}

// Modèle conseillé pour un domaine : le mieux noté dans les séries du Benchmark de l'utilisateur,
// sinon le conseil selon l'ordinateur ; « Rapidité » prend le plus léger des modèles qui conviennent.
function profileAdvice(id, priority) {
  const label = BENCH_METIERS[id];
  const bench = label ? metierAdvice(comparisons, label)?.best : null;
  if (bench) return { name: bench.model, why: tr('le mieux noté dans vos séries du Benchmark') };
  if (!computer) return null;
  const advice = recommendFor({ ...computer, metier: id });
  let best = advice.best;
  if (priority === 'rapidite')
    best = [advice.best, ...advice.alternatives].sort((a, b) => a.size - b.size)[0];
  return {
    name: 'integre/' + best.id,
    label: best.label,
    size: best.size,
    why: tr('selon la mémoire de cet ordinateur'),
  };
}

function renderProfileModels() {
  const box = $('profile-models');
  const d = profileDraft;
  if (!d.domains.length) {
    box.replaceChildren(element('p', 'muted', tr('Choisissez au moins un domaine.')));
    return;
  }
  const rows = [];
  for (const id of d.domains) {
    const advice = profileAdvice(id, d.priority);
    const row = element('div', 'profile-model');
    row.append(element('strong', '', tr(metierById(id).label)));
    if (!advice) {
      row.append(element('span', 'muted', tr('Analyse de l’ordinateur en cours…')));
      rows.push(row);
      continue;
    }
    const name = advice.label || advice.name.replace(/^integre\//, '');
    const have = models.some((m) => m.name === advice.name);
    row.append(
      element('span', 'tag', name),
      element(
        'small',
        'muted',
        [advice.size ? `${(advice.size / 1e9).toFixed(1)} Go` : '', advice.why]
          .filter(Boolean)
          .join(' · '),
      ),
      element('small', have ? 'ok' : 'muted', have ? tr('installé') : tr('à installer')),
    );
    rows.push(row);
  }
  const missing = d.domains
    .map((id) => profileAdvice(id, d.priority))
    .filter((a) => a && !models.some((m) => m.name === a.name));
  if (missing.length) {
    const open = element('button', '', tr('Ouvrir la Bibliothèque pour les installer'));
    open.type = 'button';
    open.onclick = () => $('models-tab').click();
    rows.push(open);
  }
  box.replaceChildren(...rows);
}

async function openProfile() {
  profileDraft = savedProfile();
  view('profile');
  renderProfile();
  const c = await loadComputer().catch(() => null);
  if (c)
    $('profile-computer').textContent =
      `${c.platform === 'darwin' ? 'Mac' : c.platform === 'win32' ? 'PC Windows' : 'Linux'}` +
      `${c.arch === 'arm64' ? (c.platform === 'darwin' ? ' à puce Apple' : ' ARM') : ''}` +
      ` · ${c.memoryGB} Go de mémoire` +
      (c.freeDiskGB != null ? ` · ${Math.round(c.freeDiskGB)} Go libres` : '');
  if (profileDraft) renderProfileModels();
}

$('profile-tab').onclick = guard(openProfile);
$('simple-profile').onclick = guard(openProfile);
$('profile-name').oninput = () => {
  profileDraft.firstName = $('profile-name').value.trim().slice(0, 40);
  renderProfile();
};
$('profile-topics').oninput = () => {
  profileDraft.topics = $('profile-topics').value.slice(0, 400);
  const dirty = !sameProfile(profileDraft, savedProfile());
  $('profile-dirty').hidden = !dirty;
  $('profile-save').disabled = !dirty || !profileDraft.domains.length;
  $('profile-cancel').disabled = !dirty;
};
$('profile-main').onchange = () => {
  const id = $('profile-main').value;
  profileDraft.domains = [id, ...profileDraft.domains.filter((x) => x !== id)];
  renderProfile();
};
$('profile-cancel').onclick = () => {
  profileDraft = savedProfile();
  renderProfile();
};
$('profile-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const d = profileDraft;
  if (!d.domains.length) throw new Error(tr('Choisissez au moins un domaine.'));
  const changedMetier = d.domains[0] !== settings.metier;
  settings = await window.localia.saveSettings({
    ...settings,
    firstName: d.firstName,
    metier: d.domains[0],
    profile: { domains: d.domains, topics: d.topics.trim(), goals: d.goals, priority: d.priority },
  });
  profileDraft = savedProfile();
  renderProfile();
  // Nouveau domaine principal : tâches, accueil et modèle conseillé suivent (model-choice.js).
  if (changedMetier) applyAutoModel();
  applyMetier();
  notice(tr('Profil enregistré.'));
});
