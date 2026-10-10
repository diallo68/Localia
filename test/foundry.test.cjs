const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const foundry = require('../src/foundry.cjs');

// Faux service Foundry Local : catalogue, modèles téléchargés, chargement et réponse en flux.
function fakeFoundry() {
  const calls = [];
  const loaded = new Set();
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      calls.push({ url: req.url, body: raw ? JSON.parse(raw) : null });
      const json = (data) => res.end(JSON.stringify(data));
      if (req.url === '/openai/models') return json(['Phi-4-mini-instruct-generic-cpu:4']);
      if (req.url === '/foundry/list')
        return json([{ name: 'Phi-4-mini-instruct-generic-cpu:4', fileSizeMb: 2500 }]);
      if (req.url === '/openai/loadedmodels') return json([...loaded]);
      if (req.url.startsWith('/openai/load/')) {
        loaded.add(decodeURIComponent(req.url.slice(13).split('?')[0]));
        return res.end();
      }
      if (req.url.startsWith('/openai/unload/')) return res.end();
      if (req.url === '/v1/chat/completions') {
        res.setHeader('Content-Type', 'text/event-stream');
        const event = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        event({ choices: [{ delta: { role: 'assistant' } }] });
        event({ choices: [{ delta: { content: 'Bon' } }] });
        // Morceau coupé en deux paquets réseau, avec un caractère accentué.
        const split = `data: ${JSON.stringify({ choices: [{ delta: { content: 'jour, été' } }] })}\n\n`;
        res.write(split.slice(0, 20));
        setTimeout(() => {
          res.write(split.slice(20));
          event({ choices: [{ delta: {}, finish_reason: 'length' }] });
          event({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } });
          res.end('data: [DONE]\n\n');
        }, 20);
        return;
      }
      res.statusCode = 404;
      res.end('inconnu');
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

test('adresse du service : seules les adresses de cet ordinateur sont acceptées', () => {
  assert.equal(
    foundry.parseEndpoint('🟢 Service is running on http://127.0.0.1:5273/openai/status'),
    'http://127.0.0.1:5273',
  );
  assert.equal(
    foundry.parseEndpoint('running on http://localhost:61234/'),
    'http://localhost:61234',
  );
  assert.equal(foundry.parseEndpoint('running on http://10.0.0.5:5273/openai/status'), null);
  assert.equal(foundry.parseEndpoint('🔴 Model management service is not running!'), null);
});

test('noms des modèles et emplacements de la commande foundry', () => {
  assert.ok(foundry.isFoundry('foundry/phi-4-mini'));
  assert.ok(!foundry.isFoundry('integre/phi-4-mini'));
  assert.equal(
    foundry.foundryId('foundry/Phi-4-mini-instruct-generic-cpu:4'),
    'Phi-4-mini-instruct-generic-cpu:4',
  );
  assert.match(
    foundry.foundryCandidates({ LOCALAPPDATA: 'C:\\U\\AppData\\Local' }, 'win32')[0],
    /WindowsApps\\foundry\.exe$/,
  );
  assert.ok(foundry.foundryCandidates({}, 'darwin').includes('/opt/homebrew/bin/foundry'));
});

test('demande au format d’OpenAI à partir des réglages de Localia', () => {
  const body = foundry.openaiBody('phi', {
    messages: [{ role: 'user', content: 'Bonjour', images: [] }],
    options: { temperature: 0.6, top_p: 0.9, top_k: 40, num_predict: 2048, seed: 7 },
  });
  assert.deepEqual(body, {
    model: 'phi',
    messages: [{ role: 'user', content: 'Bonjour' }],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 2048,
    temperature: 0.6,
    top_p: 0.9,
    top_k: 40,
    random_seed: 7,
  });
});

test('modèles listés et réponse en flux renvoyée au format d’Ollama', async () => {
  const { server, calls, base } = await fakeFoundry();
  try {
    const models = await foundry.listModels(base);
    assert.deepEqual(
      models.map((m) => [m.name, m.engine, m.size]),
      [['foundry/Phi-4-mini-instruct-generic-cpu:4', 'foundry', 2.5e9]],
    );
    const events = [];
    await foundry.chat({
      base,
      model: 'foundry/Phi-4-mini-instruct-generic-cpu:4',
      body: {
        messages: [{ role: 'user', content: 'Salut' }],
        options: { num_predict: 3 },
        keep_alive: 0,
      },
      onData: (d) => events.push(d),
    });
    const text = events.map((e) => e.message?.content || '').join('');
    assert.equal(text, 'Bonjour, été');
    const done = events.at(-1);
    assert.equal(done.done, true);
    assert.equal(done.done_reason, 'length');
    assert.equal(done.prompt_eval_count, 12);
    assert.equal(done.eval_count, 3);
    assert.ok(done.total_duration > 0);
    const urls = calls.map((c) => c.url);
    assert.ok(urls.includes('/openai/load/Phi-4-mini-instruct-generic-cpu%3A4'), 'modèle chargé');
    assert.ok(
      urls.some((u) => u.startsWith('/openai/unload/')),
      'modèle libéré (keep_alive 0)',
    );
    assert.equal(calls.find((c) => c.url === '/v1/chat/completions').body.max_tokens, 3);
  } finally {
    server.close();
  }
});

test('photos refusées clairement, erreur du service transmise', async () => {
  await assert.rejects(
    foundry.chat({
      base: 'http://127.0.0.1:1',
      model: 'foundry/x',
      body: { messages: [{ role: 'user', content: 'x', images: ['a'] }] },
      onData: () => {},
    }),
    /photos/,
  );
  async function* chunks() {
    yield Buffer.from('data: {"error":{"message":"modèle absent"}}\n\n');
  }
  await assert.rejects(
    foundry.readEvents(chunks(), () => {}),
    /modèle absent/,
  );
});

test('LOCALIA_FOUNDRY_URL : adresse imposée (tests), sans commande foundry', async () => {
  assert.equal(
    await foundry.endpoint({ env: { LOCALIA_FOUNDRY_URL: 'http://127.0.0.1:5999' } }),
    'http://127.0.0.1:5999',
  );
  assert.equal(
    await foundry.endpoint({ env: { FOUNDRY_PATH: '/nulle/part', PATH: '' } }).catch(() => 'err'),
    null,
  );
});
