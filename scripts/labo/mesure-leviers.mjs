// Leviers de vitesse sur processeur, mesurés sur une vraie demande avec données (question P01 de la
// série mildiou du Benchmark : tableau de ~5 400 jetons puis question), même moteur que Localia.
//
// node mesure-leviers.mjs <modele.gguf> <comparisons.json> [--fils=8] [--lot=512] [--jetons=300]
//   [--recopie] [--cache] [--json=resultat.json]
//
//   lecture et écriture : jetons/s du préremplissage et de la génération ;
//   --recopie : ajoute une demande qui recopie le tableau, avec et sans InputLookupTokenPredictor ;
//   --cache : pose une 2e question sur le même tableau sans vider la séquence (préfixe réutilisé ?) ;
//   --intervalle=N : checkpoints tous les N jetons (modèles hybrides ou SWA ; 8192 par défaut).
import {
  getLlama,
  LlamaChatSession,
  resolveChatWrapper,
  InputLookupTokenPredictor,
} from 'node-llama-cpp';
import fs from 'node:fs/promises';

const [modelFile, comparisonsFile] = process.argv.slice(2);
const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const flag = (name) => process.argv.includes(`--${name}`);
const threads = Number(option('fils', 8));
const batchSize = Number(option('lot', 512));
const maxTokens = Number(option('jetons', 300));
const interval = option('intervalle', null);

const runs = JSON.parse(await fs.readFile(comparisonsFile, 'utf8'));
const p01 = runs.find((c) => c.title === 'serie-prediction-mildiou.txt').questions[0].sent
  .messages[0].content;
const cut = p01.lastIndexOf('\n\n');
const data = p01.slice(0, cut);
const QUESTIONS = {
  analyse: p01.slice(cut + 2),
  seconde: 'Combien de jours avec symptomes = 1 compte le tableau ? Donne le nombre seulement.',
  recopie:
    'Recopie telles quelles, sans commentaire, toutes les lignes du fichier où symptomes vaut 1.',
};

const llama = await getLlama();
const model = await llama.loadModel({ modelPath: modelFile, gpuLayers: 0 });
const wrapper = () =>
  resolveChatWrapper(model, {
    customWrapperSettings: { gemma4: { reasoning: false }, qwen: { thoughts: 'discourage' } },
  });
const result = {
  file: modelFile,
  threads,
  batchSize,
  maxTokens,
  interval,
  date: new Date().toISOString(),
  mesures: {},
};

// Une demande : temps avant le premier jeton produit (lecture), puis débit d'écriture compté sur
// les jetons réellement produits (onToken), après le premier lot.
async function ask(sequence, question, label) {
  const session = new LlamaChatSession({
    contextSequence: sequence,
    autoDisposeSequence: false,
    chatWrapper: wrapper(),
  });
  const before = sequence.tokenMeter.usedInputTokens;
  const predictedBefore = { ...sequence.tokenPredictions };
  const start = performance.now();
  let first = null;
  let firstBatch = 0;
  let produced = 0;
  const text = await session.prompt(`${data}\n\n${question}`, {
    maxTokens,
    temperature: 0,
    budgets: { thoughtTokens: 0 },
    onToken: (tokens) => {
      if (first == null) {
        first = performance.now();
        firstBatch = tokens.length;
      }
      produced += tokens.length;
    },
  });
  const end = performance.now();
  const read = sequence.tokenMeter.usedInputTokens - before;
  const after = sequence.tokenPredictions;
  const m = {
    jetonsLus: read,
    premierJetonSecondes: ((first ?? end) - start) / 1000,
    lectureJetonsParSeconde: first ? read / ((first - start) / 1000) : null,
    jetonsEcrits: produced,
    ecritureJetonsParSeconde:
      first && end > first && produced > firstBatch
        ? (produced - firstBatch) / ((end - first) / 1000)
        : null,
    predictions: Object.fromEntries(
      Object.keys(after).map((k) => [k, after[k] - (predictedBefore[k] || 0)]),
    ),
    debut: text.slice(0, 160),
  };
  result.mesures[label] = m;
  console.log(
    `${label} : ${read} jetons lus, premier jeton ${m.premierJetonSecondes.toFixed(1)} s ` +
      `(${m.lectureJetonsParSeconde?.toFixed(1)} j/s) ; ${produced} jetons écrits à ${m.ecritureJetonsParSeconde?.toFixed(2)} j/s` +
      (after.validated || after.refuted ? ` ; prédictions ${JSON.stringify(m.predictions)}` : ''),
  );
  return m;
}

// Chaque essai dans un contexte neuf (la prédiction se choisit à la création de la séquence).
async function withSequence(tokenPredictor, fn) {
  const context = await model.createContext({ contextSize: 8192, threads, batchSize });
  try {
    await fn(
      context.getSequence({
        ...(tokenPredictor && { tokenPredictor }),
        ...(interval && { checkpoints: { interval: Number(interval) } }),
      }),
    );
  } finally {
    await context.dispose();
  }
}
const output = option('json', null);
try {
  // Échauffement : pages du modèle chargées depuis le disque avant toute mesure.
  await withSequence(null, async (sequence) => {
    const session = new LlamaChatSession({
      contextSequence: sequence,
      autoDisposeSequence: false,
      chatWrapper: wrapper(),
    });
    await session.prompt('Bonjour', {
      maxTokens: 8,
      temperature: 0,
      budgets: { thoughtTokens: 0 },
    });
  });
  await withSequence(null, (sequence) => ask(sequence, QUESTIONS.analyse, 'analyse'));
  if (flag('cache')) {
    // Même 2e question : à froid, puis après une 1re question sur le même tableau.
    await withSequence(null, (sequence) => ask(sequence, QUESTIONS.seconde, 'seconde-a-froid'));
    await withSequence(null, async (sequence) => {
      await ask(sequence, QUESTIONS.analyse, 'premiere-question');
      await ask(sequence, QUESTIONS.seconde, 'seconde-apres-premiere');
    });
  }
  if (flag('recopie')) {
    await withSequence(null, (sequence) =>
      ask(sequence, QUESTIONS.recopie, 'recopie-sans-prediction'),
    );
    await withSequence(new InputLookupTokenPredictor(), (sequence) =>
      ask(sequence, QUESTIONS.recopie, 'recopie-avec-prediction'),
    );
  }
} finally {
  if (output) await fs.writeFile(output, JSON.stringify(result, null, 2));
  await model.dispose();
}
