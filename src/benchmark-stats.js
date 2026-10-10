// Calculs du banc d'essai. Chargé comme script dans l'interface et par les tests Node.
// Une note (grade) par correcteur et par réponse :
//   { verdict: 'correct' | 'partiel' | 'faux' | 'hors-sujet', invention: bool, rating: 1-5, comment }
const VERDICTS = ['correct', 'partiel', 'faux', 'hors-sujet'];
const ALL_GRADERS = '*';

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
// Écart-type d'échantillon (n - 1) ; null en dessous de deux valeurs.
function sd(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((n, v) => n + (v - m) ** 2, 0) / (values.length - 1));
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const summary = (values) => ({ mean: mean(values), sd: sd(values), n: values.length });

function gradersOf(records) {
  const names = new Set();
  for (const record of records)
    for (const result of record.results)
      for (const name of Object.keys(result.grades || {})) names.add(name);
  return [...names].sort();
}

// Valeurs d'une réponse pour un correcteur, ou moyenne de tous les correcteurs. null si non notée.
function gradeValues(result, grader) {
  const grades = Object.entries(result.grades || {})
    .filter(([name]) => grader === ALL_GRADERS || name === grader)
    .map(([, grade]) => grade);
  const judged = grades.filter((g) => VERDICTS.includes(g.verdict));
  const rated = grades.filter((g) => Number.isInteger(g.rating));
  if (!judged.length && !rated.length) return null;
  return {
    correct: judged.length ? mean(judged.map((g) => (g.verdict === 'correct' ? 1 : 0))) : null,
    acceptable: judged.length
      ? mean(judged.map((g) => (['correct', 'partiel'].includes(g.verdict) ? 1 : 0)))
      : null,
    invention: judged.length ? mean(judged.map((g) => (g.invention ? 1 : 0))) : null,
    rating: rated.length ? mean(rated.map((g) => g.rating)) : null,
  };
}

const done = (result) => result.status === 'done' && result.stats;
const repetitionOf = (record) => record.repetition || 1;
const speed = (tokens, ms) => (tokens && ms ? tokens / (ms / 1000) : null);
const valuesOf = (items, key) =>
  items.map((i) => i[key]).filter((v) => v !== null && v !== undefined);

// Indicateurs par modèle. Chaque indicateur est calculé par répétition (toutes séries confondues),
// puis résumé en moyenne ± écart-type sur les répétitions.
function modelMetrics(records, grader = ALL_GRADERS) {
  const models = [...new Set(records.flatMap((r) => r.models || r.results.map((x) => x.model)))];
  return models.map((model) => {
    const byRepetition = new Map();
    for (const record of records) {
      const key = repetitionOf(record);
      if (!byRepetition.has(key)) byRepetition.set(key, []);
      byRepetition
        .get(key)
        .push(...record.results.filter((r) => r.model === model).map((r) => ({ r, record })));
    }
    const perRepetition = [...byRepetition.values()].map((items) => {
      const answered = items.filter(({ r }) => done(r));
      const grades = answered.map(({ r }) => gradeValues(r, grader)).filter(Boolean);
      const sum = (key) => answered.reduce((n, { r }) => n + (r.stats[key] || 0), 0);
      // Chargement : une fois par série et par modèle (le modèle reste chargé entre les questions).
      const loads = [...new Set(answered.map(({ record }) => record))].map((record) =>
        record.results
          .filter((r) => r.model === model && done(r))
          .reduce((n, r) => Math.max(n, r.stats.loadMs || 0), 0),
      );
      return {
        answers: items.length,
        answered: answered.length,
        graded: grades.length,
        correct: mean(valuesOf(grades, 'correct')),
        acceptable: mean(valuesOf(grades, 'acceptable')),
        invention: mean(valuesOf(grades, 'invention')),
        rating: mean(valuesOf(grades, 'rating')),
        answerSeconds: answered.length ? sum('totalMs') / answered.length / 1000 : null,
        loadSeconds: loads.length ? mean(loads) / 1000 : null,
        generation: speed(sum('outputTokens'), sum('outputMs')),
        reading: speed(sum('promptTokens'), sum('promptMs')),
        outputTokens: answered.length ? sum('outputTokens') / answered.length : null,
        cut: answered.filter(({ r }) => r.stats.doneReason === 'length').length,
        errors: items.filter(({ r }) => r.status === 'error').length,
      };
    });
    const pick = (key) => summary(valuesOf(perRepetition, key));
    const times = records.flatMap((record) =>
      record.results.filter((r) => r.model === model && done(r)).map((r) => r.stats.totalMs / 1000),
    );
    return {
      model,
      repetitions: perRepetition.length,
      answers: perRepetition.reduce((n, p) => n + p.answers, 0),
      answered: perRepetition.reduce((n, p) => n + p.answered, 0),
      graded: perRepetition.reduce((n, p) => n + p.graded, 0),
      cut: perRepetition.reduce((n, p) => n + p.cut, 0),
      errors: perRepetition.reduce((n, p) => n + p.errors, 0),
      correct: pick('correct'),
      acceptable: pick('acceptable'),
      invention: pick('invention'),
      rating: pick('rating'),
      answerSeconds: pick('answerSeconds'),
      loadSeconds: pick('loadSeconds'),
      generation: pick('generation'),
      reading: pick('reading'),
      outputTokens: pick('outputTokens'),
      times,
      medianSeconds: median(times),
    };
  });
}

