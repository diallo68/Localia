// Choix automatique du modèle : d'abord le mieux noté pour le métier dans les séries du Benchmark
// de l'utilisateur, sinon le conseil selon l'ordinateur et le métier (recommendFor, catalog.js),
// parmi les modèles installés. Dès que l'utilisateur choisit lui-même un modèle, Localia ne le
// change plus ; il peut revenir au modèle conseillé d'un clic.
let computer = null;
async function loadComputer() {
  if (computer) return computer;
  const s = await window.localia.catalogStatus().catch(() => null);
  if (s)
    computer = {
      memoryGB: s.memoryGB,
      platform: s.platform,
      arch: s.arch,
      freeDiskGB: s.freeDiskGB,
    };
  return computer;
}

// Modèle conseillé parmi les modèles installés : { name, why } ou null.
function recommendedModel() {
  const metier = currentMetier();
  const label = BENCH_METIERS[metier.id];
  const bench = label ? metierAdvice(comparisons, label)?.best : null;
  if (bench && installed(bench.model))
    return { name: bench.model, why: `le mieux noté en ${metier.label} dans vos séries` };
  if (!computer) return null;
  const advice = recommendFor({ ...computer, metier: metier.id });
  const ids = [advice.best, ...advice.alternatives].map((m) => m.id);
  for (const id of [...ids, ...advice.order.filter((x) => !ids.includes(x))]) {
    const name = 'integre/' + id;
    if (installed(name)) return { name, why: advice.reasons.join(' ; ') };
  }
  return null;
}

const manualChoice = () => settings.modelChoice === 'manuel';
let autoSelecting = false;
function applyAutoModel() {
  if (manualChoice()) return;
  const choice = recommendedModel();
  if (!choice || $('model').value === choice.name) return;
  selectModel(choice.name);
  // Changement fait par Localia : le choix reste automatique.
  autoSelecting = true;
  try {
    $('model').dispatchEvent(new Event('change'));
  } finally {
    autoSelecting = false;
  }
}

// Tout autre changement vient de l'utilisateur (liste des modèles, « Utiliser ce modèle »,
// changement de moteur) : retenu comme choix manuel.
$('model').addEventListener('change', () => {
  if (autoSelecting || manualChoice()) return;
  window.localia
    .saveSettings({ ...settings, modelChoice: 'manuel' })
    .then((saved) => {
      settings = saved;
      updateComposerAdvice();
    })
    .catch((error) => notice(error.message));
});
async function useRecommendedModel() {
  settings = await window.localia.saveSettings({ ...settings, modelChoice: 'auto' });
  applyAutoModel();
  updateComposerAdvice();
}
// « Changer de modèle » : ouvre les réglages de la conversation sur la liste des modèles.
function openModelPicker() {
  setChatPanel(true);
  $('model').focus();
}

modelListeners.push(() => {
  loadComputer()
    .then(() => {
      applyAutoModel();
      updateComposerAdvice();
    })
    .catch((error) => notice(error.message));
});
