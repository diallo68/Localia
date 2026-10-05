// Onglet « Comparaison » : une ou plusieurs questions envoyées à plusieurs modèles.
// Chaque modèle traite toutes les questions à la suite, puis il est déchargé.
let comparisons = [],
  comparisonsLoaded = false,
  shown = null,
  shownQuestion = 0,
  compareDocument = null,
  compareTitle = null,
  compareTarget = null,
  compareNode = null,
  stopRequested = false;
const VERDICT_TEXT = {
  correct: 'correct',
  partiel: 'partiel',
  faux: 'faux',
  'hors-sujet': 'hors sujet',
};
const STATUS = {
  waiting: 'En attente',
  running: 'En cours…',
  done: 'Terminé',
  cancelled: 'Arrêté',
  error: 'Erreur',
  skipped: 'Non lancé',
};

// Les comparaisons d'avant les séries (une seule question) sont converties au chargement.
function upgrade(record) {
  if (!Array.isArray(record.questions)) {
    record.questions = [{ label: 'Q1', prompt: String(record.prompt || '') }];
    for (const r of record.results) r.q = 0;
    delete record.prompt;
  }
  if (!Array.isArray(record.models))
    record.models = [...new Set(record.results.map((r) => r.model))];
  // Ancienne note unique (étoiles) : devient la note du correcteur « Vous ».
  for (const r of record.results)
    if ('rating' in r) {
      if (Number.isInteger(r.rating))
        r.grades = { ...r.grades, Vous: { ...r.grades?.Vous, rating: r.rating } };
      delete r.rating;
    }
  return record;
}
const YOU = 'Vous';
// Note moyenne de tous les correcteurs pour une réponse (null si aucune).
const ratingOf = (r) => gradeValues(r, ALL_GRADERS)?.rating ?? null;
const starsText = (value) => (value == null ? '' : '★'.repeat(Math.round(value)));
function setYourRating(result, rating) {
  const grades = { ...result.grades };
  const yours = { ...grades[YOU], rating };
  if (rating == null) delete yours.rating;
  if (Object.keys(yours).length) grades[YOU] = yours;
  else delete grades[YOU];
  result.grades = grades;
}

async function loadComparisons() {
  try {
    const saved = await window.localia.loadComparisons();
    if (!Array.isArray(saved) || saved.some((c) => !Array.isArray(c?.results)))
      throw new Error('Comparaisons incompatibles. Le fichier est conservé.');
    for (const c of saved) {
      upgrade(c);
      // Une comparaison interrompue par la fermeture de l'application reste consultable.
      for (const r of c.results)
        if (['waiting', 'running'].includes(r.status)) r.status = 'skipped';
    }
    comparisons = saved;
    comparisonsLoaded = true;
    renderCompareHistory();
    return true;
  } catch (error) {
    notice(error.message);
    return false;
  }
}
const persistComparisons = async () => {
  if (comparisonsLoaded) await window.localia.saveComparisons(comparisons);
};
const referenced = (id) =>
  compareDocument?.id === id || comparisons.some((c) => c.document?.id === id);

