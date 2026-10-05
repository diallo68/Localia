// Fichiers joints à une conversation : texte (consignes, code) envoyé tel quel ; tableau (CSV, TSV)
// résumé en « portrait » (colonnes, types, manquants, bornes, premières lignes) pour que le modèle
// écrive du code avec les vraies colonnes sans recevoir tout le fichier.
// Aucun accès disque ici : chargé par le processus principal et les tests.
const TABLE_EXTENSIONS = ['csv', 'tsv'];
const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'py',
  'r',
  'ipynb',
  'json',
  'sql',
  'yaml',
  'yml',
  'xml',
  'ini',
  'toml',
  'sh',
  'js',
  'html',
  'css',
  'tex',
  'bib',
  'log',
];
const MISSING = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '-', '?']);
// Valeurs « impossibles » utilisées comme manquantes (NASA POWER : -999).
const SENTINEL = /^-(999|9999|99)(\.0+)?$/;

// Texte d'un fichier : UTF-8, sinon Windows-1252 (fréquent pour des données exportées d'Excel).
function decodeText(buffer) {
  let text = buffer.toString('utf8');
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buffer);
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function splitLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      cells.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  cells.push(cell.trim());
  return cells;
}

// Tableau délimité : séparateur deviné (virgule, point-virgule, tabulation), en-tête de métadonnées
// sauté (NASA POWER : « -BEGIN HEADER- … -END HEADER- » ; sinon lignes avant le tableau régulier).
function parseTable(text) {
  let lines = text.split('\n');
  const preamble = [];
  const end = lines.findIndex((l) => /^-END HEADER-/i.test(l.trim()));
  if (end >= 0) {
    preamble.push(...lines.slice(0, end + 1));
    lines = lines.slice(end + 1);
  }
  lines = lines.filter((l) => l.trim());
  if (!lines.length) throw new Error('Fichier de données vide.');
  const sample = lines.slice(0, 50);
  const delimiter = [',', ';', '\t']
    .map((d) => ({ d, n: sample.filter((l) => splitLine(l, d).length > 1).length }))
    .sort((a, b) => b.n - a.n)[0].d;
  // Première ligne qui a le nombre de colonnes le plus courant : l'en-tête du tableau.
  const counts = sample.map((l) => splitLine(l, delimiter).length);
  const width = counts
    .slice()
    .sort((a, b) => counts.filter((x) => x === b).length - counts.filter((x) => x === a).length)[0];
  const start = counts.indexOf(width);
  preamble.push(...lines.slice(0, start));
  const header = splitLine(lines[start], delimiter);
  const rows = lines.slice(start + 1).map((l) => splitLine(l, delimiter));
  return { delimiter, preamble, header, rows };
}

const toNumber = (value, decimalComma) => {
  const v = decimalComma ? value.replace(/\s/g, '').replace(',', '.') : value;
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v) ? Number(v) : null;
};
const DATE =
  /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})([ T]\d{1,2}:\d{2}(:\d{2})?)?$/;

function profileTable({ delimiter, header, rows }) {
  const decimalComma = delimiter === ';';
  const columns = header.map((name, c) => {
    const values = rows.map((r) => r[c] ?? '');
    const missing = values.filter((v) => MISSING.has(v.toLowerCase())).length;
    const sentinels = values.filter((v) => SENTINEL.test(v)).length;
    const present = values.filter((v) => !MISSING.has(v.toLowerCase()) && !SENTINEL.test(v));
    const numbers = present.map((v) => toNumber(v, decimalComma)).filter((n) => n !== null);
    const column = { name, missing, sentinels };
    if (present.length && numbers.length >= 0.9 * present.length) {
      column.type = 'nombre';
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      for (const n of numbers) {
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }
      Object.assign(column, { min, max, mean: sum / numbers.length });
    } else if (
      present.length &&
      present.filter((v) => DATE.test(v)).length >= 0.9 * present.length
    ) {
      column.type = 'date';
      column.first = present[0];
      column.last = present.at(-1);
    } else {
      column.type = 'texte';
      column.distinct = new Set(present).size;
      column.examples = [...new Set(present)].slice(0, 3);
    }
    return column;
  });
  const seen = new Set();
  let duplicates = 0;
  let ragged = 0;
  for (const r of rows) {
    const key = r.join('\u0001');
    if (seen.has(key)) duplicates++;
    seen.add(key);
    if (r.length !== header.length) ragged++;
  }
  return { rows: rows.length, columns, duplicates, ragged, decimalComma };
}

const round = (n) =>
  Number.isInteger(n)
    ? String(n)
    : Math.abs(n) >= 100
      ? n.toFixed(1)
      : Number(n.toPrecision(4)).toString();

