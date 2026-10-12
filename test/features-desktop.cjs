const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Fichier de données écrit (écriture asynchrone) : attend que son contenu vérifie la condition.
async function waitForJson(profile, name, check, timeout = 5000) {
  const end = Date.now() + timeout;
  for (;;) {
    const data = await readJson(profile, name).catch(() => null);
    if (data && check(data)) return data;
    if (Date.now() > end) throw new Error(`${name} : contenu attendu non écrit.`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function waitForMissing(file, timeout = 5000) {
  const end = Date.now() + timeout;
  while (
    await fs.stat(file).then(
      () => true,
      () => false,
    )
  ) {
    if (Date.now() > end) throw new Error(`${file} n'a pas été effacé.`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
// Avant chaque lecture : écritures de Localia terminées (machines lentes), voir settleWrites.
let settleWrites = async () => {};
const readJson = async (profile, name) => {
  await settleWrites();
  return JSON.parse(await fs.readFile(path.join(profile, name), 'utf8'));
};

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-features-'));
  let app;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, mode: 'avance' }),
    );
    // Modèle Ollama simulé sur le disque (manifeste et fichier GGUF) pour le moteur intégré.
    const ollamaDir = path.join(profile, 'ollama-models');
    await fs.mkdir(path.join(ollamaDir, 'manifests/registry.ollama.ai/library/petit'), {
      recursive: true,
    });
    await fs.mkdir(path.join(ollamaDir, 'blobs'), { recursive: true });
    await fs.writeFile(
      path.join(ollamaDir, 'manifests/registry.ollama.ai/library/petit/1b'),
      JSON.stringify({
        layers: [
          { mediaType: 'application/vnd.ollama.image.model', digest: 'sha256:abc', size: 1000 },
        ],
      }),
    );
    await fs.writeFile(path.join(ollamaDir, 'blobs/sha256-abc'), 'GGUF-simulé');
    // Fichier Ollama identique à celui du catalogue (Qwen 3 4B) : fichier creux de la bonne taille.
    const qwenCatalog = require('../src/catalog.js').catalogEntry('qwen3-4b');
    const sharedBlob = path.join(ollamaDir, 'blobs', `sha256-${qwenCatalog.sha256}`);
    await fs.writeFile(sharedBlob, '');
    await fs.truncate(sharedBlob, qwenCatalog.size);
    // Comparaison au format d'avant les séries : doit rester lisible.
    await fs.writeFile(
      path.join(profile, 'comparisons.json'),
      JSON.stringify([
        {
          id: 'ancienne',
          date: '2026-10-04T10:00:00.000Z',
          prompt: 'Ancienne question',
          document: null,
          results: [{ model: 'petit:1b', status: 'done', text: 'Ancienne réponse', rating: 3 }],
        },
      ]),
    );
    app = await electron.launch({
      // Faux micro de Chromium (un son de test) pour la dictée vocale.
      args: [path.resolve('.'), '--use-fake-device-for-media-stream'],
      env: {
        ...process.env,
        LOCALIA_TEST_DATA: profile,
        LOCALIA_REMOTE_PORT: '47899',
        LOCALIA_FAKE_LLAMA: '1',
        LOCALIA_FAKE_WHISPER: '1',
        LOCALIA_FAKE_UPDATE: '1',
        LOCALIA_UPDATE_DELAY: '300',
        OLLAMA_MODELS: path.join(profile, 'ollama-models'),
      },
    });
    const page = await app.firstWindow();
    // Les tests manipulent les réglages avancés : panneau ouvert (retenu après rechargement).
    await page.waitForFunction(() => typeof setChatPanel === 'function');
    await page.evaluate(() => setChatPanel(true));
    // Mise à jour (simulée) : bandeau au démarrage, téléchargement, puis installation au
    // redémarrage ; recherche désactivable dans Confidentialité et sécurité.
    await page.waitForFunction(() =>
      document.querySelector('#update-text').textContent.includes('Localia 9.9.9 est disponible'),
    );
    await page.locator('#update-go').click();
    await page.waitForFunction(() =>
      document.querySelector('#update-text').textContent.includes('s’installera au redémarrage'),
    );
    assert.equal(await page.locator('#update-go').textContent(), 'Redémarrer maintenant');
    await page.locator('#update-go').click();
    await page.locator('#update-later').click();
    assert.equal(await page.locator('#update-banner').isVisible(), false);
    await page.locator('#security-tab').click();
    await page.waitForFunction(() => document.querySelector('#updates-enabled').checked);
    await page.locator('#updates-enabled').uncheck();
    await page.waitForFunction(async () => (await window.localia.loadSettings()).updates === 'off');
    await page.locator('#updates-check').click();
    await page.waitForFunction(() =>
      document.querySelector('#updates-status').textContent.includes('9.9.9'),
    );
    await page.locator('#updates-enabled').check();
    await page.waitForFunction(async () => (await window.localia.loadSettings()).updates !== 'off');
    await page.locator('#chat-tab').click();
    settleWrites = async () => {
      // Deux passages : une sauvegarde demandée pendant le premier est aussi attendue.
      for (let i = 0; i < 2; i++) {
        await app.evaluate(() => global.localiaWritesSettled?.());
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Ollama simulé : deux modèles, réponses avec mesures, requêtes capturées.
    await app.evaluate(() => {
      global.requests = [];
      global.fetch = async (url, options) => {
        const endpoint = new URL(String(url)).pathname;
        const body = options?.body ? JSON.parse(options.body) : null;
        if (endpoint === '/api/version') return Response.json({ version: '0.35.0' });
        if (endpoint === '/api/tags')
          return Response.json({
            models: [
              { name: 'petit:1b', size: 1e9 },
              { name: 'grand:8b', size: 5e9 },
            ],
          });
        if (endpoint === '/api/show')
          return Response.json({
            // grand:8b lit les photos ; petit:1b non.
            capabilities: [
              'completion',
              'thinking',
              ...(body?.model === 'grand:8b' ? ['vision'] : []),
            ],
            parameters: 'temperature 0.6\nnum_ctx                        8192',
            model_info: { 'test.context_length': 32768 },
            details: { family: 'test', parameter_size: '8B', quantization_level: 'Q4_K_M' },
          });
        if (endpoint === '/api/ps') return Response.json({ models: [] });
        if (endpoint === '/api/generate')
          return Response.json({
            response: 'La météo aide à décider.',
            eval_count: 60,
            eval_duration: 1e10,
            prompt_eval_count: 30,
            prompt_eval_duration: 1e9,
            load_duration: 2e9,
            done: true,
          });
        if (endpoint === '/api/chat') {
          // Réponse lente facultative (test de la pause), interrompue si la requête est annulée.
          if (global.chatDelay)
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, global.chatDelay);
              options.signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('annulée', 'AbortError'));
              });
            });
          global.requests.push(body);
          const lines = [
            { message: { thinking: 'Je réfléchis.' } },
            { message: { content: global.chatReply ?? `Réponse de **${body.model}**` } },
            {
              done: true,
              done_reason: global.chatDoneReason ?? 'stop',
              total_duration: 3e9,
              load_duration: 1e9,
              prompt_eval_count: 40,
              prompt_eval_duration: 5e8,
              eval_count: 50,
              eval_duration: 1e9,
            },
          ];
          return new Response(lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
        }
        throw new Error('unexpected endpoint ' + endpoint);
      };
    });
    // Dernière requête envoyée au modèle, une fois la réponse en cours terminée (machines lentes).
    const lastRequest = async () => {
      await page.waitForFunction(() => document.querySelector('#stop').hidden);
      return app.evaluate(() => global.requests.at(-1));
    };
    await page.locator('#refresh').dispatchEvent('click');
    await page.waitForFunction(() => document.querySelector('#model').options.length === 2);

    // Modèle mémorisé : le plus petit par défaut, puis le dernier choisi.
    assert.equal(await page.locator('#model').inputValue(), 'petit:1b');
    await page.locator('#model').selectOption('grand:8b');
    await page.locator('#prompt').fill('Bonjour');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document
        .querySelector('.message.assistant strong:not(.author)')
        ?.textContent.includes('grand'),
    );
    let request = await lastRequest();
    assert.equal(request.model, 'grand:8b');
    assert.equal(
      await page.locator('.message.assistant .model-tag').first().textContent(),
      'grand:8b',
      'modèle affiché sur la réponse',
    );
    assert.equal(request.options.num_ctx, 8192, 'contexte du Modelfile respecté');
    assert.equal((await readJson(profile, 'settings.json')).lastModel, 'grand:8b');

    // Fenêtre à sa taille minimale (petit écran) : l'historique reste cliquable, rien ne le recouvre.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(740, 560));
    await page.waitForFunction(() => window.innerHeight < 600);
    const covered = await page.evaluate(() => {
      const button = document.querySelector('#history .history-open');
      button.scrollIntoView({ block: 'nearest' });
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return top === button || button.contains(top) ? null : top?.className || top?.tagName;
    });
    assert.equal(covered, null, 'historique recouvert sur petit écran');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1180, 820));

    // Renommer.
    await page.locator('#rename-conversation').click();
    await page.locator('#rename-input').fill('Mon essai');
    await page.locator('#rename-form button[type=submit]').click();
    await page.waitForFunction(
      () => document.querySelector('#history .history-title').textContent === 'Mon essai',
    );
    await waitForJson(profile, 'conversations.json', (c) => c[0]?.title === 'Mon essai');

    await page.reload();
    await page.waitForFunction(() => document.querySelector('#model').options.length === 2);
    assert.equal(await page.locator('#model').inputValue(), 'grand:8b', 'modèle retrouvé');

    // Réglages du modèle appliqués à la conversation.
    await page.locator('#model-settings').click();
    await page.waitForFunction(() =>
      document.querySelector('#model-facts').textContent.includes('contexte maximal'),
    );
    assert.equal(await page.locator('#settings-model').inputValue(), 'grand:8b');
    assert.equal(await page.locator('[name=num_ctx]').getAttribute('placeholder'), 'Modèle : 8192');
    assert.equal(await page.locator('#think-field').isVisible(), true);
    await page.screenshot({ path: 'test-results/settings.png' });
    await page.locator('[name=temperature]').fill('0.3');
    await page.locator('[name=num_ctx]').fill('16384');
    await page.locator('[name=think]').selectOption('false');
    await page.locator('[name=system]').fill('Réponds brièvement.');
    await page.locator('#settings-form button[type=submit]').click();
    await page.waitForFunction(() =>
      document.querySelector('#settings-status').textContent.includes('enregistrés'),
    );
    await page.locator('#chat-tab').click();
    await page.locator('#history .history-open').click();
    await page.locator('#prompt').fill('Encore');
    await page.locator('#send').click();
    // Réponse terminée (la bulle apparaît avant l'envoi de la requête : machines lentes).
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 2 &&
        document.querySelector('#stop').hidden,
    );
    request = await lastRequest();
    assert.equal(request.options.temperature, 0.3);
    assert.equal(request.options.num_ctx, 16384);
    assert.equal(request.think, false);
    assert.deepEqual(request.messages[0], { role: 'system', content: 'Réponds brièvement.' });
    assert.equal(request.keep_alive, '5m');

    // Assistant de recherche : tâche choisie, conseil affiché, consigne de la tâche envoyée.
    await page.locator('#task').selectOption('calcul');
    await page.waitForFunction(() => !document.querySelector('#task-advice').hidden);
    assert.match(
      await page.locator('#task-advice').textContent(),
      /Localia refait chaque opération/,
    );
    // Ce que la tâche change, et sa suggestion de premier message (Tab pour la reprendre).
    assert.match(
      await page.locator('#task-advice').textContent(),
      /Tâche « Calculer ou vérifier un calcul » : le modèle écrit chaque opération/,
    );
    assert.match(
      await page.locator('#prompt').getAttribute('placeholder'),
      /^Ex\. Vérifie le calcul/,
    );
    await page.locator('#prompt').fill('');
    await page.locator('#prompt').press('Tab');
    assert.match(await page.locator('#prompt').inputValue(), /^Vérifie le calcul/);
    await page.locator('#prompt').fill('Combien font 40 × 25 ?');
    await page.locator('#send').click();
    // Réponse terminée (la bulle apparaît avant l'envoi de la requête : machines lentes).
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 3 &&
        document.querySelector('#stop').hidden,
    );
    request = await lastRequest();
    assert.match(
      request.messages[0].content,
      /Réponds brièvement\.\n\nÉcris chaque calcul en entier/,
    );
    assert.equal((await readJson(profile, 'conversations.json'))[0].task, 'calcul');

    // Mémoire par projet : note envoyée comme contexte, réponse ajoutée à la mémoire.
    await page.locator('#projects-tab').click();
    await page.locator('#project-name').fill('Thèse');
    await page.locator('#project-form button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('#project-detail').hidden);
    await page.locator('#note-title').fill('Site d’étude');
    await page.locator('#note-text').fill('Dalaba, Fouta Djalon, données NASA POWER 2014-2024.');
    await page.locator('#note-submit').click();
    await page.waitForFunction(() => document.querySelectorAll('.note-card').length === 1);
    await page.locator('#chat-tab').click();
    await page.locator('#project').selectOption({ label: 'Thèse' });
    await page.locator('#prompt').fill('Où se situe le site d’étude ?');
    await page.locator('#send').click();
    // Réponse terminée (la bulle apparaît avant l'envoi de la requête : machines lentes).
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 4 &&
        document.querySelector('#stop').hidden,
    );
    request = await lastRequest();
    assert.match(request.messages[0].content, /Mémoire du projet « Thèse »/);
    assert.match(request.messages[0].content, /Cette conversation est reliée au projet « Thèse »/);
    assert.match(request.messages[0].content, /### Site d’étude\nDalaba, Fouta Djalon/);
    assert.match(
      await page.locator('#notice').textContent(),
      /Mémoire du projet « Thèse » transmise : 1 note\(s\) \(Site d’étude\)/,
    );
    const projectId = (await readJson(profile, 'projects.json'))[0].id;
    assert.equal((await readJson(profile, 'conversations.json'))[0].projectId, projectId);
    await page.locator('.message.assistant .remember').last().click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('ajoutée à la mémoire'),
    );
    let savedProjects = await readJson(profile, 'projects.json');
    assert.equal(savedProjects[0].notes.length, 2);
    assert.equal(savedProjects[0].notes[1].title, 'Où se situe le site d’étude ?');
    await page.locator('#projects-tab').click();
    await page.locator('.project-row').first().click();
    await page.locator('.note-card').first().locator('button', { hasText: 'Modifier' }).click();
    await page.locator('#note-text').fill('Réponse relue et corrigée.');
    await page.locator('#note-submit').click();
    await page.waitForFunction(() =>
      document.querySelector('.note-card').textContent.includes('relue et corrigée'),
    );
    savedProjects = await readJson(profile, 'projects.json');
    assert.equal(savedProjects[0].notes[1].text, 'Réponse relue et corrigée.');
    assert.ok(savedProjects[0].notes[1].updatedAt);

    // Documents du projet : plusieurs fichiers à la fois, un ancien format refusé sans bloquer les
    // autres ; passages envoyés au modèle dans une conversation du projet ; effacés avec le projet.
    const { pptxFixture } = require('./office-fixture.cjs');
    const projectFiles = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-projet-'));
    const slides = path.join(projectFiles, 'présentation.pptx');
    await fs.writeFile(slides, pptxFixture());
    await fs.writeFile(path.join(projectFiles, 'pluie.csv'), 'mois;pluie\njuillet;481\n');
    await fs.writeFile(path.join(projectFiles, 'ancien.ppt'), 'x');
    await app.evaluate(
      ({ dialog }, files) => {
        global.realOpenDialog ||= dialog.showOpenDialog;
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
      },
      ['présentation.pptx', 'pluie.csv', 'ancien.ppt'].map((f) => path.join(projectFiles, f)),
    );
    await page.locator('#project-add-docs').click();
    await page.waitForFunction(() => document.querySelectorAll('.project-doc').length === 2);
    assert.match(
      await page.locator('#project-docs-status').textContent(),
      /^2 documents ajoutés\. Non ajouté : ancien\.ppt : Ancien format PowerPoint/,
    );
    assert.match(await page.locator('#project-docs').textContent(), /PowerPoint · 2 diapositives/);
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = global.realOpenDialog;
    });
    const projectDocIds = (await readJson(profile, 'projects.json'))[0].documents.map((d) => d.id);
    assert.equal(projectDocIds.length, 2);
    await page.locator('#chat-tab').click();
    await page.locator('#prompt').fill('Combien de millimètres en juillet à Dalaba ?');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 5 &&
        document.querySelector('#stop').hidden,
    );
    request = await lastRequest();
    assert.match(
      request.messages[0].content,
      /Documents du projet « Thèse » \(2\) : texte complet/,
    );
    assert.match(
      request.messages[0].content,
      /\[présentation\.pptx — diapositive 1\]\nCampagne de Dalaba 2025[^]*Pluie : 481 mm/,
    );
    assert.match(
      await page.locator('#notice').textContent(),
      /Documents du projet « Thèse » transmis/,
    );
    await page.locator('#projects-tab').click();
    await fs.rm(projectFiles, { recursive: true, force: true });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#project-delete').click();
    await page.waitForFunction(() => document.querySelector('#project-detail').hidden);
    assert.deepEqual(await readJson(profile, 'projects.json'), []);
    assert.equal((await readJson(profile, 'conversations.json'))[0].projectId, undefined);
    for (const id of projectDocIds)
      assert.equal(
        await fs.stat(path.join(profile, 'documents', id + '.json')).catch(() => null),
        null,
        'document du projet effacé',
      );
    await page.locator('#chat-tab').click();

    // Comparaison de deux modèles.
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    // Réglage de réflexion de chaque modèle visible avant de lancer (désactivée pour grand:8b).
    assert.match(
      await page.locator('#compare-models label', { hasText: 'grand:8b' }).textContent(),
      /réflexion désactivée/,
    );
    // Questions collées sans ligne « --- » : une seule question détectée, signalée.
    await page.locator('#compare-prompt').fill('## Q01\nPremière ?\n## Q02\nSeconde ?');
    await page.locator('#compare-prompt').dispatchEvent('input');
    assert.match(
      await page.locator('#compare-count').textContent(),
      /Une seule question détectée, alors que le texte en annonce 2 \(Q01, Q02…\)/,
    );
    await page.locator('#compare-prompt').fill('Décris le contenu en trois points.');
    for (const input of await page.locator('#compare-models input').all()) await input.check();
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('terminée'),
    );
    assert.equal(await page.locator('.compare-card.done').count(), 2);
    assert.equal(await page.locator('.compare-table tbody tr').count(), 2);
    assert.match(await page.locator('.compare-table').textContent(), /50,0 tokens\/s/);
    assert.match(
      await page.locator('.compare-card').first().textContent(),
      /Raisonnement du modèle/,
    );
    const compareRequests = (await app.evaluate(() => global.requests)).slice(-2);
    assert.deepEqual(
      compareRequests.map((r) => [r.model, r.keep_alive]),
      [
        ['petit:1b', 0],
        ['grand:8b', 0],
      ],
    );
    assert.equal(compareRequests[1].options.temperature, 0.3, 'réglages de chaque modèle');
    await page.locator('.compare-card').first().locator('.stars button').nth(3).click();
    await page.screenshot({ path: 'test-results/compare.png', fullPage: true });
    const saved = await readJson(profile, 'comparisons.json');
    assert.equal(saved[0].results[0].grades.Vous.rating, 4);
    assert.equal(saved[0].results[0].stats.outputTokens, 50);

    // Série dont certaines questions ont leur propre document (« Document : nom.pdf ») :
    // PDF importé avec le fichier de questions, envoyé seulement avec sa question.
    const seriesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-serie-'));
    await fs.mkdir(path.join(seriesDir, 'documents'));
    await fs.writeFile(
      path.join(seriesDir, 'documents', 'facture-test.pdf'),
      require('./pdf-fixture.cjs').pdfFixture(['Facture fictive : total 120 EUR.']),
    );
    await fs.writeFile(
      path.join(seriesDir, 'serie.txt'),
      '## D1\nDocument : facture-test.pdf\nQuel est le total ?\n---\n## D2\nQuestion sans document.',
    );
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      },
      path.join(seriesDir, 'serie.txt'),
    );
    await page.locator('#compare-import').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-count').textContent.includes('1 document(s)'),
    );
    for (const input of await page.locator('#compare-models input').all()) await input.uncheck();
    await page.locator('#compare-models input[value="petit:1b"]').check();
    const beforeDocs = await app.evaluate(() => global.requests.length);
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('terminée'),
    );
    const docRequests = (await app.evaluate(() => global.requests)).slice(beforeDocs);
    assert.equal(docRequests.length, 2);
    assert.match(JSON.stringify(docRequests[0].messages), /total 120 EUR/);
    assert.doesNotMatch(
      JSON.stringify(docRequests[1].messages),
      /total 120 EUR|SOURCE DOCUMENTAIRE/,
    );
    assert.equal(
      docRequests[0].messages.at(-1).content,
      'Quel est le total ?',
      'ligne Document non envoyée',
    );
    await fs.rm(seriesDir, { recursive: true, force: true });
    // Série de ce test retirée : la suite du parcours retrouve ses séries habituelles.
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .locator('.compare-row', { hasText: 'serie.txt' })
      .locator('button', { hasText: 'Supprimer' })
      .click();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('.compare-row')].some((r) =>
          r.textContent.includes('serie.txt'),
        ),
    );
    for (const input of await page.locator('#compare-models input').all()) await input.check();

    // Série de deux questions, réponse attendue jamais envoyée, export CSV.
    const csvPath = path.join(profile, 'export.csv');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, csvPath);
    const before = await app.evaluate(() => global.requests.length);
    await page
      .locator('#compare-prompt')
      .fill('## A1\nPremière question\nAttendu : SECRET-ATTENDU\n---\n## B1\nSeconde question');
    await page.waitForFunction(() =>
      document.querySelector('#compare-count').textContent.includes('2 questions'),
    );
    assert.match(await page.locator('#compare-count').textContent(), /: A1, B1\./);
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('terminée'),
    );
    const series = (await app.evaluate(() => global.requests)).slice(before);
    assert.deepEqual(
      series.map((r) => [r.model, r.messages.at(-1).content, r.keep_alive]),
      [
        ['petit:1b', 'Première question', '5m'],
        ['petit:1b', 'Seconde question', 0],
        ['grand:8b', 'Première question', '5m'],
        ['grand:8b', 'Seconde question', 0],
      ],
      'chaque modèle traite toutes les questions, puis est déchargé',
    );
    assert.ok(!JSON.stringify(series).includes('SECRET-ATTENDU'));
    assert.equal(await page.locator('.chart').count(), 3);
    assert.equal(
      await page.locator('.overview .compare-table').nth(1).locator('tbody tr').count(),
      2,
    );
    assert.match(await page.locator('.expected').textContent(), /SECRET-ATTENDU/);
    await page.locator('.compare-card').first().locator('.stars button').nth(4).click();
    await page.waitForFunction(() =>
      document.querySelector('.overview .compare-table').textContent.includes('5,0 / 5 (1)'),
    );
    await page.locator('.overview .compare-table').nth(1).locator('td.clickable').nth(3).click();
    await page.waitForFunction(
      () => document.querySelector('.question-detail .task').textContent === 'Seconde question',
    );
    await page.screenshot({ path: 'test-results/series.png', fullPage: true });
    await page.locator('.charts').screenshot({ path: 'test-results/charts.png' });
    await page.locator('button', { hasText: 'Exporter (CSV)' }).click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('export.csv'),
    );
    const csv = await fs.readFile(csvPath, 'utf8');
    assert.ok(csv.startsWith('\ufeffQuestion;Titre;Modèle'));
    assert.equal(csv.trim().split('\r\n').length, 5);
    assert.match(csv, /1;A1;petit:1b;Terminé;5,0;3,0;1,0;40;80,0;50;50,0/);

    // Après redémarrage : l'ancienne comparaison et les notes sont retrouvées.
    await page.reload();
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    assert.equal(await page.locator('.compare-row').count(), 3);
    await page.locator('.compare-row .link', { hasText: 'Ancienne question' }).click();
    assert.match(await page.locator('.compare-card').textContent(), /Ancienne réponse/);
    assert.equal(await page.locator('.compare-card .stars button.on').count(), 3);
    await page.locator('.compare-row .link', { hasText: 'Décris le contenu' }).click();
    assert.equal(await page.locator('.compare-card .stars button.on').count(), 4);
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .locator('.compare-row', { hasText: 'Décris le contenu' })
      .locator('button', { hasText: 'Supprimer' })
      .click();
    await page.waitForFunction(() => document.querySelectorAll('.compare-row').length === 2);
    const remaining = await readJson(profile, 'comparisons.json');
    assert.equal(remaining.length, 2);
    assert.deepEqual(remaining[1].questions, [{ label: 'Q1', prompt: 'Ancienne question' }]);

    // Conditions de l'expérience et messages exacts enregistrés avec la série.
    const seriesRecord = remaining[0];
    assert.equal(seriesRecord.env.ollama, '0.35.0');
    assert.ok(seriesRecord.env.machine.memoryGB > 0);
    assert.deepEqual(seriesRecord.env.models['petit:1b'] !== undefined, true);
    assert.equal(seriesRecord.questions[0].sent.messages.at(-1).content, 'Première question');
    assert.equal(seriesRecord.results[0].grades.Vous.rating, 5);

    // Benchmark : notation à l'aveugle de toutes les réponses.
    await page.locator('#bench-nav').click();
    await page.locator('#benchmark-tab').click();
    await page.waitForFunction(() => document.querySelector('#bench-results h3'));
    assert.equal(await page.locator('#bench-series input').count(), 2);
    await page.locator('#bench-grade').click();
    await page.waitForFunction(() => !document.querySelector('#bench-blind').hidden);
    const total = Number(
      (await page.locator('#blind-progress').textContent()).match(/sur (\d+)/)[1],
    );
    assert.equal(total, 5, '4 réponses de la série + 1 ancienne, sans verdict');
    // Le nom du modèle n'apparaît nulle part en dehors du texte de la réponse elle-même.
    const blindText = await page.evaluate(() =>
      [...document.querySelectorAll('#bench-blind > :not(#blind-answer)')]
        .map((n) => n.textContent)
        .join(' '),
    );
    assert.doesNotMatch(blindText, /petit:1b|grand:8b/);
    for (let i = 0; i < total; i++) {
      await page
        .locator(`#blind-form input[name=verdict][value=${i < 3 ? 'correct' : 'faux'}]`)
        .check();
      if (i >= 3) await page.locator('#blind-form input[name=invention]').check();
      await page.locator('#blind-form input[name=rating][value="4"]').check();
      // Réponse suivante affichée (ou notation finie) avant de continuer : sur une machine lente,
      // la note suivante partait sinon sur la réponse déjà notée.
      const shown = await page.locator('#blind-progress').textContent();
      await page.locator('#blind-form button[type=submit]').click();
      await page.waitForFunction(
        (before) =>
          document.querySelector('#bench-blind').hidden ||
          document.querySelector('#blind-progress').textContent !== before,
        shown,
      );
    }
    await page.waitForFunction(() => document.querySelector('#bench-blind').hidden);
    const graded = (await readJson(profile, 'comparisons.json')).flatMap((r) => r.results);
    assert.equal(graded.filter((r) => r.grades?.Vous?.verdict).length, 5);
    assert.equal(graded.filter((r) => r.grades?.Vous?.invention).length, 2);
    assert.match(await page.locator('#bench-results').textContent(), /Précision \(correct\)/);
    assert.match(
      await page.locator('#bench-results').textContent(),
      /Quel modèle pour quelle tâche \?/,
    );
    assert.equal(
      await page.locator('#bench-results .chart').count(),
      8,
      '6 graphiques + 2 cartes de chaleur (catégories, métiers)',
    );

    // Notes d'un second correcteur importées : accord entre correcteurs.
    const gradesPath = path.join(profile, 'notes-claude.csv');
    const firstSeries = (await readJson(profile, 'comparisons.json'))[0];
    await fs.writeFile(
      gradesPath,
      '\ufeffSérie;Question;Modèle;Correcteur;Verdict;Invention;Note;Commentaire\n' +
        firstSeries.results
          .map(
            (r) =>
              `${firstSeries.id};${firstSeries.questions[r.q].label};${r.model};Claude;correct;non;4;`,
          )
          .join('\n') +
        '\ninconnue;A1;petit:1b;Claude;correct;non;4;',
    );
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, gradesPath);
    await page.locator('#bench-import').click();
    await page.waitForFunction(() =>
      document.querySelector('#bench-status').textContent.includes('4 note(s) importée(s)'),
    );
    assert.match(
      await page.locator('#bench-status').textContent(),
      /1 ligne\(s\) refusée\(s\) : ligne 6 : série inconnue/,
    );
    assert.match(
      await page.locator('#bench-results').textContent(),
      /Accord entre correcteurs.*Claude \/ Vous/s,
    );

    // Après l'import : graphiques de comparaison des correcteurs, avec légende dans le SVG.
    assert.match(await page.locator('#bench-results').textContent(), /Comparaison des correcteurs/);
    assert.equal(
      await page.locator('#bench-results .chart').count(),
      11,
      '8 + 3 graphiques par correcteur',
    );
    assert.equal(await page.locator('#bench-results .legend').first().locator('span').count(), 2);

    // Export d'un graphique en SVG autonome.
    const svgPath = path.join(profile, 'precision.svg');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, svgPath);
    await page.locator('.chart-export').first().click();
    await page.waitForFunction(() =>
      document.querySelector('#bench-status').textContent.includes('precision.svg'),
    );
    const svg = await fs.readFile(svgPath, 'utf8');
    assert.ok(svg.startsWith('<?xml'));
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /<style>/);
    assert.match(svg, /Précision \(réponses correctes\)/);

    const groupedSvgPath = path.join(profile, 'precision-correcteurs.svg');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, groupedSvgPath);
    await page
      .locator('.chart', { hasText: 'Précision selon le correcteur' })
      .locator('.chart-export')
      .click();
    await page.waitForFunction(() =>
      document.querySelector('#bench-status').textContent.includes('precision-correcteurs.svg'),
    );
    const groupedSvg = await fs.readFile(groupedSvgPath, 'utf8');
    assert.match(groupedSvg, />Claude</);
    assert.match(groupedSvg, />Vous</);

    // Avis des correcteurs affichés sous chaque réponse, dans l'onglet Comparaison.
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    await page.locator('.compare-row .link', { hasText: 'Série' }).first().click();
    const gradesText = await page.locator('.compare-card .grades').first().textContent();
    assert.match(gradesText, /Claude : correct · sans invention · 4\/5/);
    assert.match(gradesText, /Vous : (correct|faux)/);

    // Répétitions : même série lancée deux fois, stabilité mesurée.
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    await page.locator('#compare-prompt').fill('Question répétée');
    for (const input of await page.locator('#compare-models input').all()) await input.check();
    await page.locator('#compare-repetitions').fill('2');
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('terminée'),
    );
    const repeated = (await readJson(profile, 'comparisons.json')).slice(0, 2);
    assert.deepEqual(
      repeated.map((r) => [r.repetition, r.repetitions]),
      [
        [2, 2],
        [1, 2],
      ],
    );
    assert.equal(repeated[0].groupId, repeated[1].groupId);
    await page.locator('#bench-nav').click();
    await page.locator('#benchmark-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#bench-results').textContent.includes('Réponses identiques'),
    );
    assert.equal(await page.locator('#bench-series input').count(), 3, 'répétitions regroupées');

    // Pause au milieu d'une série de 2 répétitions, puis reprise de ce qui manque.
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    await page.locator('#compare-prompt').fill('## P1\nPremière\n---\n## P2\nSeconde');
    for (const input of await page.locator('#compare-models input').all()) await input.check();
    await page.locator('#compare-repetitions').fill('2');
    await app.evaluate(() => {
      global.chatDelay = 400;
    });
    const beforePause = await app.evaluate(() => global.requests.length);
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('Modèle 2/2'),
    );
    await page.locator('#compare-stop').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('en pause'),
    );
    const paused = (await readJson(profile, 'comparisons.json')).filter((r) =>
      r.questions.some((q) => q.label === 'P1'),
    );
    assert.equal(paused.length, 1, 'la répétition 2 n’a pas commencé');
    const doneBefore = paused[0].results.filter((r) => r.status === 'done').length;
    assert.ok(
      doneBefore >= 2 && doneBefore < 4,
      `réponses terminées avant la pause : ${doneBefore}`,
    );
    const resume = page.locator('.compare-row button', { hasText: 'Reprendre' });
    assert.match(await resume.textContent(), new RegExp(`Reprendre \\(${8 - doneBefore} réponse`));
    const answeredBefore = (await app.evaluate(() => global.requests.length)) - beforePause;
    await app.evaluate(() => {
      global.chatDelay = 0;
    });
    await resume.click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('terminée'),
    );
    const resumed = (await readJson(profile, 'comparisons.json')).filter((r) =>
      r.questions.some((q) => q.label === 'P1'),
    );
    assert.equal(resumed.length, 2);
    assert.equal(resumed[0].groupId, resumed[1].groupId);
    assert.ok(resumed.every((r) => r.results.every((x) => x.status === 'done')));
    const first = resumed.find((r) => r.repetition === 1);
    assert.equal(first.resumes.length, 1);
    assert.equal(first.resumes[0].env.ollama, '0.35.0');
    const answeredAfter = (await app.evaluate(() => global.requests.length)) - beforePause;
    assert.equal(answeredAfter - answeredBefore, 8 - doneBefore, 'seules les réponses manquantes');
    assert.equal(await page.locator('.compare-row button', { hasText: 'Reprendre' }).count(), 0);

    await page.locator('#bench-nav').click();

    await page.locator('#benchmark-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#bench-results').textContent.includes('Réponses identiques'),
    );
    await page.screenshot({ path: 'test-results/benchmark.png', fullPage: true });
    await page;
    await page
      .locator('#bench-results .charts')
      .first()
      .screenshot({ path: 'test-results/benchmark-charts.png' });
    await page
      .locator('#bench-results .charts')
      .nth(1)
      .screenshot({ path: 'test-results/benchmark-correcteurs.png' });

    // Départ programmé d'une série : Mac maintenu éveillé dès la programmation, annulation.
    await app.evaluate(({ powerSaveBlocker }) => {
      global.awake = [];
      const start = powerSaveBlocker.start.bind(powerSaveBlocker);
      const stop = powerSaveBlocker.stop.bind(powerSaveBlocker);
      powerSaveBlocker.start = (type) => {
        global.awake.push('start:' + type);
        return start(type);
      };
      powerSaveBlocker.stop = (id) => {
        global.awake.push('stop');
        return stop(id);
      };
    });
    await page.locator('#bench-nav').click();
    await page.locator('#compare-tab').click();
    await page.locator('#compare-prompt').fill('Question programmée');
    await page.locator('#compare-models input').first().check();
    const soon = new Date(Date.now() - 60000); // heure passée : départ le lendemain
    await page
      .locator('#compare-at')
      .fill(
        `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`,
      );
    await page.locator('#compare-run').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.startsWith('Départ programmé'),
    );
    assert.match(await page.locator('#compare-status').textContent(), /dans 23 h 5\d/);
    assert.equal(await page.locator('#compare-run').isDisabled(), true);
    await page.locator('#compare-unschedule').click();
    await page.waitForFunction(() =>
      document.querySelector('#compare-status').textContent.includes('annulé'),
    );
    assert.deepEqual(await app.evaluate(() => global.awake), [
      'start:prevent-app-suspension',
      'stop',
    ]);
    await page.locator('#compare-at').fill('');
    await page.locator('#compare-prompt').fill('');

    // Actions sur les fichiers : dossier autorisé par la fenêtre système, plan vérifié, coché,
    // appliqué, inscrit au journal puis annulé. Corbeille simulée (aucun fichier réel touché).
    const work = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'localia-dossier-')));
    for (const name of ['mildiou-2019.pdf', 'mildiou-2023.pdf', 'notes.txt'])
      await fs.writeFile(path.join(work, name), name);
    await app.evaluate(
      ({ dialog, shell }, folders) => {
        global.trashed = [];
        shell.trashItem = async (file) => {
          global.trashed.push(file);
        };
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folders.shift()] });
      },
      [os.homedir(), work],
    );
    await page.locator('#files-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#files-folders').textContent.includes('Aucun dossier autorisé'),
    );
    await page.locator('#files-add').click();
    // Message réellement affiché, pour comprendre un échec sur un autre système.
    await page.waitForFunction(
      () =>
        document.querySelector('#notice').textContent ||
        !document.querySelector('#files-folders').textContent.includes('Aucun dossier'),
    );
    assert.match(
      await page.locator('#notice').textContent(),
      /ne peut pas être autorisé/,
      `dossier personnel refusé ; dossiers : ${await page.locator('#files-folders').textContent()}`,
    );
    await page.locator('#files-add').click();
    await page.waitForFunction(() =>
      document.querySelector('#files-listing summary').textContent.startsWith('3 fichier(s)'),
    );
    await app.evaluate(() => {
      global.chatReply =
        'Je classe les PDF par année.\n```json\n' +
        JSON.stringify({
          summary: 'Classement par année',
          actions: [
            { type: 'create_folder', path: '2019', reason: 'année du fichier' },
            { type: 'move', from: 'mildiou-2019.pdf', to: '2019/mildiou-2019.pdf' },
            { type: 'move', from: 'mildiou-2023.pdf', to: '2023/mildiou-2023.pdf' },
            { type: 'trash', path: 'notes.txt', reason: 'brouillon' },
          ],
        }) +
        '\n```';
    });
    await page.locator('#files-instruction').fill('Classe les PDF par année.');
    await page.locator('#files-propose').click();
    await page.waitForFunction(
      () => document.querySelectorAll('#files-actions tbody tr').length === 4,
    );
    request = await lastRequest();
    assert.match(request.messages[0].content, /plan d’actions/);
    assert.match(request.messages[1].content, /^- \[fichier\] mildiou-2019\.pdf \(16 o\)$/m);
    assert.match(request.messages[1].content, /Demande : Classe les PDF par année\./);
    assert.ok(request.options.num_ctx >= 8192);
    assert.equal(await page.locator('#files-summary').textContent(), 'Classement par année');
    assert.match(
      await page.locator('#files-actions tbody tr').nth(2).textContent(),
      /le dossier « 2023 » n’existe pas/,
    );
    assert.equal(await page.locator('#files-apply').isDisabled(), true);
    await page.locator('#files-actions tbody tr').nth(2).locator('input').uncheck();
    assert.equal(await page.locator('#files-apply').textContent(), 'Appliquer 3 action(s)');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#files-apply').click();
    await page.waitForFunction(() => document.querySelector('.journal-card'));
    assert.equal(
      await fs.readFile(path.join(work, '2019', 'mildiou-2019.pdf'), 'utf8'),
      'mildiou-2019.pdf',
    );
    assert.deepEqual(await app.evaluate(() => global.trashed), [path.join(work, 'notes.txt')]);
    const [batch] = await readJson(profile, 'actions-journal.json');
    assert.equal(batch.proposed, 4);
    assert.deepEqual(
      batch.results.map((r) => [r.type, r.done]),
      [
        ['create_folder', true],
        ['move', true],
        ['trash', true],
      ],
    );
    await page.screenshot({ path: 'test-results/files.png', fullPage: true });
    await page.locator('.journal-card summary').click();
    await page.locator('.journal-card button', { hasText: 'Annuler cette opération' }).click();
    await page.waitForFunction(() =>
      /à récupérer dans la corbeille/i.test(document.querySelector('#notice').textContent),
    );
    assert.deepEqual((await fs.readdir(work)).sort(), [
      'mildiou-2019.pdf',
      'mildiou-2023.pdf',
      'notes.txt',
    ]);
    assert.ok((await readJson(profile, 'actions-journal.json'))[0].undoneAt);
    // Réponse sans plan : rien à appliquer, la réponse du modèle est montrée.
    await app.evaluate(() => {
      global.chatReply = 'Je ne peux pas savoir quelle année correspond à chaque fichier.';
    });
    await page.locator('#files-propose').click();
    await page.waitForFunction(() =>
      document.querySelector('#files-summary').textContent.includes('Aucun plan lisible'),
    );
    assert.equal(await page.locator('#files-apply').isDisabled(), true);
    await page.locator('.folder-row button', { hasText: 'Retirer' }).click();
    await page.waitForFunction(() =>
      document.querySelector('#files-folders').textContent.includes('Aucun dossier autorisé'),
    );
    assert.equal(await page.locator('#files-form').isHidden(), true);
    await app.evaluate(() => {
      delete global.chatReply;
    });
    await fs.rm(work, { recursive: true, force: true });

    // Guide de démarrage : Ollama actif et modèles installés (simulés), première question.
    await page.locator('#guide-tab').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#guide-ollama .guide-state')
        .textContent.includes('Ollama est actif (version 0.35.0)'),
    );
    await page.waitForFunction(() =>
      /2 modèle\(s\) disponible\(s\)/.test(
        document.querySelector('#guide-model .guide-state').textContent,
      ),
    );
    assert.match(
      await page.locator('#starter-advice').textContent(),
      /Go de mémoire, nous conseillons/,
    );
    await page.locator('#guide-try button').click();
    await page.waitForFunction(() => !document.querySelector('#chat-view').hidden);
    assert.match(await page.locator('#prompt').inputValue(), /^Présente-toi en trois phrases/);
    await page.locator('#prompt').fill('');
    assert.equal((await readJson(profile, 'settings.json')).guideDone, true);

    // Performances de l'ordinateur : matériel, verdict des modèles installés, mesure de vitesse.
    await page.locator('#performance-tab').click();
    await page.waitForFunction(() => document.querySelectorAll('.pc-card').length === 6);
    assert.match(await page.locator('#pc-cards').textContent(), /Mémoire vive\d+ Go au total/);
    // Carte graphique du moteur intégré : indication, puis réglage enregistré.
    await page.waitForFunction(() =>
      document.querySelector('#gpu-engine').textContent.startsWith('Carte graphique utilisée'),
    );
    assert.equal(await page.locator('#gpu-mode').inputValue(), 'auto');
    await page.locator('#gpu-mode').selectOption('jamais');
    await page.waitForFunction(() =>
      document.querySelector('#gpu-engine').textContent.includes('« Jamais »'),
    );
    assert.equal((await readJson(profile, 'settings.json')).gpu, 'jamais');
    await page.locator('#gpu-mode').selectOption('auto');
    await page.waitForFunction(
      () => !document.querySelector('#gpu-engine').textContent.includes('« Jamais »'),
    );
    assert.equal((await readJson(profile, 'settings.json')).gpu, undefined);
    assert.match(
      await page.locator('#pc-advice').textContent(),
      /le modèle idéal pour commencer est/,
    );
    const petit = page.locator('#pc-models tr', { hasText: 'petit:1b' });
    assert.match(await petit.textContent(), /Confortable/);
    await petit.locator('button', { hasText: 'Mesurer' }).click();
    await page.waitForFunction(() =>
      document.querySelector('#pc-models').textContent.includes('6 tokens/s — confortable'),
    );
    assert.match(await petit.textContent(), /\(test rapide\)/);
    const measuredFile = await readJson(profile, 'performance.json');
    assert.equal(measuredFile['petit:1b'].tokensPerSecond, 6);
    assert.ok(measuredFile['petit:1b'].loadSeconds === 2);
    assert.match(await page.locator('#pc-suggestions').textContent(), /Gemma 3 · 4B/);

    // Compétences : dossier de départ, menu Compétence, appel « /nom », suggestions, nouvelle compétence.
    await page.locator('#skills-tab').click();
    await page.waitForFunction(() => document.querySelectorAll('.skill-card').length === 42);
    assert.match(
      await page.locator('#skills-list').textContent(),
      /Données brutes[\s\S]*\/donnees-manquants/,
    );
    await page
      .locator('.skill-card', { hasText: '5. Valeurs manquantes' })
      .locator('button', { hasText: 'Utiliser' })
      .click();
    await page.waitForFunction(() => !document.querySelector('#chat-view').hidden);
    assert.equal(await page.locator('#skill').inputValue(), 'skill:donnees-manquants');
    assert.equal(await page.locator('#task').inputValue(), '', 'tâches et compétences séparées');
    await page.locator('#new').click();
    await page.locator('#skill').selectOption('skill:donnees-manquants');
    // Tâche incompatible avec la compétence : signalé ; puis tâche retirée.
    await page.locator('#task').selectOption('synthese');
    assert.match(
      await page.locator('#task-advice').textContent(),
      /Attention : cette compétence est prévue pour la tâche « Préparer et analyser des données/,
    );
    await page.locator('#task').selectOption('');
    await page.locator('#prompt').fill('Mon fichier a des trous.');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Compétence appliquée : 5. Valeurs manquantes'),
    );
    request = await lastRequest();
    assert.match(
      request.messages[0].content,
      /Compétence « 5\. Valeurs manquantes » \(\/donnees-manquants\)/,
    );
    assert.match(
      request.messages[0].content,
      /pandas/,
      'consigne de la tâche Données (tache: donnees)',
    );
    // Appel en début de message, avec suggestions pendant la saisie.
    await page.locator('#prompt').fill('/relecture-i');
    await page.locator('#prompt').dispatchEvent('input');
    await page.waitForFunction(() => !document.querySelector('#skill-suggest').hidden);
    await page.locator('#prompt').press('Tab');
    assert.equal(await page.locator('#prompt').inputValue(), '/relecture-ieee ');
    await page.locator('#prompt').type('Relis la section 3.');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.skill-tag')].some((t) => t.textContent === '/relecture-ieee'),
    );
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Compétence appliquée : Relecture'),
    );
    request = await lastRequest();
    assert.match(request.messages[0].content, /Relecture d’un article \(format IEEE\)/);
    assert.equal(request.messages.at(-1).content, 'Relis la section 3.');
    // Appel seul, sans texte : la compétence s'applique telle quelle.
    await page.locator('#prompt').fill('/donnees-brutes');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document
        .querySelector('#notice')
        .textContent.includes('Compétence appliquée : Traiter des données brutes'),
    );
    request = await lastRequest();
    assert.equal(
      request.messages.at(-1).content,
      'Applique la compétence « Traiter des données brutes (parcours complet) ».',
    );
    assert.match(request.messages[0].content, /9\. \/donnees-documenter/);
    await page.locator('#prompt').fill('/inconnue test');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Compétence inconnue : /inconnue'),
    );
    assert.equal(await page.locator('#prompt').inputValue(), '/inconnue test', 'rien envoyé');
    await page.locator('#prompt').fill('/competences');
    await page.locator('#send').click();
    await page.waitForFunction(() => !document.querySelector('#skills-view').hidden);
    await app.evaluate(({ shell }) => {
      global.opened = [];
      shell.openPath = async (p) => {
        global.opened.push(p);
        return '';
      };
    });
    await page.locator('#skills-new').click();
    await page.waitForFunction(() => document.querySelectorAll('.skill-card').length === 43);
    assert.match(
      (await app.evaluate(() => global.opened)).at(-1),
      /Compétences[\\/]ma-competence\.md$/,
    );
    assert.match(
      await fs.readFile(path.join(profile, 'Compétences', 'ma-competence.md'), 'utf8'),
      /appel: \/ma-competence/,
    );

    // Fichiers joints : consignes (.md) et données météo (CSV NASA POWER) pour un script Python.
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-donnees-'));
    const csvFile = path.join(dataDir, 'dalaba.csv');
    const mdFile = path.join(dataDir, 'consignes.md');
    await fs.writeFile(
      csvFile,
      '-BEGIN HEADER-\nNASA/POWER Daily\n-END HEADER-\nYEAR,DOY,T2M,PRECTOTCORR\n2024,1,23.5,0.0\n2024,2,23.6,-999\n',
    );
    await fs.writeFile(mdFile, '# Nettoyage\nRemplacer -999 par NaN puis créer une colonne date.');
    await app.evaluate(
      ({ dialog }, files) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [files.shift()] });
      },
      [csvFile, mdFile],
    );
    await page.locator('#chat-tab').click();
    await page.locator('#new').click();
    await page.locator('#attach').click();
    await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 1);
    await page.locator('#attach').click();
    await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 2);
    assert.match(await page.locator('#file-chips').textContent(), /tableau · 2 lignes, 4 colonnes/);
    await page.locator('#task').selectOption('donnees');
    await page.locator('#prompt').fill('Écris le script de nettoyage.');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Fichiers transmis'),
    );
    request = await lastRequest();
    const sentSystem = request.messages[0].content;
    assert.match(sentSystem, /pandas/, 'consigne de la tâche Données');
    assert.match(sentSystem, /### Tableau : dalaba\.csv[\s\S]*skiprows=3[\s\S]*1 valeur\(s\) -999/);
    assert.match(sentSystem, /### Fichier : consignes\.md\n```\n# Nettoyage/);
    assert.ok(!sentSystem.includes('2024,2,23.6,-999\n2024'), 'portrait, pas le fichier entier');
    assert.equal(request.messages.at(-1).content, 'Écris le script de nettoyage.');
    const withFiles = (await readJson(profile, 'conversations.json')).find((c) => c.files);
    assert.deepEqual(
      withFiles.files.map((f) => f.name),
      ['dalaba.csv', 'consignes.md'],
    );
    const fileIds = withFiles.files.map((f) => f.id);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#delete-conversation').click();
    await page.waitForFunction(() => !document.querySelectorAll('.file-chip').length);
    for (const id of fileIds) await waitForMissing(path.join(profile, 'documents', id + '.json'));

    // Classeur Excel (fichier joint), document Word et PDF scanné (document de la conversation).
    const { xlsxFixture, docxFixture, scannedPdfFixture } = require('./office-fixture.cjs');
    const xlsxFile = path.join(dataDir, 'meteo.xlsx');
    const docxFile = path.join(dataDir, 'rapport.docx');
    const scanFile = path.join(dataDir, 'facture-scannee.pdf');
    await fs.writeFile(xlsxFile, xlsxFixture());
    await fs.writeFile(docxFile, docxFixture());
    await fs.writeFile(scanFile, scannedPdfFixture(['Facture numéro 2026-118']));
    await app.evaluate(
      ({ dialog }, files) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [files.shift()] });
      },
      [xlsxFile, docxFile, scanFile],
    );
    await page.locator('#new').click();
    await page.locator('#attach').click();
    await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 1);
    assert.match(await page.locator('#file-chips').textContent(), /meteo\.xlsx/);
    assert.match(await page.locator('#file-chips').textContent(), /2 feuille\(s\)/);
    await page.locator('#attach').click();
    await page.waitForFunction(() =>
      document.querySelector('#attachment-info').textContent.includes('Document Word'),
    );
    await page.locator('#prompt').fill('Quelle pluie en juillet ?');
    await page.locator('#send').click();
    await page.waitForFunction(() => !document.querySelector('#send').disabled);
    request = await lastRequest();
    const wordSent = request.messages.map((m) => m.content).join('\n');
    assert.match(wordSent, /Document Word : « Page n » désigne la section n/);
    assert.match(wordSent, /Juillet \| 481/);
    assert.match(wordSent, /Feuille « Météo » du classeur Excel « meteo\.xlsx »/);

    // Sous la réponse : copier, écouter, exporter en PDF (question et réponse, sans réseau).
    const answer = page.locator('.message.assistant').last();
    await answer.locator('.answer-action', { hasText: 'Copier' }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.answer-action')].some((b) => b.textContent === 'Copié ✓'),
    );
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    assert.ok(copied.length > 0 && !copied.includes('<'), 'texte copié sans balises');
    assert.equal(await answer.locator('.answer-action', { hasText: 'Écouter' }).count(), 1);
    const pdfOut = path.join(dataDir, 'reponse.pdf');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, pdfOut);
    await answer.locator('.answer-action', { hasText: 'Exporter en PDF' }).click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('reponse.pdf'),
    );
    assert.equal((await fs.readFile(pdfOut)).subarray(0, 5).toString(), '%PDF-');
    const docxOut = path.join(dataDir, 'reponse.docx');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, docxOut);
    await answer.locator('.answer-action', { hasText: 'Exporter en Word' }).click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('reponse.docx'),
    );
    const wordText = require('../src/office.cjs').docxText(await fs.readFile(docxOut));
    assert.match(wordText, /Question : Quelle pluie en juillet \?/);
    assert.ok(wordText.includes(copied.split('\n')[0].trim().slice(0, 30)), 'texte de la réponse');

    // Dictée vocale : accord pour le modèle, enregistrement (faux micro), texte ajouté au message.
    await app.evaluate(({ systemPreferences }) => {
      systemPreferences.askForMediaAccess = async () => true;
      systemPreferences.getMediaAccessStatus = () => 'granted';
    });
    await page.locator('#prompt').fill('Question :');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#dictate').click();
    await page.waitForFunction(() =>
      document.querySelector('#dictate').classList.contains('recording'),
    );
    assert.ok(
      (await fs.stat(path.join(profile, 'dictee', 'ggml-base-q5_1.bin'))).size > 0,
      'modèle de dictée téléchargé',
    );
    await page.waitForTimeout(1200);
    await page.locator('#dictate').click();
    await page.waitForFunction(() =>
      /^Question : Texte dicté en fr, \d/.test(document.querySelector('#prompt').value),
    );
    assert.doesNotMatch(await page.locator('#prompt').inputValue(), /Musique/);
    assert.equal(await page.locator('#dictate').getAttribute('aria-pressed'), 'false');
    await page.locator('#prompt').fill('');

    // Recherche dans les conversations : par le texte des messages, sans tenir compte des accents.
    await page.locator('#history-search').fill('PLUIE juillet');
    await page.waitForFunction(
      () => document.querySelectorAll('#history .history-row').length === 1,
    );
    await page.locator('#history-search').fill('mot-introuvable-xyz');
    await page.waitForFunction(() => document.querySelector('.history-empty'));
    await page.locator('#history-search').fill('');
    // Sélection de plusieurs conversations, supprimées ensemble après confirmation.
    const countBefore = (await readJson(profile, 'conversations.json')).length;
    assert.ok(countBefore >= 3, 'au moins trois conversations');
    await page.locator('#history-select').click();
    await page.waitForFunction(() => document.querySelectorAll('.history-check').length > 2);
    assert.equal(await page.locator('#history-delete').isDisabled(), true, 'rien de coché');
    await page.locator('.history-check').nth(0).check();
    await page.locator('#history .history-open').nth(1).click();
    await page.waitForFunction(
      () => document.querySelector('#history-delete').textContent.trim() === 'Supprimer (2)',
    );
    assert.equal(await page.locator('.history-delete:visible').count(), 0, 'corbeilles masquées');
    page.once('dialog', (dialog) => {
      assert.match(dialog.message(), /Supprimer définitivement 2 conversations/);
      dialog.accept();
    });
    await page.locator('#history-delete').click();
    await page.waitForFunction(() => !document.querySelector('.history-check'));
    await settleWrites();
    assert.equal((await readJson(profile, 'conversations.json')).length, countBefore - 2);

    // Taille du texte : zoom de la fenêtre, gardé dans les réglages.
    await page.locator('#home-tab').click();
    await page.locator('[data-text-size="1.3"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-text-size="1.3"]').getAttribute('aria-pressed') === 'true',
    );
    assert.equal((await readJson(profile, 'settings.json')).textSize, 1.3);
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),
      ),
      1.3,
    );
    await page.locator('[data-text-size="1"]').click();
    // Contraste élevé : couleurs plus foncées sur toute la page, gardé dans les réglages.
    await page.locator('#contrast-toggle').click();
    await page.waitForFunction(() => document.documentElement.dataset.contrast === 'fort');
    assert.equal((await readJson(profile, 'settings.json')).contrast, 'fort');
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--fg').trim()),
      '#000000',
    );
    await page.locator('#contrast-toggle').click();
    await page.waitForFunction(() => !document.documentElement.dataset.contrast);
    assert.equal((await readJson(profile, 'settings.json')).contrast, 'normal');
    await page.waitForFunction(
      () => document.querySelector('[data-text-size="1"]').getAttribute('aria-pressed') === 'true',
    );
    await page.locator('#chat-tab').click();
    await page.locator('#attach').click();
    await page.waitForFunction(
      () => document.querySelector('#attachment-info').textContent.includes('(OCR)'),
      null,
      { timeout: 60000 },
    );
    assert.match(await page.locator('#attachment-name').textContent(), /facture-scannee\.pdf/);
    await fs.rm(dataDir, { recursive: true, force: true });

    // Fichier déposé dans la fenêtre (glisser-déposer) : son contenu est transmis, pas son chemin.
    const drop = (name, text) =>
      page.evaluate(
        ([fileName, content]) => {
          const transfer = new DataTransfer();
          transfer.items.add(new File([content], fileName));
          const view = document.querySelector('#chat-view');
          for (const type of ['dragenter', 'dragover', 'drop'])
            view.dispatchEvent(
              new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
            );
        },
        [name, text],
      );
    await page.locator('#new').click();
    await drop('programme.exe', 'MZ');
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Format non pris en charge'),
    );
    await drop('ancien.doc', 'x');
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Ancien format Word (.doc)'),
    );
    await drop('mesures.csv', 'date,pluie\n2024-06-01,12\n2024-06-02,0\n');
    await page.waitForFunction(() => document.querySelectorAll('.file-chip').length === 1);
    assert.match(await page.locator('#file-chips').textContent(), /mesures\.csv/);
    const dropped = (await readJson(profile, 'conversations.json')).find((c) => c.files);
    assert.equal(dropped.files[0].name, 'mesures.csv');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#delete-conversation').click();
    await page.waitForFunction(() => !document.querySelectorAll('.file-chip').length);

    // Photo : refusée pour un modèle qui ne lit pas les images, envoyée (réduite, en base64)
    // à un modèle qui les lit, avec la consigne de prudence ; miniature gardée dans le message.
    const photoPath = path.join(os.tmpdir(), `localia-photo-${Date.now()}.png`);
    await fs.writeFile(
      photoPath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
        'base64',
      ),
    );
    await page.locator('#new').click();
    await page.locator('#photo-input').setInputFiles(photoPath);
    await page.waitForFunction(() => document.querySelectorAll('.image-chip').length === 1);
    await page.locator('#model').selectOption('petit:1b');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      /ne lit pas les photos/.test(document.querySelector('#notice').textContent),
    );
    assert.equal(await page.locator('.message').count(), 0, 'rien n’est envoyé');
    await page.locator('#model').selectOption('grand:8b');
    await page.locator('#send').click();
    await page.waitForFunction(() => document.querySelectorAll('.message-images img').length === 1);
    request = await lastRequest();
    const withPhoto = request.messages.at(-1);
    assert.equal(withPhoto.content, 'Que montre cette photo ?');
    assert.equal(withPhoto.images.length, 1);
    assert.equal(Buffer.from(withPhoto.images[0], 'base64').subarray(0, 2).toString('hex'), 'ffd8');
    assert.match(request.messages[0].content, /premier avis, à confirmer par un spécialiste/);
    assert.equal(await page.locator('.image-chip').count(), 0, 'photo partie avec le message');
    const photoId = (await readJson(profile, 'conversations.json'))[0].messages[0].images[0].id;
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#delete-conversation').click();
    await waitForMissing(path.join(profile, 'documents', photoId + '.json'));
    await fs.rm(photoPath, { force: true });

    // Photo avec du texte et modèle qui ne lit pas les images : texte lu par reconnaissance de
    // caractères sur cet ordinateur, puis envoyé avec le message.
    const textPhoto = path.join(os.tmpdir(), `localia-reponse-${Date.now()}.png`);
    await fs.writeFile(
      textPhoto,
      require('./office-fixture.cjs').photoFixture([
        'Refus de prise en charge',
        'Dossier 2025-4471',
      ]),
    );
    await page.locator('#new').click();
    await page.locator('#photo-input').setInputFiles(textPhoto);
    await page.waitForFunction(() => document.querySelectorAll('.image-chip').length === 1);
    await page.locator('#model').selectOption('petit:1b');
    await page.locator('#prompt').fill('voici leur réponse :');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 1 &&
        document.querySelector('#stop').hidden,
      null,
      { timeout: 60000 },
    );
    request = await lastRequest();
    assert.equal(request.messages.at(-1).images, undefined);
    assert.match(
      request.messages.at(-1).content,
      /^voici leur réponse :\n\n\[Texte lu sur la photo « localia-reponse-\d+\.(png|jpg) » par reconnaissance de caractères[^\]]*\]\n[^]*2025-4471/,
    );
    assert.match(await page.locator('#notice').textContent(), /Ce modèle ne lit pas les images/);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#delete-conversation').click();
    await fs.rm(textPhoto, { force: true });

    // Réponse vide (longueur maximale atteinte pendant la réflexion) : expliquée, question gardée.
    await app.evaluate(() => {
      global.chatReply = '';
      global.chatDoneReason = 'length';
    });
    await page.locator('#new').click();
    await page.locator('#prompt').fill('Question sans réponse visible');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('pendant sa réflexion'),
    );
    assert.equal(await page.locator('#prompt').inputValue(), 'Question sans réponse visible');
    assert.equal(await page.locator('.message').count(), 0);
    await app.evaluate(() => {
      delete global.chatReply;
      delete global.chatDoneReason;
    });
    await page.locator('#prompt').fill('');

    // Métier Santé : anonymisation avant l'envoi (repérage + liste personnelle), réponse remise
    // en clair, étiquettes gardées avec la conversation ; consigne de métier envoyée.
    await page.locator('#security-tab').click();
    await page.locator('#mask-words').fill('Clinique Pasteur');
    await page.locator('#mask-save').click();
    await page.waitForFunction(() =>
      document.querySelector('#mask-status').textContent.includes('1 mot'),
    );
    await page.locator('#metier-switch').click();
    await page.locator('.metier-card[data-metier=sante]').dblclick();
    await page.waitForFunction(() => document.body.dataset.metier === 'sante');
    await app.evaluate(() => {
      global.chatReply = 'Compte rendu pour [PERSONNE 1], suivi à la [MOT MASQUÉ 1].';
    });
    await page.locator('#new').click();
    await page
      .locator('#prompt')
      .fill('Patient Mamadou DIALLO vu à la Clinique Pasteur, tél. 06 12 34 56 78.');
    await page.locator('#send').click();
    await page.waitForFunction(() =>
      document
        .querySelector('.message.assistant .markdown')
        ?.textContent.includes('Compte rendu pour Mamadou DIALLO, suivi à la Clinique Pasteur.'),
    );
    request = await lastRequest();
    const sentText = JSON.stringify(request.messages);
    for (const secret of ['DIALLO', 'Pasteur', '06 12 34 56 78'])
      assert.ok(!sentText.includes(secret), `${secret} envoyé au modèle`);
    assert.match(
      request.messages.at(-1).content,
      /Patient \[PERSONNE 1\] vu à la \[MOT MASQUÉ 1\], tél\. \[TÉLÉPHONE 1\]/,
    );
    assert.match(request.messages[0].content, /Tu ne poses pas de diagnostic/);
    assert.match(
      await page.locator('#notice').textContent(),
      /Anonymisation : 1 mot de votre liste, 1 téléphone, 1 personne/,
    );
    await waitForJson(
      profile,
      'conversations.json',
      (c) => c[0]?.anonymap?.['[PERSONNE 1]'] === 'Mamadou DIALLO',
    );
    await app.evaluate(() => {
      global.chatReply = undefined;
    });
    await page.locator('#metier-switch').click();
    await page.locator('.metier-card[data-metier=enseignement]').dblclick();
    await page.waitForFunction(() => document.body.dataset.metier === 'enseignement');

    // Moteur intégré (simulé) : modèle repris d'Ollama, conversation sans passer par Ollama.
    await page.locator('#models-tab').click();
    await page
      .locator('.installed-row', { hasText: 'petit:1b' })
      .locator('button', { hasText: 'Utiliser avec le moteur intégré' })
      .click();
    await page.waitForFunction(() =>
      document.querySelector('#installed').textContent.includes('integre/petit:1b'),
    );
    assert.match(
      await page.locator('#installed').textContent(),
      /integre\/petit:1b moteur intégré/,
    );
    const ollamaCalls = await app.evaluate(() => global.requests.length);
    await page.locator('#chat-tab').click();
    await page.locator('#new').click();
    // Bascule Ollama ↔ moteur intégré : le même modèle de l'autre côté.
    assert.deepEqual(await page.$$eval('#model optgroup', (groups) => groups.map((g) => g.label)), [
      'Moteur intégré de Localia',
      'Ollama',
    ]);
    await page.locator('#model').selectOption('petit:1b');
    await page.locator('#engine-card').click();
    await page.locator('#engine-local').click();
    assert.equal(await page.locator('#model').inputValue(), 'integre/petit:1b');
    assert.equal(await page.locator('#engine-state').textContent(), 'Moteur intégré');
    await page.locator('#engine-ollama').click();
    assert.equal(await page.locator('#model').inputValue(), 'petit:1b');
    assert.equal(await page.locator('#engine-state').textContent(), 'Ollama');
    await page.locator('#engine-local').click();
    await page.locator('#engine-card').click();
    assert.equal(await page.locator('#model').inputValue(), 'integre/petit:1b');
    await page.locator('#prompt').fill('Question au moteur intégré');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#stop').hidden &&
        document
          .querySelector('.message.assistant:last-of-type')
          ?.textContent.includes('Réponse du moteur intégré'),
    );
    assert.equal(
      await app.evaluate(() => global.requests.length),
      ollamaCalls,
      'aucune requête à Ollama',
    );
    const integreConv = (await readJson(profile, 'conversations.json')).find(
      (c) => c.model === 'integre/petit:1b',
    );
    assert.match(integreConv.messages.at(-1).content, /à « Question au moteur intégré »/);
    assert.deepEqual(
      (await readJson(profile, 'modeles-integres.json')).map((m) => [m.name, m.origin, m.source]),
      [['integre/petit:1b', 'petit:1b', 'ollama']],
    );

    // Catalogue Hugging Face : verdicts affichés ; fichier déjà présent chez Ollama utilisé sans
    // aucun téléchargement.
    await page.locator('#models-tab').click();
    await page.waitForFunction(() => document.querySelectorAll('.hf-card').length === 12);
    const qwenCard = page.locator('.hf-card', { hasText: 'Qwen 3 · 4B' });
    assert.match(await qwenCard.textContent(), /2,5 Go · licence Apache 2\.0/);
    await qwenCard.locator('button').click();
    await page.waitForFunction(() =>
      document.querySelector('#hf-status').textContent.includes('integre/qwen3-4b est prêt'),
    );
    const sharedEntry = (await readJson(profile, 'modeles-integres.json')).find(
      (m) => m.name === 'integre/qwen3-4b',
    );
    assert.equal(sharedEntry.source, 'ollama');
    assert.equal(sharedEntry.file, sharedBlob);
    await assert.rejects(
      fs.stat(path.join(profile, 'modeles', qwenCatalog.file)),
      'rien téléchargé',
    );
    assert.equal(await qwenCard.locator('button').textContent(), 'Installé ✓');

    // Sans Internet : modèle installé depuis une « clé USB », puis recopié vers une autre.
    const usb = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-usb-'));
    const usbModel = path.join(usb, 'Mon Modèle-Q4.gguf');
    await fs.writeFile(usbModel, Buffer.concat([Buffer.from('GGUF'), Buffer.alloc(4096, 7)]));
    await fs.writeFile(path.join(usb, 'pas-un-modele.gguf'), 'bonjour');
    await app.evaluate(
      ({ dialog }, files) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [files.shift()] });
      },
      [path.join(usb, 'pas-un-modele.gguf'), usbModel, path.join(usb, 'autre-cle')],
    );
    await page.locator('#usb-import').click();
    await page.waitForFunction(() =>
      document.querySelector('#hf-status').textContent.includes('pas un modèle GGUF'),
    );
    await page.locator('#usb-import').click();
    await page.waitForFunction(() =>
      document.querySelector('#hf-status').textContent.includes('integre/mon-modele-q4 est prêt'),
    );
    const usbEntry = (await readJson(profile, 'modeles-integres.json')).find(
      (m) => m.name === 'integre/mon-modele-q4',
    );
    assert.equal(usbEntry.source, 'fichier');
    assert.equal(usbEntry.origin, 'fichier local/Mon Modèle-Q4.gguf');
    assert.equal(usbEntry.license, 'inconnue (fichier local)');
    assert.equal(usbEntry.file, path.join(profile, 'modeles', 'Mon Modèle-Q4.gguf'));
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#usb-model option')].some(
        (o) => o.value === 'integre/mon-modele-q4',
      ),
    );
    await fs.mkdir(path.join(usb, 'autre-cle'));
    await page.locator('#usb-model').selectOption('integre/mon-modele-q4');
    await page.locator('#usb-export').click();
    await page.waitForFunction(() =>
      document.querySelector('#hf-status').textContent.includes('Copie terminée'),
    );
    const copiedModel = path.join(usb, 'autre-cle', 'Mon Modèle-Q4.gguf');
    assert.deepEqual(await fs.readFile(copiedModel), await fs.readFile(usbModel));
    assert.match(
      await fs.readFile(copiedModel + '.sha256', 'utf8'),
      new RegExp(`^${usbEntry.digest.slice(7)}  Mon Modèle-Q4\\.gguf\\n$`),
    );
    await fs.rm(usb, { recursive: true, force: true });

    // Choix automatique du modèle (ordinateur et métier), puis choix de l'utilisateur respecté.
    const registry = await readJson(profile, 'modeles-integres.json');
    await fs.writeFile(
      path.join(profile, 'modeles-integres.json'),
      JSON.stringify([...registry, { ...usbEntry, name: 'integre/gemma-4-e4b' }]),
    );
    await page.evaluate(async () => {
      computer = { memoryGB: 16, platform: 'darwin', arch: 'arm64', freeDiskGB: 100 };
      settings = await window.localia.saveSettings({
        ...settings,
        mode: 'simple',
        modelChoice: 'auto',
      });
      await refresh();
    });
    // Mode simple : langue (en haut à droite), taille du texte et contraste restent accessibles.
    await page.evaluate(() => {
      applyMode();
      view('chat');
    });
    for (const selector of [
      'header [data-lang="en"]',
      '[data-text-size="1.3"]',
      '#contrast-toggle',
    ])
      assert.ok(await page.locator(selector).isVisible(), selector);
    const advised = await page.evaluate(() => recommendedModel()?.name);
    assert.ok(advised, 'un modèle conseillé parmi les modèles installés');
    await page.waitForFunction((name) => document.querySelector('#model').value === name, advised);
    assert.equal((await readJson(profile, 'settings.json')).modelChoice, undefined, 'automatique');

    // Accueil du mode simple : domaines (métier et profil), type de demande, modèle conseillé dans
    // la zone de saisie, projets, et « Analyser votre PC » dans la colonne.
    const metierBefore = await page.evaluate(() => settings.metier);
    await page.locator('#simple-home').click();
    await page.waitForSelector('#welcome .domain-chip');
    assert.match(await page.locator('#ready-pill').textContent(), /^(Prêt|Démarrage…)$/);
    await page.locator('#welcome .domain-chip', { hasText: 'Santé' }).click();
    await page.waitForFunction(() => settings.metier === 'sante');
    await page.locator('#welcome .domain-more .domain-chip').click();
    await page.locator('#welcome .domain-menu button', { hasText: 'Chercheur' }).click();
    await page.waitForFunction(() => settings.profil === 'Chercheur');
    const domainSettings = await readJson(profile, 'settings.json');
    assert.deepEqual([domainSettings.metier, domainSettings.profil], ['enseignement', 'Chercheur']);
    assert.match(
      await page.locator('#welcome .domain-more .domain-chip').textContent(),
      /Chercheur/,
    );
    assert.ok((await page.locator('#welcome-suggestions .welcome-chip').count()) > 0);
    await page.locator('[data-compose="idee"]').click();
    assert.match(await page.locator('#prompt').getAttribute('placeholder'), /Décrivez votre idée/);
    await page.locator('[data-compose="question"]').click();
    await page.waitForFunction(() =>
      document.querySelector('#model-pill-badge').textContent.includes('Conseillé'),
    );
    assert.ok(await page.locator('.resume-new').isVisible());
    await page.locator('#simple-pc').click();
    await page.waitForFunction(() => !document.querySelector('#performance-view').hidden);
    await page.locator('#simple-home').click();
    await page.waitForFunction(() => !document.querySelector('#chat-view').hidden);
    // Retour au métier du début, pour la suite (modèle conseillé de ce métier).
    await page.evaluate(async (metier) => {
      const { profil, ...rest } = settings;
      settings = await window.localia.saveSettings({ ...rest, metier });
      applyAutoModel();
      applyMetier();
    }, metierBefore);
    await page.waitForFunction((name) => document.querySelector('#model').value === name, advised);
    await page.evaluate(() => view('chat'));
    await page.evaluate(() => setChatPanel(true));
    const other =
      advised === 'integre/mon-modele-q4' ? 'integre/qwen3-4b' : 'integre/mon-modele-q4';
    await page.locator('#model').selectOption(other);
    await page.evaluate(() => setChatPanel(false));
    await page.waitForFunction(() =>
      document.querySelector('#composer-advice-text').textContent.includes('Revenir au modèle'),
    );
    assert.equal((await readJson(profile, 'settings.json')).modelChoice, 'manuel');
    // Choix manuel : un nouveau rafraîchissement ne change plus le modèle.
    await page.evaluate(() => refresh());
    assert.equal(await page.locator('#model').inputValue(), other);
    await page.locator('#composer-advice-text button', { hasText: 'Changer de modèle' }).click();
    assert.ok(
      await page.evaluate(() =>
        document.querySelector('#chat-view').classList.contains('panel-open'),
      ),
    );
    await page.locator('#composer-advice-text button', { hasText: 'Revenir au modèle' }).click();
    await page.waitForFunction((name) => document.querySelector('#model').value === name, advised);
    assert.equal((await readJson(profile, 'settings.json')).modelChoice, undefined);
    await page.evaluate(async () => {
      settings = await window.localia.saveSettings({ ...settings, mode: 'avance' });
      applyMode();
    });

    // Accès depuis un autre appareil : serveur activé, clé exigée, question posée « depuis le
    // téléphone », réponse reçue au fil de l'écriture, conversation visible sur le Mac.
    const base = 'http://127.0.0.1:47899';
    await page.locator('#security-tab').click();
    await page.locator('#remote-enabled').check();
    await page.waitForFunction(() =>
      document.querySelector('#remote-status').textContent.includes('47899'),
    );
    assert.equal((await readJson(profile, 'settings.json')).remote.enabled, true);
    const remoteKey = (await readJson(profile, 'distance.json')).token;
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal((await fetch(base + '/api/etat')).status, 401, 'sans clé');
    const auth = { Authorization: `Bearer ${remoteKey}` };
    const etat = await (await fetch(base + '/api/etat', { headers: auth })).json();
    assert.deepEqual(etat.models, ['petit:1b', 'grand:8b']);
    const http = require('node:http');
    const rebinding = await new Promise((resolve) =>
      http.get(
        `${base}/api/etat`,
        { headers: { ...auth, Host: 'site-malveillant.com:47899' } },
        (res) => resolve(res.statusCode),
      ),
    );
    assert.equal(rebinding, 421, 'en-tête Host étranger refusé');
    const asked = await fetch(base + '/api/question', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Bonjour depuis le téléphone', model: 'petit:1b' }),
    });
    const streamText = await asked.text();
    assert.match(streamText, /event: debut/);
    assert.match(streamText, /event: texte\ndata: \{"delta":"Réponse de \*\*petit:1b\*\*"\}/);
    const end = JSON.parse(/event: fin\ndata: (.+)/.exec(streamText)[1]);
    assert.equal(end.ok, true);
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.skill-tag')].some(
        (t) => t.textContent === 'depuis un autre appareil',
      ),
    );
    const remoteConv = await (
      await fetch(`${base}/api/conversations/${end.conversationId}`, { headers: auth })
    ).json();
    assert.deepEqual(
      remoteConv.messages.map((m) => m.role),
      ['user', 'assistant'],
    );
    for (let i = 0; i < 10; i++)
      await fetch(base + '/api/etat', { headers: { Authorization: 'Bearer faux' } });
    assert.equal((await fetch(base + '/api/etat', { headers: auth })).status, 429, 'trop d’essais');
    await page.locator('#security-tab').click();
    await page.locator('#remote-enabled').uncheck();
    await page.waitForFunction(() =>
      document.querySelector('#remote-status').textContent.includes('Désactivé'),
    );
    await assert.rejects(fetch(base + '/'), 'serveur arrêté');

    assert.deepEqual(errors, []);
    console.log(
      'PASS fonctions: modèle mémorisé, contexte du Modelfile, renommage, réglages appliqués, comparaison avec mesures et notes, série de questions, vue d’ensemble, export CSV, ancien format, suppression, benchmark (notation à l’aveugle, import de notes, accord, export SVG, répétitions, conditions), pause et reprise, tâches, mémoire par projet, départ programmé (Mac éveillé, annulation), compétences (menu, appel /nom, suggestions, nouvelle compétence), fichiers joints (consignes, portrait des données, glisser-déposer, effacement), photos (refus sans vision, envoi, effacement), métier Santé (anonymisation, réponse en clair), actions sur fichiers (dossier autorisé, plan vérifié, application, journal, annulation), aucune erreur JS.',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
