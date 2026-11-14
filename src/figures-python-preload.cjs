// Pont minimal de la fenêtre des figures Python : recevoir un travail, rendre son résultat.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('figures', {
  onJob: (fn) => ipcRenderer.on('figure-job', (_, job) => fn(job)),
  done: (result) => ipcRenderer.send('figure-done', result),
  ready: () => ipcRenderer.send('figure-ready'),
  failed: (message) => ipcRenderer.send('figure-failed', message),
});
