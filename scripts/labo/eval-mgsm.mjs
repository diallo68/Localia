// Exactitude en calcul (15 problèmes MGSM en français de la banque du Benchmark de Localia),
// corrigée automatiquement : la réponse « Réponse : nombre » est comparée au nombre attendu.
// Même moteur que Localia (node-llama-cpp), processeur seul, température 0.
//
// node eval-mgsm.mjs <modele.gguf> <serie-mgsm-fr.txt> [--json=resultat.json]
import { getLlama, LlamaChatSession, resolveChatWrapper } from 'node-llama-cpp';
import fs from 'node:fs/promises';

const [file, seriesFile] = process.argv.slice(2);
const output = process.argv.find((a) => a.startsWith('--json='))?.slice(7);
const series = await fs.readFile(seriesFile, 'utf8');
const questions = series
  .split(/^---$/m)
  .map((block) => {
    const id = block.match(/^## (\S+)/m)?.[1];
    const lines = block.split('\n').filter((l) => l.trim() && !/^(##|Catégorie|Attendu)/.test(l));
    const expected = block.match(/^Attendu : ([\d\s.,]+)/m)?.[1];
    return id && expected
      ? { id, question: lines.join('\n'), expected: Number(expected.replace(/\s/g, '').replace(',', '.')) }
      : null;
  })
  .filter(Boolean);

const llama = await getLlama();
const model = await llama.loadModel({ modelPath: file, gpuLayers: 0 });
const context = await model.createContext({ contextSize: 2048, threads: 8 });
const sequence = context.getSequence();
const results = [];
let correct = 0;
const started = Date.now();
for (const q of questions) {
  await sequence.clearHistory();
  const session = new LlamaChatSession({
    contextSequence: sequence,
    autoDisposeSequence: false,
    chatWrapper: resolveChatWrapper(model, { customWrapperSettings: { qwen: { thoughts: 'discourage' } } }),
  });
  const t = Date.now();
  const answer = await session.prompt(q.question, { maxTokens: 500, temperature: 0, budgets: { thoughtTokens: 0 } });
  const match = [...answer.matchAll(/R[ée]ponse\s*:\s*\**\s*(-?[\d\s.,]+)/gi)].at(-1);
  const value = match ? Number(match[1].trim().replace(/\s/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '')) : null;
  const ok = value !== null && Math.abs(value - q.expected) < 1e-6;
  if (ok) correct++;
  results.push({ id: q.id, expected: q.expected, value, ok, seconds: (Date.now() - t) / 1000 });
  process.stderr.write(`${q.id} ${ok ? 'juste' : 'faux'} (${value} / ${q.expected}) ${((Date.now() - t) / 1000).toFixed(0)} s\n`);
}
const summary = { file, correct, total: questions.length, minutes: (Date.now() - started) / 60000, results };
console.log(`${file.split('/').pop()} : ${correct}/${questions.length} justes en ${summary.minutes.toFixed(1)} min`);
if (output) await fs.writeFile(output, JSON.stringify(summary, null, 2));
await context.dispose();
await model.dispose();
