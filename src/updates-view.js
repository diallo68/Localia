// Mises à jour : recherche au démarrage (sauf si désactivée), bandeau quand une version est
// disponible, téléchargement avec avancement, puis installation (redémarrage) ou, sur un Mac non
// signé, ouverture de l'image disque à glisser dans Applications.
let updateFound = null; // { version, notes, url, mode }
let updateStage = 'idle'; // idle → available → downloading → ready

function updateBanner() {
  const banner = $('update-banner');
  banner.hidden = !updateFound || updateStage === 'idle';
  if (banner.hidden) return;
  const mac = updateFound.mode === 'assistée';
  const texts = {
    available: `Localia ${updateFound.version} est disponible.`,
    downloading: `Téléchargement de Localia ${updateFound.version}…`,
    ready: mac
      ? `Localia ${updateFound.version} est téléchargée et vérifiée. Ouvrez-la puis glissez Localia dans Applications (remplacer).`
      : `Localia ${updateFound.version} est prête : elle s’installera au redémarrage.`,
  };
  $('update-text').textContent = tr(texts[updateStage] || '');
  $('update-progress').hidden = updateStage !== 'downloading';
  $('update-go').hidden = updateStage === 'downloading';
  $('update-go').textContent = tr(
    updateStage === 'ready' ? (mac ? 'Ouvrir' : 'Redémarrer maintenant') : 'Télécharger',
  );
  $('update-notes').hidden = !updateFound.url;
}

async function checkUpdates({ quiet = false } = {}) {
  $('updates-status').textContent = tr('Recherche en cours…');
  try {
    const result = await window.localia.updateCheck();
    if (result.available) {
      updateFound = result;
      if (updateStage === 'idle') updateStage = 'available';
      $('updates-status').textContent = tr(`Localia ${result.version} est disponible.`);
    } else
      $('updates-status').textContent = result.reason
        ? tr(`Pas de mise à jour (${result.reason}).`)
        : tr('Localia est à jour.');
  } catch (error) {
    $('updates-status').textContent = tr('Recherche impossible : ') + error.message;
    if (!quiet) throw error;
  }
  updateBanner();
}

$('update-go').onclick = guard(async () => {
  if (updateStage === 'available') {
    updateStage = 'downloading';
    updateBanner();
    try {
      await window.localia.updateDownload();
      updateStage = 'ready';
    } catch (error) {
      updateStage = 'available';
      throw error;
    } finally {
      updateBanner();
    }
  } else if (updateStage === 'ready') {
    const result = await window.localia.updateInstall();
    if (result.opened) notice(tr('Image disque ouverte : glissez Localia dans Applications.'));
  }
});
$('update-later').onclick = () => {
  $('update-banner').hidden = true;
};
$('update-notes').onclick = guard(() => window.localia.updateNotes(updateFound.url));
window.localia.onProgress(({ kind, data }) => {
  if (kind !== 'update' || !data.total) return;
  $('update-progress').value = Math.round((100 * data.received) / data.total);
});

// Réglage : recherche au démarrage, et version installée.
async function renderUpdateSettings() {
  $('updates-enabled').checked = settings.updates !== 'off';
  const status = await window.localia.updateStatus().catch(() => null);
  if (status && !$('updates-status').textContent)
    $('updates-status').textContent = tr(
      `Version installée : ${status.version}. Installation ${status.mode === 'assistée' ? 'en un glisser-déposer (Mac non signé)' : 'automatique'}.`,
    );
}
$('updates-enabled').onchange = guard(async () => {
  settings = await window.localia.saveSettings({
    ...settings,
    updates: $('updates-enabled').checked ? 'on' : 'off',
  });
});
$('updates-check').onclick = guard(() => checkUpdates());
$('security-tab').addEventListener('click', () => renderUpdateSettings().catch(() => {}));

// Au démarrage : recherche discrète, quelques secondes après l'ouverture.
async function scheduleUpdateCheck() {
  if (settings.updates === 'off') return;
  const status = await window.localia.updateStatus().catch(() => null);
  setTimeout(() => checkUpdates({ quiet: true }), status?.delay ?? 8000);
}
