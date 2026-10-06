// Onglet « Performances de votre ordinateur » : quel modèle tient dans la mémoire, à quelle vitesse.
// Chargé par l'interface et les tests.

// Accélération utilisable par Ollama : puce Apple (Metal, mémoire unifiée), carte NVIDIA (CUDA),
// carte AMD récente (ROCm, Windows et Linux). Sur un Mac Intel, Ollama calcule sur le processeur.
function acceleration(hw) {
  if (hw.platform === 'darwin' && hw.arch === 'arm64')
    return {
      kind: 'apple',
      label: 'Puce Apple : la carte graphique intégrée accélère les modèles (mémoire partagée).',
      memoryGB: hw.memoryGB,
    };
  const nvidia = (hw.gpus || []).find((g) => /nvidia/i.test(g.name) && g.vramGB);
  if (nvidia && hw.platform !== 'darwin')
    return {
      kind: 'gpu',
      label: `${nvidia.name} : accélère les modèles qui tiennent dans ses ${nvidia.vramGB} Go.`,
      memoryGB: nvidia.vramGB,
    };
  const amd = (hw.gpus || []).find((g) => /amd|radeon/i.test(g.name) && g.vramGB >= 8);
  if (amd && hw.platform !== 'darwin')
    return {
      kind: 'gpu',
      label: `${amd.name} : peut accélérer les modèles si elle est prise en charge par Ollama (ROCm).`,
      memoryGB: amd.vramGB,
    };
  return {
    kind: 'cpu',
    label:
      hw.platform === 'darwin'
        ? 'Mac Intel : Ollama n’utilise pas ces cartes graphiques, les modèles tournent sur le processeur.'
        : 'Aucune carte graphique utilisable par Ollama : les modèles tournent sur le processeur.',
    memoryGB: 0,
  };
}

// Mémoire nécessaire : fichier du modèle, plus le contexte et le fonctionnement (estimation).
const neededGB = (sizeBytes) => (sizeBytes / 1e9) * 1.2 + 1;

// Verdict pour un modèle de cette taille sur cet ordinateur.
function assessModel(sizeBytes, hw) {
  const need = neededGB(sizeBytes);
  const ram = hw.memoryGB;
  const accel = acceleration(hw);
  if (need > ram - 2)
    return {
      level: 'trop-gros',
      label: 'Trop gros',
      detail: `Il faudrait environ ${round1(need)} Go de mémoire ; l’ordinateur en a ${ram}.`,
    };
  const comfortable = need <= ram * 0.6;
  const inGpu = accel.kind === 'gpu' && need <= accel.memoryGB;
  return {
    level: comfortable ? 'confortable' : 'possible',
    label: comfortable ? 'Confortable' : 'Possible, mémoire juste',
    detail:
      `Environ ${round1(need)} Go de mémoire sur ${ram}.` +
      (inGpu
        ? ' Tient dans la carte graphique : rapide.'
        : accel.kind === 'apple'
          ? ' Accéléré par la puce Apple.'
          : accel.kind === 'gpu'
            ? ' Dépasse la mémoire de la carte graphique : en partie sur le processeur, plus lent.'
            : ' Sur le processeur : comptez quelques mots par seconde.') +
      (comfortable ? '' : ' Fermez les autres applications pendant l’utilisation.'),
  };
}
const round1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Vitesse de génération lisible : une personne lit environ 5 à 8 tokens par seconde.
function speedLabel(tokensPerSecond) {
  if (tokensPerSecond == null) return null;
  const v = round1(tokensPerSecond);
  if (tokensPerSecond >= 15) return `${v} tokens/s — rapide, plus vite que la lecture`;
  if (tokensPerSecond >= 6) return `${v} tokens/s — confortable, à peu près la vitesse de lecture`;
  if (tokensPerSecond >= 2) return `${v} tokens/s — lent, réponses longues à attendre`;
  return `${v} tokens/s — très lent`;
}

// Vitesses déjà mesurées par le Benchmark (comparaisons) : médiane par modèle.
function benchmarkSpeeds(records) {
  const byModel = new Map();
  for (const record of records || [])
    for (const r of record.results || []) {
      const s = r.stats;
      if (r.status !== 'done' || !s?.outputTokens || !s.outputMs) continue;
      if (!byModel.has(r.model)) byModel.set(r.model, []);
      byModel.get(r.model).push(s.outputTokens / (s.outputMs / 1000));
    }
  const result = {};
  for (const [model, list] of byModel) {
    list.sort((a, b) => a - b);
    const mid = Math.floor(list.length / 2);
    result[model] = {
      tokensPerSecond: list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2,
      answers: list.length,
    };
  }
  return result;
}

if (typeof module !== 'undefined')
  module.exports = { acceleration, neededGB, assessModel, speedLabel, benchmarkSpeeds };
