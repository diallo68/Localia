const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  shell,
  safeStorage,
  powerSaveBlocker,
  Notification,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn, execFile } = require('node:child_process');
const os = require('node:os');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { modelName, request, readStream } = require('./ollama.cjs');
const { importPdf, loadDocument, deleteDocument, pruneDocuments } = require('./documents.cjs');
const {
  checkKind,
  taskKey,
  validateMessages,
  documentMessages,
  withSystem,
  contextSize,
  exceedsContext,
  chatBody,
  streamStats,
} = require('./chat.cjs');
const { normalizeSettings } = require('./settings.cjs');
const { verifyAnswer } = require('./verify.js');
const { taskById } = require('./tasks.js');
const { normalizeProjects, buildMemory } = require('./memory.js');
const bibliography = require('./bibliography.js');
const { formatListing, checkPlanAnswer } = require('./actions.js');
const files = require('./files.cjs');
const storage = require('./storage.cjs');
const platform = require('./platform.cjs');
const watchLogic = require('./watch.js');
const tables = require('./tables.js');
const skillsLogic = require('./skills.js');
const documentsPath = () => path.join(app.getPath('userData'), 'documents');
if (process.env.LOCALIA_TEST_DATA) app.setPath('userData', process.env.LOCALIA_TEST_DATA);
let window, service;
const tasks = new Map();
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
const send = (message) => {
  if (window && !window.isDestroyed()) window.webContents.send('progress', message);
};
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.senderFrame !== window?.webContents.mainFrame || event.senderFrame.url !== page)
      throw new Error('Accès refusé.');
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}
handle('open-questions', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: 'Importer des questions',
    properties: ['openFile'],
    filters: [{ name: 'Texte', extensions: ['txt', 'md'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const file = result.filePaths[0];
  if ((await fs.stat(file)).size > 1_000_000)
    throw new Error('Fichier de questions limité à 1 Mo.');
  return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
});
const EXPORTS = {
  csv: 'CSV',
  json: 'JSON',
  md: 'Markdown',
  svg: 'Image SVG',
};
handle('export-file', async (name, extension, content) => {
  if (!Object.hasOwn(EXPORTS, extension)) throw new Error('Format d’export inconnu.');
  if (typeof content !== 'string' || content.length > 50_000_000)
    throw new Error('Export trop volumineux.');
  const safeName = String(name || 'resultats')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  const result = await dialog.showSaveDialog(window, {
    title: 'Exporter',
    defaultPath: path.join(app.getPath('documents'), safeName + '.' + extension),
    filters: [{ name: EXPORTS[extension], extensions: [extension] }],
  });
  if (result.canceled || !result.filePath) return null;
  // BOM UTF-8 pour le CSV : Excel affiche correctement les accents.
  await fs.writeFile(result.filePath, (extension === 'csv' ? '\ufeff' : '') + content);
  return path.basename(result.filePath);
});
handle('open-grades', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: 'Importer des notes',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const file = result.filePaths[0];
  if ((await fs.stat(file)).size > 10_000_000) throw new Error('Fichier de notes limité à 10 Mo.');
  return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
});
const runCommand = (command, args) =>
  new Promise((resolve) =>
    execFile(command, args, { timeout: 3000 }, (error, stdout) =>
      resolve(error ? null : String(stdout).trim()),
    ),
  );
// Conditions de l'expérience, enregistrées avec chaque série de comparaison.
handle('environment', async (names) => {
  if (!Array.isArray(names) || names.length > 50) throw new Error('Liste de modèles invalide.');
  const [version, tags, system] = await Promise.all([
    request('/api/version')
      .then((r) => r.json())
      .catch(() => ({})),
    request('/api/tags')
      .then((r) => r.json())
      .catch(() => ({ models: [] })),
    platform.systemInfo(),
  ]);
  const models = {};
  for (const name of names.map(modelName)) {
    const m = (tags.models || []).find((x) => x.name === name);
    models[name] = m
      ? {
          digest: m.digest,
          size: m.size,
          family: m.details?.family ?? null,
          parameterSize: m.details?.parameter_size ?? null,
          quantization: m.details?.quantization_level ?? null,
          modifiedAt: m.modified_at ?? null,
        }
      : null;
  }
  return {
    capturedAt: new Date().toISOString(),
    localia: app.getVersion(),
    ollama: version.version ?? null,
    machine: {
      cpu: os.cpus()[0]?.model ?? null,
      physicalCores: system.physicalCores,
      logicalCores: os.cpus().length,
      memoryGB: Math.round(os.totalmem() / 2 ** 30),
      arch: process.arch,
      platform: process.platform,
      os: system.os,
      // Champ historique (séries enregistrées avant la prise en charge de Windows).
      ...(system.macos ? { macos: system.macos } : {}),
    },
    models,
  };
});
handle('attach-pdf', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: 'Joindre un document PDF',
    properties: ['openFile'],
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return importPdf(result.filePaths[0], documentsPath(), documentCodec);
});
// Fichier texte joint à une conversation (consignes, code, tableau de données) : enregistré comme
// un document (chiffré si le chiffrement est actif) ; un tableau est résumé en portrait.
// Un seul bouton « Ajouter » : un PDF devient le document de la conversation (lu page par page),
// tout autre fichier accepté devient un fichier joint (texte, code, portrait d'un tableau).
handle('attach', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: 'Ajouter à la conversation',
    properties: ['openFile'],
    filters: [
      {
        name: 'PDF, consignes, code et données',
        extensions: ['pdf', ...tables.TEXT_EXTENSIONS, ...tables.TABLE_EXTENSIONS],
      },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const file = result.filePaths[0];
  if (/\.pdf$/i.test(file))
    return { kind: 'pdf', doc: await importPdf(file, documentsPath(), documentCodec) };
  return { kind: 'file', file: await saveTextAttachment(file) };
});
async function saveTextAttachment(file) {
  if ((await fs.stat(file)).size > 50_000_000) throw new Error('Fichier limité à 50 Mo.');
  const name = path.basename(file);
  const prepared = tables.prepareAttachment(name, await fs.readFile(file));
  const doc = { id: crypto.randomUUID(), name, file: true, ...prepared };
  await fs.mkdir(documentsPath(), { recursive: true });
  await fs.writeFile(
    path.join(documentsPath(), doc.id + '.json'),
    documentCodec.encode(JSON.stringify(doc)),
    { mode: 0o600 },
  );
  return {
    id: doc.id,
    name,
    kind: doc.kind,
    summary: doc.summary,
    preview: doc.kind === 'table' ? doc.content : null,
  };
}
handle('delete-document', (id) => deleteDocument(documentsPath(), id));
// Vérifications automatiques d'une réponse (calculs ; avec document : pages, citations, chiffres).
handle('verify-answer', async (payload) => {
  const answer = payload?.answer;
  const question = typeof payload?.question === 'string' ? payload.question.slice(0, 100000) : '';
  if (typeof answer !== 'string' || answer.length > 200000) throw new Error('Réponse invalide.');
  const doc = payload.documentId
    ? await loadDocument(documentsPath(), payload.documentId, documentCodec)
    : null;
  const report = verifyAnswer({ answer, question, doc });
  // Question décrivant un dossier (Benchmark « Actions sur fichiers ») : plan vérifié.
  const plan = checkPlanAnswer(answer, question);
  if (plan) report.plan = plan;
  return report;
});
handle('prune-documents', (keepIds) => pruneDocuments(documentsPath(), keepIds));
handle('models', async () =>
  (await (await request('/api/tags')).json()).models.filter(
    (m) => !m.remote_host && !/cloud/i.test(m.name),
  ),
);
// Guide de démarrage : Ollama installé et actif, modèles, mémoire et place libre sur le disque.
handle('setup-status', async () => {
  const [version, tags, disk] = await Promise.all([
    request('/api/version', null, AbortSignal.timeout(3000))
      .then((r) => r.json())
      .catch(() => null),
    request('/api/tags', null, AbortSignal.timeout(3000))
      .then((r) => r.json())
      .catch(() => null),
    fs.statfs(os.homedir()).catch(() => null),
  ]);
  return {
    ollamaPath: platform.ollamaPath(),
    running: Boolean(version || tags),
    version: version?.version ?? null,
    models: tags?.models?.length ?? 0,
    memoryGB: Math.round(os.totalmem() / 2 ** 30),
    freeDiskGB: disk ? Math.round((disk.bavail * disk.bsize) / 1e9) : null,
    platform: process.platform,
  };
});
// Onglet Performances : matériel, Ollama, modèles installés et chargés, vitesses déjà mesurées.
handle('pc-scan', async () => {
  const [system, gpus, disk, tags, loaded, measured] = await Promise.all([
    platform.systemInfo(),
    platform.graphicsCards(),
    fs.statfs(os.homedir()).catch(() => null),
    request('/api/tags', null, AbortSignal.timeout(3000))
      .then((r) => r.json())
      .catch(() => null),
    request('/api/ps', null, AbortSignal.timeout(3000))
      .then((r) => r.json())
      .catch(() => null),
    readJson('performance.json', {}, 'Mesures illisibles.').catch(() => ({})),
  ]);
  return {
    platform: process.platform,
    arch: process.arch,
    os: system.os,
    cpu: os.cpus()[0]?.model?.trim() ?? null,
    physicalCores: system.physicalCores,
    logicalCores: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 2 ** 30),
    freeMemoryGB: Math.round((os.freemem() / 2 ** 30) * 10) / 10,
    gpus,
    freeDiskGB: disk ? Math.round((disk.bavail * disk.bsize) / 1e9) : null,
    ollama: Boolean(tags),
    models: (tags?.models || [])
      .filter((m) => !m.remote_host && !/cloud/i.test(m.name))
      .map((m) => ({ name: m.name, size: m.size, parameters: m.details?.parameter_size ?? null })),
    loaded: (loaded?.models || []).map((m) => ({ name: m.name, size: m.size, vram: m.size_vram })),
    measured,
  };
});
// Mesure rapide de la vitesse d'un modèle : une courte réponse, puis le modèle est déchargé.
// Même verrou que les conversations et les comparaisons : jamais pendant une série du Benchmark.
handle('pc-measure', async (name) => {
  const model = modelName(name);
  const key = taskKey('chat');
  if (tasks.has(key))
    throw new Error('Une conversation ou une comparaison est en cours : réessayez après.');
  const controller = new AbortController();
  tasks.set(key, controller);
  try {
    const response = await request(
      '/api/generate',
      {
        model,
        prompt: 'Explique en cinq phrases simples à quoi sert la météo pour un agriculteur.',
        stream: false,
        keep_alive: 0,
        options: { temperature: 0, seed: 42, num_predict: 120 },
      },
      controller.signal,
    );
    const data = await response.json();
    const result = {
      tokensPerSecond:
        data.eval_count && data.eval_duration ? data.eval_count / (data.eval_duration / 1e9) : null,
      promptPerSecond:
        data.prompt_eval_count && data.prompt_eval_duration
          ? data.prompt_eval_count / (data.prompt_eval_duration / 1e9)
          : null,
      loadSeconds: data.load_duration ? data.load_duration / 1e9 : null,
      tokens: data.eval_count ?? null,
      measuredAt: new Date().toISOString(),
    };
    const measured = await readJson('performance.json', {}, 'Mesures illisibles.').catch(
      () => ({}),
    );
    measured[model] = result;
    await writeJson('performance.json', measured, 'Mesures trop volumineuses.');
    return result;
  } finally {
    tasks.delete(key);
  }
});
// Seule adresse ouverte dans le navigateur par le guide.
handle('open-ollama-download', () => shell.openExternal('https://ollama.com/download'));
handle('start-service', async () => {
  try {
    await request('/api/tags');
    return;
  } catch {}
  if (!service) {
    const executable = platform.ollamaPath();
    if (!executable)
      throw new Error(
        `Ollama est introuvable. Installez-le depuis ollama.com (emplacements cherchés : ${platform.ollamaCandidates().join(', ')}).`,
      );
    service = spawn(executable, ['serve'], {
      stdio: 'ignore',
      env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NO_CLOUD: '1' },
    });
    service.on('error', () => {
      service = null;
    });
    service.on('exit', () => {
      service = null;
    });
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await request('/api/tags', null, AbortSignal.timeout(500));
      return;
    } catch {}
  }
  throw new Error(
    'Impossible de démarrer Ollama. Vérifiez son installation (ollama.com) ou ouvrez l’application Ollama.',
  );
});
handle('run', async (kind, payload) => {
  checkKind(kind);
  const key = taskKey(kind);
  if (tasks.has(key)) throw new Error('Une opération est déjà en cours.');
  const model = modelName(payload?.model);
  const chatLike = kind !== 'pull';
  // Onglet Fichiers : la question est construite ici, avec le contenu réel du dossier autorisé.
  if (kind === 'files') payload = await filesPayload(payload);
  if (chatLike) validateMessages(payload.messages);
  const controller = new AbortController();
  tasks.set(key, controller);
  let responseText = '';
  let thinking = '';
  let final = null;
  let used = null;
  let sent = null;
  try {
    let body = { model, stream: true };
    if (chatLike) {
      const info = await showModel(model);
      const modelSettings = (await readSettings()).models[model] || {};
      // Compétence choisie (menu Tâche ou « /appel ») : sa consigne, ses fichiers, et la tâche de base.
      const skill =
        typeof payload.skill === 'string' && payload.skill
          ? await skillContext(payload.skill)
          : null;
      if (skill) send({ kind: 'skill', data: { name: skill.skill.name, call: skill.skill.call } });
      // Consigne de la tâche choisie (assistant de recherche), ajoutée à la consigne permanente.
      const taskId = skill?.skill.task || payload.task;
      const task = taskId ? taskById(taskId) : null;
      if (taskId && !task) throw new Error('Type de tâche inconnu.');
      // Mémoire du projet de la conversation : notes de l'utilisateur, choisies selon la question.
      let memory = null;
      if (payload.projectId) {
        const projects = normalizeProjects(
          await readJson('projects.json', [], 'Projets illisibles.'),
        );
        const project = projects.find((p) => p.id === payload.projectId);
        if (!project) throw new Error('Projet introuvable : il a peut-être été supprimé.');
        memory = buildMemory(project, payload.messages.at(-1)?.content || '');
        if (memory)
          send({
            kind: 'memory',
            data: { project: project.name, notes: memory.notes, partial: memory.partial },
          });
      }
      // Fichiers joints (consignes, code, portrait des tableaux), au plus 5.
      const fileIds = Array.isArray(payload.fileIds) ? payload.fileIds.slice(0, 5) : [];
      const files = [...(skill?.files || [])];
      for (const id of fileIds) {
        const doc = await loadDocument(documentsPath(), id, documentCodec);
        if (!doc.file) throw new Error('Fichier joint invalide.');
        files.push(doc);
      }
      if (files.length) send({ kind: 'files-context', data: { names: files.map((f) => f.name) } });
      const system = [
        modelSettings.system,
        task?.instruction,
        skill?.instruction,
        memory?.text,
        tables.attachmentsBlock(files),
      ]
        .filter(Boolean)
        .join('\n\n');
      const withDocument = Boolean(payload.documentId);
      const numCtx = contextSize(
        modelSettings,
        info,
        withDocument || kind === 'files' || files.length > 0,
      );
      let messages = payload.messages;
      if (withDocument) {
        const doc = await loadDocument(documentsPath(), payload.documentId, documentCodec);
        const context = documentMessages(doc, messages, system);
        messages = context.messages;
        // Messages exacts envoyés (consigne, extraits, question) : conservés pour la reproductibilité.
        sent = { pages: context.pages, partial: context.partial, messages };
        send({ kind: 'document', data: { partial: context.partial, pages: context.pages } });
      } else {
        messages = withSystem(messages, system);
        if (kind === 'chat' && exceedsContext(payload.messages, numCtx))
          send({ kind: 'context', data: {} });
      }
      // Comparaison : le modèle est déchargé après sa dernière question pour libérer la mémoire.
      body = chatBody({
        model,
        messages,
        numCtx,
        modelSettings,
        info,
        keepAlive: kind === 'compare' && payload.keepLoaded !== true ? 0 : undefined,
      });
      used = { ...body.options, system: Boolean(modelSettings.system) };
      if (task) used.task = task.id;
      if (memory) used.memoryNotes = memory.notes.length;
      if (files.length) used.files = files.map((f) => f.name);
      if (skill) used.skill = skill.skill.call;
      if (body.think !== undefined) used.think = body.think;
    }
    const response = await request(chatLike ? '/api/chat' : '/api/pull', body, controller.signal);
    await readStream(response.body, (data) => {
      if (chatLike) {
        responseText += data.message?.content || '';
        thinking += data.message?.thinking || '';
        if (data.done) final = data;
      }
      send({ kind, data });
    });
    if (chatLike && !sent) sent = { messages: body.messages };
    return {
      cancelled: false,
      text: responseText,
      thinking,
      stats: streamStats(final),
      used,
      sent,
    };
  } catch (error) {
    if (controller.signal.aborted)
      return { cancelled: true, text: responseText, thinking, used, sent };
    throw error;
  } finally {
    tasks.delete(key);
  }
});
handle('cancel', (kind) => tasks.get(taskKey(kind))?.abort());
// Fiche du modèle demandée avant chaque réponse. Ollama peut être lent à répondre pendant qu'un
// gros modèle travaille : délai long et un second essai.
async function showModel(model) {
  let response;
  try {
    response = await request('/api/show', { model }, AbortSignal.timeout(60000));
  } catch {
    response = await request('/api/show', { model }, AbortSignal.timeout(60000));
  }
  const info = await response.json();
  if (info.remote_host || info.remote_model)
    throw new Error('Les modèles distants ne sont pas autorisés.');
  return info;
}
handle('model-info', async (name) => {
  const info = await showModel(modelName(name));
  const contextKey = Object.keys(info.model_info || {}).find((k) => k.endsWith('.context_length'));
  return {
    family: info.details?.family || null,
    parameterSize: info.details?.parameter_size || null,
    quantization: info.details?.quantization_level || null,
    capabilities: Array.isArray(info.capabilities) ? info.capabilities : [],
    maxContext: contextKey ? info.model_info[contextKey] : null,
    parameters: typeof info.parameters === 'string' ? info.parameters : '',
  };
});

