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
const METHODS = ['mots', 'bm25', 'hybride'];
const BUDGETS = [3000, 6000];
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

async function ask(model, system, question) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      options: { temperature: 0, num_ctx: 8192 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama : ${response.status}`);
  return (await response.json()).message.content;
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
  for (const budget of BUDGETS)
    for (const method of METHODS) {
      let found = 0;
      let reciprocal = 0;
      let insufficient = 0;
      let citations = 0;
      let wrongCitations = 0;
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
          const answer = await ask(model, context.text, q.question);
          const report = checkProjectSources(answer, docs);
          citations += report.citations.length;
          wrongCitations += report.citations.filter((c) =>
            ['non-trouve', 'introuvable'].includes(c.status),
          ).length;
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
        ...(model ? { citations, wrongCitations } : {}),
      };
      results.push(row);
      console.log(
        `Budget ${budget} car. · ${method.padEnd(4)} : page attendue retrouvée ${found}/${all.length} ` +
          `(${Math.round(row.recall * 100)} %) · rang réciproque moyen ${row.mrr.toFixed(2)} · ` +
          `contexte signalé insuffisant ${insufficient} · ${row.ms.toFixed(1)} ms/question · ` +
          `mémoire +${row.heapKo} Ko` +
          (model
            ? ` · citations non retrouvées ou introuvables ${wrongCitations}/${citations}`
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
      JSON.stringify({ date: new Date().toISOString(), model, results }, null, 2),
    );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
