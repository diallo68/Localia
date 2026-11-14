// Figures Python dans l'application : code matplotlib et schemdraw de la réponse exécuté à l'écart
// (Pyodide), figures affichées ; code en échec corrigé une fois par le modèle (Ollama simulé) ;
// aucun accès réseau pour le code.
const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const COURBE =
  'import numpy as np\nimport matplotlib.pyplot as plt\nf = np.logspace(1, 5, 200)\nplt.semilogx(f, 20*np.log10(1/np.sqrt(1+(f/1000)**2)))\nplt.title("Gain")\nplt.show()';
const CIRCUIT =
  'import schemdraw\nimport schemdraw.elements as elm\nwith schemdraw.Drawing() as d:\n    d += elm.Resistor().right().label("R 1 kΩ")\n    d += elm.Capacitor().down().label("C 100 nF")\n    d += elm.Ground()';
const FAUX = 'import schemdraw\nschemdraw.init()';

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-python-'));
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
    page.setDefaultTimeout(60000);
    await app.evaluate(
      (_, r) => {
        global.chats = [];
        global.fetch = async (url, options) => {
          if (String(url).endsWith('/api/tags'))
            return Response.json({ models: [{ name: 'test:local', size: 100 }] });
          if (String(url).endsWith('/api/show')) return Response.json({});
          if (String(url).endsWith('/api/chat')) {
            const body = JSON.parse(options.body);
            global.chats.push(body);
            const last = body.messages.at(-1).content;
            const content = /il a échoué/.test(last)
              ? 'Version corrigée :\n\n```python\n' + r.CIRCUIT + '\n```'
              : /panne/.test(last)
                ? 'Le circuit :\n\n```python\n' + r.FAUX + '\n```'
                : 'La courbe :\n\n```python\n' +
                  r.COURBE +
                  '\n```\n\nLe circuit :\n\n```python\n' +
                  r.CIRCUIT +
                  '\n```';
            return new Response(JSON.stringify({ message: { content } }) + '\n{"done":true}\n');
          }
          return new Response('', { status: 404 });
        };
      },
      { COURBE, CIRCUIT, FAUX },
    );
    await page.waitForFunction(() => typeof refigure === 'function');
    // 1. Courbe et circuit dessinés.
    await page.locator('#prompt').fill('Courbe et schéma du passe-bas');
    await page.locator('#prompt').press('Enter');
    await page.waitForFunction(
      () => document.querySelectorAll('.message.assistant figure.diagram img').length === 2,
    );
    const srcs = await page.$$eval('.message.assistant figure.diagram img', (i) =>
      i.map((x) => x.src.slice(0, 22)),
    );
    assert.deepEqual(srcs, ['data:image/png;base64,', 'data:image/png;base64,']);
    assert.match(
      await page.locator('.message.assistant').first().textContent(),
      /Figure produite par le code Python du modèle/,
    );
    const system = await app.evaluate(
      () => global.chats[0].messages.find((m) => m.role === 'system')?.content,
    );
    assert.match(system, /bloc ```python```/);
    // 2. Code en échec : le modèle reçoit l'erreur de Python et réécrit ; la version corrigée est gardée.
    await page.locator('#prompt').fill('Schéma en panne');
    await page.locator('#prompt').press('Enter');
    await page.waitForFunction(() => {
      const node = [...document.querySelectorAll('.message.assistant')].at(-1);
      return (
        node?.querySelector('.recalculated') &&
        node.querySelectorAll('figure.diagram img').length === 1
      );
    });
    const fix = await app.evaluate(() => global.chats.at(-1).messages.at(-1).content);
    assert.match(fix, /AttributeError: module 'schemdraw' has no attribute 'init'/);
    assert.match(
      await page.locator('.message.assistant').last().textContent(),
      /Code de la figure corrigé par le modèle/,
    );
    // 3. Aucun accès réseau pour le code.
    const net = await page.evaluate(() =>
      window.localia.runFigure(
        'import matplotlib\nimport pyodide.http\npyodide.http.open_url("https://example.com")',
      ),
    );
    assert.match(net.error, /NetworkError/);
    assert.deepEqual(errors, []);
    console.log(
      'Figures Python : courbe, circuit, correction après erreur, réseau bloqué — réussi.',
    );
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
