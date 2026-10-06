const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const e = require('../src/local-engine.cjs');

async function fakeOllama(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ollama-'));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await fs.writeFile(path.join(root, rel), content);
  }
  return root;
}
const manifest = (digest, params) =>
  JSON.stringify({
    layers: [
      { mediaType: 'application/vnd.ollama.image.model', digest: `sha256:${digest}`, size: 5 },
      ...(params
        ? [{ mediaType: 'application/vnd.ollama.image.params', digest: 'sha256:p1', size: 2 }]
        : []),
    ],
  });

test('fichier GGUF d’un modèle Ollama retrouvé par son manifeste, avec ses réglages', async () => {
  const root = await fakeOllama({
    'manifests/registry.ollama.ai/library/qwen3/8b': manifest('aa', true),
    'manifests/registry.ollama.ai/lukey03/qwen3.5-9b/latest': manifest('bb'),
    'blobs/sha256-aa': 'GGUFxx',
    'blobs/sha256-bb': 'GGUFyy',
    'blobs/sha256-p1': '{"num_ctx":16384}',
  });
  const qwen = await e.ollamaModelFile('qwen3:8b', root);
  assert.equal(qwen.file, path.join(root, 'blobs', 'sha256-aa'));
  assert.deepEqual(qwen.parameters, { num_ctx: 16384 });
  assert.equal((await e.ollamaModelFile('lukey03/qwen3.5-9b', root)).digest, 'sha256:bb');
  await assert.rejects(e.ollamaModelFile('absent:1b', root), /introuvable/);
  // Plusieurs dossiers : un dossier absent (disque externe débranché) est ignoré.
  assert.equal(
    (await e.ollamaModelFile('qwen3:8b', ['/Volumes/absent/ollama', root])).digest,
    'sha256:aa',
  );
});

test('fichier qui n’est pas au format GGUF refusé', async () => {
  const root = await fakeOllama({
    'manifests/registry.ollama.ai/library/bizarre/latest': manifest('cc'),
    'blobs/sha256-cc': 'PK\u0003\u0004',
  });
  await assert.rejects(e.ollamaModelFile('bizarre', root), /pas au format GGUF/);
});

test('registre : seulement des modèles « integre/ » avec un fichier absolu', () => {
  assert.equal(e.isLocal('integre/qwen3:8b'), true);
  assert.equal(e.isLocal('qwen3:8b'), false);
  assert.deepEqual(
    e
      .normalizeRegistry([
        { name: 'integre/a', file: '/x/a', size: 3 },
        { name: 'b', file: '/x/b', size: 3 },
        { name: 'integre/c', file: 'relatif', size: 3 },
      ])
      .map((m) => m.name),
    ['integre/a'],
  );
  assert.deepEqual(e.normalizeRegistry({}), []);
});

test('fichier déjà téléchargé par Ollama retrouvé par son empreinte et sa taille', async () => {
  const root = await fakeOllama({ 'blobs/sha256-dd': 'GGUF1234' });
  assert.equal(await e.ollamaBlobWithSha('dd', 8, root), path.join(root, 'blobs', 'sha256-dd'));
  assert.equal(
    await e.ollamaBlobWithSha('dd', 9, root),
    null,
    'taille différente : pas le même fichier',
  );
  assert.equal(await e.ollamaBlobWithSha('ee', 8, root), null);
});
