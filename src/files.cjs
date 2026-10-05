// Actions sur les fichiers, côté disque : uniquement dans un dossier autorisé par l'utilisateur,
// après vérification du plan (actions.js). Aucune suppression définitive, aucun écrasement.
const path = require('node:path');
const fs = require('node:fs/promises');
const { validatePlan } = require('./actions.js');
const platform = require('./platform.cjs');

const MAX_ENTRIES = 2000;
const MAX_DEPTH = 4;

// Dossiers qui ne peuvent pas être autorisés : selon le système (platform.cjs).
const forbiddenRoot = (root, dataDir) => platform.forbiddenRoot(root, dataDir);

async function checkRoot(root) {
  const stat = await fs.lstat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error('Le dossier autorisé n’existe plus.');
  if ((await fs.realpath(root)) !== root) throw new Error('Le dossier autorisé a été déplacé.');
}

// Contenu du dossier (sous-dossiers jusqu'à 4 niveaux) : fichiers cachés et liens symboliques ignorés.
async function listFolder(root) {
  await checkRoot(root);
  const entries = [];
  let truncated = false;
  async function walk(dir, prefix, depth) {
    const items = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );
    for (const item of items) {
      if (item.name.startsWith('.') || item.isSymbolicLink()) continue;
      if (entries.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        entries.push({ path: rel, type: 'folder' });
        if (depth < MAX_DEPTH) await walk(full, rel, depth + 1);
        else truncated = true;
      } else if (item.isFile()) {
        const stat = await fs.stat(full);
        entries.push({
          path: rel,
          type: 'file',
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }
  }
  await walk(root, '', 1);
  return { entries, truncated };
}

// Chemin absolu d'une entrée, contrôlé : il reste dans le dossier, et son dossier parent réel aussi
// (un lien symbolique ne peut pas faire sortir du dossier autorisé).
async function resolveInside(root, rel) {
  const full = path.join(root, ...rel.split('/'));
  const relative = path.relative(root, full);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('chemin hors du dossier autorisé');
  const parent = await fs.realpath(path.dirname(full));
  if (parent !== root && !parent.startsWith(root + path.sep))
    throw new Error('chemin hors du dossier autorisé');
  return full;
}
const missing = async (file) => !(await fs.lstat(file).catch(() => null));

// Exécute les actions dans l'ordre ; le plan est d'abord revérifié contre le dossier réel.
// Arrêt à la première erreur : les actions suivantes peuvent dépendre de celle-ci.
async function applyActions(root, actions, { trash }) {
  const { entries } = await listFolder(root);
  const checked = validatePlan(actions, entries);
  const refused = checked.find((c) => !c.ok);
  if (refused) throw new Error(`Plan refusé : ${refused.error}. Rien n’a été modifié.`);
  const results = [];
  let stopped = false;
  for (const { action } of checked) {
    const result = { ...action, done: false };
    delete result.content;
    results.push(result);
    if (stopped) {
      result.error = 'non exécutée (une action précédente a échoué)';
      continue;
    }
    try {
      if (action.type === 'create_folder') {
        // Parents manquants d'abord, un par un : chacun est contrôlé dans le dossier autorisé.
        for (const parent of action.parents || [])
          await fs.mkdir(await resolveInside(root, parent));
        await fs.mkdir(await resolveInside(root, action.path));
      } else if (action.type === 'create_file') {
        await fs.writeFile(await resolveInside(root, action.path), action.content, { flag: 'wx' });
      } else if (action.type === 'move') {
        const from = await resolveInside(root, action.from);
        const to = await resolveInside(root, action.to);
        if (!(await missing(to))) throw new Error(`« ${action.to} » existe déjà`);
        await fs.rename(from, to);
      } else if (action.type === 'trash') {
        await trash(await resolveInside(root, action.path));
      }
      result.done = true;
    } catch (error) {
      result.error = error.code === 'EEXIST' ? 'existe déjà' : error.message;
      stopped = true;
    }
  }
  return results;
}

// Annulation, de la dernière action à la première. Les fichiers créés vont à la corbeille ; un
// dossier créé n'est retiré que s'il est vide ; ce qui est à la corbeille se récupère dans le Finder.
async function undoActions(root, results, { trash }) {
  await checkRoot(root);
  for (const result of [...results].reverse()) {
    if (!result.done || result.undone) continue;
    try {
      if (result.type === 'move') {
        const from = await resolveInside(root, result.from);
        const to = await resolveInside(root, result.to);
        if (!(await missing(from))) throw new Error(`« ${result.from} » existe à nouveau`);
        await fs.rename(to, from);
      } else if (result.type === 'create_folder') {
        await fs.rmdir(await resolveInside(root, result.path));
        for (const parent of [...(result.parents || [])].reverse())
          await fs.rmdir(await resolveInside(root, parent));
      } else if (result.type === 'create_file') {
        await trash(await resolveInside(root, result.path));
      } else if (result.type === 'trash') {
        throw new Error(`à récupérer dans ${platform.names.trash}`);
      }
      result.undone = true;
      delete result.undoError;
    } catch (error) {
      result.undoError =
        error.code === 'ENOTEMPTY'
          ? 'dossier non vide, conservé'
          : error.code === 'ENOENT'
            ? 'introuvable (déplacé ou supprimé depuis)'
            : error.message;
    }
  }
  return results;
}

module.exports = { forbiddenRoot, listFolder, resolveInside, applyActions, undoActions };
