// Mesure de la recherche dans les documents d'un projet, avant de changer de méthode.
// Corpus : les 15 documents PDF de la banque du Benchmark réunis dans un seul projet ; questions :
// celles des séries A, B et C dont la réponse attendue indique la page. Pour chaque méthode et
// chaque budget, on mesure si les passages choisis contiennent la page attendue (rappel), le rang
// du premier bon passage, le temps de calcul et la mémoire.
// Option --modele=nom : chaque question est aussi posée à ce modèle (Ollama) avec les extraits
// choisis, et les citations de la réponse sont vérifiées (citations non retrouvées ou introuvables).
//
// node scripts/mesure-recherche.cjs [--modele=qwen3:8b] [--json=resultats.json]
const fs = require('node:fs/promises');
const path = require('node:path');
const { extractPdf } = require('../src/documents.cjs');
const { projectDocumentsContext } = require('../src/project-docs.cjs');
const { scorePassages } = require('../src/retrieval.js');
const { checkProjectSources } = require('../src/verify.js');

const BANK = path.join(__dirname, '..', 'benchmark', 'banque');
const SERIES = [
  ['serie-A-rapport.txt', 'doc-A-rapport-campagne-dalaba-2025.pdf'],
  ['serie-B-article.txt', 'doc-B-article-prevision-mildiou.pdf'],
  ['serie-C-note.txt', 'doc-C-note-technique-donnees-meteo.pdf'],
];
const METHODS = (
  process.argv.find((a) => a.startsWith('--methodes='))?.slice(11) || 'mots,bm25,hybride'
).split(',');
const BUDGETS = (process.argv.find((a) => a.startsWith('--budgets='))?.slice(10) || '3000,6000')
  .split(',')
  .map(Number);
const option = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;

