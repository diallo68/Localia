// Moteur intégré réel (llama.cpp) : un petit modèle (SmolLM2 135M, Apache 2.0, 105 Mo) téléchargé
// une fois et vérifié, repris par Localia, puis interrogé — dans l'application de développement ou
// construite (LOCALIA_PACKAGED=1). Vérifie que le moteur fourni fonctionne sur chaque système.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { downloadFile } = require('../src/download.cjs');

const MODEL = {
  url: 'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf',
  size: 105454432,
  sha256: '2e8040ceae7815abe0dcb3540b9995eaa1fa0d2ca9e797d0a635ae4433c68c2d',
};
function packagedApp() {
  if (process.platform === 'win32') return path.resolve('dist/win-unpacked/Localia.exe');
  if (process.platform === 'linux') return path.resolve('dist/linux-unpacked/localia');
  return path.resolve(
    `dist/${process.arch === 'arm64' ? 'mac-arm64' : 'mac'}/Localia.app/Contents/MacOS/Localia`,
  );
}

(async () => {
  const cache =
    process.env.LOCALIA_TEST_MODELS || path.join(os.homedir(), '.cache', 'localia-test-models');
  await fs.mkdir(cache, { recursive: true });
  const file = path.join(cache, 'SmolLM2-135M-Instruct-Q4_K_M.gguf');
  if (!(await fs.stat(file).catch(() => null)))
    await downloadFile({ url: MODEL.url, dest: file, size: MODEL.size, sha256: MODEL.sha256 });
  // Dossier Ollama simulé qui pointe vers ce fichier (même mécanisme que la reprise des modèles).
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-moteur-'));
  const ollama = path.join(profile, 'ollama');
  await fs.mkdir(path.join(ollama, 'manifests/registry.ollama.ai/library/smollm2'), {
    recursive: true,
  });
  await fs.mkdir(path.join(ollama, 'blobs'));
  await fs.writeFile(
    path.join(ollama, 'manifests/registry.ollama.ai/library/smollm2/135m'),
    JSON.stringify({
      layers: [
        {
          mediaType: 'application/vnd.ollama.image.model',
          digest: `sha256:${MODEL.sha256}`,
          size: MODEL.size,
        },
      ],
    }),
  );
  const blob = path.join(ollama, 'blobs', `sha256-${MODEL.sha256}`);
  await fs.link(file, blob).catch(() => fs.copyFile(file, blob));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ guideDone: true }));
  const launch = process.env.LOCALIA_PACKAGED
    ? { executablePath: packagedApp(), args: [] }
    : { args: [path.resolve('.')] };
  let app;
  try {
    app = await electron.launch({
      ...launch,
      env: { ...process.env, LOCALIA_TEST_DATA: profile, OLLAMA_MODELS: ollama },
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(120000);
    const entry = await page.evaluate(() => window.localia.localImport('smollm2:135m'));
    assert.equal(entry.name, 'integre/smollm2:135m');
    assert.equal(entry.architecture, 'llama');
    const started = Date.now();
    const result = await page.evaluate(() =>
      window.localia.run('chat', {
        model: 'integre/smollm2:135m',
        messages: [{ role: 'user', content: 'Say hello in one short sentence.' }],
      }),
    );
    assert.ok(result.text.trim().length > 0, 'réponse vide');
    assert.equal(result.used.engine, 'integre');
    assert.ok(result.stats.outputTokens > 0);
    // Réponses courtes (comme la longueur maximale d'une série) : le petit modèle de test peut
    // sinon compter sans fin.
    await page.evaluate(() =>
      window.localia.saveSettings({
        models: { 'integre/smollm2:135m': { options: { num_predict: 48 } } },
      }),
    );
    // Questions enchaînées sans pause, comme une série du Benchmark (modèle gardé en mémoire) :
    // chacune doit réussir (la séquence rendue n'était pas toujours libre : « No sequences left »).
    const burst = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 6; i++)
        out.push(
          await window.localia
            .run('compare', {
              model: 'integre/smollm2:135m',
              messages: [{ role: 'user', content: `Count to ${i + 2}.` }],
              keepLoaded: i < 5,
            })
            .then((r) => (r.text.trim() ? 'ok' : 'vide'))
            .catch((e) => e.message),
        );
      return out;
    });
    assert.deepEqual(burst, Array(6).fill('ok'), `questions enchaînées : ${burst.join(' | ')}`);
    const speed = result.stats.outputTokens / (result.stats.outputMs / 1000);
    console.log(
      `PASS moteur intégré réel (${process.platform}-${process.arch}${process.env.LOCALIA_PACKAGED ? ', application construite' : ''}) : ${result.stats.outputTokens} tokens à ${speed.toFixed(0)} tokens/s en ${((Date.now() - started) / 1000).toFixed(1)} s — « ${result.text.trim().slice(0, 60)} »`,
    );
  } finally {
    await app?.close().catch(() => {});
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
