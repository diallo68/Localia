// Onglet « Benchmark » : résultats agrégés de toutes les séries, notation à l'aveugle, exports.
const VERDICT_LABELS = {
  correct: 'Correct',
  partiel: 'Partiel',
  faux: 'Faux',
  'hors-sujet': 'Hors sujet',
};
const excludedGroups = new Set();
let blind = null;

const groupKey = (record) => record.groupId || record.id;
const selectedRecords = () => comparisons.filter((r) => !excludedGroups.has(groupKey(r)));
const shortModel = (name) => name.replace(/:latest$/, '');
const plusMinus = (s, format) =>
  s.mean == null ? '—' : format(s.mean) + (s.sd != null ? ' ± ' + format(s.sd) : '');
const pct = (v) => (v == null ? '—' : number(v * 100, 0) + ' %');
const secs = (v) => (v == null ? '—' : number(v, 0) + ' s');
const tps = (v) => (v == null ? '—' : number(v, 2));

function seriesGroups() {
  const groups = new Map();
  for (const record of comparisons) {
    const key = groupKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key, records]) => ({ key, records }));
}

function renderSeriesChoice() {
  const box = $('bench-series');
  for (const node of [...box.children]) if (node.tagName !== 'LEGEND') node.remove();
  const groups = seriesGroups();
  if (!groups.length) box.append(element('p', 'muted', 'Aucune série pour le moment.'));
  for (const { key, records } of groups) {
    const first = records[records.length - 1];
    const answers = records.flatMap((r) => r.results);
    const graded = answers.filter((r) => Object.keys(r.grades || {}).length).length;
    const label = element('label', 'check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !excludedGroups.has(key);
    input.onchange = () => {
      if (input.checked) excludedGroups.delete(key);
      else excludedGroups.add(key);
      renderBenchmark();
    };
    const name =
      first.title ||
      (first.questions.length === 1 ? first.questions[0].prompt.slice(0, 60) : 'Série');
    label.append(
      input,
      ` ${name} · ${new Date(first.date).toLocaleString('fr-FR')} · ${first.questions.length} question(s) × ${first.models.length} modèle(s) × ${records.length} répétition(s) · ${graded}/${answers.length} réponses notées`,
    );
    box.append(label);
  }
}

function renderGraderChoice(records) {
  const select = $('bench-grader');
  const previous = select.value || ALL_GRADERS;
  select.replaceChildren(new Option('Tous les correcteurs (moyenne)', ALL_GRADERS));
  for (const name of gradersOf(records)) select.add(new Option(name, name));
  select.value = [...select.options].some((o) => o.value === previous) ? previous : ALL_GRADERS;
  return select.value;
}

function chartWithExport(chart, fileName) {
  const button = element('button', 'chart-export', 'SVG');
  button.type = 'button';
  button.title = 'Exporter ce graphique en SVG';
  button.onclick = guard(async () => {
    const file = await window.localia.exportFile(fileName, 'svg', svgExport(chart));
    if (file) $('bench-status').textContent = `Graphique exporté : ${file}`;
  });
  chart.querySelector('figcaption').append(button);
  return chart;
}

function metricsTable(metrics) {
  const headers = [
    'Modèle',
    'Réponses',
    'Notées',
    'Précision (correct)',
    'Correct ou partiel',
    'Taux d’invention',
    'Note moyenne /5',
    'Temps moyen / réponse',
    'Temps médian',
    'Chargement',
    'Génération (tokens/s)',
    'Lecture (tokens/s)',
    'Tokens générés (moy.)',
    'Coupées',
    'Erreurs',
  ];
  const rows = metrics.map((m) => [
    m.model,
    `${m.answered}/${m.answers}`,
    m.graded,
    plusMinus(m.correct, pct),
    plusMinus(m.acceptable, pct),
    plusMinus(m.invention, pct),
    plusMinus(m.rating, (v) => number(v, 2)),
    plusMinus(m.answerSeconds, (v) => number(v, 0) + ' s'),
    secs(m.medianSeconds),
    plusMinus(m.loadSeconds, (v) => number(v, 0) + ' s'),
    plusMinus(m.generation, tps),
    plusMinus(m.reading, (v) => number(v, 1)),
    plusMinus(m.outputTokens, (v) => number(v, 0)),
    m.cut,
    m.errors,
  ]);
  return { headers, rows };
}

function scrollable(node) {
  const wrapper = element('div', 'table-scroll');
  wrapper.append(node);
  return wrapper;
}

function renderBenchmark() {
  if ($('benchmark-view').hidden) return;
  renderSeriesChoice();
  const records = selectedRecords();
  const grader = renderGraderChoice(records);
  const box = $('bench-results');
  box.replaceChildren();
  if (!records.length) {
    box.append(element('p', 'muted', 'Cochez au moins une série.'));
    return;
  }
  const metrics = modelMetrics(records, grader);
  const repetitions = Math.max(...metrics.map((m) => m.repetitions));
  box.append(element('h3', '', 'Résultats par modèle'));
  box.append(
    element(
      'p',
      'muted',
      repetitions > 1
        ? `Moyenne ± écart-type sur ${repetitions} répétitions.`
        : 'Une seule répétition : pas d’écart-type. Relancez la série avec plusieurs répétitions pour mesurer la variabilité.',
    ),
  );
  const { headers, rows } = metricsTable(metrics);
  const tableRow = element('div', 'input-row');
  const exportTable = element('button', '', 'Exporter ce tableau (CSV)');
  exportTable.type = 'button';
  exportTable.onclick = guard(async () => {
    const file = await window.localia.exportFile(
      'benchmark-tableau',
      'csv',
      toCsv([headers, ...rows]),
    );
    if (file) $('bench-status').textContent = `Tableau exporté : ${file}`;
  });
  tableRow.append(exportTable);
  box.append(scrollable(table(headers, rows)), tableRow);

  // Tableau de décision : modèle conseillé pour chaque type de tâche de l'assistant.
  const decisions = recommendModels(
    records,
    metrics.map((m) => m.model),
    (r) => gradeValues(r, grader),
  );
  box.append(element('h3', '', 'Quel modèle pour quelle tâche ?'));
  box.append(
    element(
      'p',
      'muted',
      'Le plus précis, puis le moins inventif, puis le plus rapide, d’après les réponses notées des catégories de chaque tâche. Ce tableau alimente le menu « Tâche » des conversations. En dessous de 10 réponses notées, le conseil reste indicatif.',
    ),
  );
  box.append(
    scrollable(
      table(
        [
          'Tâche',
          'Modèle conseillé',
          'Précision',
          'Invention',
          'Temps médian',
          'Plus rapide et presque aussi fiable',
          'Réponses notées',
          'Conseil',
        ],
        decisions.map(({ task, best, fast, reliable }) =>
          best
            ? [
                task.label,
                { text: shortModel(best.model), className: 'best' },
                pct(best.correct),
                pct(best.invention),
                secs(best.medianSeconds),
                fast
                  ? `${shortModel(fast.model)} (${pct(fast.correct)}, ${secs(fast.medianSeconds)})`
                  : '—',
                best.n,
                best.correct < 0.5 ? 'faible (< 50 %)' : reliable ? 'solide' : 'indicatif',
              ]
            : [task.label, '—', '—', '—', '—', '—', 0, 'pas assez de données'],
        ),
      ),
    ),
  );

  const labels = (m) => shortModel(m.model);
  const charts = element('div', 'charts');
  charts.append(
    chartWithExport(
      barChart({
        title: 'Précision (réponses correctes)',
        note: 'Part des réponses jugées correctes. Moustaches : écart-type entre répétitions.',
        max: 1,
        rows: metrics.map((m) => ({
          label: labels(m),
          value: m.correct.mean,
          sd: m.correct.sd,
          text: plusMinus(m.correct, pct),
        })),
      }),
      'precision',
    ),
    chartWithExport(
      barChart({
        title: 'Taux d’invention',
        note: 'Part des réponses contenant un fait faux présenté comme vrai.',
        max: 1,
        rows: metrics.map((m) => ({
          label: labels(m),
          value: m.invention.mean,
          sd: m.invention.sd,
          text: plusMinus(m.invention, pct),
        })),
      }),
      'invention',
    ),
    chartWithExport(
      barChart({
        title: 'Note moyenne (sur 5)',
        max: 5,
        rows: metrics.map((m) => ({
          label: labels(m),
          value: m.rating.mean,
          sd: m.rating.sd,
          text: plusMinus(m.rating, (v) => number(v, 2)),
        })),
      }),
      'note',
    ),
    chartWithExport(
      barChart({
        title: 'Vitesse de génération',
        note: 'Tokens générés par seconde (mesure d’Ollama).',
        rows: metrics.map((m) => ({
          label: labels(m),
          value: m.generation.mean,
          sd: m.generation.sd,
          text: plusMinus(m.generation, tps),
        })),
      }),
      'vitesse',
    ),
    chartWithExport(
      scatterChart({
        title: 'Qualité et vitesse',
        note: 'En haut à droite : précis et rapide.',
        xLabel: 'Génération (tokens/s)',
        yLabel: 'Précision',
        xFormat: (v) => number(v, 1),
        yFormat: pct,
        points: metrics.map((m) => ({ label: labels(m), x: m.generation.mean, y: m.correct.mean })),
      }),
      'qualite-vitesse',
    ),
    chartWithExport(
      stripChart({
        title: 'Temps de réponse',
        note: 'Un point par réponse, trait : médiane. Chargement inclus.',
        // Décimales seulement pour des durées courtes.
        format: (v) =>
          number(v, Math.max(...metrics.flatMap((m) => m.times), 0) < 10 ? 1 : 0) + ' s',
        rows: metrics.map((m) => ({ label: labels(m), values: m.times, median: m.medianSeconds })),
      }),
      'temps',
    ),
  );
  box.append(element('h3', '', 'Graphiques'), charts);

  const cells = categoryMetrics(records, grader);
  const categories = [...new Set(cells.map((c) => c.category))];
  if (categories.length) {
    const models = metrics.map((m) => m.model);
    box.append(
      heatmapTable({
        title: 'Précision par catégorie',
        note: 'Entre parenthèses : nombre de réponses notées.',
        rows: categories,
        columns: models.map(shortModel),
        cell: (category, label) => {
          const c = cells.find((x) => x.category === category && shortModel(x.model) === label);
          return c ? { value: c.correct, n: c.n } : null;
        },
        format: pct,
      }),
    );
  }

  // Vérifications automatiques : alertes relevées sans modèle, par modèle.
  const checked = records.flatMap((r) => r.results.filter((x) => x.status === 'done' && x.checks));
  if (checked.length) {
    box.append(element('h3', '', 'Vérifications automatiques'));
    box.append(
      element(
        'p',
        'muted',
        'Calculs refaits, références de pages, citations et chiffres comparés au document, sans modèle. Lancez « Vérifier les réponses » à l’étape 1 (Lancer une série) pour les séries plus anciennes.',
      ),
    );
    box.append(
      scrollable(
        table(
          [
            'Modèle',
            'Réponses vérifiées',
            'Avec alerte',
            'Calculs faux',
            'Calculs justes',
            'Références impossibles',
            'Citations introuvables',
            'Citations retrouvées',
            'Plans illisibles',
            'Actions impossibles',
          ],
          metrics.map(({ model }) => {
            const list = checked.filter((r) => r.model === model).map((r) => r.checks);
            const count = (fn) => list.reduce((n, c) => n + fn(c), 0);
            const wrong = (c) => (c.calculations || []).filter((x) => !x.ok).length;
            const missing = (c) => (c.quotes || []).filter((q) => !q.found.length).length;
            const badPlan = (c) => (c.plan ? (c.plan.readable ? 0 : 1) + c.plan.invalid.length : 0);
            return [
              model,
              list.length,
              list.filter((c) => wrong(c) + (c.pages || []).length + missing(c) + badPlan(c) > 0)
                .length,
              count(wrong),
              count((c) => (c.calculations || []).filter((x) => x.ok).length),
              count((c) => (c.pages || []).length),
              count(missing),
              count((c) => (c.quotes || []).filter((q) => q.found.length).length),
              count((c) => (c.plan && !c.plan.readable ? 1 : 0)),
              count((c) => c.plan?.invalid.length || 0),
            ];
          }),
        ),
      ),
    );
  }

  const stability = stabilityMetrics(records, grader);
  box.append(element('h3', '', 'Stabilité entre répétitions'));
  if (!stability.length)
    box.append(
      element(
        'p',
        'muted',
        'Aucune série répétée. Choisissez 2 ou 3 répétitions à l’étape 1 (Lancer une série).',
      ),
    );
  else
    box.append(
      table(
        [
          'Modèle',
          'Questions comparées',
          'Réponses identiques',
          'Verdict changé',
          'Écart-type des notes',
        ],
        stability.map((s) => [
          s.model,
          s.questions,
          pct(s.identical),
          pct(s.verdictChanges),
          s.ratingSd == null ? '—' : number(s.ratingSd, 2),
        ]),
      ),
    );

  const graders = gradersOf(records);
  if (graders.length >= 2) {
    box.append(element('h3', '', 'Accord entre correcteurs'));
    const pairs = [];
    for (let i = 0; i < graders.length; i++)
      for (let j = i + 1; j < graders.length; j++) pairs.push([graders[i], graders[j]]);
    box.append(
      table(
        [
          'Correcteurs',
          'Réponses notées par les deux',
          'Même verdict',
          'Kappa de Cohen',
          'Même avis sur l’invention',
          'Écart moyen des notes',
        ],
        pairs.map(([a, b]) => {
          const r = agreement(records, a, b);
          return [
            `${a} / ${b}`,
            r.pairs,
            pct(r.verdictAgreement),
            r.kappa == null ? '—' : number(r.kappa, 2),
            pct(r.inventionAgreement),
            r.ratingDifference == null ? '—' : number(r.ratingDifference, 2),
          ];
        }),
      ),
    );
  }

  if (graders.length >= 2) {
    // Mêmes indicateurs, calculés séparément pour chaque correcteur.
    const perGrader = graders
      .slice(0, 3)
      .map((name) => ({ name, metrics: modelMetrics(records, name) }));
    const models = metrics.map((m) => m.model);
    const values = (key) =>
      perGrader.map(({ name, metrics: list }) => ({
        name,
        values: models.map((model) => list.find((m) => m.model === model)?.[key].mean ?? null),
      }));
    box.append(element('h3', '', 'Comparaison des correcteurs'));
    if (graders.length > 3)
      box.append(
        element(
          'p',
          'muted',
          `Graphiques limités aux 3 premiers correcteurs : ${graders.slice(0, 3).join(', ')}.`,
        ),
      );
    const charts = element('div', 'charts');
    charts.append(
      chartWithExport(
        groupedBarChart({
          title: 'Précision selon le correcteur',
          note: 'Part des réponses jugées correctes par chaque correcteur.',
          labels: models.map(shortModel),
          series: values('correct'),
          max: 1,
          format: pct,
        }),
        'precision-correcteurs',
      ),
      chartWithExport(
        groupedBarChart({
          title: 'Taux d’invention selon le correcteur',
          note: 'Part des réponses contenant un fait faux, selon chaque correcteur.',
          labels: models.map(shortModel),
          series: values('invention'),
          max: 1,
          format: pct,
        }),
        'invention-correcteurs',
      ),
      chartWithExport(
        groupedBarChart({
          title: 'Note moyenne selon le correcteur',
          labels: models.map(shortModel),
          series: values('rating'),
          max: 5,
          format: (v) => number(v, 2),
        }),
        'note-correcteurs',
      ),
    );
    box.append(charts);
  }

  box.append(element('h3', '', 'Conditions de l’expérience'));
  const conditions = element('pre', 'conditions');
  conditions.textContent = conditionsMarkdown(records);
  box.append(conditions);
}

// Description de l'environnement et des réglages, au format Markdown (annexe d'un article).
function conditionsMarkdown(records) {
  const lines = ['# Conditions de l’expérience', ''];
  const dates = records.map((r) => r.date).sort();
  lines.push(
    `- Séries : ${records.length} (du ${dates[0]?.slice(0, 10)} au ${dates.at(-1)?.slice(0, 10)})`,
  );
  const envs = records.map((r) => r.env).filter(Boolean);
  if (envs.length < records.length)
    lines.push(
      `- Environnement non enregistré pour ${records.length - envs.length} série(s) antérieure(s) à cette fonction.`,
    );
  const env = envs[0];
  const resumed = records.filter((r) => r.resumes?.length);
  if (resumed.length)
    lines.push(
      `- Séries mises en pause puis reprises : ${resumed.length} (reprises le ${resumed
        .flatMap((r) => r.resumes.map((x) => x.at.slice(0, 16).replace('T', ' à ')))
        .join(', ')} UTC) ; une réponse interrompue est refaite entièrement.`,
    );
  const later = records.filter((r) => r.env?.afterTheFact).length;
  if (later)
    lines.push(
      `- Environnement relevé après coup pour ${later} série(s) (même machine, même version d’Ollama et mêmes empreintes de modèles au moment du relevé).`,
    );
  if (env) {
    lines.push(
      `- Localia ${env.localia} · Ollama ${env.ollama ?? 'inconnu'}`,
      `- Machine : ${env.machine.cpu ?? '?'} (${env.machine.physicalCores ?? '?'} cœurs physiques, ${env.machine.logicalCores} logiques), ${env.machine.memoryGB} Go, ${env.machine.arch}, ${env.machine.os ?? (env.machine.macos ? `macOS ${env.machine.macos}` : '?')}`,
      '- Inférence locale sur processeur, une requête à la fois ; chaque modèle traite toutes les questions puis il est déchargé.',
    );
  }
  const docs = [...new Set(records.map((r) => r.document?.name).filter(Boolean))];
  lines.push(`- Documents : ${docs.length ? docs.join(', ') : 'aucun'}`);
  const questionCount = new Set(
    records.flatMap((r) => r.questions.map((q) => q.label + '\u0000' + q.prompt)),
  ).size;
  lines.push(`- Questions distinctes : ${questionCount}`);
  lines.push(
    '',
    '## Modèles',
    '',
    '| Modèle | Famille | Taille | Quantification | Empreinte (digest) | Réglages utilisés |',
    '|---|---|---|---|---|---|',
  );
  const models = [...new Set(records.flatMap((r) => r.models))];
  for (const model of models) {
    const info = envs.map((e) => e.models?.[model]).find(Boolean);
    const used = [
      ...new Set(
        records.flatMap((r) =>
          r.results.filter((x) => x.model === model && x.used).map((x) => JSON.stringify(x.used)),
        ),
      ),
    ]
      .map((u) => usedText(JSON.parse(u)).replace(/^Réglages : /, ''))
      .join(' / ');
    lines.push(
      `| ${model} | ${info?.family ?? '—'} | ${info?.parameterSize ?? '—'} | ${info?.quantization ?? '—'} | ${info?.digest ? info.digest.slice(0, 12) : '—'} | ${used || '—'} |`,
    );
  }
  lines.push(
    '',
    '## Mesures',
    '',
    '- Temps, tokens et vitesses : valeurs renvoyées par Ollama (total_duration, load_duration, prompt_eval_*, eval_*).',
    '- Précision : part des réponses jugées « correctes » ; taux d’invention : part des réponses contenant un fait faux présenté comme vrai.',
    '- Écart-type d’échantillon (n − 1) entre répétitions ; accord entre correcteurs : kappa de Cohen sur le verdict.',
  );
  const graders = gradersOf(records);
  lines.push(`- Correcteurs : ${graders.length ? graders.join(', ') : 'aucun'}`);
  return lines.join('\n');
}

// Données brutes : une ligne par réponse, avec les notes de chaque correcteur.
function rawRows(records) {
  const graders = gradersOf(records);
  const header = [
    'Série',
    'Groupe',
    'Répétition',
    'Date',
    'Titre',
    'Document',
    'Question',
    'Catégorie',
    'Modèle',
    'Empreinte',
    'État',
    'Temps total (s)',
    'Chargement (s)',
    'Tokens lus',
    'Lecture (tokens/s)',
    'Tokens générés',
    'Génération (tokens/s)',
    'Coupée',
    'Réglages',
    'Calculs faux (auto)',
    'Références impossibles (auto)',
    'Citations introuvables (auto)',
    'Actions impossibles ou plan illisible (auto)',
    ...graders.flatMap((g) => [
      `Verdict (${g})`,
      `Invention (${g})`,
      `Note (${g})`,
      `Commentaire (${g})`,
    ]),
    'Question posée',
    'Réponse attendue',
    'Réponse',
  ];
  const rows = [header];
  for (const record of records)
    for (const r of record.results) {
      const q = record.questions[r.q];
      const s = r.stats || {};
      const value = (v, digits = 2) => (v == null ? '' : number(v, digits));
      rows.push([
        record.id,
        record.groupId || record.id,
        record.repetition || 1,
        record.date,
        record.title || '',
        record.document?.name || '',
        q.label,
        q.category || '',
        r.model,
        record.env?.models?.[r.model]?.digest || '',
        STATUS[r.status] || r.status,
        value(s.totalMs != null ? s.totalMs / 1000 : null, 1),
        value(s.loadMs != null ? s.loadMs / 1000 : null, 1),
        s.promptTokens ?? '',
        value(speed(s.promptTokens, s.promptMs)),
        s.outputTokens ?? '',
        value(speed(s.outputTokens, s.outputMs)),
        s.doneReason === 'length' ? 'oui' : '',
        r.used ? JSON.stringify(r.used) : '',
        r.checks ? (r.checks.calculations || []).filter((x) => !x.ok).length : '',
        r.checks ? (r.checks.pages || []).length : '',
        r.checks ? (r.checks.quotes || []).filter((x) => !x.found.length).length : '',
        r.checks?.plan ? (r.checks.plan.readable ? 0 : 1) + r.checks.plan.invalid.length : '',
        ...graders.flatMap((g) => {
          const grade = r.grades?.[g];
          return grade
            ? [
                VERDICT_LABELS[grade.verdict] || '',
                grade.verdict ? (grade.invention ? 'oui' : 'non') : '',
                grade.rating ?? '',
                grade.comment || '',
              ]
            : ['', '', '', ''];
        }),
        q.prompt,
        q.expected || '',
        r.text || r.error || '',
      ]);
    }
  return rows;
}

// Fiche à remplir par un correcteur, puis à réimporter.
function gradingSheet(records) {
  const rows = [[...GRADE_COLUMNS, 'Question posée', 'Réponse attendue', 'Réponse']];
  for (const record of records)
    for (const r of record.results.filter((x) => x.status === 'done'))
      rows.push([
        record.id,
        record.questions[r.q].label,
        r.model,
        '',
        '',
        '',
        '',
        '',
        record.questions[r.q].prompt,
        record.questions[r.q].expected || '',
        r.text || '',
      ]);
  return rows;
}

// Notation à l'aveugle : réponses présentées dans un ordre aléatoire, sans le nom du modèle.
function startBlind() {
  const grader = ($('bench-grader-name').value || '').trim().slice(0, 40) || YOU;
  const queue = selectedRecords().flatMap((record) =>
    record.results
      .filter((r) => r.status === 'done' && !r.grades?.[grader]?.verdict)
      .map((result) => ({ record, result })),
  );
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (!queue.length) {
    $('bench-status').textContent =
      `Toutes les réponses des séries cochées sont déjà notées par « ${grader} ».`;
    return;
  }
  blind = { grader, queue, index: 0, total: queue.length };
  $('bench-blind').hidden = false;
  $('bench-results').hidden = true;
  showBlind();
}
function showBlind() {
  const { record, result } = blind.queue[blind.index];
  const question = record.questions[result.q];
  $('blind-progress').textContent =
    `Réponse ${blind.index + 1} sur ${blind.total} · correcteur : ${blind.grader}`;
  $('blind-question').textContent =
    `${question.label}${question.category ? ' · ' + question.category : ''}\n${question.prompt}`;
  $('blind-expected').textContent =
    question.expected || 'Aucune réponse attendue pour cette question.';
  $('blind-expected-box').open = false;
  showMarkdown($('blind-answer'), result.text || '');
  const form = $('blind-form');
  form.reset();
  const previous = result.grades?.[blind.grader];
  if (previous?.rating) form.elements.rating.value = String(previous.rating);
  $('blind-answer').scrollTop = 0;
}
function endBlind() {
  blind = null;
  $('bench-blind').hidden = true;
  $('bench-results').hidden = false;
  renderBenchmark();
}
$('blind-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const form = $('blind-form');
  const verdict = form.elements.verdict.value;
  if (!verdict) throw new Error('Choisissez un verdict.');
  const { result } = blind.queue[blind.index];
  result.grades = {
    ...result.grades,
    [blind.grader]: {
      verdict,
      invention: form.elements.invention.checked,
      rating: form.elements.rating.value ? Number(form.elements.rating.value) : null,
      comment: form.elements.comment.value.trim().slice(0, 2000),
      at: new Date().toISOString(),
    },
  };
  await persistComparisons();
  notice('');
  blind.index++;
  if (blind.index >= blind.total) endBlind();
  else showBlind();
});
$('blind-skip').onclick = () => {
  blind.index++;
  if (blind.index >= blind.total) endBlind();
  else showBlind();
};
$('blind-stop').onclick = endBlind;