const number = (value, digits = 1) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const seconds = (ms) =>
  typeof ms === 'number'
    ? (ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' s'
    : '—';
const duration = (ms) => {
  if (typeof ms !== 'number') return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? s + ' s' : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
};
const speedText = (tokens, ms) =>
  speed(tokens, ms) === null ? '—' : number(speed(tokens, ms)) + ' tokens/s';
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
// Départ programmé d'une série (heure, minuteur), déclaré tôt : lu par compareControls.
let scheduledStart = null;
const resultsOf = (record, q) => record.results.filter((r) => r.q === q);

function fillCompareModels() {
  const box = $('compare-models');
  const checked = new Set([...box.querySelectorAll('input:checked')].map((i) => i.value));
  for (const node of [...box.children]) if (node.tagName !== 'LEGEND') node.remove();
  if (!models.length) box.append(element('p', 'muted', 'Aucun modèle installé.'));
  for (const m of models) {
    const label = element('label', 'check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = m.name;
    input.checked = checked.has(m.name);
    label.append(input, ` ${m.name} · ${(m.size / 1e9).toFixed(1)} Go`);
    box.append(label);
  }
  compareControls();
}
modelListeners.push(fillCompareModels);

function compareControls() {
  $('compare-run').disabled =
    comparing || chatting || importing || !models.length || Boolean(scheduledStart);
  $('compare-at').disabled = comparing || Boolean(scheduledStart);
  $('compare-stop').hidden = !comparing;
  $('compare-pdf').disabled = comparing || importing || chatting;
  $('compare-import').disabled = comparing;
  $('compare-repetitions').disabled = comparing;
  $('compare-remove-pdf').disabled = comparing;
  for (const input of $('compare-models').querySelectorAll('input')) input.disabled = comparing;
  for (const button of $('compare-history').querySelectorAll('button')) button.disabled = comparing;
}
controlListeners.push(compareControls);

// Nombre de questions détectées, affiché sous la tâche.
function questionHint() {
  try {
    const n = parseQuestions($('compare-prompt').value).length;
    $('compare-count').textContent =
      n > 1 ? `${n} questions détectées : elles seront traitées à la suite.` : '';
    $('compare-count').classList.remove('error');
  } catch (error) {
    $('compare-count').textContent = error.message;
    $('compare-count').classList.add('error');
  }
}
$('compare-prompt').oninput = () => {
  compareTitle = null;
  questionHint();
};
$('compare-import').onclick = guard(async () => {
  const file = await window.localia.openQuestions();
  if (!file) return;
  const questions = parseQuestions(file.text);
  if (!questions.length) throw new Error('Aucune question trouvée dans ce fichier.');
  $('compare-prompt').value = file.text.trim();
  compareTitle = file.name;
  questionHint();
  notice('');
});

function showCompareDocument() {
  $('compare-doc').textContent = compareDocument
    ? `${compareDocument.name} · ${compareDocument.pageCount} page(s). Les documents longs sont transmis par extraits.` +
      (compareDocument.alerts?.length
        ? ` ⚠ Instruction adressée à l’IA détectée (page ${compareDocument.alerts.map((a) => a.page).join(', ')}).`
        : '')
    : 'Aucun document joint (facultatif).';
  $('compare-remove-pdf').hidden = !compareDocument;
}
async function dropDraftDocument(previous) {
  if (previous && !referenced(previous.id)) await window.localia.deleteDocument(previous.id);
}
$('compare-pdf').onclick = guard(async () => {
  notice('');
  importing = true;
  controls();
  try {
    const doc = await window.localia.attachPdf();
    if (!doc) return;
    const previous = compareDocument;
    compareDocument = doc;
    showCompareDocument();
    await dropDraftDocument(previous);
  } finally {
    importing = false;
    controls();
  }
});
$('compare-remove-pdf').onclick = guard(async () => {
  const previous = compareDocument;
  compareDocument = null;
  showCompareDocument();
  await dropDraftDocument(previous);
});

function usedText(used) {
  if (!used) return '';
  const parts = [];
  if (used.temperature !== undefined) parts.push('température ' + used.temperature);
  if (used.num_ctx) parts.push('contexte ' + used.num_ctx);
  if (used.num_predict) parts.push('longueur max ' + used.num_predict);
  if (used.top_p !== undefined) parts.push('top P ' + used.top_p);
  if (used.top_k !== undefined) parts.push('top K ' + used.top_k);
  if (used.repeat_penalty !== undefined) parts.push('répétition ' + used.repeat_penalty);
  if (used.seed !== undefined) parts.push('graine ' + used.seed);
  if (used.num_thread) parts.push(used.num_thread + ' threads');
  if (used.think !== undefined) parts.push('réflexion ' + (used.think ? 'activée' : 'désactivée'));
  if (used.system) parts.push('consigne permanente');
  return 'Réglages : ' + parts.join(' · ');
}

function stars(result) {
  const box = element('div', 'stars');
  box.append(element('span', 'muted', 'Votre note : '));
  for (let n = 1; n <= 5; n++) {
    const yours = result.grades?.[YOU]?.rating;
    const button = element('button', n <= (yours || 0) ? 'on' : '', '★');
    button.type = 'button';
    button.setAttribute('aria-label', `${n} sur 5`);
    button.setAttribute('aria-pressed', String(yours === n));
    button.onclick = guard(async () => {
      setYourRating(result, yours === n ? null : n);
      renderComparison();
      await persistComparisons();
    });
    box.append(button);
  }
  return box;
}

// Meilleur résultat mis en avant seulement s'il n'y a pas d'égalité.
function bestOf(items, score) {
  const scored = items.filter((item) => score(item) !== null);
  if (scored.length < 2) return null;
  const sorted = [...scored].sort((a, b) => score(b) - score(a));
  return score(sorted[0]) > score(sorted[1]) ? sorted[0] : null;
}

function table(headers, rows) {
  const node = element('table', 'compare-table');
  const head = node.createTHead().insertRow();
  for (const title of headers) head.append(element('th', '', title));
  const body = node.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    for (const cell of cells) {
      const td = row.insertCell();
      if (cell instanceof Node) td.append(cell);
      else if (cell && typeof cell === 'object') {
        td.textContent = cell.text;
        if (cell.className) td.className = cell.className;
        if (cell.onclick) {
          td.classList.add('clickable');
          td.tabIndex = 0;
          td.onclick = cell.onclick;
          td.onkeydown = (event) => event.key === 'Enter' && cell.onclick();
        }
        if (cell.title) td.title = cell.title;
      } else td.textContent = cell ?? '—';
    }
  }
  return node;
}

function questionTable(results) {
  const done = results.filter((r) => r.status === 'done' && r.stats);
  const fastest = bestOf(done, (r) => (r.stats.totalMs == null ? null : -r.stats.totalMs));
  const quickest = bestOf(done, (r) => speed(r.stats.outputTokens, r.stats.outputMs));
  return table(
    [
      'Modèle',
      'État',
      'Temps total',
      'Chargement',
      'Lecture de la demande',
      'Génération',
      'Tokens générés',
      'Note',
    ],
    results.map((r) => {
      const s = r.stats || {};
      return [
        r.model,
        STATUS[r.status] || r.status,
        { text: seconds(s.totalMs), className: r === fastest ? 'best' : '' },
        seconds(s.loadMs),
        speedText(s.promptTokens, s.promptMs),
        { text: speedText(s.outputTokens, s.outputMs), className: r === quickest ? 'best' : '' },
        s.outputTokens ?? '—',
        ratingOf(r) == null ? '—' : starsText(ratingOf(r)),
      ];
    }),
  );
}

function resultCard(result) {
  const card = element('article', 'compare-card ' + result.status);
  const header = element('div', 'card-head');
  header.append(
    element('strong', '', result.model),
    element('span', 'badge', STATUS[result.status]),
  );
  card.append(header);
  if (result.used) card.append(element('small', 'muted', usedText(result.used)));
  if (result.error) card.append(element('p', 'error', result.error));
  if (result.thinking) {
    const details = element('details');
    details.append(
      element('summary', '', `Raisonnement du modèle (${result.thinking.length} caractères)`),
      element('p', 'thinking', result.thinking),
    );
    card.append(details);
  }
  const answer = element('div', 'markdown');
  if (result.text) showMarkdown(answer, result.text);
  else if (result.status === 'running') answer.textContent = 'Préparation de la réponse…';
  card.append(answer);
  if (result === compareTarget) compareNode = answer;
  const panel = checksPanel(result.checks);
  if (panel) card.append(panel);
  if (result.stats?.doneReason === 'length')
    card.append(element('p', 'error', 'Réponse coupée : longueur maximale atteinte.'));
  if (result.status === 'done') card.append(stars(result));
  // Avis de chaque correcteur (verdict, invention, note, commentaire).
  const graded = Object.entries(result.grades || {}).filter(([, g]) => g.verdict || g.comment);
  if (graded.length) {
    const list = element('ul', 'grades');
    for (const [name, g] of graded.sort(([a], [b]) => a.localeCompare(b))) {
      const item = element('li');
      const parts = [
        g.verdict ? VERDICT_TEXT[g.verdict] || g.verdict : null,
        g.verdict ? (g.invention ? 'invention' : 'sans invention') : null,
        Number.isInteger(g.rating) ? g.rating + '/5' : null,
      ].filter(Boolean);
      item.append(element('strong', '', name + ' : '), parts.join(' · '));
      if (g.comment) item.append(element('span', 'muted', ' — ' + g.comment));
      if (g.invention) item.classList.add('with-invention');
      list.append(item);
    }
    card.append(list);
  }
  return card;
}

// Mesures cumulées de chaque modèle sur toute la série.
function modelSummary(record) {
  return record.models.map((model) => {
    const results = record.results.filter((r) => r.model === model);
    const done = results.filter((r) => r.status === 'done' && r.stats);
    const sum = (key) => done.reduce((n, r) => n + (r.stats[key] || 0), 0);
    const rated = results.filter((r) => ratingOf(r) != null);
    return {
      model,
      done: done.length,
      total: results.length,
      rated: rated.length,
      rating: rated.length ? rated.reduce((n, r) => n + ratingOf(r), 0) / rated.length : null,
      totalMs: done.length ? sum('totalMs') : null,
      loadMs: done.length ? sum('loadMs') : null,
      read: speed(sum('promptTokens'), sum('promptMs')),
      generation: speed(sum('outputTokens'), sum('outputMs')),
      outputTokens: done.length ? sum('outputTokens') : null,
      cut: done.filter((r) => r.stats.doneReason === 'length').length,
      errors: results.filter((r) => r.status === 'error').length,
    };
  });
}

function overview(record) {
  const box = element('section', 'overview');
  const summary = modelSummary(record);
  box.append(element('h4', '', 'Vue d’ensemble'));
  const charts = element('div', 'charts');
  charts.append(
    barChart({
      title: 'Note moyenne (sur 5)',
      note: 'Moyenne des notes de tous les correcteurs, sur les réponses notées.',
      max: 5,
      rows: summary.map((s) => ({
        label: s.model,
        value: s.rating,
        text:
          s.rating === null
            ? ''
            : `${number(s.rating)} (${s.rated} notée${s.rated > 1 ? 's' : ''})`,
      })),
    }),
    barChart({
      title: 'Vitesse de génération',
      note: 'Tokens générés par seconde, sur l’ensemble des réponses (mesure d’Ollama).',
      rows: summary.map((s) => ({
        label: s.model,
        value: s.generation,
        text: s.generation === null ? '' : number(s.generation) + ' tokens/s',
      })),
    }),
    barChart({
      title: 'Temps total',
      note: 'Somme des temps de réponse, chargement compris.',
      rows: summary.map((s) => ({
        label: s.model,
        value: s.totalMs === null ? null : s.totalMs / 60000,
        text: duration(s.totalMs),
      })),
    }),
  );
  box.append(charts);
  const best = bestOf(summary, (s) => s.rating);
  box.append(
    table(
      [
        'Modèle',
        'Réponses',
        'Note moyenne',
        'Temps total',
        'dont chargement',
        'Lecture',
        'Génération',
        'Tokens générés',
        'Coupées',
        'Erreurs',
      ],
      summary.map((s) => [
        s.model,
        `${s.done} / ${s.total}`,
        {
          text: s.rating === null ? '—' : `${number(s.rating)} / 5 (${s.rated})`,
          className: s === best ? 'best' : '',
        },
        duration(s.totalMs),
        duration(s.loadMs),
        s.read === null ? '—' : number(s.read) + ' tokens/s',
        s.generation === null ? '—' : number(s.generation) + ' tokens/s',
        s.outputTokens ?? '—',
        s.cut,
        s.errors,
      ]),
    ),
  );
  box.append(element('h4', '', 'Question par question'));
  box.append(element('p', 'muted', 'Cliquez sur une case pour lire les réponses et les noter.'));
  box.append(
    table(
      ['Question', ...record.models],
      record.questions.map((question, q) => [
        { text: question.label, title: question.prompt },
        ...record.models.map((model) => {
          const r = record.results.find((x) => x.q === q && x.model === model);
          const text = !r
            ? '—'
            : r.status === 'done'
              ? `${ratingOf(r) == null ? 'à noter' : starsText(ratingOf(r))} · ${duration(r.stats?.totalMs)}`
              : STATUS[r.status];
          return {
            text,
            className: q === shownQuestion ? 'current' : '',
            onclick: () => {
              shownQuestion = q;
              renderComparison();
              $('question-detail')?.scrollIntoView({ behavior: 'smooth' });
            },
          };
        }),
      ]),
    ),
  );
  return box;
}

function questionDetail(record, q) {
  const box = element('section', 'question-detail');
  box.id = 'question-detail';
  const question = record.questions[q];
  if (record.questions.length > 1) {
    const nav = element('div', 'input-row');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Question affichée');
    record.questions.forEach((item, i) =>
      select.add(new Option(`${item.label} — ${item.prompt.slice(0, 60)}`, i)),
    );
    select.value = q;
    select.onchange = () => {
      shownQuestion = Number(select.value);
      renderComparison();
    };
    nav.append(element('h4', '', 'Détail'), select);
    box.append(nav);
  }
  box.append(element('p', 'task', question.prompt));
  if (question.expected) {
    const expected = element('div', 'expected');
    expected.append(element('strong', '', 'Réponse attendue (non envoyée aux modèles)'));
    expected.append(element('p', '', question.expected));
    box.append(expected);
  }
  const results = resultsOf(record, q);
  box.append(questionTable(results));
  const grid = element('div', 'compare-grid');
  for (const result of results) grid.append(resultCard(result));
  box.append(grid);
  return box;
}

function exportComparison(record) {
  const decimal = (value, digits = 1) =>
    value === null || value === undefined ? '' : number(value, digits);
  const rows = [
    [
      'Question',
      'Titre',
      'Modèle',
      'État',
      'Note',
      'Temps total (s)',
      'Chargement (s)',
      'Tokens lus',
      'Lecture (tokens/s)',
      'Tokens générés',
      'Génération (tokens/s)',
      'Coupée',
      'Réglages',
      'Question posée',
      'Réponse',
      'Réponse attendue',
    ],
  ];
  for (const r of record.results) {
    const question = record.questions[r.q];
    const s = r.stats || {};
    rows.push([
      r.q + 1,
      question.label,
      r.model,
      STATUS[r.status] || r.status,
      ratingOf(r) == null ? '' : number(ratingOf(r)),
      decimal(s.totalMs != null ? s.totalMs / 1000 : null),
      decimal(s.loadMs != null ? s.loadMs / 1000 : null),
      s.promptTokens ?? '',
      decimal(speed(s.promptTokens, s.promptMs)),
      s.outputTokens ?? '',
      decimal(speed(s.outputTokens, s.outputMs)),
      s.doneReason === 'length' ? 'oui' : '',
      usedText(r.used).replace(/^Réglages : /, ''),
      question.prompt,
      r.text || r.error || '',
      question.expected || '',
    ]);
  }
  const name = 'comparaison-' + record.date.slice(0, 16).replace(/[T:]/g, '-');
  return window.localia.exportFile(
    name,
    'csv',
    rows.map((row) => row.map(csvCell).join(';')).join('\r\n'),
  );
}

function renderComparison() {
  const box = $('compare-current');
  box.replaceChildren();
  compareNode = null;
  if (!shown) return;
  const head = element('div', 'compare-head');
  const titleRow = element('div', 'input-row');
  titleRow.append(
    element(
      'h3',
      '',
      (shown.title ? shown.title + ' · ' : 'Résultats du ') +
        new Date(shown.date).toLocaleString('fr-FR'),
    ),
  );
  const exportButton = element('button', '', 'Exporter (CSV)');
  exportButton.type = 'button';
  exportButton.disabled = comparing && shown === comparisons[0];
  exportButton.onclick = guard(async () => {
    const file = await exportComparison(shown);
    if (file) $('compare-status').textContent = `Résultats exportés : ${file}`;
  });
  titleRow.append(exportButton);
  const unchecked = shown.results.filter((r) => r.status === 'done' && !r.checks);
  if (unchecked.length) {
    const verifyButton = element('button', '', `Vérifier les réponses (${unchecked.length})`);
    verifyButton.type = 'button';
    verifyButton.title =
      'Calculs, pages, citations et chiffres vérifiés automatiquement, sans modèle';
    verifyButton.disabled = comparing && shown === comparisons[0];
    const record = shown;
    verifyButton.onclick = guard(async () => {
      verifyButton.disabled = true;
      for (const result of unchecked) result.checks = await verifyResult(record, result);
      await persistComparisons();
      renderComparison();
    });
    titleRow.append(verifyButton);
  }
  head.append(titleRow);
  const facts = [
    `${shown.questions.length} question${shown.questions.length > 1 ? 's' : ''} × ${shown.models.length} modèle${shown.models.length > 1 ? 's' : ''}`,
  ];
  if (shown.document) facts.push('Document : ' + shown.document.name);
  head.append(element('small', 'muted', facts.join(' · ')));
  box.append(head);
  if (shown.questions.length > 1) box.append(overview(shown));
  box.append(questionDetail(shown, Math.min(shownQuestion, shown.questions.length - 1)));
}

function recordName(record) {
  const date =
    new Date(record.date).toLocaleString('fr-FR') +
    (record.repetitions > 1 ? ` · répétition ${record.repetition}/${record.repetitions}` : '');
  if (record.questions.length === 1)
    return `${date} · ${record.questions[0].prompt.slice(0, 70)} · ${record.models.length} modèle(s)`;
  return `${date} · ${record.title || 'Série'} · ${record.questions.length} questions × ${record.models.length} modèle(s)`;
}

function renderCompareHistory() {
  const box = $('compare-history');
  box.replaceChildren();
  if (!comparisons.length) box.append(element('p', 'muted', 'Aucune comparaison pour le moment.'));
  for (const record of comparisons) {
    const row = element('div', 'compare-row' + (record === shown ? ' selected' : ''));
    const open = element('button', 'link', recordName(record));
    open.type = 'button';
    open.onclick = () => {
      shown = record;
      shownQuestion = 0;
      renderComparison();
      renderCompareHistory();
      $('compare-current').scrollIntoView({ behavior: 'smooth' });
    };
    const reuse = element('button', '', 'Réutiliser la tâche');
    reuse.type = 'button';
    reuse.onclick = guard(async () => {
      const previous = compareDocument;
      $('compare-prompt').value = formatQuestions(record.questions);
      compareTitle = record.title || null;
      questionHint();
      compareDocument = record.document || null;
      showCompareDocument();
      if (previous?.id !== compareDocument?.id) await dropDraftDocument(previous);
      $('compare-prompt').focus();
    });
    const remove = element('button', '', 'Supprimer');
    remove.type = 'button';
    remove.onclick = guard(async () => {
      if (!confirm('Supprimer définitivement cette comparaison ?')) return;
      comparisons = comparisons.filter((c) => c !== record);
      if (shown === record) shown = null;
      renderComparison();
      renderCompareHistory();
      await persistComparisons();
      if (record.document && !referenced(record.document.id))
        await window.localia.deleteDocument(record.document.id);
    });
    const progress = seriesProgress(groupOf(record));
    const newest = progress.records.at(-1) === record;
    if (newest && progress.remaining > 0) {
      const label =
        progress.errors === progress.remaining
          ? `Relancer les erreurs (${progress.errors})`
          : `Reprendre (${progress.remaining} réponse(s)${progress.errors ? `, dont ${progress.errors} en erreur` : ''})`;
      const resume = element('button', 'primary', label);
      resume.type = 'button';
      resume.title =
        'Relance seulement les réponses qui manquent, avec les mêmes questions et modèles';
      resume.onclick = guard(() => resumeSeries(groupOf(record)));
      row.append(open, resume, reuse, remove);
    } else row.append(open, reuse, remove);
    box.append(row);
  }
  compareControls();
}

$('compare-tab').onclick = () => view('compare');
const isPending = (result) => result.status !== 'done';
const groupOf = (record) => record.groupId || record.id;

// Répétitions enregistrées d'une série et réponses qui restent à obtenir.
function seriesProgress(key) {
  const records = comparisons
    .filter((c) => groupOf(c) === key)
    .sort((a, b) => (a.repetition || 1) - (b.repetition || 1));
  const total = records[0]?.repetitions || 1;
  const last = Math.max(0, ...records.map((r) => r.repetition || 1));
  const perRepetition = records[0] ? records[0].results.length : 0;
  const pending = records.reduce((n, r) => n + r.results.filter(isPending).length, 0);
  const errors = records.reduce(
    (n, r) => n + r.results.filter((x) => x.status === 'error').length,
    0,
  );
  return {
    records,
    total,
    last,
    errors,
    remaining: pending + Math.max(0, total - last) * perRepetition,
  };
}

// Vérifications automatiques d'une réponse (sans modèle) ; undefined si elles échouent.
const verifyResult = (record, result) =>
  window.localia
    .verifyAnswer({
      answer: result.text || '',
      question: record.questions[result.q].prompt,
      documentId: record.document?.id,
    })
    .catch(() => undefined);

// Exécute une répétition : chaque modèle traite ses questions non terminées, à la suite.
async function runRecord(record, prefix) {
  for (const [m, model] of record.models.entries()) {
    for (const [q, question] of record.questions.entries()) {
      const result = record.results.find((r) => r.q === q && r.model === model);
      if (!isPending(result)) continue;
      if (stopRequested) {
        result.status = 'skipped';
        continue;
      }
      $('compare-status').textContent =
        prefix +
        `Modèle ${m + 1}/${record.models.length} : ${model}` +
        (record.questions.length > 1
          ? ` · question ${q + 1}/${record.questions.length} (${question.label})`
          : '');
      Object.assign(result, { status: 'running', text: '', thinking: '' });
      for (const key of ['stats', 'used', 'error', 'sent']) delete result[key];
      compareTarget = result;
      shownQuestion = q;
      renderComparison();
      // Le modèle reste chargé tant qu'il lui reste des questions dans cette répétition.
      const keepLoaded = record.results.some((r) => r.model === model && r.q > q && isPending(r));
      try {
        const answer = await window.localia.run('compare', {
          model,
          documentId: record.document?.id,
          messages: [{ role: 'user', content: question.prompt }],
          // Série « Actions sur fichiers » : même consigne que l'onglet Fichiers, pour mesurer ce
          // que l'assistant fera réellement. Les autres séries restent sans consigne de tâche.
          task: TASKS.find((t) => t.files && t.categories.includes(question.category))?.id,
          keepLoaded,
        });
        Object.assign(result, {
          status: answer.cancelled ? 'cancelled' : 'done',
          text: answer.text,
          thinking: answer.thinking || undefined,
          stats: answer.stats,
          used: answer.used,
        });
        if (result.status === 'done') result.checks = await verifyResult(record, result);
        // Messages exacts envoyés : une fois par question, et sur la réponse s'ils diffèrent
        // (consigne permanente propre à un modèle).
        if (answer.sent) {
          if (!question.sent) question.sent = answer.sent;
          else if (JSON.stringify(question.sent) !== JSON.stringify(answer.sent))
            result.sent = answer.sent;
        }
      } catch (error) {
        Object.assign(result, { status: 'error', error: error.message });
      }
      compareTarget = null;
      renderComparison();
      await persistComparisons();
    }
  }
}

// Lance ou reprend une série : termine les répétitions existantes, puis crée celles qui manquent.
// template : { groupId, repetitions, document, questions, models, title? }.
async function runSeries(template, existing, startRepetition) {
  comparing = true;
  // Mac maintenu éveillé pendant toute la série (remplace « caffeinate »).
  await window.localia.keepAwake(true).catch(() => {});
  stopRequested = false;
  $('compare-status').textContent = 'Préparation : relevé des conditions de l’expérience…';
  controls();
  let env = null;
  try {
    env = await window.localia.environment(template.models);
  } catch (error) {
    notice('Conditions de l’expérience non enregistrées : ' + error.message);
  }
  const label = (repetition) =>
    template.repetitions > 1 ? `Répétition ${repetition}/${template.repetitions} · ` : '';
  try {
    for (const record of existing) {
      if (stopRequested) break;
      if (!record.results.some(isPending)) continue;
      record.resumes = [...(record.resumes || []), { at: new Date().toISOString(), env }];
      for (const r of record.results) if (isPending(r)) r.status = 'waiting';
      shown = record;
      renderCompareHistory();
      await persistComparisons();
      await runRecord(record, 'Reprise · ' + label(record.repetition || 1));
    }
    for (
      let repetition = startRepetition;
      repetition <= template.repetitions && !stopRequested;
      repetition++
    ) {
      const record = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        groupId: template.groupId,
        repetition,
        repetitions: template.repetitions,
        env,
        document: template.document,
        questions: template.questions.map(({ sent, ...q }) => ({ ...q })),
        models: template.models,
        results: template.models.flatMap((model) =>
          template.questions.map((_, q) => ({ q, model, status: 'waiting' })),
        ),
      };
      if (template.title) record.title = template.title;
      comparisons.unshift(record);
      shown = record;
      shownQuestion = 0;
      renderComparison();
      renderCompareHistory();
      await persistComparisons();
      await runRecord(record, label(repetition));
    }
  } finally {
    comparing = false;
    compareTarget = null;
    if (!scheduledStart) await window.localia.keepAwake(false).catch(() => {});
    $('compare-status').textContent = stopRequested
      ? 'Série en pause. Cliquez « Reprendre » dans les comparaisons enregistrées pour la terminer.'
      : 'Comparaison terminée.';
    if (template.questions.length > 1) shownQuestion = 0;
    controls();
    renderComparison();
    renderCompareHistory();
    await persistComparisons().catch((e) => notice(e.message));
  }
}

