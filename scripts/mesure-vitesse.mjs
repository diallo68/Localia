// Vitesse et mémoire réelles d'un modèle GGUF avec le moteur de Localia (node-llama-cpp), sur cet
// ordinateur : chargement, lecture de la question (préremplissage), premier mot, génération
// soutenue, mémoire résidente maximale. Aucun réglage n'est modifié dans Localia.
//
// node scripts/mesure-vitesse.mjs <fichier.gguf> [--contexte=2048] [--fils=8] [--gpu=0]
//   [--jetons=200] [--json=resultat.json]
import { getLlama, LlamaChatSession, resolveChatWrapper } from 'node-llama-cpp';
import fs from 'node:fs/promises';
import os from 'node:os';

const file = process.argv[2];
const option = (name, fallback) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
};
if (!file) {
  console.error('Usage : node scripts/mesure-vitesse.mjs <fichier.gguf> [--contexte=2048] ...');
  process.exit(1);
}
const contextSize = Number(option('contexte', 2048));
const threads = Number(option('fils', Math.max(1, os.cpus().length / 2)));
const gpuLayers = option('gpu', '0') === 'max' ? 'max' : Number(option('gpu', '0'));
const maxTokens = Number(option('jetons', 200));

// Mémoire résidente du processus, relevée toutes les 200 ms (le maximum est gardé).
let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 200);
const seconds = (start) => Number(process.hrtime.bigint() - start) / 1e9;

const QUESTION =
  'Explique en français, en cinq phrases, pourquoi le mildiou de la pomme de terre se développe ' +
  'surtout quand l’humidité est élevée, et donne deux mesures de prévention.';

const result = { file, contextSize, threads, gpuLayers, date: new Date().toISOString() };
try {
  const llama = await getLlama();
  result.backend = llama.gpu || 'cpu';
  let start = process.hrtime.bigint();
  const model = await llama.loadModel({ modelPath: file, gpuLayers });
  result.loadSeconds = seconds(start);
  const context = await model.createContext({ contextSize, threads });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    chatWrapper: resolveChatWrapper(model, {
      customWrapperSettings: { qwen: { thoughts: 'discourage' }, gemma4: { reasoning: false } },
    }),
  });
  let firstToken = null;
  let tokens = 0;
  start = process.hrtime.bigint();
  const answer = await session.prompt(QUESTION, {
    maxTokens,
    temperature: 0,
    budgets: { thoughtTokens: 0 },
    onTextChunk: () => {},
    onToken: (chunk) => {
      if (firstToken == null) firstToken = seconds(start);
      tokens += chunk.length;
    },
  });
  const total = seconds(start);
  result.firstTokenSeconds = firstToken;
  result.tokens = tokens;
  result.generationSeconds = total - (firstToken ?? 0);
  result.tokensPerSecond = tokens > 1 ? (tokens - 1) / result.generationSeconds : null;
  result.answer = answer;
  await context.dispose();
  await model.dispose();
} catch (error) {
  result.error = error.message;
}
clearInterval(sampler);
result.peakRssGB = Math.round((peakRss / 1e9) * 100) / 100;

console.log(
  result.error
    ? `ÉCHEC : ${result.error}`
    : `${file.split('/').pop()} · moteur ${result.backend} · contexte ${contextSize} · ${threads} fils\n` +
        `  chargement ${result.loadSeconds.toFixed(1)} s · premier mot ${result.firstTokenSeconds?.toFixed(1)} s · ` +
        `${result.tokens} jetons à ${result.tokensPerSecond?.toFixed(2)} jetons/s · mémoire max ${result.peakRssGB} Go\n` +
        `  réponse : ${result.answer.replace(/\s+/g, ' ').slice(0, 300)}`,
);
const output = option('json', null);
if (output) await fs.writeFile(output, JSON.stringify(result, null, 2));