// Précision et note par catégorie de question et par modèle (toutes répétitions confondues).
function categoryMetrics(records, grader = ALL_GRADERS) {
  const cells = new Map();
  for (const record of records)
    for (const result of record.results) {
      if (!done(result)) continue;
      const category = record.questions[result.q]?.category || 'Sans catégorie';
      const values = gradeValues(result, grader);
      if (!values) continue;
      const key = category + '\u0000' + result.model;
      if (!cells.has(key)) cells.set(key, { category, model: result.model, items: [] });
      cells.get(key).items.push(values);
    }
  return [...cells.values()].map(({ category, model, items }) => ({
    category,
    model,
    n: items.length,
    correct: mean(valuesOf(items, 'correct')),
    invention: mean(valuesOf(items, 'invention')),
    rating: mean(valuesOf(items, 'rating')),
  }));
}

// Métier d'une question d'après le début de son libellé (séries « métiers » : E01, ED3, MD6…).
// null pour les autres séries.
const METIER_PREFIXES = {
  A: 'Administration',
  C: 'Entreprise',
  E: 'Enseignement',
  F: 'Finance',
  I: 'Ingénierie',
  J: 'Juridique',
  M: 'Communication',
  P: 'Codage',
  R: 'Recherche',
  S: 'Santé',
  T: 'Télécommunications',
  Y: 'Cybersécurité',
};
function metierOf(label) {
  const match = /^([A-Z])D?\d+\b/.exec(String(label || ''));
  return (match && METIER_PREFIXES[match[1]]) || null;
}

// Note, précision et invention par métier et par modèle (toutes répétitions confondues).
// group (facultatif) regroupe des métiers sous un même nom (ex. Enseignement et Recherche).
function metierMetrics(records, grader = ALL_GRADERS, group = (m) => m) {
  const cells = new Map();
  for (const record of records)
    for (const result of record.results) {
      if (!done(result)) continue;
      const metier = group(metierOf(record.questions[result.q]?.label));
      const values = metier && gradeValues(result, grader);
      if (!values) continue;
      const key = metier + '\u0000' + result.model;
      if (!cells.has(key)) cells.set(key, { metier, model: result.model, items: [] });
      cells.get(key).items.push(values);
    }
  return [...cells.values()].map(({ metier, model, items }) => ({
    metier,
    model,
    n: items.length,
    correct: mean(valuesOf(items, 'correct')),
    acceptable: mean(valuesOf(items, 'acceptable')),
    invention: mean(valuesOf(items, 'invention')),
    rating: mean(valuesOf(items, 'rating')),
  }));
}

// Performances (temps, vitesse, longueur) par métier et par modèle, sans besoin de notes.
function metierPerformance(records, group = (m) => m) {
  const cells = new Map();
  for (const record of records)
    for (const result of record.results) {
      if (!done(result)) continue;
      const metier = group(metierOf(record.questions[result.q]?.label));
      if (!metier) continue;
      const key = metier + '\u0000' + result.model;
      if (!cells.has(key)) cells.set(key, { metier, model: result.model, items: [] });
      cells.get(key).items.push(result.stats);
    }
  return [...cells.values()].map(({ metier, model, items }) => {
    const sum = (key) => items.reduce((n, s) => n + (s[key] || 0), 0);
    return {
      metier,
      model,
      n: items.length,
      answerSeconds: sum('totalMs') / items.length / 1000,
      generation: speed(sum('outputTokens'), sum('outputMs')),
      outputTokens: sum('outputTokens') / items.length,
      cut: items.filter((s) => s.doneReason === 'length').length,
    };
  });
}

