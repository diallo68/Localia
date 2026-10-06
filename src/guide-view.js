// Guide de démarrage : installer Ollama, télécharger un modèle adapté à l'ordinateur, essayer.
// S'ouvre au lancement tant qu'aucun modèle n'est installé (sauf si l'utilisateur l'a désactivé).
const formatGB = (n) => `${String(n).replace('.', ',')} Go`;
let setupStatus = null;

function guideStep(id, done, state, actions = []) {
  const step = $(id);
  step.classList.toggle('done', done);
  step.querySelector('.guide-state').textContent = (done ? '✓ ' : '') + state;
  const box = step.querySelector('.guide-actions');
  box.replaceChildren();
  for (const { label, primary, onclick, disabled } of actions) {
    const button = element('button', primary ? 'primary' : '', label);
    button.type = 'button';
    button.disabled = Boolean(disabled);
    button.onclick = guard(onclick);
    box.append(button);
  }
}

// Carte « Pour commencer » de la Bibliothèque de modèles, selon la mémoire de l'ordinateur.
function showStarterCard(status) {
  const { best } = recommendStarter(status.memoryGB);
  $('starter-advice').textContent = localText(
    `Sur ce Mac de ${status.memoryGB} Go de mémoire, nous conseillons ${best.label}.`,
  );
  $('starter-label').textContent = best.label;
  $('starter-note').textContent = best.note;
  $('starter-meta').textContent = `${best.name} · ${formatGB(best.sizeGB)} · ${best.license}`;
  $('download').dataset.model = best.name;
}

async function renderGuide() {
  setupStatus = await window.localia.setupStatus();
  const s = setupStatus;
  showStarterCard(s);
  const windows = s.platform === 'win32';
  const linux = s.platform === 'linux';

  // 1. Ollama
  if (s.running)
    guideStep(
      'guide-ollama',
      true,
      `Ollama est installé et actif${s.version ? ` (version ${s.version})` : ''}.`,
    );
  else if (s.ollamaPath)
    guideStep('guide-ollama', false, 'Ollama est installé mais arrêté.', [
      {
        label: 'Démarrer Ollama',
        primary: true,
        onclick: async () => {
          await window.localia.start();
          await refresh();
          await renderGuide();
        },
      },
    ]);
  else
    guideStep(
      'guide-ollama',
      false,
      linux
        ? 'Ollama n’est pas installé. Sur ollama.com/download, copiez la commande d’installation pour Linux dans un terminal, puis revenez ici.'
        : windows
          ? 'Ollama n’est pas installé. Téléchargez-le, lancez « OllamaSetup.exe » et suivez l’installation, puis revenez ici.'
          : 'Ollama n’est pas installé. Téléchargez-le, ouvrez le fichier, glissez Ollama dans Applications et lancez-le une fois, puis revenez ici.',
      [
        {
          label: 'Télécharger Ollama (ollama.com)',
          primary: true,
          onclick: () => window.localia.openOllamaDownload(),
        },
        { label: 'J’ai installé Ollama : vérifier', onclick: renderGuide },
      ],
    );

  // 2. Modèle conseillé selon la mémoire
  const { best, alternatives } = recommendStarter(s.memoryGB);
  if (s.models > 0)
    guideStep(
      'guide-model',
      true,
      `${s.models} modèle(s) installé(s). Vous pouvez en ajouter dans la Bibliothèque de modèles.`,
    );
  else {
    const disk =
      s.freeDiskGB != null ? ` Place libre sur le disque : ${formatGB(s.freeDiskGB)}.` : '';
    guideStep(
      'guide-model',
      false,
      localText(
        `Ce Mac a ${s.memoryGB} Go de mémoire : nous conseillons ${best.label} (${formatGB(best.sizeGB)}). ${best.note}${disk}`,
      ),
      [best, ...alternatives].map((m, i) => ({
        label: `Télécharger ${m.label} (${formatGB(m.sizeGB)})${i ? '' : ' — conseillé'}`,
        primary: i === 0,
        disabled: !s.running || pulling || !enoughDisk(m, s.freeDiskGB),
        onclick: async () => {
          $('guide-progress').textContent = 'Connexion au catalogue…';
          await download(m.name);
          await renderGuide();
        },
      })),
    );
    if (!s.running) $('guide-progress').textContent = 'Démarrez d’abord Ollama (étape 1).';
    else if (!enoughDisk(best, s.freeDiskGB))
      $('guide-progress').textContent =
        'Place insuffisante sur le disque pour le modèle conseillé.';
  }

  // 3. Première question
  guideStep(
    'guide-try',
    false,
    s.models > 0 ? 'Tout est prêt.' : 'Disponible une fois un modèle installé.',
    [
      {
        label: 'Poser une première question',
        primary: s.models > 0,
        disabled: !s.models,
        onclick: () => {
          $('new').click();
          view('chat');
          $('prompt').value =
            'Présente-toi en trois phrases et dis-moi ce que tu peux faire pour moi sans connexion Internet.';
          $('prompt').focus();
        },
      },
    ],
  );
  $('guide-done').checked = settings.guideDone === true;
}

window.localia.onProgress(({ kind, data }) => {
  if (kind !== 'pull' || $('guide-view').hidden) return;
  const percent = data.total ? ` ${Math.round((100 * (data.completed || 0)) / data.total)} %` : '';
  $('guide-progress').textContent = `${data.status || 'Téléchargement…'}${percent}`;
});

async function openGuide() {
  view('guide');
  await renderGuide();
}
$('guide-tab').onclick = guard(openGuide);
$('guide-close').onclick = () => view('chat');
$('guide-done').onchange = guard(async () => {
  settings = await window.localia.saveSettings({ ...settings, guideDone: $('guide-done').checked });
});
