// Catalogue du moteur intégré : modèles GGUF de Hugging Face, en accès libre, version Q4_K_M.
// Taille et empreinte SHA-256 relevées par l'API de Hugging Face le 6 octobre 2026 : le fichier
// téléchargé est vérifié avant d'être utilisé. Chargé par l'interface, le processus principal et
// les tests.
const CATALOG = [
  {
    id: 'gemma-4-e2b',
    label: 'Gemma 4 · E2B',
    repo: 'unsloth/gemma-4-E2B-it-GGUF',
    file: 'gemma-4-E2B-it-Q4_K_M.gguf',
    size: 3106738272,
    sha256: '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8',
    license: 'Apache 2.0',
    minMemoryGB: 8,
    note: 'Gemma 4 conçu pour les petits ordinateurs : léger et rapide.',
  },
  {
    id: 'gemma-4-e4b',
    label: 'Gemma 4 · E4B',
    repo: 'unsloth/gemma-4-E4B-it-GGUF',
    file: 'gemma-4-E4B-it-Q4_K_M.gguf',
    size: 4977171584,
    sha256: '85a896a047553e842f25297ee5b031d64ff30147d9c4af17b1e4b394cd1fab87',
    license: 'Apache 2.0',
    minMemoryGB: 12,
    note: 'Gemma 4 pour ordinateurs moyens : bon compromis entre qualité et vitesse.',
  },
  {
    id: 'gemma-4-12b',
    label: 'Gemma 4 · 12B',
    repo: 'unsloth/gemma-4-12b-it-GGUF',
    file: 'gemma-4-12b-it-Q4_K_M.gguf',
    size: 7121861440,
    sha256: '0a270ec9fe6b34f4a0d33992b6135117b484ebc4766ab76b51d4ae8c457e4c42',
    license: 'Apache 2.0',
    minMemoryGB: 16,
    note: 'Le plus capable des Gemma 4 proposés ; lent sans carte graphique.',
  },
  {
    id: 'gemma-3-1b',
    label: 'Gemma 3 · 1B',
    repo: 'unsloth/gemma-3-1b-it-GGUF',
    file: 'gemma-3-1b-it-Q4_K_M.gguf',
    size: 806058272,
    sha256: '8270790f3ab69fdfe860b7b64008d9a19986d8df7e407bb018184caa08798ebd',
    license: 'Gemma Terms of Use',
    minMemoryGB: 0,
    note: 'Très léger : pour découvrir Localia sur un petit ordinateur.',
  },
  {
    id: 'gemma-3-4b',
    label: 'Gemma 3 · 4B',
    repo: 'unsloth/gemma-3-4b-it-GGUF',
    file: 'gemma-3-4b-it-Q4_K_M.gguf',
    size: 2489894016,
    sha256: '04a43a22e8d2003deda5acc262f68ec1005fa76c735a9962a8c77042a74a7d19',
    license: 'Gemma Terms of Use',
    minMemoryGB: 8,
    note: 'Léger et multilingue.',
  },
  {
    id: 'gemma-3-12b',
    label: 'Gemma 3 · 12B',
    repo: 'unsloth/gemma-3-12b-it-GGUF',
    file: 'gemma-3-12b-it-Q4_K_M.gguf',
    size: 7300778336,
    sha256: '15b8fd9d8672cd4240c178c217ca781409291f34e353d2e913b29c7602ceb3ff',
    license: 'Gemma Terms of Use',
    minMemoryGB: 16,
    note: 'Le plus fiable dans les essais menés avec Localia (le moins d’inventions), mais lent.',
  },
  {
    id: 'qwen3-4b',
    label: 'Qwen 3 · 4B',
    repo: 'Qwen/Qwen3-4B-GGUF',
    file: 'Qwen3-4B-Q4_K_M.gguf',
    size: 2497280256,
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
    license: 'Apache 2.0',
    minMemoryGB: 8,
    note: 'Rapide ; raisonne avant de répondre (réflexion désactivable).',
  },
  {
    id: 'qwen3-8b',
    label: 'Qwen 3 · 8B',
    repo: 'Qwen/Qwen3-8B-GGUF',
    file: 'Qwen3-8B-Q4_K_M.gguf',
    size: 5027783488,
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
    license: 'Apache 2.0',
    minMemoryGB: 12,
    note: 'Bon en raisonnement et en code.',
  },
  {
    id: 'qwen3.5-4b',
    label: 'Qwen 3.5 · 4B',
    repo: 'unsloth/Qwen3.5-4B-GGUF',
    file: 'Qwen3.5-4B-Q4_K_M.gguf',
    size: 2740937888,
    sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
    license: 'Apache 2.0',
    minMemoryGB: 8,
    note: 'Version officielle de Qwen 3.5, petit modèle.',
  },
  {
    id: 'qwen3.5-9b',
    label: 'Qwen 3.5 · 9B',
    repo: 'unsloth/Qwen3.5-9B-GGUF',
    file: 'Qwen3.5-9B-Q4_K_M.gguf',
    size: 5680522464,
    sha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8',
    license: 'Apache 2.0',
    minMemoryGB: 12,
    note: 'Version officielle de Qwen 3.5 (à comparer avec la version « abliterated »).',
  },
  {
    id: 'phi-4-mini',
    label: 'Phi-4 mini · 3.8B',
    repo: 'unsloth/Phi-4-mini-instruct-GGUF',
    file: 'Phi-4-mini-instruct-Q4_K_M.gguf',
    size: 2491874272,
    sha256: '88c00229914083cd112853aab84ed51b87bdf6b9ce42f532d8c85c7c63b1730a',
    license: 'MIT',
    minMemoryGB: 8,
    note: 'Microsoft : petit modèle fort en raisonnement et en calcul (finance, ingénierie).',
  },
  {
    id: 'medgemma-1.5-4b',
    label: 'MedGemma 1.5 · 4B',
    repo: 'unsloth/medgemma-1.5-4b-it-GGUF',
    file: 'medgemma-1.5-4b-it-Q4_K_M.gguf',
    size: 2489894976,
    sha256: 'b31becdf4f39561800505514cce67681604fe449d04dd35c8c92fd7848c6d7bd',
    license: 'Health AI Developer Foundations (conditions propres à lire)',
    minMemoryGB: 8,
    note: 'Google, spécialisé santé (janvier 2026). Licence propre à Google : à lire avant tout usage hors test.',
  },
];

