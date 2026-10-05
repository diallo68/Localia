// Actions sur les fichiers proposées par un modèle : contenu d'un dossier présenté au modèle, plan
// d'actions lu dans sa réponse et vérifié action par action contre l'état réel du dossier.
// Aucun accès disque ici : chargé par le processus principal, l'interface et les tests.
const ACTION_TYPES = ['create_folder', 'move', 'create_file', 'trash'];
const MAX_ACTIONS = 200;
const MAX_LISTING = 300; // entrées montrées au modèle
const MAX_FILE_CONTENT = 100000;
const TEXT_EXTENSIONS = ['md', 'txt', 'csv'];

// Chemin relatif au dossier autorisé, séparé par « / » : jamais absolu, jamais « .. », jamais caché.
function cleanPath(value) {
  if (typeof value !== 'string') throw new Error('chemin manquant');
  const raw = value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!raw) throw new Error('chemin vide');
  if (raw.startsWith('/') || /^[a-z]:/i.test(raw) || raw.startsWith('~'))
    throw new Error('chemin absolu refusé');
  const parts = raw.split('/');
  if (parts.length > 8) throw new Error('arborescence trop profonde');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') throw new Error('chemin invalide');
    if (part.startsWith('.')) throw new Error('fichier caché refusé');
    if (part.length > 200 || /[\u0000-\u001f:]/.test(part))
      throw new Error('nom de fichier invalide');
  }
  return parts.join('/');
}
const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

