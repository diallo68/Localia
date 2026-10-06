// Moteur intégré, côté processus principal : registre des modèles (fichiers GGUF), reprise des
// modèles déjà téléchargés par Ollama, et dialogue avec le processus du moteur (llama-worker.mjs).
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

const PREFIX = 'integre/';
const isLocal = (name) => typeof name === 'string' && name.startsWith(PREFIX);

// Fichier GGUF d'un modèle Ollama, d'après son manifeste (~/.ollama/models).
// Dossiers où Ollama range ses modèles : OLLAMA_MODELS (dossier déplacé, parfois sur un disque
// externe non branché), dossier personnel, service Linux. Le premier qui contient le modèle gagne.
const ollamaRoots = () =>
  [
    process.env.OLLAMA_MODELS,
    path.join(os.homedir(), '.ollama', 'models'),
    '/usr/share/ollama/.ollama/models',
  ].filter(Boolean);
async function ollamaModelFile(name, roots = ollamaRoots()) {
  let lastError;
  for (const root of [].concat(roots)) {
    try {
      return await modelFileIn(name, root);
    } catch (error) {
      lastError = error;
      if (!/introuvable/.test(error.message)) throw error;
    }
  }
  throw lastError;
}
async function modelFileIn(name, root) {
  const [base, tag = 'latest'] = String(name).split(':');
  const parts = base.includes('/') ? base.split('/') : ['library', base];
  const manifest = path.join(root, 'manifests', 'registry.ollama.ai', ...parts, tag);
  let data;
  try {
    data = JSON.parse(await fs.readFile(manifest, 'utf8'));
  } catch {
    throw new Error(`Modèle Ollama introuvable sur cet ordinateur : ${name}.`);
  }
  const layer = (data.layers || []).find(
    (l) => l.mediaType === 'application/vnd.ollama.image.model',
  );
  if (!layer?.digest) throw new Error(`Manifeste Ollama sans fichier de modèle : ${name}.`);
  const file = path.join(root, 'blobs', layer.digest.replace(':', '-'));
  const handle = await fs.open(file, 'r').catch(() => null);
  if (!handle) throw new Error(`Fichier du modèle absent : ${name}.`);
  const magic = Buffer.alloc(4);
  await handle.read(magic, 0, 4, 0);
  await handle.close();
  if (magic.toString() !== 'GGUF')
    throw new Error(`Ce fichier n’est pas au format GGUF : ${name}.`);
  const params = (data.layers || []).find(
    (l) => l.mediaType === 'application/vnd.ollama.image.params',
  );
  let parameters = {};
  if (params?.digest)
    parameters = JSON.parse(
      await fs
        .readFile(path.join(root, 'blobs', params.digest.replace(':', '-')), 'utf8')
        .catch(() => '{}'),
    );
  return { file, digest: layer.digest, size: layer.size, parameters };
}

// Fichier déjà présent chez Ollama avec la même empreinte (Ollama nomme ses fichiers d'après leur
// SHA-256) : utilisable tel quel, sans nouveau téléchargement.
async function ollamaBlobWithSha(sha256, size, roots = ollamaRoots()) {
  for (const root of [].concat(roots)) {
    const file = path.join(root, 'blobs', `sha256-${sha256}`);
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.size === size) return file;
  }
  return null;
}

// Registre : [{ name, file, source, origin, size, digest, architecture, contextLength, addedAt }].
function normalizeRegistry(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m) => isLocal(m?.name) && typeof m.file === 'string' && path.isAbsolute(m.file) && m.size > 0,
  );
}

// Processus du moteur : démarré à la première demande, redémarré s'il s'arrête.
function createEngine({ utilityProcess, workerPath, env }) {
  let child = null;
  let ready = null;
  let nextId = 1;
  const pending = new Map(); // id → { onChunk, resolve, reject }
  function start() {
    if (ready) return ready;
    child = utilityProcess.fork(workerPath, [], { serviceName: 'Localia — moteur intégré', env });
    ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Le moteur intégré ne démarre pas.')), 30000);
      child.on('message', (message) => {
        if (message.type === 'ready') {
          clearTimeout(timer);
          resolve();
          return;
        }
        const job = pending.get(message.id);
        if (!job) return;
        if (message.type === 'chunk') job.onChunk(message.data);
        else if (message.type === 'done') {
          job.onChunk(message.data);
          pending.delete(message.id);
          job.resolve();
        } else if (message.type === 'checked') {
          pending.delete(message.id);
          job.resolve(message.info);
        } else if (message.type === 'error') {
          pending.delete(message.id);
          job.reject(new Error(message.message));
        }
      });
      child.on('exit', (code) => {
        child = null;
        ready = null;
        for (const job of pending.values())
          job.reject(
            new Error(
              `Le moteur intégré s’est arrêté (code ${code}) : mémoire insuffisante ou modèle incompatible ?`,
            ),
          );
        pending.clear();
      });
    });
    return ready;
  }
  async function send(message, onChunk = () => {}) {
    await start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { onChunk, resolve, reject });
      child.postMessage({ ...message, id });
    });
  }
  return {
    // Conversation au format d'Ollama ; onData reçoit les mêmes objets que le flux d'Ollama.
    async chat({ file, body, signal, onData }) {
      await start();
      const id = nextId;
      const abort = () => child?.postMessage({ type: 'abort', id });
      signal?.addEventListener('abort', abort, { once: true });
      try {
        await send(
          {
            type: 'chat',
            path: file,
            messages: body.messages,
            options: body.options,
            think: body.think,
            keepAlive: body.keep_alive === 0 ? 0 : null,
          },
          onData,
        );
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    },
    check: (file) => send({ type: 'check', path: file }),
    unload: () => child?.postMessage({ type: 'unload' }),
    stop: () => child?.kill(),
  };
}

module.exports = {
  PREFIX,
  isLocal,
  ollamaModelFile,
  ollamaBlobWithSha,
  normalizeRegistry,
  createEngine,
};
