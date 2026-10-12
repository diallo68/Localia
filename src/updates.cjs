// Mises à jour de Localia, publiées sur GitHub (diallo68/Localia). La recherche lit seulement la
// liste publique des versions : aucune donnée de l'utilisateur n'est envoyée ; elle peut être
// désactivée dans « Confidentialité et sécurité ».
// - Windows et Linux : electron-updater télécharge la nouvelle version, installée au redémarrage.
// - macOS : sans signature Apple (Developer ID), macOS refuse l'installation automatique ; Localia
//   télécharge l'image disque, vérifie son empreinte et l'ouvre : il reste à glisser Localia dans
//   Applications. Une version signée (package:diffusion) passe en mode automatique.
const path = require('node:path');

const REPO = 'diallo68/Localia';
const GITHUB_HOSTS = /(^|\.)(github\.com|githubusercontent\.com)$/i;

// Comparaison de versions « 1.2.3 » (préfixe v et suffixe -beta ignorés pour l'ordre).
function compareVersions(a, b) {
  const parts = (v) =>
    String(v)
      .replace(/^v/i, '')
      .split(/[.-]/)
      .slice(0, 3)
      .map((x) => parseInt(x, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

// Image disque macOS de la version pour ce processeur, avec son empreinte publiée par GitHub.
function pickMacAsset(release, arch) {
  const version = String(release.tag_name || '').replace(/^v/i, '');
  const asset = (release.assets || []).find((a) => a.name === `Localia-${version}-mac-${arch}.dmg`);
  const sha256 = /^sha256:([0-9a-f]{64})$/i.exec(asset?.digest || '')?.[1]?.toLowerCase();
  if (!asset || !sha256) return null;
  return { name: asset.name, url: asset.browser_download_url, size: asset.size, sha256 };
}

function createUpdater({
  currentVersion,
  platform,
  arch,
  signed = false,
  packaged = true,
  downloadsDir,
  send = () => {},
  fetchImpl = fetch,
  downloadFile,
  openPath,
  autoUpdater: loadAutoUpdater = () => require('electron-updater').autoUpdater,
}) {
  const assisted = platform === 'darwin' && !signed;
  let pending = null; // { version, notes, url, asset? }
  let downloaded = null; // chemin de l'image disque (macOS) ou true (installation au redémarrage)
  let updater = null;
  const auto = () => {
    if (updater) return updater;
    updater = loadAutoUpdater();
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on('download-progress', (p) =>
      send({
        kind: 'update',
        data: { phase: 'téléchargement', received: p.transferred, total: p.total },
      }),
    );
    return updater;
  };
  return {
    mode: assisted ? 'assistée' : 'automatique',
    async check() {
      if (!packaged) return { available: false, reason: 'version de développement' };
      if (assisted) {
        const response = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Localia (mises à jour)',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 404) return { available: false };
        if (!response.ok) throw new Error(`GitHub : erreur ${response.status}.`);
        const release = await response.json();
        const version = String(release.tag_name || '').replace(/^v/i, '');
        if (compareVersions(version, currentVersion) <= 0) return { available: false, version };
        const asset = pickMacAsset(release, arch);
        if (!asset)
          return { available: false, version, reason: 'pas encore de fichier pour ce Mac' };
        pending = {
          version,
          notes: String(release.body || '').slice(0, 4000),
          url: release.html_url,
          asset,
        };
      } else {
        const result = await auto().checkForUpdates();
        const info = result?.updateInfo;
        if (!info || compareVersions(info.version, currentVersion) <= 0)
          return { available: false };
        const notes = Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join('\n')
          : info.releaseNotes;
        pending = {
          version: info.version,
          notes: String(notes || '')
            .replace(/<[^>]+>/g, '')
            .slice(0, 4000),
          url: `https://github.com/${REPO}/releases/tag/v${info.version}`,
        };
      }
      return {
        available: true,
        mode: assisted ? 'assistée' : 'automatique',
        ...pending,
        asset: undefined,
      };
    },
    async download() {
      if (!pending) throw new Error('Aucune mise à jour à télécharger : recherchez d’abord.');
      if (assisted) {
        const dest = path.join(downloadsDir, pending.asset.name);
        await downloadFile({
          url: pending.asset.url,
          dest,
          size: pending.asset.size,
          sha256: pending.asset.sha256,
          allowedHosts: GITHUB_HOSTS,
          onProgress: (p) => send({ kind: 'update', data: p }),
        });
        downloaded = dest;
      } else {
        await auto().downloadUpdate();
        downloaded = true;
      }
      return { ready: true, version: pending.version };
    },
    async install() {
      if (!downloaded) throw new Error('Mise à jour pas encore téléchargée.');
      if (assisted) {
        const error = await openPath(downloaded);
        if (error) throw new Error(`Impossible d’ouvrir ${path.basename(downloaded)} : ${error}`);
        return { opened: path.basename(downloaded) };
      }
      setImmediate(() => auto().quitAndInstall());
      return { restarting: true };
    },
  };
}

// LOCALIA_FAKE_UPDATE=1 (tests automatiques) : une version 9.9.9 simulée, sans réseau.
function fakeUpdater({ send = () => {} } = {}) {
  let state = 'none';
  return {
    mode: 'automatique',
    async check() {
      state = 'found';
      return {
        available: true,
        mode: 'automatique',
        version: '9.9.9',
        notes: 'Corrections et nouveautés.',
        url: `https://github.com/${REPO}/releases/tag/v9.9.9`,
      };
    },
    async download() {
      if (state !== 'found')
        throw new Error('Aucune mise à jour à télécharger : recherchez d’abord.');
      send({ kind: 'update', data: { phase: 'téléchargement', received: 50, total: 100 } });
      state = 'ready';
      return { ready: true, version: '9.9.9' };
    },
    async install() {
      if (state !== 'ready') throw new Error('Mise à jour pas encore téléchargée.');
      state = 'installing';
      return { restarting: true, simulated: true };
    },
  };
}

module.exports = { REPO, GITHUB_HOSTS, compareVersions, pickMacAsset, createUpdater, fakeUpdater };