// Classement : la justesse d'abord. Part de réponses correctes, puis moins d'inventions, puis note
// moyenne, puis rapidité (un modèle lent qui dit juste passe devant un rapide qui invente).
// Les éléments sans note ni verdict sont exclus.
function rankModels(items) {
  const value = (v) => (v && typeof v === 'object' ? v.mean : v);
  const desc = (a, b) => (value(b) ?? -1) - (value(a) ?? -1);
  const asc = (a, b, missing) => (value(a) ?? missing) - (value(b) ?? missing);
  return items
    .filter((m) => value(m.rating) != null || value(m.correct) != null)
    .sort(
      (a, b) =>
        desc(a.correct, b.correct) ||
        asc(a.invention, b.invention, 1) ||
        desc(a.rating, b.rating) ||
        asc(a.answerSeconds, b.answerSeconds, Infinity),
    );
}

// Modèle conseillé pour un métier (étiquette du banc d'essai, ex. « Santé », ou liste d'étiquettes
// comptées ensemble, ex. ['Enseignement', 'Recherche']) : classement des modèles notés sur ces
// questions, avec le temps moyen par réponse. null sans réponse notée.
function metierAdvice(records, metier, grader = ALL_GRADERS) {
  const wanted = [].concat(metier);
  const name = wanted.join(' + ');
  const group = (m) => (wanted.includes(m) ? name : m);
  const perf = metierPerformance(records, group).filter((p) => p.metier === name);
  const ranked = rankModels(
    metierMetrics(records, grader, group)
      .filter((c) => c.metier === name && c.n)
      .map((c) => ({
        ...c,
        answerSeconds: perf.find((p) => p.model === c.model)?.answerSeconds ?? null,
      })),
  );
  return ranked.length ? { best: ranked[0], ranked } : null;
}

// Verdict d'une réponse : celui du correcteur, ou l'ensemble des verdicts de tous les correcteurs.
function verdictOf(result, grader) {
  if (grader !== ALL_GRADERS) return result.grades?.[grader]?.verdict || null;
  const verdicts = Object.keys(result.grades || {})
    .sort()
    .map((name) => result.grades[name].verdict)
    .filter(Boolean);
  return verdicts.length ? verdicts.join('/') : null;
}

// Stabilité entre répétitions d'une même série (même groupId) : réponses identiques mot pour mot,
// et écart-type des notes d'une même question.
function stabilityMetrics(records, grader = ALL_GRADERS) {
  const groups = new Map();
  for (const record of records)
    if (record.groupId) {
      if (!groups.has(record.groupId)) groups.set(record.groupId, []);
      groups.get(record.groupId).push(record);
    }
  const byModel = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    for (const model of first.models)
      first.questions.forEach((_, q) => {
        const runs = group
          .map((record) => record.results.find((r) => r.q === q && r.model === model))
          .filter((r) => r && done(r));
        if (runs.length < 2) return;
        if (!byModel.has(model))
          byModel.set(model, { identical: [], ratingSd: [], verdictChanges: [] });
        const entry = byModel.get(model);
        entry.identical.push(runs.every((r) => r.text === runs[0].text) ? 1 : 0);
        const ratings = runs.map((r) => gradeValues(r, grader)?.rating).filter((v) => v != null);
        if (ratings.length >= 2) entry.ratingSd.push(sd(ratings));
        const verdicts = runs.map((r) => verdictOf(r, grader)).filter(Boolean);
        if (verdicts.length >= 2) entry.verdictChanges.push(new Set(verdicts).size > 1 ? 1 : 0);
      });
  }
  return [...byModel.entries()].map(([model, e]) => ({
    model,
    questions: e.identical.length,
    identical: mean(e.identical),
    ratingSd: mean(e.ratingSd),
    verdictChanges: mean(e.verdictChanges),
  }));
}

