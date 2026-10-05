// Découpe d'une série de questions. Chargé comme script dans l'interface et par les tests Node.
// Format : questions séparées par une ligne « --- ». Dans chaque question, facultatif :
// « ## Titre » en première ligne, « Catégorie : … » sur une ligne, et « Attendu : … » (jusqu'à la
// fin) pour la réponse attendue. Ni la catégorie ni la réponse attendue ne sont envoyées aux modèles.
const MAX_QUESTIONS = 100;
const MAX_PROMPT = 20000;

function parseQuestions(text) {
  const blocks = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/^[ \t]*---[ \t]*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length > MAX_QUESTIONS)
    throw new Error(`Une série est limitée à ${MAX_QUESTIONS} questions.`);
  return blocks.map((block, index) => {
    let lines = block.split('\n');
    let label = `Q${index + 1}`;
    const title = /^#{1,6}\s+(.+)$/.exec(lines[0].trim());
    if (title) {
      label = title[1].trim().slice(0, 60);
      lines = lines.slice(1);
    }
    let category = '';
    const cat = lines.findIndex((l) => /^\s*(?:cat[ée]gorie|category)\s*:/i.test(l));
    const firstExpected = lines.findIndex((l) => /^\s*(?:attendu|expected)\s*:/i.test(l));
    if (cat >= 0 && (firstExpected < 0 || cat < firstExpected)) {
      category = lines[cat]
        .replace(/^\s*(?:cat[ée]gorie|category)\s*:\s*/i, '')
        .trim()
        .slice(0, 40);
      lines = lines.filter((_, i) => i !== cat);
    }
    let expected = '';
    const at = lines.findIndex((l) => /^\s*(?:attendu|expected)\s*:/i.test(l));
    if (at >= 0) {
      expected = [lines[at].replace(/^\s*(?:attendu|expected)\s*:\s*/i, ''), ...lines.slice(at + 1)]
        .join('\n')
        .trim();
      lines = lines.slice(0, at);
    }
    const prompt = lines.join('\n').trim();
    if (!prompt) throw new Error(`La question « ${label} » est vide.`);
    if (prompt.length > MAX_PROMPT)
      throw new Error(`La question « ${label} » dépasse 20 000 caractères.`);
    const question = { label, prompt };
    if (category) question.category = category;
    if (expected) question.expected = expected;
    return question;
  });
}

// Texte d'une série, au même format, pour « Réutiliser la tâche ».
function formatQuestions(questions) {
  const [only] = questions;
  if (questions.length === 1 && only.label === 'Q1' && !only.expected && !only.category)
    return questions[0].prompt;
  return questions
    .map(
      (q) =>
        `## ${q.label}\n${q.category ? 'Catégorie : ' + q.category + '\n' : ''}` +
        `${q.prompt}${q.expected ? '\nAttendu : ' + q.expected : ''}`,
    )
    .join('\n---\n');
}

if (typeof module !== 'undefined') module.exports = { parseQuestions, formatQuestions };