// Questions d'une série avec la ou les pages attendues (« page 2 », « pages 3 et 4 », « p. 5 »).
function questions(text, docName) {
  return text
    .split(/^---$/m)
    .map((block) => {
      const id = block.match(/^## (\S+)/m)?.[1];
      const question = block
        .split('\n')
        .find((l) => l.trim() && !/^(##|Catégorie|Attendu)/.test(l));
      const expected = block.match(/^Attendu : (.*)$/m)?.[1] || '';
      const pages = new Set();
      for (const m of expected.matchAll(/pages?\s+((?:\d+(?:\s*(?:,|et|à|-)\s*)?)+)/gi))
        for (const n of m[1].match(/\d+/g)) pages.add(Number(n));
      return id && question && pages.size ? { id, question, pages: [...pages], docName } : null;
    })
    .filter(Boolean);
}

// Réponse lue en flux : sans flux, Node abandonne une requête dont l'en-tête tarde plus de
// 5 minutes (longue réponse d'un gros modèle sur processeur).
async function ask(model, system, question) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      stream: true,
      think: false,
      options: { temperature: 0, num_ctx: 8192, num_predict: 700 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama : ${response.status}`);
  let text = '';
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) text += JSON.parse(line).message?.content || '';
  }
  if (buffer.trim()) text += JSON.parse(buffer).message?.content || '';
  return text;
}

(async () => {
  const files = [
    ...(await fs.readdir(path.join(BANK, 'documents'))).map((f) => path.join(BANK, 'documents', f)),
    ...(await fs.readdir(path.join(BANK, 'metiers', 'documents'))).map((f) =>
      path.join(BANK, 'metiers', 'documents', f),
    ),
  ].filter((f) => f.endsWith('.pdf'));
  const docs = [];
  for (const file of files) {
    const extracted = await extractPdf(file);
    docs.push({
      id: path.basename(file),
      name: path.basename(file),
      type: 'pdf',
      pages: extracted.pages,
    });
  }
  const all = [];
  for (const [serie, docName] of SERIES)
    all.push(...questions(await fs.readFile(path.join(BANK, serie), 'utf8'), docName));
  const characters = docs.reduce((n, d) => n + d.pages.reduce((m, p) => m + p.text.length, 0), 0);
  console.log(
    `Corpus : ${docs.length} documents, ${characters.toLocaleString('fr-FR')} caractères ; ${all.length} questions avec page attendue.\n`,
  );
  const model = option('modele');
  const project = { name: 'Banque du Benchmark' };
  const results = [];
  // Réponses déjà obtenues, par modèle, consigne et question. Avec --cache=fichier, chacune est
  // enregistrée dès qu'elle arrive : une mesure arrêtée reprend là où elle s'était arrêtée.
  const cacheFile = option('cache');
  const answers = new Map(
    cacheFile
      ? Object.entries(JSON.parse(await fs.readFile(cacheFile, 'utf8').catch(() => '{}')))
      : [],
  );
  const details = [];
  let asked = 0;
  for (const budget of BUDGETS)
    for (const method of METHODS) {
      let found = 0;
      let reciprocal = 0;
      let insufficient = 0;
      let citations = 0;
      let wrongCitations = 0;
      const statuses = {};
      let uncitedLines = 0;
      let withoutCitation = 0;
      let citedExpected = 0;
      let citedWithoutPage = 0;
      const askTimes = [];
      const misses = [];
      const heapBefore = process.memoryUsage().heapUsed;
      const start = process.hrtime.bigint();
      const contexts = all.map((q) => {
        const context = projectDocumentsContext(project, docs, q.question, budget, 'fr', method);
        return { q, context };
      });
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      const heap = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
      for (const { q, context } of contexts) {
        const hit = context.passages.some((p) => p.name === q.docName && q.pages.includes(p.page));
        if (hit) found++;
        else misses.push(q.id);
        if (context.insufficient) insufficient++;
        // Rang du premier bon passage dans le classement complet.
        const chunks = docs.flatMap((d) =>
          d.pages.flatMap((p) => {
            const list = [];
            for (let o = 0; o < p.text.length; o += 1400)
              list.push({ name: d.name, page: p.number, text: p.text.slice(o, o + 1400) });
            return list;
          }),
        );
        const scores = scorePassages(
          chunks.map((c) => c.text),
          q.question,
          method,
        );
        const order = chunks
          .map((c, i) => ({ ...c, score: scores[i] }))
          .sort((a, b) => b.score - a.score);
        const rank = order.findIndex((c) => c.name === q.docName && q.pages.includes(c.page));
        if (rank >= 0) reciprocal += 1 / (rank + 1);
        if (model) {
          // Même consigne et mêmes extraits qu'une méthode déjà mesurée : réponse reprise
          // (température 0), pas reposée.
          const key = `${model}\n\n${context.text}\n\n${q.question}`;
          let entry = answers.get(key);
          if (!entry) {
            const started = Date.now();
            const answer = await ask(model, context.text, q.question);
            entry = { answer, ms: Date.now() - started };
            answers.set(key, entry);
            if (cacheFile) {
              await fs.writeFile(cacheFile + '.tmp', JSON.stringify(Object.fromEntries(answers)));
              await fs.rename(cacheFile + '.tmp', cacheFile);
            }
            asked++;
            process.stderr.write(
              `  ${asked} réponse(s) · ${q.id} · ${method} · ${budget} car. · ${Math.round(entry.ms / 1000)} s\n`,
            );
          }
          askTimes.push(entry.ms);
          const report = checkProjectSources(entry.answer, docs);
          citations += report.citations.length;
          for (const c of report.citations) statuses[c.status] = (statuses[c.status] || 0) + 1;
          wrongCitations += report.citations.filter((c) =>
            ['non-trouve', 'introuvable'].includes(c.status),
          ).length;
          uncitedLines += report.uncited.length;
          if (!report.citations.length) withoutCitation++;
          // Page attendue citée : bon document et bonne page ; document attendu cité sans page :
          // compté à part.
          if (report.citations.some((c) => c.name === q.docName && q.pages.includes(c.number)))
            citedExpected++;
          else if (report.citations.some((c) => c.name === q.docName && !c.number))
            citedWithoutPage++;
          details.push({
            budget,
            method,
            id: q.id,
            expected: q.pages,
            citations: report.citations.map((c) => ({
              name: c.name,
              place: c.place,
              number: c.number,
              status: c.status,
              claim: c.claim,
            })),
            uncited: report.uncited,
            answer: entry.answer,
          });
        }
      }
      const row = {
        budget,
        method,
        recall: found / all.length,
        mrr: reciprocal / all.length,
        insufficient,
        ms: elapsed / all.length,
        heapKo: Math.round(heap / 1024),
        misses,
        ...(model
          ? {
              citations,
              wrongCitations,
              statuses,
              uncitedLines,
              withoutCitation,
              citedExpected,
              citedWithoutPage,
              // Médiane : une mise en veille de l'ordinateur fausse quelques durées.
              secondsPerAnswer: Math.round(
                [...askTimes].sort((a, b) => a - b)[askTimes.length >> 1] / 1000,
              ),
            }
          : {}),
      };
      results.push(row);
      console.log(
        `Budget ${budget} car. · ${method.padEnd(4)} : page attendue retrouvée ${found}/${all.length} ` +
          `(${Math.round(row.recall * 100)} %) · rang réciproque moyen ${row.mrr.toFixed(2)} · ` +
          `contexte signalé insuffisant ${insufficient} · ${row.ms.toFixed(1)} ms/question · ` +
          `mémoire +${row.heapKo} Ko` +
          (model
            ? `\n    réponses : ${citations} citation(s) (${Object.entries(statuses)
                .map(([k, v]) => `${k} ${v}`)
                .join(', ')}) ; non retrouvées ou introuvables ${wrongCitations}/${citations} ; ` +
              `lignes chiffrées sans source ${uncitedLines} ; réponses sans citation ${withoutCitation}/${all.length} ; ` +
              `page attendue citée ${citedExpected}/${all.length} (document attendu sans page : ${citedWithoutPage}) ; ${row.secondsPerAnswer} s par réponse (médiane)`
            : '') +
          (misses.length ? `\n    manquées : ${misses.join(', ')}` : ''),
      );
    }
  // Proximité sémantique (facultative) : --embed=modèle d'Ollama ; passages et questions changés
  // en vecteurs, passages classés par similarité cosinus. Mesure seulement : non utilisée par Localia.
  const embedModel = option('embed');
  if (embedModel) {
    const embed = async (input) => {
      const response = await fetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        body: JSON.stringify({ model: embedModel, input }),
      });
      if (!response.ok) throw new Error(`Ollama : ${response.status} ${await response.text()}`);
      return (await response.json()).embeddings;
    };
    const cosine = (a, b) => {
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      return dot / Math.sqrt(na * nb);
    };
    const chunks = docs.flatMap((d) =>
      d.pages.flatMap((p) => {
        const list = [];
        for (let o = 0; o < p.text.length; o += 1400)
          list.push({ name: d.name, page: p.number, text: p.text.slice(o, o + 1400) });
        return list;
      }),
    );
    const start = Date.now();
    const vectors = [];
    for (let i = 0; i < chunks.length; i += 8)
      vectors.push(...(await embed(chunks.slice(i, i + 8).map((c) => c.text))));
    const indexing = Date.now() - start;
    for (const budget of BUDGETS) {
      let found = 0;
      let reciprocal = 0;
      const misses = [];
      const askStart = Date.now();
      for (const q of all) {
        const [v] = await embed([q.question]);
        const order = chunks
          .map((c, i) => ({ ...c, score: cosine(v, vectors[i]) }))
          .sort((a, b) => b.score - a.score);
        let size = 0;
        const selected = [];
        for (const c of order) {
          if (size + c.text.length + 60 > budget) continue;
          selected.push(c);
          size += c.text.length + 60;
        }
        if (selected.some((c) => c.name === q.docName && q.pages.includes(c.page))) found++;
        else misses.push(q.id);
        const rank = order.findIndex((c) => c.name === q.docName && q.pages.includes(c.page));
        if (rank >= 0) reciprocal += 1 / (rank + 1);
      }
      const row = {
        budget,
        method: `embed:${embedModel}`,
        recall: found / all.length,
        mrr: reciprocal / all.length,
        indexingMs: indexing,
        ms: (Date.now() - askStart) / all.length,
        misses,
      };
      results.push(row);
      console.log(
        `Budget ${budget} car. · sémantique (${embedModel}) : page attendue retrouvée ${found}/${all.length} ` +
          `(${Math.round(row.recall * 100)} %) · rang réciproque moyen ${row.mrr.toFixed(2)} · ` +
          `indexation ${(indexing / 1000).toFixed(1)} s pour ${chunks.length} passages · ${row.ms.toFixed(0)} ms/question` +
          (misses.length ? `\n    manquées : ${misses.join(', ')}` : ''),
      );
    }
  }
  const output = option('json');
  if (output)
    await fs.writeFile(
      output,
      JSON.stringify({ date: new Date().toISOString(), model, results, details }, null, 2),
    );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
