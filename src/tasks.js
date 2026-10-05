// Types de tâches de l'assistant de recherche et choix du modèle d'après le Benchmark.
// Chargé comme script dans l'interface, et par le processus principal et les tests (CommonJS).
const TASKS = [
  {
    id: 'extraction',
    label: 'Extraire des informations d’un document',
    categories: ['Extraction', 'Pièges à invention'],
    instruction:
      'Réponds uniquement à partir du document fourni. Cite la page de chaque information. Si le document ne contient pas l’information demandée, réponds « Le document ne le précise pas » sans rien supposer.',
  },
  {
    id: 'relecture',
    label: 'Relire un article et repérer les incohérences',
    categories: ['Incohérences'],
    instruction:
      'Compare les chiffres, les tableaux, les citations et les références entre eux et avec le texte. Liste chaque incohérence avec les pages concernées. N’affirme pas qu’un passage est cohérent sans l’avoir vérifié.',
  },
  {
    id: 'synthese',
    label: 'Résumer',
    categories: ['Synthèse'],
    instruction: 'Résume fidèlement, sans ajouter de chiffre ni d’information absents du texte.',
  },
  {
    id: 'calcul',
    label: 'Calculer ou vérifier un calcul',
    categories: ['Calcul', 'Raisonnement'],
    instruction:
      'Écris chaque calcul en entier sous la forme « a × b = c », une opération par ligne, pour qu’il puisse être vérifié.',
    warning:
      'Aucun modèle n’est fiable en calcul : Localia refait chaque opération écrite dans la réponse.',
  },
  {
    id: 'redaction',
    label: 'Rédiger ou traduire',
    categories: ['Rédaction'],
    instruction:
      'Écris en français clair et correct. Utilise la terminologie scientifique exacte et n’invente aucune donnée.',
  },
  {
    id: 'code',
    label: 'Écrire ou corriger du code',
    categories: ['Code'],
    instruction: 'Donne un code complet et exécutable, puis explique brièvement ce qu’il fait.',
    warning:
      'Exécutez le code avant de vous y fier : les tests écrits par les modèles sont souvent faux.',
  },
  {
    id: 'fichiers',
    label: 'Organiser des fichiers (onglet Fichiers)',
    files: true, // proposé dans l'onglet Fichiers, pas dans les conversations
    categories: ['Actions sur fichiers'],
    instruction: [
      'Tu proposes un plan d’actions sur les fichiers du dossier décrit ; tu n’exécutes rien : l’utilisateur relit et valide chaque action.',
      'Réponds par une phrase de résumé, puis un seul bloc ```json de la forme :',
      '{"summary": "…", "actions": [',
      '  {"type": "create_folder", "path": "Articles/2023", "reason": "…"},',
      '  {"type": "move", "from": "article.pdf", "to": "Articles/2023/article.pdf", "reason": "…"},',
      '  {"type": "create_file", "path": "notes.md", "content": "…", "reason": "…"},',
      '  {"type": "trash", "path": "copie.tmp", "reason": "…"}',
      ']}',
      'Règles : les chemins partent de l’intérieur du dossier, exactement comme dans la liste, séparés par « / », sans jamais commencer par le nom du dossier lui-même (« 2021/a.pdf », pas « Articles/2021/a.pdf ») ; « move » sert aussi à renommer ; crée un dossier avant d’y déplacer des fichiers ; n’écrase jamais un fichier existant (si le nom de destination est déjà pris, choisis un autre nom) ; ne mets rien à la corbeille sans demande explicite ; seuls les fichiers .md, .txt et .csv peuvent être créés.',
      'Tu ne vois que les noms, tailles et types des fichiers, pas leur contenu : ne déduis pas le contenu d’un fichier de son nom sans le dire. Si la demande est ambiguë ou impossible, explique-le et renvoie une liste d’actions vide.',
    ].join('\n'),
    warning:
      'Le modèle ne fait que proposer : Localia vérifie chaque action et vous validez avant toute modification.',
  },
  {
    id: 'question',
    label: 'Question générale',
    categories: ['Honnêteté', 'Pièges à invention'],
    instruction:
      'Si tu ne connais pas la réponse ou si elle peut avoir changé depuis tes données d’entraînement, dis-le clairement au lieu de supposer.',
  },
];
const taskById = (id) => TASKS.find((t) => t.id === id) || null;
const MIN_ANSWERS = 2;
const RELIABLE_ANSWERS = 10; // questions distinctes notées

// Réponses notées d'un modèle pour une liste de catégories : précision, invention, temps médian.
// Une question posée plusieurs fois (répétitions, séries relancées) compte une seule fois :
// ses répétitions sont moyennées, pour que le nombre de questions reste honnête.
function taskMetrics(records, model, categories, valuesOf) {
  const byQuestion = new Map();
  const times = [];
  for (const record of records)
    for (const result of record.results) {
      if (result.model !== model || result.status !== 'done') continue;
      const question = record.questions[result.q];
      if (!categories.includes(question?.category)) continue;
      const v = valuesOf(result);
      if (!v || v.correct == null) continue;
      const key = question.prompt || question.label;
      if (!byQuestion.has(key)) byQuestion.set(key, []);
      byQuestion.get(key).push(v);
      if (result.stats?.totalMs) times.push(result.stats.totalMs / 1000);
    }
  if (!byQuestion.size) return null;
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const perQuestion = [...byQuestion.values()].map((list) => ({
    correct: mean(list.map((v) => v.correct)),
    invention: mean(list.map((v) => v.invention).filter((x) => x != null)),
  }));
  const sorted = [...times].sort((a, b) => a - b);
  const median = !sorted.length
    ? null
    : sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    model,
    n: perQuestion.length,
    correct: mean(perQuestion.map((q) => q.correct)),
    invention: mean(perQuestion.map((q) => q.invention).filter((x) => x != null)),
    medianSeconds: median,
  };
}

// Conseil par tâche : le modèle installé le plus précis (puis le moins inventif, puis le plus rapide),
// et le plus rapide parmi ceux qui perdent au plus 15 points de précision sans inventer davantage.
function recommendModels(records, installed, valuesOf) {
  return TASKS.map((task) => {
    const candidates = installed
      .map((model) => taskMetrics(records, model, task.categories, valuesOf))
      .filter((m) => m && m.n >= MIN_ANSWERS);
    if (!candidates.length) return { task, best: null, fast: null, candidates: [] };
    const ranked = [...candidates].sort(
      (a, b) =>
        b.correct - a.correct ||
        (a.invention ?? 1) - (b.invention ?? 1) ||
        (a.medianSeconds ?? Infinity) - (b.medianSeconds ?? Infinity),
    );
    const best = ranked[0];
    const fast = ranked
      .filter(
        (m) =>
          m !== best &&
          m.correct >= best.correct - 0.15 &&
          (m.invention ?? 1) <= (best.invention ?? 0) + 0.15 &&
          m.medianSeconds != null,
      )
      .sort((a, b) => a.medianSeconds - b.medianSeconds)
      .find((m) => best.medianSeconds == null || m.medianSeconds < best.medianSeconds * 0.75);
    return {
      task,
      best,
      fast: fast || null,
      candidates: ranked,
      reliable: best.n >= RELIABLE_ANSWERS,
    };
  });
}

if (typeof module !== 'undefined')
  module.exports = { TASKS, taskById, taskMetrics, recommendModels, MIN_ANSWERS, RELIABLE_ANSWERS };
