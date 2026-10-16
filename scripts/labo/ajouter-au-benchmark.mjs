// Ajoute un modèle rejoué hors de Localia (rejouer-series.mjs) aux comparaisons du Benchmark,
// puis applique des fichiers de notes CSV. Localia doit être fermé.
// node ajouter-au-benchmark.mjs comparisons.json series.json integre/nom --digest=sha256:… --origine=… notes1.csv notes2.csv
// --jetons-de=integre/autre : nombre de jetons lus repris d'un modèle de même tokenizer mesuré par
// Localia (rejouer-series.mjs ne compte que le dernier message, pas l'historique des conversations).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { checkCalculations } = require('../../src/verify.js');
const { applyGrades } = require('../../src/benchmark-stats.js');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const option = (name) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const [comparisonsFile, seriesFile, modelName, ...gradeFiles] = args;
const records = JSON.parse(fs.readFileSync(comparisonsFile, 'utf8'));
const series = JSON.parse(fs.readFileSync(seriesFile, 'utf8'));

let added = 0;
for (const record of records) {
  const answers = series.results.filter((r) => r.series === record.title);
  if (!answers.length) continue;
  if (answers.length !== record.questions.length)
    throw new Error(
      `${record.title} : ${answers.length} réponses pour ${record.questions.length} questions`,
    );
  record.results = record.results.filter((r) => r.model !== modelName);
  if (!record.models.includes(modelName)) record.models.push(modelName);
  record.env.models[modelName] = {
    engine: 'integre (llama.cpp)',
    digest: option('digest') || null,
    size: Number(option('taille')) || null,
    family: option('famille') || null,
    parameterSize: option('parametres') || null,
    quantization: option('quantification') || null,
    source: 'labo',
    origin: option('origine') || series.file,
  };
  for (const a of answers) {
    if (record.questions[a.q]?.label !== a.label)
      throw new Error(`${record.title} q${a.q} : ${a.label} ≠ question`);
    const first = Math.round(a.stats.firstTokenSeconds * 1000);
    const total = Math.round(a.stats.totalSeconds * 1000);
    const twin = record.results.find((r) => r.q === a.q && r.model === option('jetons-de'));
    record.results.push({
      q: a.q,
      model: modelName,
      status: 'done',
      text: a.text,
      stats: {
        totalMs: total,
        loadMs: null,
        promptTokens: twin?.stats?.promptTokens ?? a.stats.promptTokens,
        promptMs: first,
        outputTokens: a.stats.outputTokens,
        outputMs: total - first,
        doneReason: a.stopReason === 'maxTokens' ? 'length' : 'stop',
      },
      used: a.used,
      checks: { calculations: checkCalculations(a.text) },
    });
    added++;
  }
}
console.log(`${added} réponses ajoutées`);
for (const file of gradeFiles) {
  const { applied, rejected } = applyGrades(records, fs.readFileSync(file, 'utf8'));
  console.log(
    `${file} : ${applied} notes appliquées, ${rejected.length} refusées`,
    rejected.slice(0, 5),
  );
  if (rejected.length) process.exit(1);
}
fs.writeFileSync(comparisonsFile, JSON.stringify(records));
