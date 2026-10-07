// Onglet « Réglages des modèles ».
const OPTION_FIELDS = [
  'temperature',
  'num_ctx',
  'num_predict',
  'top_p',
  'top_k',
  'repeat_penalty',
  'seed',
  'num_thread',
];
let settingsRequest = 0;

// Valeurs du Modelfile (texte « parameters » renvoyé par Ollama).
function modelDefaults(text) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = /^(\w+)\s+(.+)$/.exec(line.trim());
    if (match && OPTION_FIELDS.includes(match[1])) values[match[1]] = match[2];
  }
  return values;
}

function fillSettingsModels() {
  const select = $('settings-model');
  const previous = select.value;
  select.replaceChildren();
  if (!models.length) select.add(new Option('Aucun modèle installé', ''));
  for (const m of models) select.add(new Option(m.name, m.name));
  if (installed(previous)) select.value = previous;
  for (const element of $('settings-form').elements) element.disabled = !models.length;
}
modelListeners.push(() => {
  fillSettingsModels();
  if (!$('settings-view').hidden) showSettings();
});

function openSettings(name) {
  view('settings');
  if (installed(name)) $('settings-model').value = name;
  showSettings();
}

async function showSettings() {
  const name = $('settings-model').value;
  const form = $('settings-form');
  const saved = settings.models[name] || { options: {} };
  for (const field of OPTION_FIELDS) {
    form.elements[field].value = saved.options[field] ?? '';
    form.elements[field].placeholder = '';
  }
  form.elements.keepAlive.value = saved.keepAlive ?? '';
  form.elements.think.value = saved.think ?? '';
  form.elements.system.value = saved.system ?? '';
  form.elements.num_ctx.removeAttribute('max');
  $('settings-status').textContent = '';
  $('think-field').hidden = true;
  $('model-facts').textContent = name ? 'Lecture des informations du modèle…' : '';
  if (!name) return;
  const request = ++settingsRequest;
  try {
    const info = await window.localia.modelInfo(name);
    if (request !== settingsRequest) return;
    const defaults = modelDefaults(info.parameters);
    for (const field of OPTION_FIELDS)
      if (defaults[field] !== undefined)
        form.elements[field].placeholder = 'Modèle : ' + defaults[field];
    if (!defaults.num_ctx) form.elements.num_ctx.placeholder = 'Localia : 4096';
    if (info.maxContext) form.elements.num_ctx.max = info.maxContext;
    $('think-field').hidden = !info.capabilities.includes('thinking');
    $('model-facts').textContent = [
      info.family && 'Famille ' + info.family,
      info.parameterSize && info.parameterSize + ' paramètres',
      info.quantization && 'quantification ' + info.quantization,
      info.maxContext && 'contexte maximal ' + info.maxContext.toLocaleString('fr-FR') + ' tokens',
      info.capabilities.length && 'capacités : ' + info.capabilities.join(', '),
    ]
      .filter(Boolean)
      .join(' · ');
  } catch (error) {
    if (request === settingsRequest) $('model-facts').textContent = error.message;
  }
}

async function saveModelSettings(name, value) {
  const next = { ...settings, models: { ...settings.models } };
  if (value) next.models[name] = value;
  else delete next.models[name];
  settings = await window.localia.saveSettings(next);
}

$('settings-tab').onclick = () => {
  openSettings($('settings-model').value || $('model').value);
  showPrivacy().catch((error) => notice(error.message));
  showRemote().catch((error) => notice(error.message));
};
$('settings-model').onchange = showSettings;
$('settings-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const name = $('settings-model').value;
  if (!name) return;
  const form = $('settings-form');
  const options = {};
  for (const field of OPTION_FIELDS)
    if (form.elements[field].value !== '') options[field] = form.elements[field].value;
  await saveModelSettings(name, {
    options,
    keepAlive: form.elements.keepAlive.value,
    think: form.elements.think.value,
    system: form.elements.system.value,
  });
  notice('');
  $('settings-status').textContent = `Réglages enregistrés pour ${name}.`;
});
$('settings-reset').onclick = guard(async () => {
  const name = $('settings-model').value;
  if (!name) return;
  await saveModelSettings(name, null);
  await showSettings();
  $('settings-status').textContent = `${name} utilise de nouveau ses valeurs d’origine.`;
});