// Portrait lisible par le modèle (et par l'utilisateur) : tout ce qu'il faut pour écrire le code.
function describeTable(name, table, profile, sampleRows = 8) {
  const d = { ',': 'virgule', ';': 'point-virgule', '\t': 'tabulation' }[table.delimiter];
  const lines = [
    `Tableau « ${name} » : ${profile.rows} lignes, ${profile.columns.length} colonnes, séparateur ${d}${profile.decimalComma ? ', virgule décimale probable' : ''}.`,
  ];
  if (table.preamble.length)
    lines.push(
      `${table.preamble.length} ligne(s) d'en-tête avant le tableau (à sauter à la lecture, ex. skiprows=${table.preamble.length}).` +
        (table.preamble.some((l) => /NASA\/POWER|POWER/i.test(l)) ? ' Format NASA POWER.' : ''),
    );
  const meta = table.preamble.filter((l) => /:/.test(l) && !/^-/.test(l.trim())).slice(0, 12);
  if (meta.length) lines.push("Métadonnées de l'en-tête :", ...meta.map((l) => `  ${l.trim()}`));
  lines.push('Colonnes :');
  for (const c of profile.columns) {
    const parts = [c.type];
    if (c.type === 'nombre')
      parts.push(`min ${round(c.min)}, max ${round(c.max)}, moyenne ${round(c.mean)}`);
    if (c.type === 'date') parts.push(`de ${c.first} à ${c.last}`);
    if (c.type === 'texte')
      parts.push(`${c.distinct} valeur(s) distincte(s), ex. ${c.examples.join(' ; ')}`);
    if (c.missing) parts.push(`${c.missing} vide(s)`);
    if (c.sentinels)
      parts.push(`${c.sentinels} valeur(s) -999 ou similaire (manquantes probables)`);
    lines.push(`- ${c.name} : ${parts.join(', ')}`);
  }
  // Colonnes de date séparées (NASA POWER) : la conversion exacte, source d'erreurs fréquente.
  const has = (...names) => names.every((n) => table.header.includes(n));
  if (has('YEAR', 'DOY'))
    lines.push(
      "Date : YEAR + DOY (jour de l'année, 1 à 366, pas le jour du mois) → pd.to_datetime(df['YEAR'] * 1000 + df['DOY'], format='%Y%j').",
    );
  else if (has('YEAR', 'MO', 'DY'))
    lines.push(
      "Date : YEAR, MO (mois), DY (jour du mois) → pd.to_datetime(df[['YEAR', 'MO', 'DY']].rename(columns={'YEAR': 'year', 'MO': 'month', 'DY': 'day'})).",
    );
  if (profile.duplicates) lines.push(`${profile.duplicates} ligne(s) en double.`);
  if (profile.ragged)
    lines.push(`${profile.ragged} ligne(s) avec un nombre de colonnes différent de l'en-tête.`);
  const show = (rows) => rows.map((r) => r.join(table.delimiter === '\t' ? '\t' : table.delimiter));
  lines.push(
    `Premières lignes (en-tête compris) :`,
    show([table.header, ...table.rows.slice(0, sampleRows)]).join('\n'),
  );
  if (table.rows.length > sampleRows + 2)
    lines.push('Dernières lignes :', show(table.rows.slice(-2)).join('\n'));
  return lines.join('\n');
}

function extensionOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

// Fichier joint prêt à être enregistré : { kind: 'table' | 'text', content, summary }.
function prepareAttachment(name, buffer, { maxText = 12000 } = {}) {
  const extension = extensionOf(name);
  const text = decodeText(buffer);
  if (TABLE_EXTENSIONS.includes(extension)) {
    const table = parseTable(text);
    const profile = profileTable(table);
    return {
      kind: 'table',
      content: describeTable(name, table, profile),
      summary: `${profile.rows} lignes, ${profile.columns.length} colonnes`,
    };
  }
  if (!TEXT_EXTENSIONS.includes(extension)) throw new Error('Type de fichier non pris en charge.');
  const partial = text.length > maxText;
  return {
    kind: 'text',
    content: partial ? text.slice(0, maxText) : text,
    partial,
    summary: `${text.length.toLocaleString('fr-FR')} caractères${partial ? `, seuls les ${maxText.toLocaleString('fr-FR')} premiers transmis` : ''}`,
  };
}

// Bloc ajouté à la consigne du modèle pour les fichiers joints.
function attachmentsBlock(files) {
  if (!files.length) return '';
  return [
    "Fichiers joints par l'utilisateur. Le code sera exécuté sur son ordinateur, dans le dossier de ces fichiers : lis-les par leur nom. Pour un tableau, seul son portrait est fourni (colonnes, types, bornes, premières lignes) : utilise exactement ces noms de colonnes et n'invente aucune valeur.",
    ...files.map((f) =>
      f.kind === 'table'
        ? `### Tableau : ${f.name}\n${f.content}`
        : `### Fichier : ${f.name}${f.partial ? ' (début seulement)' : ''}\n\`\`\`\n${f.content}\n\`\`\``,
    ),
  ].join('\n\n');
}

if (typeof module !== 'undefined')
  module.exports = {
    TABLE_EXTENSIONS,
    TEXT_EXTENSIONS,
    decodeText,
    parseTable,
    profileTable,
    describeTable,
    prepareAttachment,
    attachmentsBlock,
  };
