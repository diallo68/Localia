// Guide de démarrage : modèle conseillé selon la mémoire de l'ordinateur.
// Chargé par l'interface et les tests.
const STARTER_MODELS = [
  {
    name: 'gemma3:1b',
    label: 'Gemma 3 · 1B',
    sizeGB: 0.8,
    minMemoryGB: 0,
    license: 'Gemma Terms of Use',
    note: 'Très léger : pour découvrir Localia sur un petit ordinateur. Réponses simples, souvent imprécises.',
  },
  {
    name: 'gemma3:4b',
    label: 'Gemma 3 · 4B',
    sizeGB: 3.3,
    minMemoryGB: 8,
    license: 'Gemma Terms of Use',
    note: 'Léger et multilingue : un bon début sur un ordinateur de 8 Go.',
  },
  {
    name: 'qwen3:8b',
    label: 'Qwen 3 · 8B',
    sizeGB: 5.2,
    minMemoryGB: 12,
    license: 'Apache 2.0',
    note: 'Bon en raisonnement et en code, plus rapide que Gemma 3 12B.',
  },
  {
    name: 'gemma3:12b',
    label: 'Gemma 3 · 12B',
    sizeGB: 8.1,
    minMemoryGB: 16,
    license: 'Gemma Terms of Use',
    note: 'Le plus fiable dans les essais menés avec Localia (le moins d’inventions), mais plus lent.',
  },
];

// Le plus gros modèle qui tient dans la mémoire, et les autres possibles (du plus gros au plus petit).
function recommendStarter(memoryGB) {
  const fitting = STARTER_MODELS.filter((m) => (memoryGB ?? 0) >= m.minMemoryGB).reverse();
  const [best, ...alternatives] = fitting.length ? fitting : [STARTER_MODELS[0]];
  return { best, alternatives: alternatives.slice(0, 2) };
}

// Place libre suffisante : le modèle, plus une marge de 2 Go.
const enoughDisk = (model, freeGB) => freeGB == null || freeGB >= model.sizeGB + 2;

if (typeof module !== 'undefined')
  module.exports = { STARTER_MODELS, recommendStarter, enoughDisk };
