// Espace de travail : recherche commune, page d'un projet, routines, sauvegarde, accueil.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60000).toISOString();

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-workspace-'));
  let app;
  let page;
  const errors = [];
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, mode: 'avance' }),
    );
    await fs.writeFile(
      path.join(profile, 'projects.json'),
      JSON.stringify([
        {
          id: 'p-these',
          name: 'Thèse',
          description: 'Mildiou à Dalaba',
          createdAt: iso(60 * 24 * 30),
          notes: [
            {
              id: 'n-site',
              title: 'Site d’étude',
              text: 'Dalaba, Fouta Djalon, 1 200 m.',
              createdAt: iso(60 * 24 * 20),
            },
          ],
          documents: [],
        },
        {
          id: 'p-bilan',
          name: 'Bilan boulangerie',
          createdAt: iso(60 * 24 * 2),
          notes: [],
          documents: [],
        },
      ]),
    );
    await fs.writeFile(
      path.join(profile, 'conversations.json'),
      JSON.stringify([
        {
          id: 'c-pluie',
          title: 'Pluies de juillet',
          projectId: 'p-these',
          updatedAt: iso(5),
          messages: [
            { role: 'user', content: 'Quelle pluie en juillet à Dalaba ?' },
            { role: 'assistant', content: 'En juillet, 481 mm de pluie sont relevés à Dalaba.' },
          ],
        },
        {
          id: 'c-pain',
          title: 'Prix du pain',
          updatedAt: iso(60),
          messages: [{ role: 'user', content: 'Combien coûte la baguette ?' }],
        },
      ]),
    );
    // Lancement de Localia sur le profil de test, avec Ollama simulé.
    const start = async () => {
      app = await electron.launch({
        args: [path.resolve('.')],
        env: {
          ...process.env,
          LOCALIA_TEST_DATA: profile,
          LOCALIA_FAKE_LLAMA: '1',
          LOCALIA_TEST_KEYCHAIN: 'ok',
          LOCALIA_TEST_BACKUP: path.join(profile, 'test.localia'),
        },
      });
      page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.waitForFunction(() => typeof openSearch === 'function' && projectsLoaded);
      // Ollama simulé : un modèle ; réponse fixée par global.chatReply, requêtes capturées.
      await app.evaluate(() => {
        global.requests = [];
        global.fetch = async (url, options) => {
          const endpoint = new URL(String(url)).pathname;
          const body = options?.body ? JSON.parse(options.body) : null;
          if (endpoint === '/api/version') return Response.json({ version: '0.35.0' });
          if (endpoint === '/api/tags')
            return Response.json({ models: [{ name: 'petit:1b', size: 1e9 }] });
          if (endpoint === '/api/show')
            return Response.json({
              capabilities: ['completion'],
              parameters: 'num_ctx 8192',
              model_info: { 'test.context_length': 32768 },
              details: { family: 'test', parameter_size: '1B', quantization_level: 'Q4_K_M' },
            });
          if (endpoint === '/api/ps') return Response.json({ models: [] });
          if (endpoint === '/api/chat') {
            // Réponse lente facultative, interrompue si la requête est annulée.
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
              { message: { content: global.chatReply ?? 'Réponse simulée.' } },
              { done: true, done_reason: 'stop', eval_count: 10, eval_duration: 1e9 },
            ];
            return new Response(lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
          }
          throw new Error('unexpected endpoint ' + endpoint);
        };
      });
      await page.locator('#refresh').dispatchEvent('click');
      await page.waitForFunction(() => document.querySelector('#model').options.length === 1);
    };
    await start();
    const settle = () => page.evaluate(() => window.localia.loadProjects());

    // Projets récents : la conversation d'il y a 5 minutes place « Thèse » avant « Bilan ».
    await page.locator('#home-tab').click();
    await page.waitForSelector('#home-projects .home-row');
    assert.deepEqual(
      (await page.locator('#home-projects .home-row strong').allTextContents()).slice(0, 2),
      ['Thèse', 'Bilan boulangerie'],
    );

    // Document ajouté au projet « Thèse » (texte simple), puis recherche commune.
    await page.locator('#projects-tab').click();
    await page.locator('.project-row', { hasText: 'Thèse' }).click();
    await page.evaluate(() =>
      addProjectDocuments(() =>
        window.localia.projectDocumentsDrop([
          {
            name: 'releves.txt',
            bytes: new TextEncoder().encode(
              'Relevés pluviométriques de la station.\n\nJuillet : 481 mm à Dalaba, mildiou observé sur 12 parcelles.',
            ),
          },
        ]),
      ),
    );
    await page.waitForSelector('.project-doc');

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await page.waitForFunction(() => !document.querySelector('#search-view').hidden);
    await page.locator('#search-input').fill('dalaba');
    await page.waitForFunction(() =>
      /résultat/.test(document.querySelector('#search-status').textContent),
    );
    const groups = await page.locator('.search-group h3').allTextContents();
    assert.deepEqual(groups, [
      'Conversations (2)',
      'Notes des projets (1)',
      'Documents des projets (1)',
    ]);
    // Filtre par type, puis par projet.
    await page.locator('#search-kinds button[data-kind="document"]').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.search-group').length === 1 &&
        document.querySelector('.search-group h3').textContent.startsWith('Documents'),
    );
    assert.match(await page.locator('.search-result').first().textContent(), /releves\.txt/);
    await page.locator('#search-kinds button[data-kind=""]').click();
    await page.locator('#search-project').selectOption('none');
    await page.waitForFunction(() => document.querySelectorAll('.search-result').length === 0);
    await page.locator('#search-project').selectOption('p-these');
    await page.waitForFunction(() => document.querySelectorAll('.search-result').length === 4);

    // Document ouvert à sa page, mot surligné.
    await page.locator('.search-result', { hasText: 'releves.txt' }).click();
    await page.waitForFunction(() => !document.querySelector('#project-reader').hidden);
    assert.match(await page.locator('#reader-text').textContent(), /481 mm/);
    assert.equal(await page.locator('#reader-text mark').first().textContent(), 'Dalaba');

    // Message ouvert dans sa conversation et mis en évidence.
    await page.locator('#search-tab').click();
    await page.locator('#search-input').fill('481 juillet');
    await page.waitForSelector('.search-result');
    await page.locator('.search-result', { hasText: 'Pluies de juillet' }).first().click();
    await page.waitForFunction(() => !document.querySelector('#chat-view').hidden);
    await page.waitForSelector('.message.search-hit');

    // Note ouverte dans son projet.
    await page.locator('#search-tab').click();
    await page.locator('#search-input').fill('fouta');
    await page.locator('.search-result', { hasText: 'Site d’étude' }).click();
    await page.waitForSelector('.note-card.search-hit');

    // Page du projet : vue de synthèse, prochaine étape, suppression dans le menu « Actions ».
    assert.equal(await page.locator('#project-heading').textContent(), 'Thèse');
    assert.match(await page.locator('#project-conversations').textContent(), /Pluies de juillet/);
    assert.match(await page.locator('#project-recent-docs').textContent(), /releves\.txt/);
    assert.equal(await page.locator('#project-delete').isVisible(), false);
    await page.locator('#project-next-edit').click();
    await page.locator('#project-next-input').fill('Vérifier les relevés d’août');
    await page.locator('#project-next-form button[type=submit]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('#project-next-text').textContent === 'Vérifier les relevés d’août',
    );
    assert.equal(
      (await settle()).find((p) => p.id === 'p-these').nextStep,
      'Vérifier les relevés d’août',
    );

    // Proposition de note : décision écrite par l'utilisateur dans une conversation du projet.
    await page.locator('#project-conversations .overview-row').first().click();
    await page.locator('#prompt').fill('On retient la station de Dalaba pour toute l’étude.');
    await page.locator('#send').click();
    await page.waitForSelector('.memory-proposal');
    assert.match(
      await page.locator('.memory-proposal').textContent(),
      /On retient la station de Dalaba/,
    );
    await page.locator('.memory-proposal button', { hasText: 'Corriger' }).click();
    await page.waitForFunction(() => document.querySelector('#memory-dialog').open);
    assert.match(await page.locator('#memory-provenance').textContent(), /Proposée par Localia/);
    await page.locator('#memory-note-text').fill('Station retenue : Dalaba (toute l’étude).');
    await page.locator('#memory-save').click();
    await page.waitForFunction(() => !document.querySelector('.memory-proposal'));
    const saved = (await settle()).find((p) => p.id === 'p-these').notes.at(-1);
    assert.equal(saved.text, 'Station retenue : Dalaba (toute l’étude).');
    assert.equal(saved.source.kind, 'proposition');
    assert.equal(saved.source.conversationId, 'c-pluie');
    // Résultat conservé visible dans la vue de synthèse, provenance sur la note.
    await page.locator('#projects-tab').click();
    assert.match(await page.locator('#project-kept').textContent(), /On retient la station/);
    assert.match(
      await page.locator('.note-card', { hasText: 'Station retenue' }).textContent(),
      /Proposée par Localia · conversation « Pluies de juillet »/,
    );

    // Routine : document ajouté → synthèse sourcée → vérification → résultat à relire.
    await page.locator('#routines-tab').click();
    await page.locator('#routine-project').selectOption('p-these');
    await page.locator('#routine-form button[type=submit]').click();
    await page.waitForSelector('.routine-row');
    await app.evaluate(() => {
      global.chatReply = '- Août : 455 mm à Dalaba [aout.txt — section 1].';
    });
    await page.evaluate(() => {
      openProjectId = 'p-these';
      return addProjectDocuments(() =>
        window.localia.projectDocumentsDrop([
          { name: 'aout.txt', bytes: new TextEncoder().encode('Août : 455 mm à Dalaba.') },
        ]),
      );
    });
    await page.locator('#routines-tab').click();
    await page.waitForSelector('.run-row.state-a-relire');
    let request = await app.evaluate(() => global.requests.at(-1));
    assert.match(request.messages.at(-1).content, /synthèse sourcée du document « aout\.txt »/);
    assert.match(request.messages.at(-1).content, /Août : 455 mm à Dalaba/);
    await page.locator('.run-row.state-a-relire').click();
    assert.match(await page.locator('#run-text').textContent(), /455 mm/);
    assert.deepEqual(await page.locator('#run-checks .source-state').allTextContents(), [
      'Chiffres retrouvés',
    ]);
    // À traiter sur l'accueil, puis relu.
    await page.locator('#home-tab').click();
    assert.match(await page.locator('#home-todo').textContent(), /Synthèse de aout\.txt/);
    await page.locator('#home-todo button', { hasText: 'aout.txt' }).click();
    await page.locator('#run-reviewed').click();
    await page.waitForSelector('.run-row.state-relu');

    // Une conversation passe avant une routine en cours ; la routine reprend ensuite.
    await app.evaluate(() => {
      global.chatDelay = 1500;
      global.chatReply = '- Septembre : 302 mm [sept.txt — section 1].';
    });
    await page.evaluate(() =>
      addProjectDocuments(() =>
        window.localia.projectDocumentsDrop([
          { name: 'sept.txt', bytes: new TextEncoder().encode('Septembre : 302 mm.') },
        ]),
      ),
    );
    await page.waitForSelector('.run-row.state-en-cours');
    await page.evaluate(() => openConversation(conversations.find((c) => c.id === 'c-pain')));
    await page.locator('#prompt').fill('Et le croissant ?');
    await page.locator('#send').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.message.assistant').length === 1 &&
        document.querySelector('#stop').hidden,
    );
    await page.locator('#routines-tab').click();
    await page.waitForSelector('.run-row.state-a-relire', { timeout: 20000 });
    assert.match(
      await page.locator('.run-row.state-a-relire').textContent(),
      /reprise après interruption/,
    );
    await app.evaluate(() => {
      delete global.chatDelay;
      delete global.chatReply;
    });
    const savedRoutines = JSON.parse(
      await fs.readFile(path.join(profile, 'routines.json'), 'utf8'),
    );
    assert.equal(savedRoutines.routines.length, 1);
    assert.deepEqual(
      savedRoutines.runs.map((r) => [r.docName, r.state]),
      [
        ['aout.txt', 'relu'],
        ['sept.txt', 'a-relire'],
      ],
    );

    // Redémarrage : exécution restée en cours reprise, départ programmé passé signalé comme manqué.
    await app.close();
    const stored = JSON.parse(await fs.readFile(path.join(profile, 'routines.json'), 'utf8'));
    stored.paused = true;
    stored.runs.push({
      ...stored.runs[0],
      id: 'interrompue',
      state: 'en-cours',
      step: 'generation',
      text: undefined,
      checks: undefined,
    });
    stored.scheduled = {
      at: iso(30),
      template: { questions: [{ label: 'Q1', text: 'Question' }], models: ['petit:1b'] },
    };
    await fs.writeFile(path.join(profile, 'routines.json'), JSON.stringify(stored));
    await start();
    await page.locator('#home-tab').click();
    assert.match(await page.locator('#home-todo').textContent(), /Départ programmé manqué/);
    await page.locator('#routines-tab').click();
    assert.match(
      await page.locator('.run-row.state-en-attente').textContent(),
      /reprise après interruption/,
    );
    await page.locator('#routines-pause').click();
    await page.waitForFunction(() => !document.querySelector('.run-row.state-en-attente'));
    await page.waitForFunction(
      () => document.querySelectorAll('.run-row.state-a-relire').length === 2,
    );

    // Sauvegarde chiffrée par phrase de passe, puis restauration (chiffrement actif).
    await page.evaluate(() => window.localia.encryptionEnable());
    await page.locator('#security-tab').click();
    await page.locator('#backup-passphrase').fill('phrase de passe de test');
    await page.locator('#backup-confirm').fill('autre phrase de passe');
    await page.locator('#backup-create').click();
    await page.waitForFunction(() =>
      /confirmation ne correspond pas/.test(document.querySelector('#backup-status').textContent),
    );
    await page.locator('#backup-confirm').fill('phrase de passe de test');
    await page.locator('#backup-create').click();
    await page.waitForFunction(() =>
      /Sauvegarde enregistrée et relue/.test(document.querySelector('#backup-status').textContent),
    );
    const packed = await fs.readFile(path.join(profile, 'test.localia'));
    assert.ok(packed.subarray(0, 20).toString().startsWith('LOCALIA-SAUVEGARDE-1'));
    assert.ok(!packed.includes(Buffer.from('Bilan boulangerie')), 'sauvegarde chiffrée');
    await page.locator('#backup-passphrase').fill('mauvaise phrase de passe');
    await page.locator('#backup-verify').click();
    await page.waitForFunction(() =>
      /Phrase de passe incorrecte/.test(document.querySelector('#backup-status').textContent),
    );
    await page.locator('#backup-passphrase').fill('phrase de passe de test');
    await page.locator('#backup-verify').click();
    await page.waitForFunction(() =>
      /Sauvegarde intacte/.test(document.querySelector('#backup-status').textContent),
    );
    // Projet supprimé après la sauvegarde, puis restauré.
    await page.evaluate(async () => {
      projects = projects.filter((p) => p.id !== 'p-bilan');
      await persistProjects();
    });
    assert.equal((await settle()).length, 1);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#backup-restore').click();
    await page.waitForEvent('load');
    await page.waitForFunction(() => typeof projectsLoaded !== 'undefined' && projectsLoaded);
    assert.deepEqual(
      (await settle()).map((p) => p.id),
      ['p-these', 'p-bilan'],
    );
    const profileFiles = await fs.readdir(profile);
    const kept = profileFiles.find((f) => f.startsWith('avant-restauration-'));
    assert.ok(kept, 'données précédentes copiées');
    assert.ok((await fs.readdir(path.join(profile, kept, 'documents'))).length >= 3);
    const restored = await fs.readFile(path.join(profile, 'projects.json'));
    assert.ok(restored.subarray(0, 17).toString() === 'LOCALIA-CHIFFRE-1', 'rechiffré avec la clé');

    assert.deepEqual(errors, []);
    console.log(
      'PASS espace de travail : projets récents, recherche commune (conversations, notes, documents, filtres, ouverture dans le contexte), page du projet (synthèse, prochaine étape, menu), propositions de notes avec provenance, routines (déclencheur, synthèse vérifiée, à relire, priorité aux conversations, reprise après redémarrage), départ programmé manqué, sauvegarde chiffrée et restauration.',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
