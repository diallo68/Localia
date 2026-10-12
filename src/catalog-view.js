// Bibliothèque de modèles : catalogue du moteur intégré (Hugging Face), téléchargement avec reprise.
const gigas = (bytes) => `${(bytes / 1e9).toFixed(1).replace('.', ',')} Go`;
let catalogState = null;

async function renderCatalog() {
  catalogState = await window.localia.catalogStatus();
  const s = catalogState;
  const hw = { memoryGB: s.memoryGB, platform: s.platform, arch: s.arch, gpus: [] };
  // Modèles du moteur intégré que l'on peut copier vers une clé USB.
  const local = s.installed.filter((name) => name.startsWith('integre/'));
  $('usb-export-row').hidden = !local.length;
  const chosen = $('usb-model').value;
  $('usb-model').replaceChildren(
    ...local.map((name) => new Option(name.slice('integre/'.length), name)),
  );
  if (local.includes(chosen)) $('usb-model').value = chosen;
  for (const id of ['usb-import', 'usb-export']) $(id).disabled = Boolean(s.downloading);
  const box = $('hf-catalog');
  box.replaceChildren();
  // Les modèles qui tiennent dans la mémoire d'abord, du plus léger au plus lourd.
  const order = { confortable: 0, possible: 1, 'trop-gros': 2 };
  const rows = s.catalog
    .map((m) => ({ m, verdict: assessModel(m.size, hw) }))
    .sort((a, b) => order[a.verdict.level] - order[b.verdict.level] || a.m.size - b.m.size);
  for (const { m, verdict } of rows) {
    const installed = s.installed.includes('integre/' + m.id);
    const card = element('article', 'hf-card' + (verdict.level === 'trop-gros' ? ' too-big' : ''));
    card.append(
      element('strong', '', m.label),
      element('small', 'muted', `${gigas(m.size)} · licence ${m.license} · ${m.repo}`),
      element('p', '', m.note),
      element('small', `verdict verdict-${verdict.level}`, `${verdict.label} — ${verdict.detail}`),
    );
    const button = element('button', installed ? '' : 'primary', '');
    button.type = 'button';
    const partial = s.partial[m.id];
    button.textContent = installed
      ? 'Installé ✓'
      : partial
        ? `Reprendre (${Math.round((100 * partial) / m.size)} %)`
        : 'Télécharger';
    button.disabled =
      installed ||
      Boolean(s.downloading) ||
      verdict.level === 'trop-gros' ||
      !enoughDisk({ sizeGB: m.size / 1e9 }, s.freeDiskGB);
    button.onclick = guard(() =>
      startDownload(() => window.localia.catalogDownload(m.id), m.label),
    );
    card.append(button);
    box.append(card);
  }
}

async function startDownload(run, label, first = 'Connexion à Hugging Face…') {
  notice('');
  $('hf-download').hidden = false;
  $('hf-name').textContent = label;
  $('hf-status').textContent = first;
  $('hf-progress').removeAttribute('value');
  $('hf-cancel').hidden = false;
  try {
    const result = await run();
    if (result?.quiet) $('hf-download').hidden = true;
    else if (result?.cancelled && result.copy)
      $('hf-status').textContent = 'Copie interrompue : rien n’a été installé ni écrit.';
    else if (result?.cancelled)
      $('hf-status').textContent =
        'En pause : cliquez « Reprendre » pour continuer là où le téléchargement s’est arrêté.';
    else if (result.copied) {
      $('hf-status').textContent =
        `${result.name} : à installer sur l’autre ordinateur avec « Installer depuis un fichier… ».`;
      $('hf-progress').value = 100;
    } else {
      $('hf-status').textContent = `${result.name} est prêt : il fonctionne sans Ollama.`;
      $('hf-progress').value = 100;
    }
  } catch (error) {
    $('hf-status').textContent = error.message;
  } finally {
    $('hf-cancel').hidden = true;
    await refresh();
    await renderCatalog().catch(() => {});
  }
}

window.localia.onProgress(({ kind, data }) => {
  if (kind !== 'download') return;
  if (data.total) $('hf-progress').value = Math.round((100 * data.received) / data.total);
  $('hf-status').textContent =
    data.phase === 'téléchargement'
      ? `${gigas(data.received)} sur ${gigas(data.total)}`
      : data.phase === 'reprise'
        ? `Reprise : vérification des ${gigas(data.received)} déjà reçus…`
        : data.phase === 'vérification'
          ? 'Vérification de l’empreinte du fichier…'
          : data.phase === 'copie'
            ? `Copie : ${gigas(data.received)} sur ${gigas(data.total)}`
            : 'Essai du modèle avec le moteur intégré…';
});
$('hf-cancel').onclick = guard(() => window.localia.downloadCancel());
$('hf-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const url = $('hf-url').value.trim();
  await startDownload(() => window.localia.hfDownload(url), url.split('/').pop());
});
$('usb-import').onclick = guard(() =>
  startDownload(
    () => window.localia.modelFromFile().then((r) => r ?? { cancelled: true, quiet: true }),
    'Modèle depuis un fichier',
    'Copie du fichier…',
  ),
);
$('usb-export').onclick = guard(async () => {
  const name = $('usb-model').value;
  await startDownload(
    async () => {
      const result = await window.localia.modelToFile(name);
      if (!result) return { cancelled: true, quiet: true };
      if (result.cancelled) return result;
      return { name: `Copie terminée (${result.file.split(/[\\/]/).pop()})`, copied: true };
    },
    name.slice('integre/'.length),
    'Copie vers la clé USB…',
  );
});
$('models-tab').addEventListener('click', () => renderCatalog().catch((e) => notice(e.message)));