// Accord entre deux correcteurs sur les réponses notées par les deux.
function agreement(records, a, b) {
  const pairs = [];
  for (const record of records)
    for (const result of record.results) {
      const ga = result.grades?.[a];
      const gb = result.grades?.[b];
      if (ga && gb) pairs.push([ga, gb]);
    }
  const verdictPairs = pairs.filter(
    ([x, y]) => VERDICTS.includes(x.verdict) && VERDICTS.includes(y.verdict),
  );
  let kappa = null;
  let observed = null;
  if (verdictPairs.length) {
    observed = mean(verdictPairs.map(([x, y]) => (x.verdict === y.verdict ? 1 : 0)));
    const expected = VERDICTS.reduce((n, v) => {
      const pa = mean(verdictPairs.map(([x]) => (x.verdict === v ? 1 : 0)));
      const pb = mean(verdictPairs.map(([, y]) => (y.verdict === v ? 1 : 0)));
      return n + pa * pb;
    }, 0);
    kappa = expected < 1 ? (observed - expected) / (1 - expected) : null;
  }
  const ratingPairs = pairs.filter(
    ([x, y]) => Number.isInteger(x.rating) && Number.isInteger(y.rating),
  );
  return {
    pairs: pairs.length,
    verdictAgreement: observed,
    kappa,
    inventionAgreement: verdictPairs.length
      ? mean(verdictPairs.map(([x, y]) => (Boolean(x.invention) === Boolean(y.invention) ? 1 : 0)))
      : null,
    ratingDifference: ratingPairs.length
      ? mean(ratingPairs.map(([x, y]) => Math.abs(x.rating - y.rating)))
      : null,
  };
}

// CSV avec séparateur « ; » et guillemets (format Excel français).
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text).replace(/^﻿/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

const GRADE_COLUMNS = [
  'Série',
  'Question',
  'Modèle',
  'Correcteur',
  'Verdict',
  'Invention',
  'Note',
  'Commentaire',
];
const normalize = (text) =>
  String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Applique un fichier de notes. Renvoie le nombre de notes appliquées et les lignes refusées.
function applyGrades(records, text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Fichier de notes vide.');
  const header = rows[0].map(normalize);
  const col = (name) => header.indexOf(normalize(name));
  for (const name of GRADE_COLUMNS.slice(0, 5))
    if (col(name) < 0) throw new Error(`Colonne « ${name} » absente du fichier de notes.`);
  let applied = 0;
  const rejected = [];
  rows.slice(1).forEach((row, index) => {
    const get = (name) => (col(name) >= 0 ? (row[col(name)] || '').trim() : '');
    const line = index + 2;
    const record = records.find((r) => r.id === get('Série'));
    const q = record?.questions.findIndex((x) => x.label === get('Question'));
    const result = record?.results.find((r) => r.q === q && r.model === get('Modèle'));
    const grader = get('Correcteur').slice(0, 40);
    const verdict = normalize(get('Verdict')).replace(' ', '-');
    const rating = get('Note') ? Number(get('Note')) : null;
    const invention = ['oui', 'yes', '1', 'vrai', 'true'].includes(normalize(get('Invention')));
    const problem = !record
      ? 'série inconnue'
      : q < 0
        ? 'question inconnue'
        : !result
          ? 'modèle absent de la série'
          : !grader
            ? 'correcteur manquant'
            : !VERDICTS.includes(verdict)
              ? 'verdict invalide (correct, partiel, faux, hors-sujet)'
              : rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)
                ? 'note invalide (1 à 5)'
                : null;
    if (problem) {
      rejected.push(`ligne ${line} : ${problem}`);
      return;
    }
    result.grades = { ...result.grades };
    result.grades[grader] = {
      verdict,
      invention,
      rating,
      comment: get('Commentaire').slice(0, 2000),
      at: new Date().toISOString(),
    };
    applied++;
  });
  return { applied, rejected };
}

if (typeof module !== 'undefined')
  module.exports = {
    VERDICTS,
    ALL_GRADERS,
    GRADE_COLUMNS,
    mean,
    sd,
    median,
    gradersOf,
    gradeValues,
    modelMetrics,
    categoryMetrics,
    metierOf,
    metierMetrics,
    metierPerformance,
    metierAdvice,
    rankModels,
    stabilityMetrics,
    agreement,
    toCsv,
    parseCsv,
    applyGrades,
  };
