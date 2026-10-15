// Page « Automatisations » : routines (document ajouté → synthèse sourcée → à relire), file
// d'exécution, historique. Les exécutions se font une à une, quand le modèle est libre ; une
// conversation ou une série du Benchmark passe avant (la routine en cours reprend après).
let routinesData = { paused: false, routines: [], runs: [] };
let routinesLoaded = false;
let routineRunning = null; // exécution en cours
let routineYield = false; // arrêt demandé pour laisser passer une conversation
let openRunId = null;

const RUN_LABELS = {
  'en-attente': 'En attente',
  'en-cours': 'En cours',
  'a-relire': 'À relire',
  relu: 'Relu',
  erreur: 'Erreur',
  arrete: 'Arrêtée',
};
const STEP_LABELS = {
  lecture: 'lecture du document',
  chargement: 'chargement du modèle en mémoire',
  generation: 'rédaction de la synthèse',
  verification: 'vérification des citations',
};

async function loadRoutines() {
  try {
    routinesData = await window.localia.loadRoutines();
    routinesLoaded = true;
  } catch (error) {
    notice(error.message);
  }
  renderRoutines();
}
async function saveRoutines() {
  if (!routinesLoaded)
    throw new Error('Les routines n’ont pas pu être chargées : rien n’est enregistré.');
  routinesData = await window.localia.saveRoutines(routinesData);
  // L'exécution en cours garde son objet : celui de la liste relue est remplacé par lui.
  if (routineRunning) {
    const index = routinesData.runs.findIndex((r) => r.id === routineRunning.id);
    if (index >= 0) routinesData.runs[index] = routineRunning;
  }
  renderRoutines();
  if (!$('home-view').hidden) renderHome();
}

const routineById = (id) => routinesData.routines.find((r) => r.id === id) || null;
const runById = (id) => routinesData.runs.find((r) => r.id === id) || null;
// Modèle d'une routine : le sien s'il est installé, sinon celui des conversations.
const routineModel = (routine) =>
  routine?.model && installed(routine.model) ? routine.model : $('model').value || models[0]?.name;

// Déclencheur : documents ajoutés à un projet.
async function queueDocumentRoutines(projectId, documents) {
  if (!routinesLoaded) return;
  if (!runsForDocuments(routinesData, projectId, documents).length) return;
  await saveRoutines();
  pumpRoutines();
}

// Lance la prochaine exécution en attente si le modèle est libre.
let pumpTimer = null;
function pumpRoutines() {
  clearTimeout(pumpTimer);
  if (routineRunning || !routinesLoaded || !historyReady) return;
  const run = nextRun(routinesData);
  if (!run) return;
  if (!models.length) return renderRoutines();
  // Modèle occupé (conversation, série, lecture d'un fichier) : nouvel essai dans 3 secondes.
  if (chatting || comparing || importing || pulling) {
    pumpTimer = setTimeout(pumpRoutines, 3000);
    return;
  }
  executeRun(run).catch((error) => notice(error.message));
}
async function executeRun(run) {
  const routine = routineById(run.routineId);
  let busy = false;
  routineRunning = run;
  Object.assign(run, {
    state: 'en-cours',
    step: 'lecture',
    startedAt: new Date().toISOString(),
    endedAt: undefined,
    error: undefined,
    model: routineModel(routine),
  });
  try {
    await saveRoutines();
    if (!routine) throw new Error('La routine a été supprimée.');
    const result = await window.localia.run('routine', {
      model: run.model,
      projectId: run.projectId,
      docId: run.docId,
    });
    if (result.cancelled) {
      // Arrêt pour une conversation : l'exécution repart en attente ; arrêt demandé : arrêtée.
      run.state = routineYield ? 'en-attente' : 'arrete';
      if (routineYield) run.resumed = true;
      run.step = undefined;
      return;
    }
    run.text = result.text || '';
    if (!run.text.trim()) throw new Error('Le modèle n’a écrit aucune synthèse.');
    run.step = 'verification';
    renderRoutines();
    run.checks = await window.localia
      .verifyAnswer({ answer: run.text, question: '', projectId: run.projectId })
      .catch(() => undefined);
    run.state = 'a-relire';
    run.step = undefined;
  } catch (error) {
    run.step = undefined;
    // Modèle pris entre-temps par un autre traitement : l'exécution repart en attente.
    busy = /déjà en cours/.test(error.message);
    run.state = busy ? 'en-attente' : 'erreur';
    run.error = busy ? undefined : error.message;
  } finally {
    run.endedAt = new Date().toISOString();
    routineRunning = null;
    routineYield = false;
    await saveRoutines().catch((error) => notice(error.message));
    if (busy) pumpTimer = setTimeout(pumpRoutines, 3000);
    else pumpRoutines();
  }
}
// Avant une conversation ou une série : la routine en cours s'arrête et reprendra ensuite.
async function yieldRoutine() {
  if (!routineRunning) return;
  routineYield = true;
  await window.localia.cancel('routine').catch(() => {});
  for (let i = 0; i < 100 && routineRunning; i++) await new Promise((r) => setTimeout(r, 50));
}
window.localia.onProgress(({ kind, data }) => {
  if (kind === 'step' && data.task === 'routine' && routineRunning) {
    routineRunning.step = data.step;
    renderRoutines();
    if (!$('home-view').hidden) renderHome();
  }
});