$('benchmark-tab').onclick = () => {
  view('benchmark');
  renderBenchmark();
};
$('bench-grader').onchange = renderBenchmark;
$('bench-grade').onclick = guard(async () => startBlind());
$('bench-import').onclick = guard(async () => {
  const file = await window.localia.openGrades();
  if (!file) return;
  const { applied, rejected } = applyGrades(comparisons, file.text);
  await persistComparisons();
  renderBenchmark();
  $('bench-status').textContent =
    `${applied} note(s) importée(s) depuis ${file.name}.` +
    (rejected.length
      ? ` ${rejected.length} ligne(s) refusée(s) : ${rejected.slice(0, 5).join(' ; ')}${rejected.length > 5 ? '…' : ''}`
      : '');
});
const stamp = () => new Date().toISOString().slice(0, 10);
$('bench-export-csv').onclick = guard(async () => {
  const file = await window.localia.exportFile(
    `benchmark-donnees-${stamp()}`,
    'csv',
    toCsv(rawRows(selectedRecords())),
  );
  if (file) $('bench-status').textContent = `Données exportées : ${file}`;
});
$('bench-export-json').onclick = guard(async () => {
  const data = {
    exportedAt: new Date().toISOString(),
    format: 'localia-benchmark-1',
    series: selectedRecords(),
  };
  const file = await window.localia.exportFile(
    `benchmark-donnees-${stamp()}`,
    'json',
    JSON.stringify(data, null, 2),
  );
  if (file) $('bench-status').textContent = `Données exportées : ${file}`;
});
$('bench-export-md').onclick = guard(async () => {
  const file = await window.localia.exportFile(
    `conditions-experience-${stamp()}`,
    'md',
    conditionsMarkdown(selectedRecords()),
  );
  if (file) $('bench-status').textContent = `Conditions exportées : ${file}`;
});
$('bench-export-sheet').onclick = guard(async () => {
  const file = await window.localia.exportFile(
    `fiche-notation-${stamp()}`,
    'csv',
    toCsv(gradingSheet(selectedRecords())),
  );
  if (file) $('bench-status').textContent = `Fiche de notation exportée : ${file}`;
});
