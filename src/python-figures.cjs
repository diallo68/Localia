// Figures Python : le code de dessin (matplotlib, schemdraw) écrit par le modèle est exécuté dans
// Pyodide, dans une fenêtre cachée à part (figures-python.html) :
// - session à part : toute requête est refusée sauf les fichiers de Localia (page et Pyodide embarqué) ;
//   le code ne peut donc rien envoyer sur Internet ni lire les fichiers de l'utilisateur ;
// - pas de Node.js, bac à sable de Chromium ;
// - un calcul trop long (boucle sans fin) fait détruire la fenêtre, recréée au travail suivant.
const path = require('node:path');
const { BrowserWindow, ipcMain, session } = require('electron');

const TIMEOUT_MS = 60000; // temps du code du modèle
const LOAD_MS = 600000; // chargement de Python et de matplotlib : ~20 s, mais plusieurs minutes au tout
// premier lancement d’une application nouvellement installée (vérification des fichiers par macOS)
const MAX_CODE = 20000;
let win = null;
let loading = null;
let queue = Promise.resolve();
const pending = new Map();

function allowed(url) {
  if (!url.startsWith('file:')) return false;
  const file = decodeURIComponent(new URL(url).pathname);
  return (
    file.startsWith(__dirname + path.sep) || file.startsWith(__dirname.replace(/\\/g, '/') + '/')
  );
}

function open() {
  if (loading) return loading;
  const figureSession = session.fromPartition('localia-figures-python');
  figureSession.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !allowed(details.url) }),
  );
  figureSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'figures-python-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: figureSession,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  const current = win;
  loading = new Promise((resolve, reject) => {
    const done = (error) => {
      clearTimeout(timer);
      ipcMain.removeListener('figure-ready', onReady);
      ipcMain.removeListener('figure-failed', onFailed);
      if (error) {
        current.destroy();
        reject(error);
      } else resolve();
    };
    const onReady = (event) => event.sender === current.webContents && done();
    const onFailed = (event, message) =>
      event.sender === current.webContents &&
      done(new Error('Python n’a pas pu démarrer : ' + String(message).slice(0, 300)));
    const timer = setTimeout(
      () => done(new Error('Python a mis trop de temps à démarrer.')),
      LOAD_MS,
    );
    ipcMain.on('figure-ready', onReady);
    ipcMain.on('figure-failed', onFailed);
    current.webContents.once('did-fail-load', (_, __, description) => done(new Error(description)));
  });
  win.on('closed', () => {
    if (win === current) {
      win = null;
      loading = null;
    }
    for (const [id, job] of pending) {
      pending.delete(id);
      job.reject(new Error('Exécution du code interrompue.'));
    }
  });
  win.loadFile(path.join(__dirname, 'figures-python.html'));
  return loading;
}

ipcMain.on('figure-done', (event, result) => {
  if (!win || event.sender !== win.webContents) return;
  const job = pending.get(result?.id);
  if (!job) return;
  pending.delete(result.id);
  job.resolve({
    images: (Array.isArray(result.images) ? result.images : [])
      .filter((b) => typeof b === 'string' && b.length < 8_000_000)
      .slice(0, 6)
      .map((b) => 'data:image/png;base64,' + b),
    error: typeof result.error === 'string' ? result.error.slice(0, 2000) : null,
  });
});

// Un travail à la fois ; renvoie { images: [data:image/png…], error }.
function runFigure(code) {
  if (typeof code !== 'string' || !code.trim()) return Promise.reject(new Error('Code vide.'));
  if (code.length > MAX_CODE) return Promise.reject(new Error('Code trop long pour être exécuté.'));
  const run = queue.then(async () => {
    await open();
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        win?.destroy(); // seule façon d'arrêter un calcul sans fin
        reject(new Error('Le code a pris trop de temps (plus de 60 s) : il a été arrêté.'));
      }, TIMEOUT_MS);
      pending.set(id, {
        resolve: (r) => (clearTimeout(timer), resolve(r)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      win.webContents.send('figure-job', { id, code });
    });
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { runFigure, allowed };
