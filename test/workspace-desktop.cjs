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
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, LOCALIA_TEST_DATA: profile, LOCALIA_FAKE_LLAMA: '1' },
    });
    const page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForFunction(() => typeof openSearch === 'function' && projectsLoaded);

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

    assert.deepEqual(errors, []);
    console.log(
      'PASS espace de travail : projets récents, recherche commune (conversations, notes, documents, filtres, ouverture dans le contexte).',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
