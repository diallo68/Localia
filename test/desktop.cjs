const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-test-'));
  let app;
  try {
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, LOCALIA_TEST_DATA: profile },
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('connecté'),
    );
    assert.ok((await page.locator('#model option').count()) > 0);
    await page.locator('#models-tab').click();
    await page.locator('#custom-model').fill('bad name');
    await page.locator('#custom-form button').click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('valide'),
    );
    await app.evaluate(() => {
      const original = global.fetch;
      global.fetch = async (url, options) => {
        if (String(url).endsWith('/api/chat'))
          return new Response(
            '{"message":{"content":"Bonjour, **test** local"}}\n{"message":{"content":" réussi."}}\n{"done":true}\n',
          );
        if (String(url).endsWith('/api/pull'))
          return new Response(
            '{"status":"Téléchargement","total":100,"completed":50}\n{"status":"success"}\n',
          );
        return original(url, options);
      };
    });
    await page.locator('#download').click();
    await page.waitForFunction(() =>
      document.querySelector('#transfer-status').textContent.includes('prêt'),
    );
    const concurrent = await page.evaluate(async () => {
      const payload = {
        model: document.querySelector('#model').value,
        messages: [{ role: 'user', content: 'Bonjour' }],
      };
      const results = await Promise.allSettled([
        window.localia.run('chat', payload),
        window.localia.run('chat', payload),
      ]);
      const unknown = await window.localia.run('delete', payload).catch((e) => e.message);
      return { results: results.map((r) => r.status + ':' + (r.reason?.message || '')), unknown };
    });
    assert.ok(concurrent.results.includes('fulfilled:'), concurrent.results.join(' | '));
    assert.ok(concurrent.results.some((r) => r.includes('déjà en cours')));
    assert.match(concurrent.unknown, /Opération inconnue/);
    await page.locator('#chat-tab').click();
    await page.locator('#prompt').fill('Bonjour — test interface');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelector('.message.assistant p')?.textContent ===
          'Bonjour, test local réussi.' && document.querySelector('#stop').hidden,
    );
    assert.equal(await page.locator('.message.assistant .markdown strong').textContent(), 'test');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#history button'));
    await page.locator('#history button').click();
    assert.equal(
      await page.locator('.message.assistant p').textContent(),
      'Bonjour, test local réussi.',
    );
    await page.locator('#new').click();
    await page.locator('[data-prompt]').first().click();
    assert.ok((await page.locator('#prompt').inputValue()).includes('e-mail'));
    await page.locator('#prompt').fill('');
    await page.screenshot({ path: 'test-results/desktop.png' });
    await page.setViewportSize({ width: 740, height: 560 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await app.evaluate(() => {
      global.fetch = async () => {
        throw new Error('offline');
      };
    });
    await page.locator('#refresh').dispatchEvent('click');
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('arrêté'),
    );
    assert.equal(await page.locator('#send').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: modèles réels, validation, téléchargement simulé, chat simulé, sauvegarde/rechargement, suggestions, largeur minimale, service indisponible, absence d’erreurs JS.',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
