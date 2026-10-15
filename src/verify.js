// Vérifications automatiques d'une réponse, sans modèle : citations, pages, calculs, chiffres,
// instructions piégées dans le document. Utilisé par le processus principal et par les tests.
const EXCERPT_SIZE = 1400; // même découpage que documentContext (documents.cjs)

const normalizeText = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// --- Nombres -----------------------------------------------------------------------------------

// Valeurs possibles d'un nombre écrit à la française ou à l'anglaise (1 250 ; 1,250 ; 8,775 ; 0.95).
function numberCandidates(token) {
  let t = String(token).replace(/[\s  ]/g, '');
  const percent = t.endsWith('%');
  t = t.replace(/%$/, '');
  if (!/^\d[\d.,]*$/.test(t)) return [];
  const values = new Set();
  const lastComma = t.lastIndexOf(',');
  const lastPoint = t.lastIndexOf('.');
  if (lastComma >= 0 && lastPoint >= 0) {
    const decimal = lastComma > lastPoint ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    values.add(Number(t.split(thousands).join('').replace(decimal, '.')));
  } else if (lastComma >= 0 || lastPoint >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const grouped = new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(t);
    if (grouped) values.add(Number(t.split(sep).join('')));
    if ((t.match(new RegExp(`\\${sep}`, 'g')) || []).length === 1)
      values.add(Number(t.replace(sep, '.')));
  } else values.add(Number(t));
  const result = [...values].filter(Number.isFinite);
  return percent ? [...result, ...result.map((v) => v / 100)] : result;
}

const NUMBER_RE = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?%?|\d+(?:[.,]\d+)*%?/g;

// --- Calculs -----------------------------------------------------------------------------------

// Mise en forme des formules LaTeX et des unités pour ne garder que l'arithmétique.
function simplifyMath(line) {
  return (
    line
      .replace(/\$+/g, ' ')
      .replace(/\\text\{[^}]*\}/g, ' ')
      .replace(/\\(left|right|,|;|!|quad)/g, ' ')
      .replace(/\\times|\\cdot/g, '×')
      .replace(/\\approx/g, '≈')
      .replace(/\^\{([^{}]+)\}/g, '^($1)')
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))')
      .replace(/[{}]/g, ' ')
      .replace(/\*\*/g, ' ')
      .replace(/(\d)\s+[xX]\s+(?=\d)/g, '$1 × ')
      .replace(/[A-Za-zÀ-ÿ€$£]+\s*\/\s*[A-Za-zÀ-ÿ€$£]+/g, ' ') // unités comme t/ha, EUR/kg
      .replace(/[−–]/g, '-')
      // Unités placées entre un nombre et un opérateur (« 45 000 kg × 0,35 », « 12 420 EUR - 300 EUR = »).
      // Au plus 4 mots, séparés par des espaces : pas de retour en arrière exponentiel.
      .replace(
        /(\d)\s*(?:[A-Za-zÀ-ÿ€$£]{1,20}\.?[ \t]+){0,3}[A-Za-zÀ-ÿ€$£]{1,20}\.?[ \t]*(?=[-+×*·/÷^=≈~)])/g,
        '$1 ',
      )
      .replace(/(\d)\s*[A-Za-zÀ-ÿ€$£]+\.?\s*$/g, '$1')
  );
}