// « Données sur ce Mac » : chiffrement des fichiers de Localia.
async function showPrivacy(status) {
  status ||= await window.localia.encryptionStatus();
  const parts = [];
  if (status.error) parts.push(`⚠ ${status.error}`);
  else if (status.enabled)
    parts.push(
      `✓ Chiffrement actif : ${status.encryptedFiles} fichier(s) sur ${status.files} chiffré(s).`,
    );
  else parts.push(`Chiffrement désactivé : ${status.files} fichier(s) enregistré(s) en clair.`);
  if (status.fileVault === true) parts.push('FileVault est activé sur ce Mac.');
  // Hors macOS : état du chiffrement du disque inconnu (null), rien n'est affiché.
  if (status.fileVault === false)
    parts.push('FileVault est désactivé : le reste du disque n’est pas chiffré.');
  if (!status.keychain && !status.enabled)
    parts.push(`Chiffrement impossible : ${status.keystore} est indisponible.`);
  $('privacy-status').textContent = localText(parts.join(' '));
  const toggle = $('encryption-toggle');
  toggle.textContent = status.enabled ? 'Désactiver le chiffrement' : 'Chiffrer mes données';
  toggle.className = status.enabled ? '' : 'primary';
  toggle.disabled = (!status.enabled && !status.keychain) || (status.enabled && !status.unlocked);
  $('encryption-export').hidden = !status.unlocked;
  $('encryption-import').hidden = !status.enabled;
}
$('encryption-toggle').onclick = guard(async () => {
  const status = await window.localia.encryptionStatus();
  if (
    status.enabled &&
    !confirm(
      'Déchiffrer toutes les données de Localia ? Elles seront de nouveau lisibles en clair.',
    )
  )
    return;
  $('privacy-status').textContent = status.enabled ? 'Déchiffrement…' : 'Chiffrement…';
  const next = status.enabled
    ? await window.localia.encryptionDisable()
    : await window.localia.encryptionEnable();
  await showPrivacy(next);
  if (next.enabled)
    notice(
      localText(
        'Données chiffrées. Exportez maintenant la clé de secours (Réglages des modèles → Données sur ce Mac) et gardez-la hors de ce Mac.',
      ),
    );
});
$('encryption-export').onclick = guard(async () => {
  const name = await window.localia.encryptionExportKey();
  if (name) notice(`Clé de secours enregistrée dans « ${name} ». Gardez-la hors de ce Mac.`);
});
$('encryption-import').onclick = guard(async () => {
  const status = await window.localia.encryptionImportKey();
  if (!status) return;
  await showPrivacy(status);
  notice('Clé de secours acceptée : rechargement de vos données…');
});

// « Accès depuis vos autres appareils » : serveur, adresses et QR codes, appareils connectés.
async function showRemote(status) {
  status ||= await window.localia.remoteStatus();
  $('remote-enabled').checked = status.enabled;
  $('remote-reset').hidden = !status.running;
  $('remote-status').textContent = status.error
    ? `⚠ ${status.error}`
    : !status.enabled
      ? 'Désactivé : aucun autre appareil ne peut se connecter.'
      : !status.running
        ? 'Démarrage…'
        : status.addresses.length
          ? `Actif sur le port ${status.port}. Scannez un QR code avec l’appareil à connecter.`
          : 'Actif, mais ce Mac n’est relié à aucun réseau local ni à Tailscale.';
  const box = $('remote-addresses');
  box.replaceChildren();
  for (const a of status.addresses) {
    const card = element('figure', 'remote-card');
    const img = document.createElement('img');
    img.src = a.qr;
    img.alt = `QR code de connexion (${a.kind === 'tailscale' ? 'Tailscale' : 'réseau local'})`;
    card.append(
      img,
      element(
        'figcaption',
        '',
        `${a.kind === 'tailscale' ? 'Tailscale (depuis l’extérieur)' : 'Réseau local (même Wi-Fi)'} · ${a.url}`,
      ),
    );
    box.append(card);
  }
  const devices = $('remote-devices');
  devices.replaceChildren();
  if (status.running && status.devices.length) {
    devices.append(element('strong', '', 'Appareils connectés récemment'));
    const list = element('ul', 'muted');
    for (const d of status.devices)
      list.append(
        element(
          'li',
          '',
          `${d.ip.replace(/^::ffff:/, '')} · ${deviceName(d.userAgent)} · ${new Date(d.lastSeen).toLocaleString('fr-FR')}`,
        ),
      );
    devices.append(list);
  }
}
const deviceName = (agent) =>
  /iphone/i.test(agent)
    ? 'iPhone'
    : /ipad/i.test(agent)
      ? 'iPad'
      : /android/i.test(agent)
        ? 'Android'
        : /windows/i.test(agent)
          ? 'Windows'
          : /mac os/i.test(agent)
            ? 'Mac'
            : /linux/i.test(agent)
              ? 'Linux'
              : 'navigateur';
$('remote-enabled').onchange = guard(async () => {
  $('remote-status').textContent = $('remote-enabled').checked ? 'Démarrage…' : 'Arrêt…';
  const status = await window.localia.remoteEnable($('remote-enabled').checked);
  // Réglages relus : l'option est enregistrée par le processus principal.
  settings = await window.localia.loadSettings();
  await showRemote(status);
});
$('remote-reset').onclick = guard(async () => {
  if (!confirm('Changer la clé ? Tous les appareils connectés devront scanner le nouveau QR code.'))
    return;
  await showRemote(await window.localia.remoteReset());
});

// Anonymisation : mots toujours masqués avant l'envoi au modèle.
function showMaskWords() {
  $('mask-words').value = (settings.maskWords || []).join('\n');
}
$('mask-save').onclick = guard(async () => {
  const maskWords = $('mask-words')
    .value.split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
  settings = await window.localia.saveSettings({ ...settings, maskWords });
  showMaskWords();
  $('mask-status').textContent = `${settings.maskWords?.length || 0} mot(s) masqué(s).`;
});
$('settings-tab').addEventListener('click', showMaskWords);
