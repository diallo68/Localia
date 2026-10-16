// Rejoue, sur un nouveau modèle GGUF, les questions de séries déjà passées dans le Benchmark de
// Localia : mêmes messages (document compris), mêmes réglages, même moteur (node-llama-cpp, comme
// src/llama-worker.mjs). Les réponses sont enregistrées après chaque question : une coupure se
// reprend en relançant la même commande.
//
// node rejouer-series.mjs <comparisons.json> <modele.gguf> <sortie.json> [--nom=libellé]
//   [--series=titre1,titre2] [--fils=8]
import { getLlama, LlamaChatSession, resolveChatWrapper } from 'node-llama-cpp';
import fs from 'node:fs/promises';
import os from 'node:os';

const [comparisonsFile, modelFile, outputFile] = process.argv.slice(2);
const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (!outputFile) {
  console.error('Usage : node rejouer-series.mjs <comparisons.json> <modele.gguf> <sortie.json>');
  process.exit(1);
}
const name = option(
  'nom',
  modelFile
    .split('/')
    .pop()
    .replace(/\.gguf$/, ''),
);
const wanted = option('series', '')?.split(',').filter(Boolean);
const threads = Number(option('fils', Math.max(1, os.cpus().length / 2)));

// Séries d'origine : par défaut celles passées par plusieurs modèles.
const runs = JSON.parse(await fs.readFile(comparisonsFile, 'utf8')).filter((c) =>
  wanted.length ? wanted.includes(c.title) : c.models.length > 1,
);
const output = await fs
  .readFile(outputFile, 'utf8')
  .then(JSON.parse)
  .catch(() => ({
    model: name,
    file: modelFile,
    threads,
    machine: os.cpus()[0].model,
    results: [],
  }));
const done = new Set(output.results.map((r) => `${r.series}|${r.q}`));
const save = () => fs.writeFile(outputFile, JSON.stringify(output, null, 2));

// Historique au format Ollama → node-llama-cpp (comme history() dans src/llama-worker.mjs).
function history(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const items = system ? [{ type: 'system', text: system }] : [];
  const rest = messages.filter((m) => m.role !== 'system');
  const last = rest.pop();
  for (const m of rest)
    items.push(
      m.role === 'user'
        ? { type: 'user', text: m.content }
        : { type: 'model', response: [m.content] },
    );
  return { items, question: last.content };
}

const llama = await getLlama();
const model = await llama.loadModel({ modelPath: modelFile, gpuLayers: 0 });
let context = null;
let sequence = null;
let total = runs.reduce((n, c) => n + c.questions.length, 0);
let peakRss = 0;
const sampler = setInterval(() => (peakRss = Math.max(peakRss, process.memoryUsage().rss)), 500);

for (const run of runs) {
  for (const [q, question] of run.questions.entries()) {
    if (done.has(`${run.title}|${q}`)) continue;
    // Réglages réellement utilisés à l'époque (ceux du premier modèle de la série).
    const used = run.results.find((r) => r.q === q)?.used || {};
    const contextSize = used.num_ctx || 16384;
    if (context?.contextSize !== contextSize) {
      await context?.dispose();
      context = await model.createContext({ contextSize, threads });
      // Une seule séquence, vidée avant chaque question (comme dans Localia).
      sequence = context.getSequence();
    }
    await sequence.clearHistory();
    const session = new LlamaChatSession({
      contextSequence: sequence,
      autoDisposeSequence: false,
      chatWrapper: resolveChatWrapper(model, {
        customWrapperSettings: { gemma4: { reasoning: false }, qwen: { thoughts: 'discourage' } },
      }),
    });
    const { items, question: prompt } = history(question.sent.messages);
    session.setChatHistory(items);
    const started = Date.now();
    let firstToken = null;
    let result;
    try {
      result = await session.promptWithMeta(prompt, {
        maxTokens: used.num_predict > 0 ? used.num_predict : contextSize,
        temperature: used.temperature,
        topP: used.top_p,
        topK: used.top_k,
        seed: used.seed,
        budgets: used.think === false ? { thoughtTokens: 0 } : undefined,
        onResponseChunk: () => (firstToken ||= Date.now()),
      });
    } catch (error) {
      result = { response: [], stopReason: `erreur : ${error.message}` };
    }
    const end = Date.now();
    const text = result.response.filter((p) => typeof p === 'string').join('');
    const tokens = model.tokenize(text).length;
    output.results.push({
      series: run.title,
      q,
      label: question.label,
      category: question.category,
      text,
      stopReason: result.stopReason,
      stats: {
        promptTokens: model.tokenize(prompt).length,
        firstTokenSeconds: ((firstToken || end) - started) / 1000,
        totalSeconds: (end - started) / 1000,
        outputTokens: tokens,
        tokensPerSecond: firstToken && end > firstToken ? tokens / ((end - firstToken) / 1000) : 0,
      },
      used,
    });
    output.peakRssGB = peakRss / 1e9;
    await save();
    const s = output.results.at(-1).stats;
    console.log(
      `${output.results.length}/${total} ${question.label} : ${s.totalSeconds.toFixed(0)} s, ` +
        `${s.tokensPerSecond.toFixed(1)} jetons/s, ${result.stopReason}`,
    );
  }
}
clearInterval(sampler);
console.log(
  `FIN : ${output.results.length} réponses, mémoire max ${(peakRss / 1e9).toFixed(2)} Go`,
);
await context?.dispose();
await model.dispose();