// Fichiers JSON du dossier de données : écriture atomique, une file d'attente par fichier.
const dataPath = (name) => path.join(app.getPath('userData'), name);
const writeQueues = new Map();
async function readJson(name, fallback, unreadable) {
  let buffer;
  try {
    buffer = await fs.readFile(dataPath(name));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(unreadable);
  }
  const text = storage.decrypt(buffer, dataKey); // message explicite si la clé manque
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(unreadable);
  }
}
// Contenu à écrire, calculé au moment de l'écriture : suit l'état du chiffrement à cet instant.
function encodeData(text) {
  if (!encryptionEnabled) return text;
  if (!dataKey)
    throw new Error(
      'Données chiffrées verrouillées : rien n’est enregistré tant que la clé n’est pas retrouvée.',
    );
  return storage.encrypt(text, dataKey);
}
const documentCodec = {
  encode: encodeData,
  decode: (buffer) => storage.decrypt(buffer, dataKey),
};
function queueWrite(name, produce) {
  const queue = (writeQueues.get(name) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const text = await produce();
      if (text == null) return; // rien à écrire (fichier absent)
      const data = encodeData(text);
      await fs.mkdir(app.getPath('userData'), { recursive: true });
      await fs.writeFile(dataPath(name) + '.tmp', data, { mode: 0o600 });
      await fs.rename(dataPath(name) + '.tmp', dataPath(name));
    });
  writeQueues.set(name, queue);
  return queue;
}
// Tests automatiques : attendre la fin des écritures en cours avant de relire les fichiers.
if (process.env.LOCALIA_TEST_DATA)
  global.localiaWritesSettled = () =>
    Promise.all([...writeQueues.values()].map((q) => q.catch(() => {})));
