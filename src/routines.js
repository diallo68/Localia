// Routines : traitements enregistrés, lancés par un déclencheur, avec un historique d'exécutions.
// Première routine : document ajouté à un projet → lecture du texte → synthèse sourcée par un
// modèle → résultat à relire. Les routines ne tournent que lorsque Localia est ouverte ; une
// exécution interrompue (Localia fermée, arrêt) est reprise au démarrage suivant.
// Chargé par le processus principal, l'interface et les tests.
const ROUTINE_TRIGGERS = ['document-ajoute'];
const RUN_STATES = ['en-attente', 'en-cours', 'a-relire', 'relu', 'erreur', 'arrete'];
const ROUTINE_STEPS = ['lecture', 'chargement', 'generation', 'verification'];
const ROUTINE_LIMITS = { routines: 50, runs: 300, text: 100000, name: 120 };

const shortText = (value, max) => (typeof value === 'string' ? value.slice(0, max) : undefined);
const isId = (value) => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);

function normalizeRoutines(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const routines = (Array.isArray(data.routines) ? data.routines : [])
    .slice(0, ROUTINE_LIMITS.routines)
    .map((r) => {
      if (!r || !isId(r.id)) throw new Error('Routine sans identifiant.');
      if (!ROUTINE_TRIGGERS.includes(r.trigger)) throw new Error('Déclencheur inconnu.');
      if (!isId(r.projectId)) throw new Error('Une routine doit viser un projet.');
      return {
        id: r.id,
        name: shortText(r.name, ROUTINE_LIMITS.name)?.trim() || 'Synthèse des nouveaux documents',
        trigger: r.trigger,
        projectId: r.projectId,
        model: shortText(r.model, 200) || null,
        enabled: r.enabled !== false,
        createdAt: shortText(r.createdAt, 40) || new Date().toISOString(),
      };
    });
  const runs = (Array.isArray(data.runs) ? data.runs : []).slice(-ROUTINE_LIMITS.runs).map((x) => {
    if (!x || !isId(x.id) || !isId(x.routineId)) throw new Error('Exécution invalide.');
    return {
      id: x.id,
      routineId: x.routineId,
      projectId: shortText(x.projectId, 100),
      docId: shortText(x.docId, 100),
      docName: shortText(x.docName, 200) || 'Document',
      state: RUN_STATES.includes(x.state) ? x.state : 'erreur',
      step: ROUTINE_STEPS.includes(x.step) ? x.step : undefined,
      model: shortText(x.model, 200),
      createdAt: shortText(x.createdAt, 40) || new Date().toISOString(),
      startedAt: shortText(x.startedAt, 40),
      endedAt: shortText(x.endedAt, 40),
      error: shortText(x.error, 1000),
      resumed: x.resumed === true || undefined,
      text: shortText(x.text, ROUTINE_LIMITS.text),
      checks: x.checks && typeof x.checks === 'object' ? x.checks : undefined,
    };
  });
  return {
    paused: data.paused === true,
    routines,
    runs,
    scheduled: scheduledSeries(data.scheduled),
  };
}
// Départ programmé d'une série du Benchmark : heure et série préparée, gardés jusqu'au départ.
function scheduledSeries(value) {
  if (!value || typeof value !== 'object' || typeof value.at !== 'string') return undefined;
  if (Number.isNaN(new Date(value.at).getTime())) return undefined;
  const template = value.template;
  if (!template || !Array.isArray(template.questions) || !Array.isArray(template.models))
    return undefined;
  if (JSON.stringify(template).length > 5_000_000) return undefined;
  return { at: value.at, template };
}

// Au démarrage : une exécution restée « en cours » (Localia fermée pendant le traitement) repart
// en attente, marquée comme reprise.
function resumeInterrupted(data) {
  for (const run of data.runs)
    if (run.state === 'en-cours') {
      run.state = 'en-attente';
      run.step = undefined;
      run.resumed = true;
    }
  return data;
}

// Exécutions créées pour des documents ajoutés à un projet (une par routine active du projet).
function runsForDocuments(data, projectId, documents, now = new Date().toISOString()) {
  const created = [];
  for (const routine of data.routines) {
    if (
      !routine.enabled ||
      routine.trigger !== 'document-ajoute' ||
      routine.projectId !== projectId
    )
      continue;
    for (const doc of documents)
      created.push({
        id: `${routine.id}-${doc.id}`.slice(0, 100),
        routineId: routine.id,
        projectId,
        docId: doc.id,
        docName: doc.name,
        state: 'en-attente',
        createdAt: now,
      });
  }
  const known = new Set(data.runs.map((r) => r.id));
  const fresh = created.filter((r) => !known.has(r.id));
  data.runs.push(...fresh);
  return fresh;
}

// Prochaine exécution à lancer : la plus ancienne en attente (rien si les routines sont suspendues).
const nextRun = (data) =>
  data.paused ? null : data.runs.find((r) => r.state === 'en-attente') || null;

// Consigne de la synthèse sourcée d'un document.
function routinePrompt(docName, lang = 'fr') {
  return lang === 'en'
    ? `Write a sourced summary of the document “${docName}” from the extracts below: the main points, the key figures and the conclusions, in at most 12 bullet points. After each point, cite the document and the place in square brackets, for example [${docName} — page 2]. Do not add anything that is not in the extracts; if something important is missing or unreadable, say so at the end.`
    : `Rédige une synthèse sourcée du document « ${docName} » à partir des extraits ci-dessous : points principaux, chiffres clés et conclusions, en 12 points au plus. Après chaque point, cite le document et l’endroit entre crochets, par exemple [${docName} — page 2]. N’ajoute rien qui ne figure pas dans les extraits ; si un élément important manque ou est illisible, dis-le à la fin.`;
}

if (typeof module !== 'undefined')
  module.exports = {
    ROUTINE_TRIGGERS,
    RUN_STATES,
    normalizeRoutines,
    resumeInterrupted,
    runsForDocuments,
    nextRun,
    routinePrompt,
  };
