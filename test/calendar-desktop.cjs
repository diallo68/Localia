// Calendrier dans l'application : échéance créée, vue du mois et liste, dates d'un document de
// projet proposées par le modèle (Ollama simulé) et vérifiées, export puis import .ics.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function waitFor(condition, timeout = 5000) {
  const end = Date.now() + timeout;
  while (!(await condition().catch(() => false))) {
    if (Date.now() > end) throw new Error('Condition non atteinte à temps.');
    await new Promise((r) => setTimeout(r, 100));
  }
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-calendrier-'));
  let app;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, mode: 'avance' }),
    );
    const cfp = path.join(profile, 'appel.txt');
    await fs.writeFile(
      cfp,
      'Appel à communications du colloque Agro 2027.\n\n' +
        'Date limite de soumission des résumés : 15 janvier 2027.\n\n' +
        'Notification aux auteurs : March 1st, 2027.\n',
    );
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, LOCALIA_TEST_DATA: profile },
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.setDefaultTimeout(15000);
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      global.fetch = async (url, options) => {
        if (String(url).endsWith('/api/tags'))
          return Response.json({ models: [{ name: 'test:local', size: 100 }] });
        if (String(url).endsWith('/api/show')) return Response.json({});
        if (String(url).endsWith('/api/chat')) {
          global.datesChat = JSON.parse(options.body);
          // Une date juste, une date à la page fausse, une date inventée.
          return new Response(
            JSON.stringify({
              message: {
                content:
                  '2027-01-15 | Soumission des résumés | p. 1\n' +
                  '2027-03-01 | Notification aux auteurs | p. 9\n' +
                  '2027-06-30 | Version finale | p. 1',
              },
            }) + '\n{"done":true}\n',
          );
        }
        return new Response('', { status: 404 });
      };
    }, cfp);
    await page.waitForFunction(() => typeof calendarLoaded !== 'undefined' && calendarLoaded);

    // 1. Échéance créée à la main : visible dans le mois, puis dans la liste.
    await page.locator('#calendar-tab').click();
    await page.waitForFunction(() => !document.querySelector('#calendar-view').hidden);
    assert.equal(await page.locator('.calendar-cell.today').count(), 1);
    await page.locator('#calendar-add').click();
    await page.locator('#event-title').fill('Rendre le rapport');
    await page.locator('#event-time').fill('14:30');
    await page.locator('#event-form button[value=save]').click();
    await page.waitForSelector('.calendar-chip');
    assert.match(
      await page.locator('.calendar-cell.today').textContent(),
      /14:30 Rendre le rapport/,
    );
    await page.locator('#calendar-mode-list').click();
    assert.match(await page.locator('#calendar-list').textContent(), /Cette semaine \(1\)/);
    await page.locator('#calendar-list .event-row input[type=checkbox]').check();
    await page.waitForFunction(() =>
      /Faites \(1\)/.test(document.querySelector('#calendar-list').textContent),
    );

    // 2. Projet et document, puis dates cherchées par le modèle et vérifiées par Localia.
    await page.locator('#projects-tab').click();
    await page.locator('#project-name').fill('Colloque');
    await page.locator('#project-form button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('#project-detail').hidden);
    await page.locator('#project-add-docs').click();
    await page.waitForFunction(() => document.querySelectorAll('.project-doc').length === 1);
    assert.match(await page.locator('#project-events').textContent(), /Aucune échéance/);
    await page.locator('#project-event-dates').click();
    await page.waitForFunction(() => !document.querySelector('#calendar-dates-form').hidden);
    await page.locator('#calendar-dates-form button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#dates-dialog').open);
    const prompt = await app.evaluate(() => global.datesChat.messages[0].content);
    assert.match(prompt, /AAAA-MM-JJ \| intitulé court \| p\. N/);
    assert.match(prompt, /15 janvier 2027/);
    const rows = page.locator('#dates-list .dates-row');
    assert.equal(await rows.count(), 3);
    assert.match(await rows.nth(0).textContent(), /vérifiée/);
    assert.match(await rows.nth(1).textContent(), /le modèle citait la p\. 9/);
    assert.match(await rows.nth(2).textContent(), /à vérifier/);
    assert.equal(await rows.nth(2).locator('input[type=checkbox]').isChecked(), false);
    await rows.nth(0).locator('.dates-title').fill('Soumission du résumé');
    await page.locator('#dates-add').click();
    await page.waitForFunction(() => calendarData.events.length === 3);
    const added = await page.evaluate(() => calendarData.events.filter((e) => e.source));
    assert.deepEqual(
      added.map((e) => [e.title, e.date, e.source.page, e.source.verified]),
      [
        ['Soumission du résumé', '2027-01-15', 1, true],
        ['Notification aux auteurs', '2027-03-01', 1, true],
      ],
    );
    // Le projet montre ses échéances, avec la source cliquable.
    await page.locator('#projects-tab').click();
    await page.waitForFunction(() =>
      /Soumission du résumé/.test(document.querySelector('#project-events').textContent),
    );
    await page.locator('#project-events .event-source').first().click();
    await page.waitForFunction(() => document.querySelector('#page-dialog').open);
    assert.match(await page.locator('#page-dialog-text').textContent(), /15 janvier 2027/);
    await page.keyboard.press('Escape');

    // 3. Export .ics (fichier réel), puis import du même fichier : rien en double.
    const ics = path.join(profile, 'export.ics');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, ics);
    await page.locator('#calendar-tab').click();
    await page.locator('#calendar-export').click();
    await waitFor(async () => (await fs.readFile(ics, 'utf8')).includes('END:VCALENDAR'));
    const text = await fs.readFile(ics, 'utf8');
    assert.match(text, /SUMMARY:Soumission du résumé/);
    assert.match(text, /DTSTART;VALUE=DATE:20270115/);
    assert.match(text, /CATEGORIES:Colloque/);
    await page.locator('#calendar-import').click();
    await page.waitForFunction(() =>
      /déjà présente/.test(document.querySelector('#notice').textContent),
    );
    assert.equal(await page.evaluate(() => calendarData.events.length), 3);

    // 4. Mode simple : entrée « Calendrier » de la colonne, prochaines échéances sur l'accueil.
    await page.locator('#mode-switch').click();
    await page.waitForFunction(() => !isAdvanced());
    await page.locator('#simple-calendar').click();
    await page.waitForFunction(() => !document.querySelector('#calendar-view').hidden);
    await page.locator('#simple-home').click();
    await page.waitForFunction(() => !document.querySelector('#accueil-events-section').hidden);
    assert.match(await page.locator('#accueil-events').textContent(), /Soumission du résumé/);

    // Interface en anglais : textes du calendrier traduits, puis retour au français.
    await page.evaluate(() => document.querySelector('#lang-en').click());
    await page.locator('#simple-calendar').click();
    await page.waitForFunction(() =>
      /Calendar\./.test(document.querySelector('#calendar-view h2').textContent),
    );
    assert.match(await page.locator('#calendar-export').textContent(), /Export \(\.ics\)/);
    await page.evaluate(() => document.querySelector('#lang-fr').click());

    // 5. Données enregistrées sur le disque, et relues après redémarrage de l'interface.
    await page.reload();
    await page.waitForFunction(() => typeof calendarLoaded !== 'undefined' && calendarLoaded);
    assert.equal(await page.evaluate(() => calendarData.events.length), 3);
    assert.deepEqual(errors, []);
    console.log('Calendrier : parcours complet réussi.');
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
