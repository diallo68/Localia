const { modelName } = require('./ollama.cjs');
const { metierById } = require('./metiers.js');

const LANGS = ['fr', 'en'];

// Options Ollama réglables par modèle (https://docs.ollama.com/modelfile#valid-parameters-and-values).
// Une valeur absente laisse le réglage du modèle.
const OPTIONS = {
  temperature: { min: 0, max: 2 },
  top_p: { min: 0, max: 1 },
  top_k: { min: 1, max: 500, integer: true },
  repeat_penalty: { min: 0.5, max: 2 },
  num_ctx: { min: 512, max: 262144, integer: true },
  num_predict: { min: 16, max: 32768, integer: true },
  seed: { min: 0, max: 2147483647, integer: true },
  num_thread: { min: 1, max: 128, integer: true },
};
const KEEP_ALIVE = { 0: 0, '5m': '5m', '30m': '30m', '1h': '1h' };
const THINK = ['true', 'false'];
const MAX_SYSTEM = 4000;
const MAX_MODELS = 200;

function normalizeModel(raw) {
  const result = { options: {} };
  if (!raw || typeof raw !== 'object') return result;
  for (const [name, rule] of Object.entries(OPTIONS)) {
    const value = raw.options?.[name];
    if (value === undefined || value === null || value === '') continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < rule.min || number > rule.max)
      throw new Error(`Réglage « ${name} » hors limites (${rule.min} à ${rule.max}).`);
    if (rule.integer && !Number.isInteger(number))
      throw new Error(`Réglage « ${name} » : nombre entier attendu.`);
    result.options[name] = number;
  }
  if (typeof raw.system === 'string' && raw.system.trim()) {
    if (raw.system.length > MAX_SYSTEM)
      throw new Error('Consigne permanente limitée à 4 000 caractères.');
    result.system = raw.system.trim();
  }
  if (raw.keepAlive !== undefined && raw.keepAlive !== '') {
    if (!Object.hasOwn(KEEP_ALIVE, raw.keepAlive))
      throw new Error('Durée de maintien en mémoire invalide.');
    result.keepAlive = raw.keepAlive;
  }
  if (raw.think !== undefined && raw.think !== '') {
    if (!THINK.includes(raw.think)) throw new Error('Réglage de réflexion invalide.');
    result.think = raw.think;
  }
  return result;
}

function normalizeSettings(raw) {
  // Fonctions en ligne : désactivées tant que l'utilisateur ne les active pas explicitement.
  const settings = {
    lastModel: null,
    models: {},
    online: { bibliography: false },
    remote: { enabled: false },
  };
  if (!raw || typeof raw !== 'object') return settings;
  // Accès depuis les autres appareils : désactivé tant que l'utilisateur ne l'active pas.
  settings.remote.enabled = raw.remote?.enabled === true;
  // Guide de démarrage : ne plus l'ouvrir au lancement une fois que l'utilisateur l'a demandé.
  if (raw.guideDone === true) settings.guideDone = true;
  // Métier choisi au premier lancement, et langue de l'interface.
  if (metierById(raw.metier)) settings.metier = raw.metier;
  if (LANGS.includes(raw.lang)) settings.lang = raw.lang;
  // Mots toujours masqués avant l'envoi au modèle (anonymisation des métiers sensibles).
  if (Array.isArray(raw.maskWords)) {
    const words = raw.maskWords.map((w) => String(w).trim()).filter(Boolean);
    if (words.length > 300 || words.some((w) => w.length > 100))
      throw new Error('Liste des mots masqués : 300 mots de 100 caractères au plus.');
    if (words.length) settings.maskWords = [...new Set(words)];
  }
  settings.online.bibliography = raw.online?.bibliography === true;
  if (raw.lastModel) settings.lastModel = modelName(raw.lastModel);
  const entries = Object.entries(raw.models && typeof raw.models === 'object' ? raw.models : {});
  if (entries.length > MAX_MODELS) throw new Error('Trop de modèles dans les réglages.');
  for (const [name, value] of entries) {
    const key = modelName(name);
    const model = normalizeModel(value);
    if (Object.keys(model.options).length || model.system || model.keepAlive || model.think)
      settings.models[key] = model;
  }
  return settings;
}

// Contexte du modèle lu dans son Modelfile (texte « parameters » de /api/show).
function modelContext(parameters) {
  const match = /^num_ctx\s+(\d+)\s*$/m.exec(parameters || '');
  return match ? Number(match[1]) : null;
}

module.exports = { OPTIONS, KEEP_ALIVE, normalizeSettings, modelContext };