function runTitle(run) {
  return `${tr('Synthèse de')} ${run.docName}`;
}
function runDetail(run) {
  const project = projectById(run.projectId)?.name || tr('projet supprimé');
  const parts = [project, shortDate(run.endedAt || run.startedAt || run.createdAt)];
  if (run.model) parts.push(run.model);
  if (run.state === 'en-cours' && run.step) parts.push(tr(STEP_LABELS[run.step]));
  if (run.resumed && run.state !== 'relu') parts.push(tr('reprise après interruption'));
  if (run.error) parts.push(run.error);
  return parts.filter(Boolean).join(' · ');
}
// Exécutions à relire ou en erreur (accueil, « À traiter »).
const runsToReview = () =>
  routinesData.runs.filter((r) => ['a-relire', 'erreur'].includes(r.state));

function renderRoutines() {
  // Activité : exécution en cours, file d'attente, pause.
  const waiting = routinesData.runs.filter((r) => r.state === 'en-attente').length;
  const activity = routineRunning
    ? `${tr('En cours')} : ${runTitle(routineRunning)} — ${tr(STEP_LABELS[routineRunning.step] || 'préparation')}…` +
      (waiting ? ` ${waiting} ${tr('en attente')}.` : '')
    : routinesData.paused
      ? `${tr('Routines suspendues')}${waiting ? ` : ${waiting} ${tr('en attente')}` : ''}.`
      : waiting && !models.length
        ? `${waiting} ${tr('en attente')} : ${tr('aucun modèle installé.')}`
        : waiting
          ? `${waiting} ${tr('en attente')} : ${tr('départ dès que le modèle est libre.')}`
          : tr('Aucun traitement en cours.');
  $('routine-activity-text').textContent = activity;
  $('routine-stop').hidden = !routineRunning;
  $('routines-pause').textContent = tr(
    routinesData.paused ? 'Reprendre les routines' : 'Suspendre les routines',
  );

  // Formulaire : projets et modèles.
  const projectSelect = $('routine-project');
  const previous = projectSelect.value;
  projectSelect.replaceChildren(new Option(tr('Projet surveillé…'), ''));
  for (const p of projects) projectSelect.add(new Option(p.name, p.id));
  projectSelect.value = projectById(previous) ? previous : '';
  const modelSelect = $('routine-model');
  const chosen = modelSelect.value;
  modelSelect.replaceChildren(new Option(tr('Modèle des conversations'), ''));
  for (const m of models) modelSelect.add(new Option(m.name, m.name));
  modelSelect.value = installed(chosen) ? chosen : '';

  const list = $('routines-list');
  list.replaceChildren();
  if (!routinesData.routines.length)
    list.append(element('p', 'muted', 'Aucune routine. Créez-en une ci-dessus.'));
  for (const routine of routinesData.routines) {
    const row = element('article', 'routine-row');
    const text = element('span', 'routine-text');
    const project = projectById(routine.projectId);
    text.append(
      element('strong', '', routine.name),
      element(
        'small',
        'muted',
        `${tr('Projet')} ${project ? `« ${project.name} »` : tr('supprimé')} · ${tr('quand un document est ajouté')} · ${routine.model || tr('modèle des conversations')}`,
      ),
    );
    const toggle = element('label', 'routine-toggle');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = routine.enabled;
    box.onchange = guard(async () => {
      routine.enabled = box.checked;
      await saveRoutines();
    });
    toggle.append(box, tr(' Active'));
    const existing = element('button', '', 'Lancer sur les documents existants');
    existing.type = 'button';
    existing.disabled = !project?.documents.length || !routine.enabled;
    existing.onclick = guard(async () => {
      const before = routinesData.runs.length;
      // Exécutions déjà faites pour ces documents : relancées seulement si l'utilisateur le demande.
      runsForDocuments(routinesData, routine.projectId, project.documents);
      const added = routinesData.runs.length - before;
      notice(
        added
          ? `${added} document(s) mis en attente.`
          : 'Ces documents ont déjà été traités : utilisez « Relancer » dans l’historique.',
      );
      await saveRoutines();
      pumpRoutines();
    });
    const remove = element('button', 'link-button danger', 'Supprimer');
    remove.type = 'button';
    remove.onclick = guard(async () => {
      if (!confirm(tr('Supprimer cette routine ? Son historique est conservé.'))) return;
      routinesData.routines = routinesData.routines.filter((r) => r !== routine);
      for (const run of routinesData.runs)
        if (run.routineId === routine.id && run.state === 'en-attente') run.state = 'arrete';
      await saveRoutines();
    });
    row.append(text, toggle, existing, remove);
    list.append(row);
  }

  const runs = $('runs-list');
  runs.replaceChildren();
  const ordered = [...routinesData.runs].reverse().slice(0, 100);
  if (!ordered.length) runs.append(element('p', 'muted', 'Aucune exécution pour l’instant.'));
  for (const run of ordered) {
    const row = element('button', `run-row state-${run.state}`);
    row.type = 'button';
    row.dataset.runId = run.id;
    row.append(
      element('span', 'run-state', tr(RUN_LABELS[run.state])),
      element('strong', '', runTitle(run)),
      element('small', 'muted', runDetail(run)),
    );
    row.onclick = () => openRun(run.id);
    runs.append(row);
  }
  showRun();
}

