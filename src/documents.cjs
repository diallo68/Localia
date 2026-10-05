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
function documentContext(doc, question, budget = 10000) {
  const words = [
    ...new Set(
      question
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .match(/[a-z0-9]{4,}/g) || [],
    ),
  ];
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
  return {
    partial,
    pages: [...new Set(selected.map((c) => c.page))],
    text:
      `Document : ${doc.name}\nCouverture : ${partial ? 'EXTRAITS SEULEMENT — aucune vérification exhaustive possible' : 'tout le texte extractible'}. ${doc.emptyPages.length ? 'Pages sans texte : ' + doc.emptyPages.join(', ') + '.' : ''}\n` +
      selected
        .map((c) => `[Page ${c.page}, extrait ${Math.floor(c.offset / 1400) + 1}]\n${c.text}`)
        .join('\n\n'),
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
  extractPdf,
  importPdf,
  loadDocument,
  deleteDocument,
  pruneDocuments,
  documentContext,
};
