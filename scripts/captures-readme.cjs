const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
// Captures du README (docs/*.png, 3120 × 1744) sur un profil de démonstration fictif :
// npm run captures (en anglais dans docs/en : npm run captures -- en). Aucune donnée réelle n'est utilisée.
const { execFileSync } = require('node:child_process');
const lang = process.argv[2] === 'en' ? 'en' : 'fr';
const out = path.join(__dirname, '..', 'docs', lang === 'en' ? 'en' : '');
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-demo-'));
  execFileSync(process.execPath, [path.join(__dirname, 'demo-data.cjs'), profile, lang]);
  await fs.mkdir(out, { recursive: true });
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env: { ...process.env, LOCALIA_TEST_DATA: profile },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1560,
    height: 872,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.waitForFunction(() => document.body.dataset.view === 'home', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, name) });
  };
  await page.evaluate(() => renderHome());
  await shot('home.png');
  await page.locator('#history button[data-id="demo-c1"]').click();
  await page.evaluate(() => setChatPanel(true));
  await shot('chat.png');
  await page.locator('#bench-nav').click();
  await page.locator('#benchmark-tab').click();
  await page.waitForTimeout(1500);
  await shot('benchmark.png');
  await page.evaluate(() =>
    document.querySelector('#bench-results .charts')?.scrollIntoView({ block: 'start' }),
  );
  await shot('benchmark-charts.png');
  await page.locator('#compare-tab').click();
  await page.locator('#compare-history .compare-row button.link').first().click();
  await page.waitForTimeout(800);
  await page.evaluate(() =>
    document.querySelector('#compare-current')?.scrollIntoView({ block: 'start' }),
  );
  await shot('comparison.png');
  await page.locator('#projects-tab').click();
  await page
    .locator('#projects-list button')
    .first()
    .click()
    .catch(() => {});
  await shot('projects.png');
  await page.evaluate((query) => openSearch(query), lang === 'en' ? 'oven' : 'four');
  await page.waitForTimeout(800);
  await shot('search.png');
  await page.locator('#routines-tab').click();
  await page.locator('.run-row').first().click();
  await page.evaluate(() =>
    document.querySelector('#routines-view h3')?.scrollIntoView({ block: 'start' }),
  );
  await shot('routines.png');
  await page.locator('#settings-tab').click();
  await shot('settings.png');
  await page.locator('#security-tab').click();
  await page.waitForTimeout(800);
  await shot('security.png');
  await page.locator('#mode-switch').click();
  await page.waitForTimeout(500);
  await page.locator('#new').click();
  await page.evaluate(() => {
    setChatPanel(false);
    selectModel('gemma3:12b');
    document.querySelector('#model').dispatchEvent(new Event('change'));
  });
  await shot('simple.png');
  console.log('erreurs', JSON.stringify(errors));
  await app.close();
  await fs.rm(profile, { recursive: true, force: true });
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