function writeJson(name, value, tooLarge) {
  const data = JSON.stringify(value);
  if (data.length > 20_000_000) throw new Error(tooLarge);
  return queueWrite(name, () => data);
}

// --- Chiffrement des données -----------------------------------------------------------------
// La clé de données (aléatoire) est enregistrée dans « cle.bin », elle-même chiffrée par le
// coffre de clés du système (safeStorage : trousseau de macOS, protection des données de Windows).
// Chiffrement actif = ce fichier existe.
const DATA_FILES = [
  'conversations.json',
  'comparisons.json',
  'projects.json',
  'settings.json',
  'folders.json',
  'actions-journal.json',
  'watch.json',
  'performance.json',
];
const keyPath = () => dataPath('cle.bin');
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
let dataKey = null;
let encryptionEnabled = false;
let keyError = null;
// Tests automatiques seulement : trousseau simulé, pour ne jamais toucher au vrai trousseau.
const testKeychain = process.env.LOCALIA_TEST_DATA ? process.env.LOCALIA_TEST_KEYCHAIN : null;
const keychain = testKeychain
  ? {
      available: () => true,
      encrypt: (text) => Buffer.from('SIMULE:' + text),
      decrypt: (buffer) => {
        if (testKeychain === 'refuse') throw new Error('refusé');
        return buffer.toString().slice('SIMULE:'.length);
      },
    }
  : {
      // Linux sans trousseau (GNOME Keyring, KWallet) : Electron « chiffre » avec une clé fixe
      // connue (« basic_text ») ; Localia refuse plutôt que de donner une fausse sécurité.
      available: () =>
        safeStorage.isEncryptionAvailable() &&
        !(
          process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text'
        ),
      encrypt: (text) => safeStorage.encryptString(text),
      decrypt: (buffer) => safeStorage.decryptString(buffer),
    };
