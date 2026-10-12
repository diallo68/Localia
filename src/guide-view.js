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
  const catalog = await window.localia.catalogStatus();
  showStarterCard(s);
  const windows = s.platform === 'win32';
  const linux = s.platform === 'linux';
  const installed = models.length;

  // 1. Modèle du catalogue conseillé selon l'ordinateur et le métier, pour le moteur intégré.
  const { best, alternatives, reasons } = recommendFor({ ...catalog, metier: currentMetier().id });
  if (installed)
    guideStep(
      'guide-model',
      true,
      `${installed} modèle(s) disponible(s). Vous pouvez en ajouter dans la Bibliothèque de modèles.`,
    );
  else {
    const disk =
      catalog.freeDiskGB != null
        ? ` Place libre sur le disque : ${formatGB(catalog.freeDiskGB)}.`
        : '';
    guideStep(
      'guide-model',
      false,
      localText(
        `Pour cet ordinateur et le métier ${currentMetier().label}, nous conseillons ${best.label} (${formatGB(Math.round(best.size / 1e8) / 10)}) : ${reasons.join(' ; ')}. ${best.note}${disk} Vous pourrez changer de modèle à tout moment.`,
      ),
      [best, ...alternatives].map((m, i) => ({
        label: `Télécharger ${m.label} (${formatGB(Math.round(m.size / 1e8) / 10)})${i ? '' : ' — conseillé'}`,
        primary: i === 0,
        disabled:
          Boolean(catalog.downloading) || !enoughDisk({ sizeGB: m.size / 1e9 }, catalog.freeDiskGB),
        onclick: async () => {
          $('guide-progress').textContent = 'Connexion à Hugging Face…';
          try {
            const result = await window.localia.catalogDownload(m.id);
            $('guide-progress').textContent = result?.cancelled
              ? 'En pause : cliquez à nouveau pour reprendre.'
              : `${result.name} est prêt.`;
          } catch (error) {
            $('guide-progress').textContent = error.message;
          }
          await refresh();
          await renderGuide();
        },
      })),
    );
  }

  // 2. Première question
  guideStep(
    'guide-try',
    false,
    installed ? 'Tout est prêt.' : 'Disponible une fois un modèle installé.',
    [
      {
        label: 'Poser une première question',
        primary: installed > 0,
        disabled: !installed,
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

  // Ollama : facultatif.
  if (s.running)
    guideStep(
      'guide-ollama',
      true,
      `Ollama est actif${s.version ? ` (version ${s.version})` : ''} : ses modèles apparaissent aussi dans Localia.`,
    );
  else if (s.ollamaPath)
    guideStep('guide-ollama', false, 'Ollama est installé mais arrêté.', [
      {
        label: 'Démarrer Ollama',
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
      linux || windows
        ? 'Ollama n’est pas installé : ce n’est pas nécessaire, Localia a son propre moteur.'
        : 'Ollama n’est pas installé : ce n’est pas nécessaire, Localia a son propre moteur.',
    );
  $('guide-done').checked = settings.guideDone === true;
}

window.localia.onProgress(({ kind, data }) => {
  if (kind === 'download' && !$('guide-view').hidden) {
    $('guide-progress').textContent =
      data.phase === 'téléchargement'
        ? `Téléchargement : ${Math.round((100 * data.received) / data.total)} %`
        : data.phase === 'vérification'
          ? 'Vérification du fichier…'
          : data.phase === 'reprise'
            ? 'Reprise du téléchargement…'
            : 'Essai du modèle…';
    return;
  }
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
