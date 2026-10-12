const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  compareVersions,
  pickMacAsset,
  createUpdater,
  GITHUB_HOSTS,
} = require('../src/updates.cjs');

const SHA = 'a'.repeat(64);
const release = (tag, assets = []) => ({
  tag_name: tag,
  html_url: `https://github.com/diallo68/Localia/releases/tag/${tag}`,
  body: 'Nouveautés',
  assets,
});
const dmg = (version, arch, digest = `sha256:${SHA}`) => ({
  name: `Localia-${version}-mac-${arch}.dmg`,
  browser_download_url: `https://github.com/diallo68/Localia/releases/download/v${version}/Localia-${version}-mac-${arch}.dmg`,
  size: 1000,
  digest,
});
const reply = (status, body) => async () => ({ status, ok: status < 400, json: async () => body });

test('versions comparées dans le bon ordre', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('v1.0.0', '1.0.0') === 0);
  assert.ok(compareVersions('0.5.0', '0.6.0-beta.1') < 0);
});

test('Mac non signé : image disque de ce processeur, avec empreinte, téléchargée puis ouverte', async () => {
  assert.equal(pickMacAsset(release('v0.6.0', [dmg('0.6.0', 'x64', null)]), 'x64'), null);
  assert.equal(pickMacAsset(release('v0.6.0', [dmg('0.6.0', 'arm64')]), 'x64'), null);
  const downloads = [];
  const opened = [];
  const updater = createUpdater({
    currentVersion: '0.5.0',
    platform: 'darwin',
    arch: 'x64',
    downloadsDir: '/tmp/telechargements',
    fetchImpl: reply(200, release('v0.6.0', [dmg('0.6.0', 'arm64'), dmg('0.6.0', 'x64')])),
    downloadFile: async (options) => downloads.push(options),
    openPath: async (file) => opened.push(file) && '',
    autoUpdater: () => assert.fail('pas d’installation automatique sans signature'),
  });
  assert.equal(updater.mode, 'assistée');
  await assert.rejects(updater.download(), /recherchez d’abord/);
  const found = await updater.check();
  assert.equal(found.available, true);
  assert.equal(found.version, '0.6.0');
  assert.equal(found.asset, undefined, 'détails du fichier gardés côté processus principal');
  await updater.download();
  assert.equal(downloads[0].dest, path.join('/tmp/telechargements', 'Localia-0.6.0-mac-x64.dmg'));
  assert.equal(downloads[0].sha256, SHA);
  assert.equal(downloads[0].allowedHosts, GITHUB_HOSTS);
  assert.deepEqual(await updater.install(), { opened: 'Localia-0.6.0-mac-x64.dmg' });
  assert.deepEqual(opened, [path.join('/tmp/telechargements', 'Localia-0.6.0-mac-x64.dmg')]);
});

test('Mac : déjà à jour, aucune publication, ou version de développement', async () => {
  const base = { platform: 'darwin', arch: 'x64', downloadsDir: '/tmp' };
  const same = createUpdater({
    ...base,
    currentVersion: '0.6.0',
    fetchImpl: reply(200, release('v0.6.0')),
  });
  assert.equal((await same.check()).available, false);
  const none = createUpdater({ ...base, currentVersion: '0.5.0', fetchImpl: reply(404, {}) });
  assert.equal((await none.check()).available, false);
  const dev = createUpdater({
    ...base,
    currentVersion: '0.5.0',
    packaged: false,
    fetchImpl: () => assert.fail(),
  });
  assert.match((await dev.check()).reason, /développement/);
});

test('Windows et Linux : electron-updater télécharge puis installe au redémarrage', async () => {
  const calls = [];
  const fake = {
    on: () => {},
    checkForUpdates: async () => ({
      updateInfo: { version: '0.6.0', releaseNotes: '<p>Corrections</p>' },
    }),
    downloadUpdate: async () => calls.push('download'),
    quitAndInstall: () => calls.push('install'),
  };
  const updater = createUpdater({
    currentVersion: '0.5.0',
    platform: 'win32',
    arch: 'x64',
    autoUpdater: () => fake,
  });
  assert.equal(updater.mode, 'automatique');
  const found = await updater.check();
  assert.equal(found.notes, 'Corrections');
  assert.equal(fake.autoDownload, false, 'rien téléchargé sans accord');
  await updater.download();
  assert.deepEqual(await updater.install(), { restarting: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['download', 'install']);
});