async function loadKey() {
  let sealed;
  try {
    sealed = await fs.readFile(keyPath());
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  encryptionEnabled = true;
  try {
    dataKey = Buffer.from(keychain.decrypt(sealed), 'base64');
    if (dataKey.length !== 32) throw new Error('clé invalide');
  } catch {
    dataKey = null;
    keyError = `${capitalize(platform.names.keystore)} n’a pas rendu la clé de chiffrement (accès refusé ou réinitialisé). Importez la clé de secours.`;
  }
}
async function saveKey(key) {
  if (!keychain.available())
    throw new Error(`${capitalize(platform.names.keystore)} est indisponible.`);
  const sealed = keychain.encrypt(key.toString('base64'));
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(keyPath() + '.tmp', sealed, { mode: 0o600 });
  await fs.rename(keyPath() + '.tmp', keyPath());
}
async function documentFiles() {
  try {
    return (await fs.readdir(documentsPath()))
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(documentsPath(), f));
  } catch {
    return [];
  }
}
// Tous les fichiers de données réécrits selon l'état actuel (chiffrés ou en clair).
async function rewriteAll() {
  for (const name of DATA_FILES)
    await queueWrite(name, async () => {
      try {
        return storage.decrypt(await fs.readFile(dataPath(name)), dataKey);
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    });
  for (const file of await documentFiles()) {
    const text = storage.decrypt(await fs.readFile(file), dataKey);
    await fs.writeFile(file + '.tmp', encodeData(text), { mode: 0o600 });
    await fs.rename(file + '.tmp', file);
  }
}
async function encryptionStatus() {
  const all = [
    ...(await Promise.all(DATA_FILES.map((n) => fs.readFile(dataPath(n)).catch(() => null)))),
    ...(await Promise.all((await documentFiles()).map((f) => fs.readFile(f).catch(() => null)))),
  ].filter(Boolean);
  const fileVault = await platform.diskEncryption();
  return {
    enabled: encryptionEnabled,
    unlocked: Boolean(dataKey),
    error: encryptionEnabled && !dataKey ? keyError : null,
    keychain: keychain.available(),
    files: all.length,
    encryptedFiles: all.filter(storage.isEncrypted).length,
    fileVault,
  };
}
handle('encryption-status', async () => ({
  ...(await encryptionStatus()),
  keystore: platform.names.keystore,
}));
handle('encryption-enable', async () => {
  if (encryptionEnabled) return encryptionStatus();
  const key = storage.newKey();
  await saveKey(key);
  dataKey = key;
  encryptionEnabled = true;
  await rewriteAll();
  return encryptionStatus();
});
handle('encryption-disable', async () => {
  if (!encryptionEnabled) return encryptionStatus();
  if (!dataKey) throw new Error('Clé indisponible : importez d’abord la clé de secours.');
  encryptionEnabled = false;
  try {
    await rewriteAll();
  } catch (error) {
    encryptionEnabled = true;
    throw new Error(`Déchiffrement interrompu (${error.message}) : le chiffrement reste actif.`);
  }
  await fs.rm(keyPath(), { force: true });
  dataKey = null;
  return encryptionStatus();
});
handle('encryption-export-key', async () => {
  if (!dataKey) throw new Error('Aucune clé à exporter : le chiffrement n’est pas actif.');
  const result = await dialog.showSaveDialog(window, {
    title: 'Enregistrer la clé de secours',
    defaultPath: path.join(app.getPath('documents'), 'localia-cle-de-secours.txt'),
    filters: [{ name: 'Texte', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(
    result.filePath,
    [
      'Clé de secours de Localia',
      '',
      'Elle déchiffre toutes vos données Localia : conversations, comparaisons, projets, textes des PDF.',
      'Gardez-la hors de cet ordinateur (clé USB, gestionnaire de mots de passe) et ne la partagez pas.',
      `Pour l’utiliser : Réglages des modèles → Données sur ${process.platform === 'darwin' ? 'ce Mac' : 'cet ordinateur'} → Importer la clé de secours.`,
      '',
      storage.recoveryText(dataKey),
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return path.basename(result.filePath);
});
handle('encryption-import-key', async () => {
  if (!encryptionEnabled) throw new Error('Le chiffrement n’est pas actif.');
  const result = await dialog.showOpenDialog(window, {
    title: 'Importer la clé de secours',
    properties: ['openFile'],
    filters: [{ name: 'Texte', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const file = result.filePaths[0];
  if ((await fs.stat(file)).size > 100_000) throw new Error('Fichier trop volumineux.');
  const key = storage.parseRecovery(await fs.readFile(file, 'utf8'));
  // La clé doit ouvrir les fichiers chiffrés existants.
  for (const name of DATA_FILES) {
    const buffer = await fs.readFile(dataPath(name)).catch(() => null);
    if (buffer && storage.isEncrypted(buffer)) {
      storage.decrypt(buffer, key);
      break;
    }
  }
  await saveKey(key);
  dataKey = key;
  keyError = null;
  // Interface rechargée par le processus principal (la navigation de la page reste bloquée) :
  // conversations, comparaisons et projets sont relus avec la clé retrouvée.
  setTimeout(() => window?.webContents.reload(), 100);
  return encryptionStatus();
});

handle('load', () =>
  readJson('conversations.json', [], 'Historique illisible. Le fichier existant a été conservé.'),
);
handle('save', (conversations) => {
  if (!Array.isArray(conversations)) throw new Error('Historique invalide.');
  return writeJson('conversations.json', conversations, 'Historique trop volumineux.');
});
async function readSettings() {
  try {
    return normalizeSettings(await readJson('settings.json', {}, 'Réglages illisibles.'));
  } catch {
    return normalizeSettings({});
  }
}
handle('load-settings', readSettings);
handle('save-settings', async (settings) => {
  const normalized = normalizeSettings(settings);
  await writeJson('settings.json', normalized, 'Réglages trop volumineux.');
  return normalized;
});
handle('load-comparisons', () =>
  readJson('comparisons.json', [], 'Comparaisons illisibles. Le fichier existant a été conservé.'),
);
handle('save-comparisons', (comparisons) => {
  if (!Array.isArray(comparisons)) throw new Error('Comparaisons invalides.');
  return writeJson('comparisons.json', comparisons, 'Comparaisons trop volumineuses.');
});
handle('load-projects', async () =>
  normalizeProjects(
    await readJson('projects.json', [], 'Projets illisibles. Le fichier existant a été conservé.'),
  ),
);
handle('save-projects', async (projects) => {
  const normalized = normalizeProjects(projects);
  await writeJson('projects.json', normalized, 'Projets trop volumineux.');
  return normalized;
});
// --- Actions sur les fichiers -------------------------------------------------------------------
// Les dossiers autorisés ne s'ajoutent que par la fenêtre de choix du système (geste de
// l'utilisateur) : ni l'interface ni un modèle ne peuvent en ajouter un autrement.
const MAX_FOLDERS = 20;
const MAX_BATCHES = 100;
async function readFolders() {
  const folders = await readJson('folders.json', [], 'Liste des dossiers autorisés illisible.');
  if (!Array.isArray(folders)) throw new Error('Liste des dossiers autorisés illisible.');
  return folders.filter((f) => typeof f?.id === 'string' && typeof f.path === 'string');
}
async function folderById(id) {
  const folder = (await readFolders()).find((f) => f.id === id);
  if (!folder) throw new Error('Dossier non autorisé.');
  return folder;
}
const readJournal = () => readJson('actions-journal.json', [], 'Journal des actions illisible.');
handle('files-folders', readFolders);
handle('files-add-folder', async () => {
  const result = await dialog.showOpenDialog(window, {
    title: 'Autoriser Localia à organiser ce dossier',
    buttonLabel: 'Autoriser',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const root = await fs.realpath(result.filePaths[0]);
  const reason = files.forbiddenRoot(root, app.getPath('userData'));
  if (reason)
    throw new Error(
      `Ce dossier ne peut pas être autorisé (${reason}). Choisissez un sous-dossier.`,
    );
  const folders = await readFolders();
  const existing = folders.find((f) => f.path === root);
  if (existing) return existing;
  if (folders.length >= MAX_FOLDERS) throw new Error(`${MAX_FOLDERS} dossiers autorisés au plus.`);
  const folder = {
    id: crypto.randomUUID(),
    path: root,
    name: path.basename(root),
    addedAt: new Date().toISOString(),
  };
  await writeJson('folders.json', [...folders, folder], 'Liste trop longue.');
  return folder;
});
handle('files-remove-folder', async (id) => {
  await writeJson(
    'folders.json',
    (await readFolders()).filter((f) => f.id !== id),
    'Liste trop longue.',
  );
});
handle('files-list', async (id) => files.listFolder((await folderById(id)).path));
handle('files-reveal', async (id) => {
  const error = await shell.openPath((await folderById(id)).path);
  if (error) throw new Error(error);
});
async function filesPayload(payload) {
  const folder = await folderById(payload?.folderId);
  const instruction = typeof payload.instruction === 'string' ? payload.instruction.trim() : '';
  if (!instruction || instruction.length > 4000)
    throw new Error('Décrivez ce que vous voulez faire (4 000 caractères au plus).');
  const { entries, truncated } = await files.listFolder(folder.path);
  const listing = entries.length ? formatListing(entries) : '(dossier vide)';
  return {
    model: payload.model,
    task: 'fichiers',
    messages: [
      {
        role: 'user',
        content: `Contenu du dossier « ${folder.name} » (noms, types et tailles ; chemins à partir de l’intérieur du dossier) :\n${listing}${truncated ? '\n(dossier très grand : contenu incomplet)' : ''}\n\nDemande : ${instruction}`,
      },
    ],
  };
}
handle('files-apply', async (payload) => {
  const folder = await folderById(payload?.folderId);
  if (!Array.isArray(payload.actions) || !payload.actions.length || payload.actions.length > 200)
    throw new Error('Aucune action à appliquer.');
  const results = await files.applyActions(folder.path, payload.actions, {
    trash: shell.trashItem,
  });
  const batch = {
    id: crypto.randomUUID(),
    folderId: folder.id,
    folder: folder.name,
    at: new Date().toISOString(),
    instruction: String(payload.instruction || '').slice(0, 4000),
    model: payload.model ? modelName(payload.model) : null,
    proposed: Number(payload.proposed) || payload.actions.length,
    results,
  };
  await writeJson(
    'actions-journal.json',
    [batch, ...(await readJournal())].slice(0, MAX_BATCHES),
    'Journal trop volumineux.',
  );
  return batch;
});
handle('files-journal', readJournal);
handle('files-undo', async (batchId) => {
  const journal = await readJournal();
  const batch = journal.find((b) => b.id === batchId);
  if (!batch) throw new Error('Opération introuvable dans le journal.');
  const folder = await folderById(batch.folderId);
  await files.undoActions(folder.path, batch.results, { trash: shell.trashItem });
  batch.undoneAt = new Date().toISOString();
  await writeJson('actions-journal.json', journal, 'Journal trop volumineux.');
  return batch;
});
// --- Compétences ---------------------------------------------------------------------------------
// Un fichier Markdown par compétence, dans un dossier visible de l'utilisateur (modifiable, partageable).
const skillsDir = () =>
  process.env.LOCALIA_TEST_DATA
    ? dataPath('Compétences')
    : path.join(app.getPath('documents'), 'Localia', 'Compétences');
const STARTER_SKILLS = path.join(__dirname, 'skills');
// Compétences de départ copiées une seule fois : une compétence supprimée n'est pas recréée, une
// compétence modifiée n'est jamais écrasée.
async function installStarterSkills() {
  const dir = skillsDir();
  await fs.mkdir(dir, { recursive: true });
  const record = path.join(dir, '.installees.json');
  const installed = new Set(await fs.readFile(record, 'utf8').then(JSON.parse, () => []));
  for (const name of await fs.readdir(STARTER_SKILLS)) {
    if (installed.has(name)) continue;
    const target = path.join(dir, name);
    const exists = await fs.stat(target).then(
      () => true,
      () => false,
    );
    if (!exists) await fs.writeFile(target, await fs.readFile(path.join(STARTER_SKILLS, name)));
    installed.add(name);
  }
  await fs.writeFile(record, JSON.stringify([...installed].sort(), null, 1));
}
let skillsReady = null;
async function loadSkills() {
  skillsReady ||= installStarterSkills().catch(() => {});
  await skillsReady;
  const dir = skillsDir();
  const names = (await fs.readdir(dir).catch(() => []))
    .filter((n) => n.endsWith('.md') && !n.startsWith('.'))
    .slice(0, 300);
  const entries = [];
  for (const name of names) {
    const file = path.join(dir, name);
    if ((await fs.stat(file)).size > 60_000) continue;
    entries.push({ name, text: await fs.readFile(file, 'utf8') });
  }
  return { dir, ...skillsLogic.buildCatalog(entries) };
}
// Fichier du dossier des compétences seulement (ni sous-dossier, ni chemin qui en sort).
function skillFile(name) {
  const dir = skillsDir();
  const file = path.join(dir, String(name));
  if (path.dirname(file) !== dir || path.basename(file).startsWith('.'))
    throw new Error('Fichier de compétence invalide.');
  return file;
}
handle('skills-list', loadSkills);
handle('skills-open-dir', async () => {
  await fs.mkdir(skillsDir(), { recursive: true });
  const error = await shell.openPath(skillsDir());
  if (error) throw new Error(error);
});
handle('skills-open', async (id) => {
  const skill = (await loadSkills()).skills.find((s) => s.id === id);
  if (!skill) throw new Error('Compétence introuvable.');
  const error = await shell.openPath(skillFile(skill.file));
  if (error) throw new Error(error);
});
// Nouvelle compétence : modèle prêt à remplir, ouvert dans l'éditeur de texte du système.
handle('skills-new', async () => {
  const dir = skillsDir();
  await fs.mkdir(dir, { recursive: true });
  const exists = (name) =>
    fs.stat(path.join(dir, name)).then(
      () => true,
      () => false,
    );
  let n = 1;
  let name = 'ma-competence.md';
  while (await exists(name)) name = `ma-competence-${++n}.md`;
  await fs.writeFile(
    path.join(dir, name),
    [
      '---',
      `nom: Ma compétence ${n}`,
      `appel: /${name.replace(/\.md$/, '')}`,
      'description: Ce que fait cette compétence, en une phrase.',
      'famille: Mes compétences',
      'tache: redaction',
      '---',
      '',
      'Décrivez ici, pour le modèle, ce qu’il doit faire, dans quel ordre, ce qu’il doit rendre et ce qu’il ne doit pas faire.',
      '',
    ].join('\n'),
  );
  const error = await shell.openPath(path.join(dir, name));
  if (error) throw new Error(error);
  return name;
});
// Consigne et fichiers d'une compétence, pour la conversation.
async function skillContext(id) {
  const { skills } = await loadSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill)
    throw new Error(
      `Compétence introuvable (/${id}) : elle a peut-être été supprimée ou renommée.`,
    );
  const files = [];
  for (const name of skill.files.slice(0, 5)) {
    const buffer = await fs.readFile(skillFile(name)).catch(() => null);
    if (!buffer) throw new Error(`Fichier de la compétence introuvable : ${name}.`);
    files.push({ name, ...tables.prepareAttachment(name, buffer) });
  }
  return { skill, instruction: skillsLogic.skillInstruction(skill, skills), files };
}

// --- Zotero (API locale, lecture seule) ---------------------------------------------------------
// Zotero tourne sur ce Mac : rien ne sort de l'ordinateur, la recherche en ligne n'est pas requise.
const ZOTERO_API = 'http://127.0.0.1:23119/api/users/0';
const ZOTERO_KEY = /^[A-Z0-9]{8}$/;
async function zoteroJson(route) {
  let response;
  try {
    response = await fetch(ZOTERO_API + route, {
      headers: { 'Zotero-API-Version': '3' },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Zotero n’est pas ouvert : lancez Zotero, puis réessayez.');
  }
  if (response.status === 403)
    throw new Error(
      'Zotero refuse l’accès. Dans Zotero : Réglages → Avancé → cochez « Autoriser les autres applications de cet ordinateur à communiquer avec Zotero ».',
    );
  if (!response.ok) throw new Error(`Zotero : erreur ${response.status}.`);
  return { data: await response.json(), total: Number(response.headers.get('Total-Results')) };
}
// Toute la bibliothèque (éléments principaux), gardée 30 secondes pour les vérifications en série.
let zoteroCache = null;
async function zoteroLibrary() {
  if (zoteroCache && Date.now() - zoteroCache.at < 30000) return zoteroCache.items;
  const items = [];
  for (let start = 0; start < 10000; start += 100) {
    const { data, total } = await zoteroJson(`/items/top?limit=100&start=${start}`);
    items.push(...data);
    if (!data.length || items.length >= total) break;
  }
  zoteroCache = { at: Date.now(), items };
  return items;
}
const withRecord = (item) => !['attachment', 'note', 'annotation'].includes(item.data?.itemType);
handle('zotero-status', async () => {
  const items = await zoteroLibrary();
  return { total: items.length, withRecord: items.filter(withRecord).length };
});
handle('zotero-search', async (query) => {
  if (typeof query !== 'string' || !query.trim() || query.length > 300)
    throw new Error('Recherche vide ou trop longue (300 caractères au plus).');
  const { data } = await zoteroJson(
    `/items/top?limit=30&qmode=titleCreatorYear&q=${encodeURIComponent(query.trim())}`,
  );
  return data.map(bibliography.fromZotero);
});
// Références comparées aux notices de la bibliothèque (les PDF sans notice sont ignorés).
handle('zotero-verify', async (references) => {
  if (!Array.isArray(references) || !references.length || references.length > 300)
    throw new Error('Entre 1 et 300 références à comparer.');
  zoteroCache = null;
  const works = (await zoteroLibrary()).filter(withRecord).map(bibliography.fromZotero);
  return references.map((reference) => {
    if (typeof reference !== 'string' || reference.length > 2000)
      throw new Error('Référence invalide.');
    return { reference, ...bibliography.bestMatch(reference, works) };
  });
});
handle('zotero-open', async (key) => {
  if (!ZOTERO_KEY.test(key)) throw new Error('Élément Zotero invalide.');
  await shell.openExternal(`zotero://select/library/items/${key}`);
});
// PDF d'un élément Zotero importé comme document de conversation (texte extrait sur ce Mac).
handle('zotero-pdf', async (key) => {
  if (!ZOTERO_KEY.test(key)) throw new Error('Élément Zotero invalide.');
  // Un PDF sans notice est lui-même l'élément principal : pas d'enfants.
  const children = await zoteroJson(`/items/${key}/children`).then(
    (r) => r.data,
    () => [],
  );
  const { data: parent } = await zoteroJson(`/items/${key}`);
  const pdfs = [parent, ...children].filter(
    (c) =>
      c.data?.contentType === 'application/pdf' &&
      String(c.links?.enclosure?.href || '').startsWith('file:'),
  );
  if (!pdfs.length) throw new Error('Cet élément Zotero n’a pas de PDF enregistré sur ce Mac.');
  const file = fileURLToPath(pdfs[0].links.enclosure.href);
  // Fichier de la bibliothèque Zotero uniquement (dossier « storage ») et au format PDF.
  if (!/[\\/]storage[\\/][A-Z0-9]{8}[\\/][^\\/]+\.pdf$/i.test(file))
    throw new Error('Fichier Zotero inattendu : il n’est pas importé.');
  const doc = await importPdf(file, documentsPath(), documentCodec);
  return { ...doc, title: parent.data?.title || doc.name };
});
// Zotero en écriture, sur clic explicite seulement : une notice ajoutée à « Ma bibliothèque ».
async function addToZotero(work, tags) {
  let response;
  try {
    response = await fetch('http://127.0.0.1:23119/connector/saveItems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionID: crypto.randomUUID(),
        items: [bibliography.toZoteroItem(work, tags)],
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Zotero n’est pas ouvert : lancez Zotero, puis réessayez.');
  }
  if (response.status !== 201)
    throw new Error(`Zotero n’a pas enregistré la notice (${response.status}).`);
  zoteroCache = null;
}

// --- Veille bibliographique (OpenAlex) -----------------------------------------------------------
// Sujets interrogés selon leur fréquence pendant que Localia est ouverte, seulement si la recherche
// en ligne est autorisée. Seul le texte du sujet est envoyé à OpenAlex.
const readWatch = async () =>
  watchLogic.normalizeWatch(await readJson('watch.json', {}, 'Veille bibliographique illisible.'));
let watchQueue = Promise.resolve();
// Lecture, modification et écriture de la veille, une opération à la fois.
function updateWatch(change) {
  const next = watchQueue.then(async () => {
    const watch = await readWatch();
    const result = await change(watch);
    await writeJson('watch.json', watch, 'Veille trop volumineuse.');
    return result;
  });
  watchQueue = next.catch(() => {});
  return next;
}
async function searchTopic(topic) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', topic.query);
  url.searchParams.set('filter', `from_publication_date:${watchLogic.sinceDate(topic)}`);
  // Tri par pertinence parmi les articles récents (le tri par date ramène des articles hors sujet).
  url.searchParams.set('per-page', '25');
  url.searchParams.set(
    'select',
    'id,display_name,publication_year,doi,authorships,primary_location,cited_by_count',
  );
  return ((await onlineJson(url)).results || []).map(bibliography.fromOpenAlex);
}
async function runTopics(select) {
  const watch = await readWatch();
  const topics = select(watch);
  let added = 0;
  for (const { id } of topics) {
    let works = null;
    let error = null;
    const topic = watch.topics.find((t) => t.id === id);
    try {
      works = await searchTopic(topic);
    } catch (e) {
      error = e.message;
    }
    added += await updateWatch((w) => {
      const t = w.topics.find((x) => x.id === id);
      if (!t) return 0;
      if (error) {
        t.lastError = error;
        return 0;
      }
      return watchLogic.mergeResults(w, t, works).length;
    });
  }
  if (added) {
    send({ kind: 'watch', data: { added } });
    if (Notification.isSupported()) {
      const note = new Notification({
        title: 'Veille bibliographique',
        body: `${added} nouvel(s) article(s) dans vos sujets suivis.`,
      });
      note.on('click', () => {
        window?.show();
        send({ kind: 'watch-open', data: {} });
      });
      note.show();
    }
  }
  return added;
}
let watchRunning = false;
async function runDueWatch() {
  if (watchRunning || !(await readSettings()).online.bibliography) return;
  watchRunning = true;
  try {
    await runTopics((watch) => watchLogic.dueTopics(watch));
  } catch {
    // Veille illisible ou chiffrement verrouillé : réessayée au prochain passage.
  } finally {
    watchRunning = false;
  }
}
handle('watch-load', readWatch);
handle('watch-add', (query, frequency) =>
  updateWatch((w) => watchLogic.addTopic(w, query, frequency)),
);
handle('watch-remove', (id) =>
  updateWatch((w) => {
    w.topics = w.topics.filter((t) => t.id !== id);
    w.items = w.items.filter((i) => i.topicId !== id);
  }),
);
handle('watch-run', async (id) => {
  if (!(await readSettings()).online.bibliography)
    throw new Error(
      'La recherche en ligne est désactivée. Activez-la dans l’onglet Bibliographie.',
    );
  return runTopics((watch) => watch.topics.filter((t) => t.id === id));
});
handle('watch-mark', (itemId, status) => {
  if (!watchLogic.ITEM_STATUSES.includes(status)) throw new Error('État inconnu.');
  return updateWatch((w) => {
    const item = w.items.find((i) => i.id === itemId);
    if (item) item.status = status;
  });
});
handle('watch-zotero', async (itemId) => {
  const watch = await readWatch();
  const item = watch.items.find((i) => i.id === itemId);
  if (!item) throw new Error('Article introuvable dans la veille.');
  await addToZotero(item.work, ['Veille Localia']);
  await updateWatch((w) => {
    const found = w.items.find((i) => i.id === itemId);
    if (found) found.status = 'zotero';
  });
});

// Mac maintenu éveillé pendant une série du Benchmark, ou en attendant son heure de départ.
let awakeId = null;
handle('keep-awake', (on) => {
  if (on && awakeId === null) awakeId = powerSaveBlocker.start('prevent-app-suspension');
  if (!on && awakeId !== null) {
    powerSaveBlocker.stop(awakeId);
    awakeId = null;
  }
  return awakeId !== null;
});

// --- Bibliographie -----------------------------------------------------------------------------
// Hors ligne : citations « Auteur [n] » d'un PDF importé comparées à sa liste de références.
handle('biblio-check-document', async (documentId) => {
  const doc = await loadDocument(documentsPath(), documentId, documentCodec);
  const { references } = bibliography.parseReferences(doc.pages);
  const { citations } = bibliography.checkCitations(doc.pages);
  return { name: doc.name, references, citations };
});
// En ligne (désactivé par défaut) : seules ces adresses sont autorisées, seul le texte de la recherche
// ou de la référence est envoyé.
const ONLINE_HOSTS = new Set(['api.openalex.org', 'api.crossref.org']);
async function onlineJson(url) {
  if (!(await readSettings()).online.bibliography)
    throw new Error(
      'La recherche en ligne est désactivée. Activez-la dans l’onglet Bibliographie.',
    );
  const target = new URL(url);
  if (target.protocol !== 'https:' || !ONLINE_HOSTS.has(target.hostname))
    throw new Error('Adresse non autorisée.');
  // Trop de requêtes (429) : nouvel essai après l'attente demandée par le service (au plus 3 fois).
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(target, {
        headers: { 'User-Agent': `Localia/${app.getVersion()} (bibliographie)` },
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(`${target.hostname} ne répond pas : vérifiez la connexion Internet.`);
    }
    if (response.status === 429 && attempt < 3) {
      const wait = Math.min(Number(response.headers.get('retry-after')) || 2 ** (attempt + 1), 30);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? `${target.hostname} limite le nombre de requêtes : réessayez dans quelques minutes.`
          : `${target.hostname} : erreur ${response.status}.`,
      );
    return response.json();
  }
}
handle('biblio-search', async (query) => {
  if (typeof query !== 'string' || !query.trim() || query.length > 300)
    throw new Error('Recherche vide ou trop longue (300 caractères au plus).');
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query.trim());
  url.searchParams.set('per-page', '25');
  url.searchParams.set(
    'select',
    'id,type,display_name,publication_year,doi,authorships,primary_location,cited_by_count',
  );
  const data = await onlineJson(url);
  return bibliography.uniqueWorks((data.results || []).map(bibliography.fromOpenAlex)).slice(0, 15);
});
// Notice d'une recherche ajoutée à Zotero, sur clic : champs vérifiés avant l'envoi.
handle('zotero-add-work', async (work) => {
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  if (
    !work ||
    !text(work.title, 1000) ||
    !work.title.trim() ||
    !Array.isArray(work.authors) ||
    work.authors.length > 200 ||
    !work.authors.every((a) => text(a, 300)) ||
    !(work.year == null || Number.isInteger(work.year)) ||
    !(work.venue == null || text(work.venue, 500)) ||
    !(work.doi == null || (text(work.doi, 300) && /^10\.\d{4,9}\/\S+$/.test(work.doi))) ||
    !(work.type == null || text(work.type, 50))
  )
    throw new Error('Notice invalide.');
  await addToZotero(work, ['Recherche Localia']);
});
handle('biblio-verify', async (references) => {
  if (!Array.isArray(references) || !references.length || references.length > 100)
    throw new Error('Entre 1 et 100 références à vérifier.');
  const results = [];
  for (const reference of references) {
    if (typeof reference !== 'string' || reference.length > 2000)
      throw new Error('Référence invalide.');
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', reference);
    url.searchParams.set('rows', '3');
    url.searchParams.set('select', 'DOI,title,author,issued,container-title');
    // Une référence en échec n'interrompt pas les autres ; une désactivation, si.
    try {
      const data = await onlineJson(url);
      const match = bibliography.bestMatch(
        reference,
        (data.message?.items || []).map(bibliography.fromCrossref),
      );
      results.push({ reference, ...match });
    } catch (error) {
      if (!(await readSettings()).online.bibliography) throw error;
      results.push({ reference, verdict: 'erreur', error: error.message, work: null });
    }
    // Rythme modéré : Crossref limite les requêtes rapprochées.
    await new Promise((resolve) => setTimeout(resolve, 250));
    send({ kind: 'biblio', data: { done: results.length, total: references.length } });
  }
  return results;
});

function createWindow() {
  window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 740,
    minHeight: 560,
    title: 'Localia',
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('closed', () => {
    for (const task of tasks.values()) task.abort();
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(async () => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: 'Localia', submenu: [{ role: 'about' }, { role: 'quit' }] },
      {
        label: 'Édition',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      { label: 'Fenêtre', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
    ]),
  );
  // Clé de chiffrement lue avant la fenêtre : les données ne sont jamais lues sans elle.
  await loadKey().catch((error) => {
    encryptionEnabled = true;
    keyError = `Clé de chiffrement illisible (${error.message}).`;
  });
  createWindow();
  skillsReady = installStarterSkills().catch(() => {});
  // Veille : premier passage peu après l'ouverture, puis toutes les 30 minutes.
  setTimeout(runDueWatch, 20000);
  setInterval(runDueWatch, 30 * 60000);
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  for (const task of tasks.values()) task.abort();
  service?.kill();
});