const catalogEntry = (id) => CATALOG.find((m) => m.id === id) || null;
// Modèle conseillé selon la mémoire, puis deux autres plus légers. Au-delà de 16 Go, Gemma 3 12B :
// le plus fiable dans le Benchmark de l'auteur.
const RECOMMENDED = [
  [16, 'gemma-3-12b'],
  [12, 'qwen3-8b'],
  [8, 'gemma-3-4b'],
  [0, 'gemma-3-1b'],
];
function recommendCatalog(memoryGB) {
  const ids = RECOMMENDED.filter(([min]) => (memoryGB ?? 0) >= min).map(([, id]) => id);
  const [best, ...rest] = ids.map(catalogEntry);
  return { best, alternatives: rest.slice(0, 2) };
}
// Choix automatique selon l'ordinateur et le métier. Ordre de préférence par métier, tiré du
// Benchmark de l'auteur (octobre 2026, 4 modèles, 2 à 3 correcteurs) : Gemma 4 E4B le plus juste
// et celui qui invente le moins (85 % de réponses correctes, 3 % d'inventions, 57 s) ;
// Qwen 3.5 9B meilleur en code (83 %) mais plus lent et plus inventif ; MedGemma faible même en
// santé (51 %) : jamais conseillé d'office. Les plus petits modèles servent de repli.
const GENERAL = ['gemma-4-e4b', 'qwen3.5-9b', 'gemma-4-e2b', 'qwen3.5-4b', 'gemma-3-1b'];
const METIER_PREFERENCES = {
  ingenierie: ['qwen3.5-9b', 'gemma-4-e4b', 'qwen3.5-4b', 'gemma-4-e2b', 'gemma-3-1b'],
};
const METIER_REASONS = {
  ingenierie: 'en Ingénierie, Qwen 3.5 9B écrit le meilleur code dans nos essais',
};
// Sans puce Apple ni carte graphique, un modèle de plus de 5 Go répond 2 à 3 fois plus lentement :
// réservé aux ordinateurs d'au moins 32 Go.
const SLOW_LIMIT = 5.0e9;
function recommendFor({ memoryGB = 0, platform, arch, freeDiskGB = null, metier } = {}) {
  const fast = platform === 'darwin' && arch === 'arm64';
  const order = METIER_PREFERENCES[metier] || GENERAL;
  const reasons = [`${memoryGB} Go de mémoire`];
  if (!fast && memoryGB < 32)
    reasons.push('sans puce Apple : modèles de moins de 5 Go, plus rapides');
  const fits = (m) =>
    m &&
    memoryGB >= m.minMemoryGB &&
    (fast || memoryGB >= 32 || m.size <= SLOW_LIMIT) &&
    (freeDiskGB == null || freeDiskGB >= m.size / 1e9 + 2);
  const ranked = order.map(catalogEntry).filter(fits);
  const best = ranked[0] || catalogEntry('gemma-3-1b');
  if (METIER_REASONS[metier] && best.id === order[0]) reasons.push(METIER_REASONS[metier]);
  else if (best.id === 'gemma-4-e4b')
    reasons.push('Gemma 4 E4B : le plus juste et celui qui invente le moins dans nos essais');
  // Choix réduit par la place libre : dit à l'utilisateur, qui peut libérer de l'espace.
  const withoutDisk =
    freeDiskGB == null ? best : recommendFor({ memoryGB, platform, arch, metier }).best;
  if (withoutDisk.id !== best.id)
    reasons.push(
      `peu de place libre sur le disque : ${best.label} plutôt que ${withoutDisk.label}`,
    );
  if (freeDiskGB != null && freeDiskGB < best.size / 1e9 + 2)
    reasons.push('place libre insuffisante : libérez de l’espace sur le disque');
  return { best, alternatives: ranked.slice(1, 3), order, reasons };
}
const downloadUrl = (m) => `https://huggingface.co/${m.repo}/resolve/main/${m.file}`;

if (typeof module !== 'undefined')
  module.exports = { CATALOG, catalogEntry, downloadUrl, recommendCatalog, recommendFor };
