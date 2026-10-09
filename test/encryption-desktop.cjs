// Chiffrement des données, de bout en bout, avec un trousseau simulé (le vrai trousseau de
// macOS n'est jamais utilisé par les tests).
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const MAGIC = 'LOCALIA-CHIFFRE-1\n';
const documentId = '11111111-2222-3333-4444-555555555555';
const conversation = {
  id: 'c1',
  document: { id: documentId, name: 'a.pdf' },
  title: 'Mildiou à Dalaba',
  messages: [{ role: 'user', content: 'Quel est le seuil d’humidité ?' }],
};

async function launch(profile, keychain) {
  const app = await electron.launch({
    args: [path.resolve('.')],
    env: { ...process.env, LOCALIA_TEST_DATA: profile, LOCALIA_TEST_KEYCHAIN: keychain },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { app, page, errors };
}
const head = async (file) => (await fs.readFile(file)).subarray(0, MAGIC.length).toString();

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-chiffrement-'));
  const recovery = path.join(profile, '..', path.basename(profile) + '-cle.txt');
  let session;
  try {
    await fs.writeFile(path.join(profile, 'conversations.json'), JSON.stringify([conversation]));
    // Mode avancé : le test ouvre « Confidentialité et sécurité » depuis la colonne de gauche.
    await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ mode: 'avance' }));
    await fs.mkdir(path.join(profile, 'documents'));
    await fs.writeFile(
      path.join(profile, 'documents', documentId + '.json'),
      JSON.stringify({ id: documentId, name: 'a.pdf', pages: [{ number: 1, text: 'Secret' }] }),
    );

    // 1. Données en clair, puis chiffrées.
    session = await launch(profile, 'simule');
    let { app, page } = session;
    await page.waitForFunction(() =>
      document.querySelector('#history').textContent.includes('Mildiou à Dalaba'),
    );
    // Premier lancement : question directe, sans choisir de métier (écran le plus simple).
    await page.waitForFunction(() => !document.querySelector('#metier-view').hidden);
    await page.locator('#quick-prompt').fill('');
    await page.locator('#quick-send').click();
    await page.waitForFunction(() => document.body.dataset.metier === 'general');
    assert.equal(await page.locator('.pick[for=task]').isHidden(), true);
    // Sans modèle installé (machine de test sans Ollama) : le guide s'ouvre au premier lancement.
    await page.waitForFunction(() =>
      /Ollama|Aucun modèle|Moteur/.test(document.querySelector('#status').textContent),
    );
    if (!(await page.evaluate(() => models.length))) {
      await page.waitForFunction(() => !document.querySelector('#guide-view').hidden);
      // Conseil écrit une fois la mémoire mesurée : attendu, pas lu tout de suite (machine lente).
      await page.waitForFunction(() =>
        /Go de mémoire : nous conseillons/.test(
          document.querySelector('#guide-model .guide-state')?.textContent || '',
        ),
      );
    }
    await page.locator('#security-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#privacy-status').textContent.includes('Chiffrement désactivé'),
    );
    await page.locator('#encryption-toggle').click();
    await page.waitForFunction(() =>
      document.querySelector('#privacy-status').textContent.includes('Chiffrement actif'),
    );
    const status = await page.locator('#privacy-status').textContent();
    const [, done, total] = status.match(/(\d+) fichier\(s\) sur (\d+)/);
    assert.equal(done, total);
    for (const file of ['conversations.json', path.join('documents', documentId + '.json')]) {
      assert.equal(await head(path.join(profile, file)), MAGIC, file);
      assert.ok(!(await fs.readFile(path.join(profile, file), 'utf8')).includes('Dalaba'));
    }
    assert.ok(await fs.stat(path.join(profile, 'cle.bin')));

    // Clé de secours exportée ; un nouvel enregistrement reste chiffré.
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, recovery);
    await page.locator('#encryption-export').click();
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Clé de secours enregistrée'),
    );
    assert.match(await fs.readFile(recovery, 'utf8'), /LOCALIA-CLE-1:/);
    await page.locator('#projects-tab').click();
    await page.locator('#project-name').fill('Thèse confidentielle');
    await page.locator('#project-form button[type=submit]').click();
    await page.waitForFunction(() =>
      document.querySelector('#projects-list').textContent.includes('Thèse confidentielle'),
    );
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(await head(path.join(profile, 'projects.json')), MAGIC);
    assert.deepEqual(session.errors, []);
    await app.close();

    // 2. Relance : données déchiffrées avec la clé du trousseau.
    session = await launch(profile, 'simule');
    ({ app, page } = session);
    await page.waitForFunction(() =>
      document.querySelector('#history').textContent.includes('Mildiou à Dalaba'),
    );
    await app.close();

    // 3. Trousseau qui refuse : rien n'est chargé, rien n'est écrasé ; clé de secours importée.
    const before = await fs.readFile(path.join(profile, 'conversations.json'));
    session = await launch(profile, 'refuse');
    ({ app, page } = session);
    await page.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('n’a pas rendu la clé'),
    );
    assert.equal(await page.locator('#security-view').isVisible(), true);
    assert.ok(!(await page.locator('#history').textContent()).includes('Mildiou'));
    assert.deepEqual(await fs.readFile(path.join(profile, 'conversations.json')), before);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, recovery);
    await page.locator('#encryption-import').click();
    await page.waitForFunction(() =>
      document.querySelector('#history').textContent.includes('Mildiou à Dalaba'),
    );

    // 4. Déchiffrement : fichiers de nouveau en clair, clé retirée.
    await page.locator('#security-tab').click();
    await page.waitForFunction(() =>
      document.querySelector('#encryption-toggle').textContent.includes('Désactiver'),
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#encryption-toggle').click();
    await page.waitForFunction(() =>
      document.querySelector('#privacy-status').textContent.includes('Chiffrement désactivé'),
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8'))[0].title,
      'Mildiou à Dalaba',
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(profile, 'projects.json'), 'utf8'))[0].name,
      'Thèse confidentielle',
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(profile, 'documents', documentId + '.json'), 'utf8'))
        .pages[0].text,
      'Secret',
    );
    await assert.rejects(fs.stat(path.join(profile, 'cle.bin')));
    assert.deepEqual(session.errors, []);
    console.log(
      'PASS chiffrement: activation (conversations, documents), nouvel enregistrement chiffré, clé de secours, relance, trousseau refusé sans perte, import de la clé, désactivation, aucune erreur JS.',
    );
  } finally {
    await session?.app.close().catch(() => {});
    await fs.rm(profile, { recursive: true, force: true });
    await fs.rm(recovery, { force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
