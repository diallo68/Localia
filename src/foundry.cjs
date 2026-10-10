// Foundry Local (Microsoft) : troisième moteur, à côté du moteur intégré et d'Ollama. Son service
// tourne sur l'ordinateur et répond au format d'OpenAI sur un port qui change à chaque démarrage.
// Localia ne contacte que ce service local ; les modèles s'appellent « foundry/<nom> ».
// Windows, Linux et macOS Apple Silicon seulement (pas les Mac Intel).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { Agent } = require('undici');

const PREFIX = 'foundry/';
// Pas de limite d'attente : un gros modèle peut mettre longtemps avant son premier mot.
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const isFoundry = (name) => typeof name === 'string' && name.startsWith(PREFIX);
const foundryId = (name) => name.slice(PREFIX.length);

// Emplacements usuels de la commande « foundry » ; FOUNDRY_PATH l'emporte s'il est défini.
function foundryCandidates(env = process.env, system = process.platform) {
  if (system === 'win32') {
    const local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return [
      path.win32.join(local, 'Microsoft', 'WindowsApps', 'foundry.exe'), // installation par winget
      path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Foundry Local', 'foundry.exe'),
    ];
  }
  if (system === 'darwin') return ['/opt/homebrew/bin/foundry', '/usr/local/bin/foundry'];
  return [
    '/usr/local/bin/foundry',
    '/usr/bin/foundry',
    path.join(os.homedir(), '.local/bin/foundry'),
  ];
}
// lstat et non existsSync : sous Windows, foundry.exe est un « alias d'exécution » (lien
// spécial de WindowsApps) que existsSync ne voit pas.
function present(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}
function foundryPath(env = process.env) {
  if (env.FOUNDRY_PATH && present(env.FOUNDRY_PATH)) return env.FOUNDRY_PATH;
  return foundryCandidates(env).find(present) || null;
}

const run = (command, args, timeout) =>
  new Promise((resolve) =>
    execFile(command, args, { timeout, windowsHide: true }, (_error, stdout, stderr) =>
      resolve(String(stdout || '') + String(stderr || '')),
    ),
  );

// Adresse du service dans la sortie de « foundry server status / start ». Seules les adresses
// de cet ordinateur sont acceptées.
function parseEndpoint(text) {
  for (const match of String(text || '').matchAll(/https?:\/\/[^\s/"']+/g)) {
    try {
      const url = new URL(match[0]);
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return url.origin;
    } catch {}
  }
  return null;
}

let cached = null;
// Commande « foundry » : « server » depuis la version de 2026, « service » avant.
async function cliOutput(cli, action, timeout) {
  for (const group of ['server', 'service']) {
    const text = await run(cli, [group, action], timeout);
    if (!/unknown command/i.test(text)) return text;
  }
  return '';
}
// Adresse du service : LOCALIA_FOUNDRY_URL (tests), sinon demandée à la commande « foundry ».
// start = true : démarre le service s'il est arrêté. null si Foundry Local est absent ou arrêté.
async function endpoint({ start = false, env = process.env } = {}) {
  if (env.LOCALIA_FOUNDRY_URL) return parseEndpoint(env.LOCALIA_FOUNDRY_URL);
  if (cached && (await alive(cached))) return cached;
  cached = null;
  const cli = foundryPath(env);
  if (!cli) return null;
  cached = parseEndpoint(await cliOutput(cli, 'status', 10000));
  if (cached && !(await alive(cached))) cached = null;
  if (!cached && start) cached = parseEndpoint(await cliOutput(cli, 'start', 60000));
  return cached;
}
async function alive(base) {
  for (const route of ['/v1/models', '/openai/status'])
    try {
      if ((await fetch(base + route, { signal: AbortSignal.timeout(2000) })).ok) return true;
    } catch {}
  return false;
}

async function call(base, route, { body, signal, timeout = 10000 } = {}) {
  let response;
  try {
    response = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: signal || AbortSignal.timeout(timeout),
      dispatcher,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`Foundry Local ne répond pas (${error.cause?.code || error.message}).`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Foundry Local : erreur ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
    );
  }
  return response;
}

// Identifiants des modèles téléchargés : route de l'ancienne version (/openai/models). Depuis
// 2026, /v1/models donne tout le catalogue : on garde ceux que « foundry cache list » cite.
async function modelIds(base, env = process.env) {
  try {
    const names = await (await call(base, '/openai/models')).json();
    if (Array.isArray(names)) return names;
  } catch {}
  const data = await (await call(base, '/v1/models')).json();
  const ids = (data?.data || []).map((m) => m.id).filter(Boolean);
  const cli = foundryPath(env);
  if (!cli) return ids;
  return cachedIds(ids, await run(cli, ['cache', 'list'], 20000));
}
// Modèles du catalogue présents dans le cache. « foundry cache list » donne l'alias (nom court)
// et l'appareil : « qwen2.5-0.5b | 822 MB | CPU » → qwen2.5-0.5b-instruct-generic-cpu:4.
function cachedIds(ids, cache) {
  const found = new Set(ids.filter((id) => cache.includes(id)));
  for (const line of cache.split('\n')) {
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2 || /^alias$/i.test(cells[0])) continue;
    const alias = cells[0].toLowerCase();
    const device = (cells.find((c) => /^(cpu|gpu|npu)$/i.test(c)) || '').toLowerCase();
    const match =
      ids.find(
        (id) =>
          id.toLowerCase().startsWith(alias + '-') && device && id.toLowerCase().includes(device),
      ) || ids.find((id) => id.toLowerCase().startsWith(alias + '-'));
    if (match) found.add(match);
  }
  return ids.filter((id) => found.has(id));
}
// Modèles déjà téléchargés dans Foundry Local, avec leur taille d'après le catalogue.
async function listModels(base) {
  const names = await modelIds(base);
  let sizes = new Map();
  try {
    const catalog = await (await call(base, '/foundry/list')).json();
    const list = Array.isArray(catalog) ? catalog : catalog.models || [];
    sizes = new Map(list.map((m) => [m.name, (m.fileSizeMb || 0) * 1e6]));
  } catch {}
  return (Array.isArray(names) ? names : []).map((id) => ({
    name: PREFIX + id,
    size: sizes.get(id) || sizes.get(String(id).replace(/:\d+$/, '')) || 0,
    engine: 'foundry',
    details: { family: 'onnx', parameter_size: null },
  }));
}

