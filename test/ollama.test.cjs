const { test } = require('node:test');
const assert = require('node:assert/strict');
const { modelName, readStream } = require('../src/ollama.cjs');
test('flux NDJSON découpé, UTF-8 et dernière ligne sans saut', async () => {
  const data = new TextEncoder().encode('{"message":{"content":"été"}}\n{"done":true}');
  async function* chunks() {
    for (let i = 0; i < data.length; i++) yield data.slice(i, i + 1);
  }
  const events = [];
  await readStream(chunks(), (x) => events.push(x));
  assert.deepEqual(events, [{ message: { content: 'été' } }, { done: true }]);
});
test('erreurs Ollama transmises au client', async () => {
  async function* chunks() {
    yield Buffer.from('{"error":"espace insuffisant"}\n');
  }
  await assert.rejects(
    readStream(chunks(), () => {}),
    /espace insuffisant/,
  );
});
test('modèles locaux autorisés, noms distants ou invalides refusés', () => {
  assert.equal(modelName('qwen2.5:1.5b'), 'qwen2.5:1.5b');
  for (const name of ['', 'x:cloud', 'https://host/model', 'x\nserve', null])
    assert.throws(() => modelName(name));
});

test('délai dépassé : message distinct de « Ollama inaccessible »', async () => {
  const { request } = require('../src/ollama.cjs');
  const original = global.fetch;
  global.fetch = (_url, options) =>
    new Promise((_, reject) =>
      options.signal.addEventListener('abort', () => reject(options.signal.reason)),
    );
  try {
    // Minuteur ordinaire : celui d'AbortSignal.timeout ne garde pas la boucle d'événements active,
    // et Node peut arrêter le test avant qu'il ne se déclenche (constaté sous Linux).
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('délai', 'TimeoutError')), 20);
    await assert.rejects(
      request('/api/show', { model: 'm' }, controller.signal),
      /pas répondu à temps/,
    );
    const failure = (code) => async (_url, options) => {
      global.lastOptions = options;
      throw Object.assign(new TypeError('fetch failed'), { cause: { code } });
    };
    global.fetch = failure('ECONNREFUSED');
    await assert.rejects(request('/api/tags'), /inaccessible/);
    // Aucune limite d'attente des en-têtes : le dispatcher dédié est toujours transmis.
    assert.ok(global.lastOptions.dispatcher, 'dispatcher sans délai transmis à fetch');
    global.fetch = failure('UND_ERR_SOCKET');
    await assert.rejects(request('/api/chat', { model: 'm' }), /interrompue \(UND_ERR_SOCKET\)/);
  } finally {
    global.fetch = original;
  }
});