async function resumeSeries(key) {
  if (comparing || chatting || !comparisonsLoaded) return;
  const { records, total, last } = seriesProgress(key);
  if (!records.length) return;
  const first = records[0];
  notice('');
  await runSeries(
    {
      groupId: first.groupId || first.id,
      repetitions: total,
      document: first.document,
      questions: first.questions,
      models: first.models,
      title: first.title,
    },
    records,
    last + 1,
  );
}

// Départ programmé : la série préparée démarre à l'heure choisie ; Localia doit rester ouverte.
function nextOccurrence(time, now = new Date()) {
  const [hours, minutes] = time.split(':').map(Number);
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}
function scheduleSeries(template, time) {
  const at = nextOccurrence(time);
  scheduledStart = {
    at,
    timer: setTimeout(() => {
      scheduledStart = null;
      $('compare-unschedule').hidden = true;
      notice('');
      runSeries(template, [], 1).catch((error) => notice(error.message));
    }, at - new Date()),
  };
  window.localia.keepAwake(true).catch(() => {});
  $('compare-unschedule').hidden = false;
  const minutes = Math.round((at - new Date()) / 60000);
  $('compare-status').textContent =
    `Départ programmé ${at.toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })} (dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}). Laissez Localia ouverte et le Mac branché, couvercle ouvert : il ne se mettra pas en veille.`;
  controls();
}
$('compare-unschedule').onclick = guard(async () => {
  if (!scheduledStart) return;
  clearTimeout(scheduledStart.timer);
  scheduledStart = null;
  $('compare-unschedule').hidden = true;
  $('compare-status').textContent = 'Départ programmé annulé.';
  await window.localia.keepAwake(false);
  controls();
});