// Flux « server-sent events » d'OpenAI : une ligne « data: {...} » par morceau, puis [DONE].
async function readEvents(body, onEvent) {
  let buffer = '';
  const decoder = new TextDecoder();
  const consume = (line) => {
    const text = line.trim();
    if (!text.startsWith('data:')) return;
    const data = text.slice(5).trim();
    if (!data || data === '[DONE]') return;
    const event = JSON.parse(data);
    if (event.error) throw new Error(event.error.message || String(event.error));
    onEvent(event);
  };
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      consume(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
    }
  }
  consume(buffer + decoder.decode());
}

// Demande au format d'Ollama (messages, options) → demande au format d'OpenAI.
function openaiBody(id, body) {
  const o = body.options || {};
  const request = {
    model: id,
    messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    stream_options: { include_usage: true },
  };
  if (o.num_predict > 0) request.max_tokens = o.num_predict;
  if (o.temperature != null) request.temperature = o.temperature;
  if (o.top_p != null) request.top_p = o.top_p;
  if (o.top_k != null) request.top_k = o.top_k;
  if (o.seed != null) request.random_seed = o.seed;
  return request;
}

// Réponse en flux, renvoyée au format d'Ollama (message.content, message.thinking, puis
// statistiques finales) pour que la conversation et le Benchmark la traitent comme les autres.
async function chat({ base, model, body, signal, onData }) {
  if (body.messages.some((m) => m.images?.length))
    throw new Error('Foundry Local ne lit pas encore les photos dans Localia. Retirez la photo.');
  const id = foundryId(model);
  const start = process.hrtime.bigint();
  await load(base, id, signal);
  const loadEnd = process.hrtime.bigint();
  const response = await call(base, '/v1/chat/completions', {
    body: openaiBody(id, body),
    signal,
  });
  let first = null;
  let pieces = 0;
  let finish = null;
  let usage = null;
  await readEvents(response.body, (event) => {
    if (event.usage) usage = event.usage;
    const choice = event.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finish = choice.finish_reason;
    const delta = choice.delta || {};
    const thinking = delta.reasoning_content || delta.reasoning;
    if (!delta.content && !thinking) return;
    first ||= process.hrtime.bigint();
    pieces++;
    onData({ message: thinking ? { thinking } : { content: delta.content } });
  });
  const end = process.hrtime.bigint();
  const promptEnd = first || end;
  onData({
    done: true,
    done_reason: finish === 'length' ? 'length' : 'stop',
    total_duration: Number(end - start),
    load_duration: Number(loadEnd - start),
    prompt_eval_count: usage?.prompt_tokens ?? null,
    prompt_eval_duration: Number(promptEnd - loadEnd),
    eval_count: usage?.completion_tokens ?? pieces,
    eval_duration: Number(end - promptEnd),
  });
  // Comparaison : modèle libéré après sa dernière question, comme avec les autres moteurs.
  if (body.keep_alive === 0)
    await call(base, `/openai/unload/${encodeURIComponent(id)}?force=true`).catch(() =>
      foundryPath() ? run(foundryPath(), ['model', 'unload', id], 60000) : null,
    );
}
// Modèle chargé avant la question : route de l'ancienne version, sinon « foundry model load ».
async function load(base, id, signal) {
  try {
    const loaded = await (await call(base, '/openai/loadedmodels', { signal })).json();
    if (Array.isArray(loaded) && loaded.includes(id)) return;
    await call(base, `/openai/load/${encodeURIComponent(id)}`, { signal, timeout: 600000 });
  } catch (error) {
    if (signal?.aborted) throw error;
    // Version de 2026 : modèles chargés sur /models/loaded, chargement par la commande.
    const loaded = await call(base, '/models/loaded', { signal })
      .then((r) => r.json())
      .catch(() => null);
    const names = (Array.isArray(loaded) ? loaded : loaded?.data || []).map((m) => m.id || m);
    if (names.includes(id)) return;
    const cli = foundryPath();
    if (cli) await run(cli, ['model', 'load', id], 600000);
  }
}

module.exports = {
  PREFIX,
  isFoundry,
  foundryId,
  foundryCandidates,
  foundryPath,
  parseEndpoint,
  cachedIds,
  endpoint,
  listModels,
  readEvents,
  openaiBody,
  chat,
};