// Contenu du dossier, une entrée par ligne (même format pour l'assistant et pour le Benchmark).
function formatListing(entries) {
  const shown = entries.slice(0, MAX_LISTING);
  const lines = shown.map((e) =>
    e.type === 'folder'
      ? `- [dossier] ${e.path}/`
      : `- [fichier] ${e.path}${e.size != null ? ` (${formatSize(e.size)})` : ''}`,
  );
  if (entries.length > shown.length)
    lines.push(`- … ${entries.length - shown.length} autres entrées non montrées`);
  return lines.join('\n');
}
function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} o`;
  if (bytes < 1e6) return `${Math.round(bytes / 1000)} Ko`;
  return `${(bytes / 1e6).toFixed(1).replace('.', ',')} Mo`;
}
// Lecture inverse, pour vérifier une réponse du Benchmark dont la question contient un dossier.
function parseListing(text) {
  const entries = [];
  for (const m of String(text).matchAll(/^- \[(dossier|fichier)\] (.+?)\/?(?: \([^)]*\))?$/gm))
    entries.push({ type: m[1] === 'dossier' ? 'folder' : 'file', path: m[2] });
  return entries;
}

// Plan au format JSON dans la réponse : bloc ```json, sinon premier objet { … } complet.
function parsePlan(text) {
  const source = String(text);
  const candidates = [...source.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const start = source.indexOf('{');
  if (start >= 0) candidates.push(source.slice(start, source.lastIndexOf('}') + 1));
  for (const candidate of candidates) {
    let data;
    try {
      data = JSON.parse(candidate);
    } catch {
      continue;
    }
    const actions = Array.isArray(data) ? data : data?.actions;
    if (!Array.isArray(actions)) continue;
    if (actions.length > MAX_ACTIONS)
      throw new Error(`Plan trop long (${MAX_ACTIONS} actions au plus).`);
    return {
      summary: typeof data.summary === 'string' ? data.summary.slice(0, 2000) : '',
      actions,
    };
  }
  return null;
}

// Vérifie chaque action dans l'ordre, sur un état simulé du dossier : une action valide modifie
// l'état vu par les suivantes, une action refusée ne le modifie pas.
function validatePlan(actions, entries) {
  const state = new Map(entries.map((e) => [e.path, e.type]));
  const exists = (p) => p === '' || state.has(p);
  const isFolder = (p) => p === '' || state.get(p) === 'folder';
  return actions.map((raw) => {
    const action = { type: raw?.type, reason: typeof raw?.reason === 'string' ? raw.reason : '' };
    try {
      if (!ACTION_TYPES.includes(action.type)) throw new Error('type d’action inconnu');
      if (action.type === 'move') {
        action.from = cleanPath(raw.from);
        action.to = cleanPath(raw.to);
        if (!exists(action.from)) throw new Error(`« ${action.from} » n’existe pas`);
        if (action.from === action.to) throw new Error('source et destination identiques');
        if (exists(action.to)) throw new Error(`« ${action.to} » existe déjà`);
        if (!isFolder(parentOf(action.to)))
          throw new Error(`le dossier « ${parentOf(action.to)} » n’existe pas`);
        if (action.to.startsWith(action.from + '/'))
          throw new Error('un dossier ne peut pas être déplacé dans lui-même');
        // Le contenu d'un dossier déplacé le suit.
        for (const [p, type] of [...state])
          if (p === action.from || p.startsWith(action.from + '/')) {
            state.delete(p);
            state.set(action.to + p.slice(action.from.length), type);
          }
      } else {
        action.path = cleanPath(raw.path);
        if (action.type === 'trash') {
          if (!exists(action.path)) throw new Error(`« ${action.path} » n’existe pas`);
          for (const p of [...state.keys()])
            if (p === action.path || p.startsWith(action.path + '/')) state.delete(p);
        } else {
          if (exists(action.path)) throw new Error(`« ${action.path} » existe déjà`);
          // Un dossier peut être créé avec ses dossiers parents manquants (« Dalaba/2023 ») :
          // ils sont notés pour pouvoir être retirés à l'annulation.
          const parents = [];
          for (let p = parentOf(action.path); p && !exists(p); p = parentOf(p)) parents.unshift(p);
          if (action.type === 'create_folder' && parents.length) {
            action.parents = parents;
            for (const p of parents) state.set(p, 'folder');
          }
          if (!isFolder(parentOf(action.path)))
            throw new Error(`le dossier « ${parentOf(action.path)} » n’existe pas`);
          if (action.type === 'create_file') {
            const extension = action.path.split('.').pop().toLowerCase();
            if (!action.path.includes('.') || !TEXT_EXTENSIONS.includes(extension))
              throw new Error('seuls les fichiers .md, .txt et .csv peuvent être créés');
            if (typeof raw.content !== 'string') throw new Error('contenu du fichier manquant');
            if (raw.content.length > MAX_FILE_CONTENT) throw new Error('contenu trop long');
            action.content = raw.content;
          }
          state.set(action.path, action.type === 'create_folder' ? 'folder' : 'file');
        }
      }
      return { action, ok: true };
    } catch (error) {
      return { action, ok: false, error: error.message };
    }
  });
}

function describeAction(a) {
  if (a.type === 'move')
    return parentOf(a.from) === parentOf(a.to) && a.from && a.to
      ? `Renommer « ${a.from} » en « ${a.to.split('/').pop()} »`
      : `Déplacer « ${a.from} » vers « ${a.to} »`;
  if (a.type === 'create_folder')
    return `Créer le dossier « ${a.path} »${a.parents?.length ? ` (et ${a.parents.map((p) => `« ${p} »`).join(', ')})` : ''}`;
  if (a.type === 'create_file') return `Créer le fichier « ${a.path} »`;
  if (a.type === 'trash') return `Mettre « ${a.path} » à la corbeille`;
  return `Action inconnue (${a.type ?? 'sans type'})`;
}

// Vérification automatique d'une réponse : plan lu et vérifié contre le dossier décrit dans la
// question. Rien si la question ne décrit pas de dossier.
function checkPlanAnswer(answer, question) {
  const entries = parseListing(question);
  if (!entries.length) return null;
  let plan;
  try {
    plan = parsePlan(answer);
  } catch (error) {
    return { readable: false, error: error.message, valid: 0, invalid: [] };
  }
  if (!plan) return { readable: false, error: 'aucun plan JSON lisible', valid: 0, invalid: [] };
  const checked = validatePlan(plan.actions, entries);
  return {
    readable: true,
    valid: checked.filter((c) => c.ok).length,
    invalid: checked
      .filter((c) => !c.ok)
      .map((c) => ({ action: describeAction(c.action), error: c.error })),
  };
}

if (typeof module !== 'undefined')
  module.exports = {
    ACTION_TYPES,
    MAX_LISTING,
    cleanPath,
    formatListing,
    parseListing,
    parsePlan,
    validatePlan,
    describeAction,
    checkPlanAnswer,
  };