// Évalue une expression (nombres, + - × / ^, parenthèses) pour chaque lecture possible des nombres.
function evaluateAll(expression) {
  const tokens = expression.match(
    /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?%?|\d+(?:[.,]\d+)*%?|[-+×*·/÷^()]/g,
  );
  if (!tokens) return [];
  const clean = tokens.map((t) => (/\d/.test(t) ? t.trim() : t)).filter(Boolean);
  const numbers = clean.filter((t) => /\d/.test(t)).map(numberCandidates);
  if (!numbers.length || numbers.some((c) => !c.length)) return [];
  const combos = numbers.reduce((acc, c) => acc.flatMap((a) => c.map((v) => [...a, v])), [[]]);
  const results = [];
  for (const values of combos.slice(0, 64)) {
    let i = 0;
    let k = 0;
    const peek = () => clean[i];
    const next = () => clean[i++];
    const primary = () => {
      const t = next();
      if (t === '(') {
        const v = sum();
        if (next() !== ')') throw new Error('parenthèse');
        return v;
      }
      if (t === '-') return -factor();
      if (t !== undefined && /\d/.test(t)) return values[k++];
      throw new Error('jeton');
    };
    const factor = () => {
      let v = primary();
      if (peek() === '^') {
        next();
        v = v ** factor();
      }
      return v;
    };
    const product = () => {
      let v = factor();
      while (['×', '*', '·', '/', '÷'].includes(peek())) {
        const op = next();
        const r = factor();
        v = op === '/' || op === '÷' ? v / r : v * r;
      }
      return v;
    };
    const sum = () => {
      let v = product();
      while (['+', '-'].includes(peek())) v = next() === '+' ? v + product() : v - product();
      return v;
    };
    try {
      const v = sum();
      if (i === clean.length && Number.isFinite(v)) results.push(v);
    } catch {
      // expression non reconnue : ignorée
    }
  }
  return results;
}