$('compare-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  if (comparing || chatting || !comparisonsLoaded || scheduledStart) return;
  const questions = parseQuestions($('compare-prompt').value);
  const selected = [...$('compare-models').querySelectorAll('input:checked')].map((i) => i.value);
  const repetitions = Math.min(5, Math.max(1, Number($('compare-repetitions').value) || 1));
  if (!questions.length) return;
  if (!selected.length) {
    notice('Choisissez au moins un modèle à comparer.');
    return;
  }
  notice('');
  const template = {
    groupId: crypto.randomUUID(),
    repetitions,
    document: compareDocument,
    questions,
    models: selected,
    title: compareTitle && questions.length > 1 ? compareTitle : undefined,
  };
  if ($('compare-at').value) scheduleSeries(template, $('compare-at').value);
  else await runSeries(template, [], 1);
});
$('compare-stop').onclick = guard(async () => {
  stopRequested = true;
  await window.localia.cancel('compare');
});

window.localia.onProgress(({ kind, data }) => {
  if (kind !== 'compare' || !compareTarget) return;
  compareTarget.text += data.message?.content || '';
  compareTarget.thinking += data.message?.thinking || '';
  if (!compareNode || compareNode.dataset.pending) return;
  compareNode.dataset.pending = '1';
  const target = compareNode;
  requestAnimationFrame(() => {
    delete target.dataset.pending;
    if (!compareTarget || target !== compareNode) return;
    if (compareTarget.text) showMarkdown(target, compareTarget.text);
    else if (compareTarget.thinking)
      target.textContent = `Le modèle réfléchit… (${compareTarget.thinking.length} caractères de raisonnement)`;
  });
});
