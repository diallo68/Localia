// Foundry Local dans l'application : faux service local (format d'OpenAI), modèle listé dans son
// groupe, bascule par le bouton « Foundry Local », réponse affichée et enregistrée.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const MODEL = 'Phi-4-mini-instruct-generic-cpu:4';
function fakeFoundry() {
  const asked = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const json = (data) => res.end(JSON.stringify(data));
      if (req.url === '/openai/status') return json({ Endpoints: [] });
      if (req.url === '/openai/models') return json([MODEL]);
      if (req.url === '/foundry/list') return json([{ name: MODEL, fileSizeMb: 2500 }]);
      if (req.url === '/openai/loadedmodels') return json([MODEL]);
      if (req.url.startsWith('/openai/')) return res.end();
      if (req.url === '/v1/chat/completions') {
        asked.push(JSON.parse(raw));
        res.setHeader('Content-Type', 'text/event-stream');
        for (const content of ['Réponse ', 'de **Foundry** Local.'])
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`,
        );
        res.write(
          `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 6 } })}\n\n`,
        );
        return res.end('data: [DONE]\n\n');
      }
      res.statusCode = 404;
      res.end();
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, asked, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

const apple = process.platform !== 'win32';
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-foundry-'));
  const { server, asked, url } = await fakeFoundry();
  let app;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, metier: 'finance' }),
    );
    app = await electron.launch({
      args: [path.resolve('.')],
      env: {
        ...process.env,
        LOCALIA_TEST_DATA: profile,
        LOCALIA_FOUNDRY_URL: url,
        // Fausse aide Apple Intelligence (script exécutable : pas sous Windows).
        ...(apple
          ? { LOCALIA_APPLE_FM: path.join(__dirname, 'fixtures', 'fake-apple-fm.cjs') }
          : {}),
      },
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('#model optgroup')].some((g) => g.label.includes('Foundry')),
      null,
      { timeout: 30000 },
    );
    assert.equal(
      await page
        .locator('#model optgroup[label="Foundry Local (Microsoft)"] option')
        .getAttribute('value'),
      'foundry/' + MODEL,
    );
    // Localia s'ouvre sur le domaine « Général » ; Finance choisi pour que ses consignes
    // accompagnent les questions.
    await page.locator('.domain-chip[data-domain=finance]').click();
    await page.waitForFunction(() => document.body.dataset.metier === 'finance');
    // Bouton du moteur, dans les réglages avancés de la conversation.
    await page.waitForFunction(() => !document.querySelector('#chat-view').hidden);
    await page.evaluate(() => {
      if (!document.querySelector('#chat-view').classList.contains('panel-open'))
        document.querySelector('#panel-toggle').click();
    });
    await page.locator('#engine-card').click();
    assert.equal(await page.locator('#engine-foundry').isVisible(), true);
    await page.locator('#engine-foundry').click();
    assert.equal(await page.locator('#model').inputValue(), 'foundry/' + MODEL);
    assert.equal(await page.locator('#engine-state').textContent(), 'Foundry Local');
    await page.locator('#prompt').fill('Bonjour Foundry');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#stop').hidden &&
        document
          .querySelector('.message.assistant:last-of-type')
          ?.textContent.includes('Foundry Local.'),
      null,
      { timeout: 30000 },
    );
    assert.equal(
      await page.locator('.message.assistant:last-of-type strong').last().textContent(),
      'Foundry',
    );
    assert.equal(asked.length, 1);
    assert.equal(asked[0].model, MODEL);
    assert.equal(asked[0].stream, true);
    assert.ok(asked[0].messages.at(-1).content.includes('Bonjour Foundry'));
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8'));
    assert.ok(JSON.stringify(saved).includes('de **Foundry** Local.'));
    // Apple Intelligence : modèle « apple/intelligence », bouton, réponse.
    if (apple) {
      // Panneau du moteur encore ouvert depuis la bascule vers Foundry Local.
      assert.equal(await page.locator('#engine-apple').isVisible(), true);
      await page.locator('#engine-apple').click();
      assert.equal(await page.locator('#model').inputValue(), 'apple/intelligence');
      assert.equal(await page.locator('#engine-state').textContent(), 'Apple Intelligence');
      await page.locator('#prompt').fill('Bonjour Apple');
      await page.locator('#send').click();
      await page.waitForFunction(
        () =>
          document.querySelector('#stop').hidden &&
          document
            .querySelector('.message.assistant:last-of-type')
            ?.textContent.includes('(consigne).'),
        null,
        { timeout: 30000 },
      );
      // Retour à Foundry Local depuis le modèle d'Apple.
      await page.locator('#engine-foundry').click();
      assert.equal(await page.locator('#model').inputValue(), 'foundry/' + MODEL);
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS Foundry Local${apple ? ' et Apple Intelligence' : ''} : modèles listés, bascule de moteur, réponses en flux affichées et enregistrées, aucune erreur JS.`,
    );
  } finally {
    await app?.close();
    server.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
