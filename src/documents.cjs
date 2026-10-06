const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { randomUUID } = require('node:crypto');
const { detectInjection } = require('./verify.js');
const MAX_BYTES = 25 * 1024 * 1024;
async function extractPdf(file) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_BYTES)
    throw new Error('Choisissez un PDF de moins de 25 Mo.');
  const bytes = await fs.readFile(file);
  if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-')))
    throw new Error('Ce fichier n’est pas un PDF valide.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pdf-worker.cjs'), { workerData: bytes });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Lecture trop longue. Essayez un PDF plus court.'));
    }, 60000);
    worker.once('message', (result) => {
      clearTimeout(timer);
      worker.terminate();
      result.error ? reject(new Error(result.error)) : resolve(result);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Impossible de lire ce PDF.'));
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error('La lecture du PDF a été interrompue.'));
    });
  });
}
// Codage des fichiers de documents : texte brut par défaut, chiffré si le chiffrement est actif.
const PLAIN = { encode: (text) => text, decode: (buffer) => buffer.toString('utf8') };
async function importPdf(file, directory, codec = PLAIN) {
  const extracted = await extractPdf(file);
  const doc = { id: randomUUID(), name: path.basename(file), ...extracted };
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, doc.id + '.json'), codec.encode(JSON.stringify(doc)), {
    mode: 0o600,
  });
  return {
    id: doc.id,
    name: doc.name,
    pageCount: doc.pageCount,
    characters: doc.pages.reduce((n, p) => n + p.text.length, 0),
    emptyPages: doc.emptyPages,
    // Phrases adressées à une IA (injection de consignes), signalées dès l'import.
    alerts: detectInjection(doc.pages),
  };
}
const DOCUMENT_ID = /^[0-9a-f-]{36}$/;
function checkId(id) {
  if (typeof id !== 'string' || !DOCUMENT_ID.test(id)) throw new Error('Document invalide.');
}
async function loadDocument(directory, id, codec = PLAIN) {
  checkId(id);
  let buffer;
  try {
    buffer = await fs.readFile(path.join(directory, id + '.json'));
  } catch {
    throw new Error('Document introuvable. Joignez à nouveau le PDF.');
  }
  // Clé indisponible : message du chiffrement, plus utile que « introuvable ».
  const text = codec.decode(buffer);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Document illisible. Joignez à nouveau le PDF.');
  }
}
// Numéros imprimés des pages (en-tête ou pied de page), quand ils diffèrent de la position dans le
// fichier : thèse ou livre dont la page « 1 » est la 20e du PDF, pages liminaires en chiffres romains.
// Un numéro n'est retenu que s'il suit le même décalage que la majorité des pages : jamais deviné.
const ROMAN = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
function romanValue(text) {
  const values = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const v = values[text[i]];
    total += v < (values[text[i + 1]] || 0) ? -v : v;
  }
  return total;
}
function printedPages(doc) {
  const candidates = doc.pages.map((page) => {
    const lines = page.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const edge = [...lines.slice(0, 2), ...lines.slice(-2)].join(' ');
    const tokens = edge.toLowerCase().split(/[\s|–—-]+/);
    return {
      number: page.number,
      arabic: tokens.filter((t) => /^\d{1,4}$/.test(t)).map(Number),
      roman: tokens.filter((t) => t && ROMAN.test(t)),
    };
  });
  const best = (offsets, pages) => {
    const counts = new Map();
    for (const o of offsets) counts.set(o, (counts.get(o) || 0) + 1);
    let top = null;
    for (const [o, n] of counts) if (!top || n > top[1]) top = [o, n];
    return top && top[1] >= Math.max(3, pages * 0.2) ? top[0] : null;
  };
  const arabic = best(
    candidates.flatMap((c) => [...new Set(c.arabic.map((n) => c.number - n))]),
    candidates.length,
  );
  // Chiffres romains : cherchés parmi les pages sans numéro arabe (pages liminaires).
  const rest = candidates.filter((c) => arabic === null || !c.arabic.includes(c.number - arabic));
  const roman = best(
    rest.flatMap((c) => [...new Set(c.roman.map((r) => c.number - romanValue(r)))]),
    rest.length,
  );
  const labels = new Map();
  for (const c of candidates) {
    if (arabic !== null && arabic !== 0 && c.arabic.includes(c.number - arabic))
      labels.set(c.number, String(c.number - arabic));
    else if (roman !== null) {
      const r = c.roman.find((x) => romanValue(x) === c.number - roman);
      if (r) labels.set(c.number, r);
    }
  }
  return labels;
}

function terms(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]{4,}/g) || []
  );
}

// Extraits les plus pertinents pour la question, dans la limite de « budget » caractères.
function documentContext(doc, question, budget = 10000) {
  const words = [...new Set(terms(question))];
  const chunks = [];
  for (const page of doc.pages)
    for (let offset = 0; offset < page.text.length; offset += 1400) {
      const text = page.text.slice(offset, offset + 1400);
      const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      chunks.push({
        page: page.number,
        offset,
        text,
        score: words.reduce((n, w) => n + (normalized.includes(w) ? 1 : 0), 0),
      });
    }
  const selected = [];
  let size = 0;
  for (const chunk of [...chunks].sort(
    (a, b) => b.score - a.score || a.page - b.page || a.offset - b.offset,
  )) {
    const length = chunk.text.length + 40;
    if (size + length > budget) continue;
    selected.push(chunk);
    size += length;
  }
  selected.sort((a, b) => a.page - b.page || a.offset - b.offset);
  const partial = selected.length < chunks.length;
  const printed = doc.web ? new Map() : printedPages(doc);
  const label = (c) =>
    `[Page ${c.page}, extrait ${Math.floor(c.offset / 1400) + 1}` +
    (printed.has(c.page) ? ` — page imprimée ${printed.get(c.page)}]` : ']');
  return {
    partial,
    pages: [...new Set(selected.map((c) => c.page))],
    text:
      `Document : ${doc.name}\nCouverture : ${partial ? 'EXTRAITS SEULEMENT — aucune vérification exhaustive possible' : 'tout le texte extractible'}. ${doc.emptyPages.length ? 'Pages sans texte : ' + doc.emptyPages.join(', ') + '.' : ''}\n` +
      (printed.size
        ? '« Page N » = position dans le fichier PDF (couverture = page 1) ; « page imprimée » = numéro inscrit sur la page.\n'
        : '') +
      selected.map((c) => `${label(c)}\n${c.text}`).join('\n\n'),
  };
}
async function deleteDocument(directory, id) {
  checkId(id);
  await fs.rm(path.join(directory, id + '.json'), { force: true });
}
// Supprime les textes extraits qu'aucune conversation ne référence plus.
async function pruneDocuments(directory, keepIds) {
  if (!Array.isArray(keepIds)) throw new Error('Liste de documents invalide.');
  const keep = new Set(keepIds);
  let files;
  try {
    files = await fs.readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
  let removed = 0;
  for (const file of files) {
    const id = file.slice(0, -'.json'.length);
    if (!file.endsWith('.json') || !DOCUMENT_ID.test(id) || keep.has(id)) continue;
    await fs.rm(path.join(directory, file), { force: true });
    removed++;
  }
  return removed;
}
module.exports = {
  printedPages,
  extractPdf,
  importPdf,
  loadDocument,
  deleteDocument,
  pruneDocuments,
  documentContext,
};
