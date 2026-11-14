// Schémas Mermaid dans l'application : réponse simulée avec trois blocs (juste, à réparer, faux),
// dessin en image, code sous l'image, version texte pour la copie, consigne envoyée au modèle.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Codes réels du 14 nov. 2026 : Dial-bowe (procédure de passeport), qwen3-4b (parenthèses), faux.
const REPONSE = [
  'Voici le schéma demandé.',
  '```mermaid\nflowchart TD\n    A[Demandeur] --> B[Dépôt du dossier]\n    B --> C[Vérification]\n    C --> D{Dossier complet ?}\n    D -- Non --> B\n    D -- Oui --> E[Prise d’empreintes]\n    E --> F[Fabrication]\n    F --> G[Remise]\n```',
  'Et le cycle :',
  '```mermaid\ngraph TD\n    A[Spores] --> B[Infection de la feuille]\n    B --> C[Infection de la tuber (pomme de terre)]\n    C -->|Pluie (gouttes)| A\n```',
  'Un code faux :',
  '```mermaid\ngantt\n    etat_de_l_art :blue, 6 mois\n    etat_de_l_art ~> redaction\n```',
].join('\n\n');

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-schemas-'));
  let app;
  try {
    await fs.writeFile(
      path.join(profile, 'settings.json'),
      JSON.stringify({ guideDone: true, mode: 'avance' }),
    );
    app = await electron.launch({
      args: [path.resolve('.')],
      env: { ...process.env, LOCALIA_TEST_DATA: profile },
    });
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    await app.evaluate((_, reponse) => {
      global.fetch = async (url, options) => {
        if (String(url).endsWith('/api/tags'))
          return Response.json({ models: [{ name: 'test:local', size: 100 }] });
        if (String(url).endsWith('/api/show')) return Response.json({});
        if (String(url).endsWith('/api/chat')) {
          global.schemaChat = JSON.parse(options.body);
          return new Response(
            JSON.stringify({ message: { content: reponse } }) + '\n{"done":true}\n',
          );
        }
        return new Response('', { status: 404 });
      };
    }, REPONSE);
    await page.waitForFunction(() => typeof drawDiagrams === 'function');
    await page.locator('#prompt').fill('Fais-moi les schémas');
    await page.locator('#prompt').press('Enter');
    await page.waitForFunction(
      () => document.querySelectorAll('.message.assistant figure.diagram img').length === 2,
    );
    // Consigne Mermaid envoyée au modèle.
    const system = await app.evaluate(
      () => global.schemaChat.messages.find((m) => m.role === 'system')?.content,
    );
    assert.match(system, /écris-le en Mermaid dans un bloc ```mermaid```/);
    // Deux schémas dessinés (dont un réparé), un code faux laissé en code avec un avis.
    const srcs = await page.$$eval('.message.assistant figure.diagram img', (imgs) =>
      imgs.map((i) => i.src.slice(0, 26)),
    );
    assert.deepEqual(srcs, ['data:image/svg+xml;charset', 'data:image/svg+xml;charset']);
    await page.waitForSelector('.message.assistant .diagram-error');
    assert.equal(await page.locator('.message.assistant pre code.language-mermaid').count(), 3);
    const sizes = await page.$$eval('.message.assistant figure.diagram img', (imgs) =>
      imgs.map((i) => [i.naturalWidth, i.naturalHeight]),
    );
    for (const [w, h] of sizes) assert.ok(w > 100 && h > 100, `image trop petite : ${w}×${h}`);
    // Version texte (copie) : le code Mermaid revient à la place de l'image, puis l'image revient.
    const text = await page.evaluate(() => {
      const content = document.querySelector('.message.assistant .markdown');
      return withTextFormulas(content, () => content.innerText);
    });
    assert.match(text, /flowchart TD/);
    assert.match(text, /Infection de la tuber \(pomme de terre\)/);
    assert.equal(await page.locator('.message.assistant figure.diagram').count(), 2);
    assert.equal(
      await page.locator('.message.assistant figure.diagram details pre').count(),
      2,
      'le code reste sous l’image après la copie',
    );
    // Export PDF : l'image du schéma est gardée (sans le bouton « Voir le code »).
    const html = await page.evaluate(() => {
      const content = document.querySelector('.message.assistant .markdown');
      return withTextFormulas(content, () => content.innerHTML, { diagrams: 'image' });
    });
    assert.equal((html.match(/<img src="data:image\/svg\+xml/g) || []).length, 2);
    assert.doesNotMatch(html, /Voir le code/);
    const pdf = path.join(profile, 'reponse.pdf');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, pdf);
    await page.locator('.message.assistant button', { hasText: 'Exporter en PDF' }).click();
    for (let i = 0; i < 100 && !(await fs.stat(pdf).catch(() => null)); i++)
      await new Promise((r) => setTimeout(r, 100));
    assert.ok((await fs.stat(pdf)).size > 20000, 'PDF avec les schémas');
    await page
      .locator('.message.assistant figure.diagram')
      .first()
      .screenshot({ path: path.join(os.tmpdir(), 'localia-schema-1.png') });
    await page
      .locator('.message.assistant figure.diagram')
      .nth(1)
      .screenshot({ path: path.join(os.tmpdir(), 'localia-schema-2.png') });
    assert.deepEqual(errors, []);
    console.log(
      'Schémas : dessin, réparation, code faux signalé, version texte, consigne — réussi.',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