const hasOperator = (expression) => /\d[^\d]*[-+×*·/÷^]\s*[\d(]/.test(expression);
const MATH_CHARS = '\\d\\s\\u00a0\\u202f.,()+\\-×*·/÷^%';

function matches(left, right, approximate) {
  for (const a of left)
    for (const b of right) {
      const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
      if (Math.abs(a - b) / scale <= (approximate ? 0.02 : 0.005)) return true;
    }
  return false;
}

// Égalités écrites dans la réponse (« 40 × 25 = 1 000 », « (1,327)^10 ≈ 15,43 ») et leur exactitude.
function checkCalculations(text) {
  const checks = [];
  const seen = new Set();
  for (const raw of String(text).split('\n')) {
    const line = simplifyMath(raw);
    const parts = line.split(/(=|≈|~)/);
    for (let p = 1; p < parts.length - 1; p += 2) {
      const before = parts[p - 1];
      const after = parts[p + 1];
      let left = (before.match(new RegExp(`[${MATH_CHARS}]+$`)) || [''])[0].trim();
      // Tiret de liste en début de ligne (« - 45 000 × 0,35 = … ») : ce n'est pas un signe moins.
      if (p === 1 && /^-\s/.test(left) && !before.slice(0, before.lastIndexOf(left)).trim())
        left = left.replace(/^-\s+/, '');
      const right = (after.match(new RegExp(`^[${MATH_CHARS}]+`)) || [''])[0].trim();
      if (!/\d/.test(left) || !/\d/.test(right)) continue;
      if (!hasOperator(left) && !hasOperator(right)) continue; // conversion d'unités, définition…
      const a = evaluateAll(left);
      const b = evaluateAll(right);
      if (!a.length || !b.length) continue;
      const expression = `${left} ${parts[p]} ${right}`.replace(/\s+/g, ' ');
      if (seen.has(expression)) continue;
      seen.add(expression);
      // Changement d'écriture en puissance de 10 (« 312,4 milliards = 312,4 × 10^9 ») : ignoré.
      const powerOfTen = (e) => /^\(?[\d\s.,]+\)?\s*[×*·]\s*10\s*\^/.test(e);
      if ((powerOfTen(left) && !hasOperator(right)) || (powerOfTen(right) && !hasOperator(left)))
        continue;
      const ok = matches(a, b, parts[p] !== '=');
      // Valeur exacte affichée : la lecture du calcul la plus proche du résultat écrit.
      const closest = a.reduce(
        (best, v) => {
          const gap = Math.min(...b.map((w) => Math.abs(v - w) / Math.max(Math.abs(w), 1e-12)));
          return gap < best.gap ? { v, gap } : best;
        },
        { v: a[0], gap: Infinity },
      ).v;
      checks.push({ expression, ok, expected: ok ? null : closest });
    }
  }
  return checks;
}

// --- Document ----------------------------------------------------------------------------------

// Pages et extraits cités dans la réponse : existent-ils dans le document ?
function checkPageReferences(text, doc) {
  const problems = [];
  const pageCount = doc.pages.length;
  const excerpts = (n) =>
    Math.max(1, Math.ceil((doc.pages[n - 1]?.text.length || 0) / EXCERPT_SIZE));
  const seen = new Set();
  for (const m of String(text).matchAll(/page\s+(\d+)\s*,\s*extrait\s+(\d+)/gi)) {
    const [page, excerpt] = [Number(m[1]), Number(m[2])];
    const key = `${page}-${excerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seen.add('p' + page);
    if (page < 1 || page > pageCount)
      problems.push({ reference: m[0], reason: `le document a ${pageCount} pages` });
    else if (excerpt > excerpts(page))
      problems.push({
        reference: m[0],
        reason: `la page ${page} n’a que ${excerpts(page)} extrait(s)`,
      });
  }
  for (const m of String(text).matchAll(/\b(?:p\.|pages?)\s*(\d+)(?:\s*(?:-|–|à)\s*(\d+))?/gi)) {
    for (const page of [Number(m[1]), m[2] ? Number(m[2]) : null].filter(Boolean)) {
      if (page > pageCount && !seen.has('p' + page)) {
        seen.add('p' + page);
        problems.push({ reference: m[0], reason: `le document a ${pageCount} pages` });
      }
    }
  }
  return problems;
}

// Passages cités entre guillemets ou en bloc de citation : présents mot pour mot dans le document ?
function checkQuotes(text, doc, question = '') {
  const quotes = [];
  const add = (q) => {
    const clean = q.trim();
    if (clean.split(/\s+/).length >= 5 && !quotes.includes(clean)) quotes.push(clean);
  };
  for (const m of String(text).matchAll(/«\s*([^»]{20,}?)\s*»|“([^”]{20,}?)”|"([^"\n]{20,}?)"/g))
    add(m[1] || m[2] || m[3]);
  for (const line of String(text).split('\n'))
    if (/^\s*>/.test(line)) add(line.replace(/^\s*>\s*/, '').replace(/^\*+|\*+$/g, ''));
  const pages = doc.pages.map((p) => ({ number: p.number, text: normalizeText(p.text) }));
  const asked = normalizeText(question);
  return quotes
    .filter((quote) => !asked.includes(normalizeText(quote))) // reprise de la question posée
    .slice(0, 20)
    .map((quote) => {
      const fragments = quote
        .split(/\.\.\.|…|\[\.\.\.\]/)
        .map(normalizeText)
        .filter((f) => f.split(' ').length >= 3);
      const found = pages
        .filter((p) => fragments.length && fragments.every((f) => p.text.includes(f)))
        .map((p) => p.number);
      return { quote: quote.slice(0, 160), found };
    });
}

// Nombres de la réponse absents du document (ni dans la question) : calculés ou inventés.
function checkNumbers(text, doc, question = '') {
  const known = new Set();
  const addAll = (source) => {
    for (const token of String(source).match(NUMBER_RE) || [])
      for (const v of numberCandidates(token)) known.add(Math.round(v * 10000) / 10000);
  };
  for (const page of doc.pages) addAll(page.text);
  addAll(question);
  const cleaned = String(text)
    .replace(/page\s+\d+\s*,\s*extrait\s+\d+/gi, ' ')
    .replace(/\b(?:p\.|pages?|extraits?)\s*\d+(?:\s*(?:-|–|à)\s*\d+)?/gi, ' ')
    .replace(/\[\d+\]/g, ' ');
  const missing = [];
  for (const token of cleaned.match(NUMBER_RE) || []) {
    const values = numberCandidates(token);
    if (!values.length) continue;
    if (values.every((v) => Number.isInteger(v) && Math.abs(v) < 10)) continue; // listes, petits entiers
    if (values.some((v) => known.has(Math.round(v * 10000) / 10000))) continue;
    if (!missing.includes(token.trim())) missing.push(token.trim());
  }
  return missing.slice(0, 30);
}

// Phrases adressées à une IA dans un document (injection de consignes).
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)?\s*instructions/i,
  /(?:note|message|instruction)s?\s+(?:to|for)\s+(?:the\s+)?(?:ai|llm|assistant|language model)/i,
  /\b(?:reply|respond|answer)\s+only\s+with/i,
  /\byou\s+are\s+now\b/i,
  /\bsystem\s+prompt\b/i,
  /ignore[sz]?\s+(?:toutes\s+)?(?:les|tes|vos)\s+(?:instructions|consignes)\s+(?:précédentes|precedentes|ci-dessus)?/i,
  /oublie[sz]?\s+(?:toutes\s+)?(?:les|tes|vos)\s+(?:instructions|consignes)/i,
  /\bréponds?\s+uniquement\s+(?:par|avec)\b/i,
  /\btu\s+es\s+(?:maintenant|désormais)\b/i,
  /(?:note|message)\s+(?:à|a)\s+l['’]\s*(?:ia|assistant)/i,
];
function detectInjection(pages) {
  const alerts = [];
  for (const page of pages)
    for (const pattern of INJECTION_PATTERNS) {
      const m = pattern.exec(page.text);
      if (m) {
        const start = Math.max(0, m.index - 40);
        alerts.push({
          page: page.number,
          excerpt: page.text
            .slice(start, m.index + m[0].length + 80)
            .replace(/\s+/g, ' ')
            .trim(),
        });
        break;
      }
    }
  return alerts;
}

// --- Sources des documents d'un projet ------------------------------------------------------------
// Le modèle cite « [nom — page 2] », « (nom — diapositive 1) » ou « nom » seul. Chaque citation est
// comparée au passage cité : document et endroit existants, chiffres et mots de la phrase présents.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DOC_NAME_RE =
  /[[(]([^\][()\n]{1,160}?\.(?:pdf|docx|xlsx|pptx|csv|tsv|txt|md|json|png|jpe?g|webp|gif))\s*(?:[—–-]\s*(page|section|diapositive|slide|photo)\s*(\d+))?[^\][()\n]{0,40}[\])]/gi;
const valuesOf = (text) => {
  const values = [];
  for (const token of String(text).match(NUMBER_RE) || []) {
    const v = numberCandidates(token);
    // Petits entiers (listes, étapes) : rien à vérifier.
    if (v.length && !v.every((x) => Number.isInteger(x) && Math.abs(x) < 10))
      values.push({ token: token.trim(), values: v });
  }
  return values;
};
const round4 = (v) => Math.round(v * 10000) / 10000;
const WORD_RE = /[a-z0-9]{5,}/g;
// Passage montré à l'utilisateur : autour du premier chiffre retrouvé, sinon début du passage.
function excerptAround(text, token) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const at = token ? clean.indexOf(token) : -1;
  const start = Math.max(0, (at >= 0 ? at : 0) - 160);
  return (
    (start ? '…' : '') + clean.slice(start, start + 420) + (clean.length > start + 420 ? '…' : '')
  );
}

function checkProjectSources(answer, docs) {
  // Échappements Markdown du modèle (« Bilan\_2025.docx ») retirés avant la comparaison.
  const text = String(answer).replace(/\\([\\_*[\]()#`~|-])/g, '$1');
  const found = [];
  const overlaps = (s, e) => found.some((c) => s < c.end && e > c.start);
  // Citations des documents du projet, par nom (le plus long d'abord : « a.pdf » dans « data.pdf »).
  for (const doc of [...docs].sort((a, b) => b.name.length - a.name.length)) {
    const re = new RegExp(
      `${escapeRe(doc.name)}(?:\\s*[—–-]\\s*(page|section|diapositive|slide|photo)\\s*(\\d+))?`,
      'gi',
    );
    for (const m of text.matchAll(re)) {
      const end = m.index + m[0].length;
      if (!overlaps(m.index, end))
        found.push({ start: m.index, end, doc, place: m[1], number: m[2] && Number(m[2]) });
    }
  }
  // Noms de fichiers cités entre crochets ou parenthèses qui ne sont pas dans le projet.
  for (const m of text.matchAll(DOC_NAME_RE)) {
    const end = m.index + m[0].length;
    if (!overlaps(m.index, end))
      found.push({
        start: m.index,
        end,
        missing: m[1].trim(),
        place: m[2],
        number: m[3] && Number(m[3]),
      });
  }
  found.sort((a, b) => a.start - b.start);
  const lineStart = (i) => text.lastIndexOf('\n', i - 1) + 1;
  const citations = found.map((c, i) => {
    // Affirmation : depuis la citation précédente de la même ligne (ou le début de la ligne).
    const previous = found[i - 1];
    const from = Math.max(lineStart(c.start), previous ? previous.end : 0);
    const claim = text
      .slice(from, c.start)
      .replace(/^[\s\])]*[,;.]?\s*/, '')
      .replace(/[*_`#>]/g, '')
      .replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')
      .replace(/[[(]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const place = c.place ? (/slide/i.test(c.place) ? 'diapositive' : c.place.toLowerCase()) : null;
    const base = { claim: claim.slice(0, 240), place, number: c.number || null };
    if (c.missing) return { ...base, name: c.missing, status: 'introuvable', reason: 'absent' };
    const doc = c.doc;
    const page = c.number ? doc.pages.find((p) => p.number === c.number) : null;
    if (c.number && !page)
      return {
        ...base,
        name: doc.name,
        docId: doc.id,
        status: 'introuvable',
        reason: 'endroit',
        count: doc.pages.length,
      };
    const passage = page ? page.text : doc.pages.map((p) => p.text).join('\n');
    const known = new Set();
    for (const v of valuesOf(passage)) for (const x of v.values) known.add(round4(x));
    const figures = valuesOf(claim);
    const ok = figures.filter((f) => f.values.some((x) => known.has(round4(x))));
    const words = [...new Set(normalizeText(claim).match(WORD_RE) || [])];
    const own = normalizeText(passage);
    const share = words.length ? words.filter((w) => own.includes(w)).length / words.length : 0;
    let status;
    if (figures.length)
      status = ok.length === figures.length ? 'confirme' : ok.length ? 'partiel' : 'non-trouve';
    else if (words.length >= 2)
      status = share >= 0.5 ? 'confirme' : share >= 0.25 ? 'partiel' : 'non-trouve';
    else status = 'present';
    return {
      ...base,
      name: doc.name,
      docId: doc.id,
      status,
      basis: figures.length ? 'chiffres' : words.length >= 2 ? 'mots' : null,
      missingFigures: figures.filter((f) => !ok.includes(f)).map((f) => f.token),
      excerpt: excerptAround(passage, ok[0]?.token),
    };
  });
  // Lignes avec des chiffres et sans aucune source, seulement si la réponse cite ses sources.
  const uncited = [];
  if (citations.length) {
    let at = 0;
    for (const line of text.split('\n')) {
      const start = at;
      at += line.length + 1;
      const clean = line
        .replace(/[*_`#>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean || found.some((c) => c.start >= start && c.start < at)) continue;
      // Phrase d'introduction (« … en 2026 : ») ou seule année : pas une affirmation chiffrée.
      const figures = valuesOf(clean).filter(
        (f) => !f.values.every((x) => Number.isInteger(x) && x >= 1900 && x <= 2100),
      );
      // Calcul (« a + b = c ») : déjà refait par la vérification des calculs.
      if (figures.length && !/:$/.test(clean) && !/=/.test(clean))
        uncited.push(clean.slice(0, 160));
    }
  }
  return { citations: citations.slice(0, 40), uncited: uncited.slice(0, 10) };
}

// Rapport complet pour une réponse (doc et documents de projet facultatifs).
function verifyAnswer({ answer, question = '', doc = null, projectDocs = null }) {
  const report = { calculations: checkCalculations(answer) };
  if (doc) {
    report.pages = checkPageReferences(answer, doc);
    report.quotes = checkQuotes(answer, doc, question);
    report.numbers = checkNumbers(answer, doc, question);
    report.documentAlerts = detectInjection(doc.pages);
  }
  if (projectDocs?.length) report.sources = checkProjectSources(answer, projectDocs);
  return report;
}

if (typeof module !== 'undefined')
  module.exports = {
    numberCandidates,
    evaluateAll,
    checkCalculations,
    checkPageReferences,
    checkQuotes,
    checkNumbers,
    detectInjection,
    checkProjectSources,
    verifyAnswer,
  };
