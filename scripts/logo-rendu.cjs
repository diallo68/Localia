// Rendu des SVG du logo en PNG de 1024 px à fond transparent (lancé par scripts/logo.cjs).
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const dossier = process.argv.at(-1);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  for (const nom of ['plein', 'mac']) {
    const contenu = fs.readFileSync(path.join(dossier, nom + '.svg'), 'utf8');
    const page = `<!doctype html><html><body style="margin:0;background:transparent">${contenu.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page));
    await new Promise((r) => setTimeout(r, 300));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
    fs.writeFileSync(
      path.join(dossier, nom + '.png'),
      image.resize({ width: 1024, height: 1024 }).toPNG(),
    );
  }
  app.quit();
});