function openRun(id) {
  openRunId = id;
  view('routines');
  renderRoutines();
  $('run-detail').scrollIntoView({ block: 'nearest' });
}
function showRun() {
  const run = runById(openRunId);
  $('run-detail').hidden = !run;
  if (!run) return;
  $('run-title').textContent = runTitle(run);
  $('run-meta').textContent = `${tr(RUN_LABELS[run.state])} · ${runDetail(run)}`;
  if (run.text) showMarkdown($('run-text'), run.text);
  else
    $('run-text').textContent = tr(
      run.state === 'erreur' ? 'Aucune synthèse.' : 'Pas encore de résultat.',
    );
  $('run-checks').replaceChildren();
  const sources = sourcesPanel(run.checks?.sources);
  if (sources) $('run-checks').append(sources);
  const panel = checksPanel(run.checks);
  if (panel) $('run-checks').append(panel);
  $('run-reviewed').hidden = run.state !== 'a-relire';
  $('run-memory').hidden = !run.text || !projectById(run.projectId);
  $('run-retry').hidden = !['erreur', 'arrete', 'a-relire', 'relu'].includes(run.state);
}
$('run-close').onclick = () => {
  openRunId = null;
  showRun();
};
$('run-reviewed').onclick = guard(async () => {
  const run = runById(openRunId);
  if (!run) return;
  run.state = 'relu';
  await saveRoutines();
});
$('run-memory').onclick = guard(async () => {
  const run = runById(openRunId);
  const project = projectById(run?.projectId);
  if (!project) return;
  const saved = await reviewMemory(project, runTitle(run), run.text, {
    kind: 'routine',
    conversationTitle: routineById(run.routineId)?.name,
    model: run.model,
    at: new Date().toISOString(),
  });
  if (saved && run.state === 'a-relire') {
    run.state = 'relu';
    await saveRoutines();
  }
});
$('run-retry').onclick = guard(async () => {
  const run = runById(openRunId);
  if (!run) return;
  Object.assign(run, { state: 'en-attente', text: undefined, checks: undefined, error: undefined });
  await saveRoutines();
  pumpRoutines();
});
$('routine-stop').onclick = guard(async () => {
  routineYield = false;
  await window.localia.cancel('routine');
});
$('routines-pause').onclick = guard(async () => {
  routinesData.paused = !routinesData.paused;
  await saveRoutines();
  pumpRoutines();
});
$('routine-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const project = projectById($('routine-project').value);
  if (!project) throw new Error('Choisissez le projet à surveiller.');
  routinesData.routines.push({
    id: crypto.randomUUID(),
    name: `Synthèse des nouveaux documents de « ${project.name} »`.slice(0, 120),
    trigger: 'document-ajoute',
    projectId: project.id,
    model: $('routine-model').value || null,
    enabled: true,
    createdAt: new Date().toISOString(),
  });
  await saveRoutines();
  notice(
    `Routine créée : chaque document ajouté à « ${project.name} » sera résumé et vérifié, puis proposé à la relecture.`,
  );
});
$('routines-tab').onclick = () => {
  view('routines');
  renderRoutines();
};
modelListeners.push(() => {
  if (!$('routines-view').hidden) renderRoutines();
  pumpRoutines();
});
