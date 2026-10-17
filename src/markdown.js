// Mise en forme des réponses. Chargé comme script dans l'interface et par les tests Node.
// Le HTML écrit par le modèle est affiché comme texte ; les images ne sont pas chargées.
function createMarkdown(markdownit) {
  const md = markdownit({ html: false, linkify: false, breaks: true });
  md.disable('image');
  md.inline.ruler.before('escape', 'math', mathRule);
  md.renderer.rules.math = (tokens, i) => {
    const { content, meta } = tokens[i];
    const text = latexToText(content);
    // Formule trop complexe pour du texte : montrée telle quelle, en code, plutôt que déformée.
    if (text == null) return `<code>${md.utils.escapeHtml(meta.source)}</code>`;
    const kind = meta.display ? 'math math-display' : 'math';
    return `<span class="${kind}">${md.utils.escapeHtml(text)}</span>`;
  };
  return (text) => md.render(text);
}

// --- Formules LaTeX ------------------------------------------------------------------------------
// Les modèles écrivent les formules en LaTeX ($…$, $$…$$, \(…\), \[…\]). Les plus courantes
// (chimie, puissances, fractions, symboles) sont converties en texte lisible, que l'on peut aussi
// copier, écouter ou exporter ; les autres restent en code.

// $…$ seulement si le premier et le dernier caractère ne sont pas des espaces et que le $ fermant
// n'est pas suivi d'un chiffre : « entre 5 $ et 10 $ » ou « $5 et $10 » restent des montants.
// Fermeture cherchée sur MATH_MAX caractères au plus : une longue réponse pleine de « \( » sans
// fermeture ne coûte pas une recherche jusqu'au bout du texte à chaque fois.
const MATH_MAX = 2000;
function closing(src, close, from) {
  const window = src.slice(from, from + MATH_MAX);
  let at = window.indexOf(close);
  while (at > 0 && window[at - 1] === '\\') at = window.indexOf(close, at + 1); // \$ échappé
  return at === -1 ? -1 : from + at;
}
function mathRule(state, silent) {
  const src = state.src;
  const start = state.pos;
  const pairs = [
    ['$$', '$$', true],
    ['\\[', '\\]', true],
    ['\\(', '\\)', false],
    ['$', '$', false],
  ];
  for (const [open, close, display] of pairs) {
    if (!src.startsWith(open, start)) continue;
    const from = start + open.length;
    let end = closing(src, close, from);
    if (open === '$') {
      if (/\s/.test(src[from] || ' ') || src[from] === '$') return false;
      while (end !== -1 && (/\s/.test(src[end - 1]) || /\d/.test(src[end + 1] || ''))) {
        if (/\d/.test(src[end + 1] || '')) return false;
        end = closing(src, close, end + 1);
      }
    }
    if (end === -1 || end === from) return false;
    const content = src.slice(from, end);
    // Un $ simple n'entoure une formule que s'il y a un signe de formule (« $10, ou 3$ » non), et
    // jamais un montant suivi de mots sans commande LaTeX (« $10 + taxe de 2$ »).
    if (open === '$' && !/[\\^_=+<>]|^\S+$/.test(content)) return false;
    if (open === '$' && /^\d[^\\]*[A-Za-zÀ-ÿ]{2}/.test(content)) return false;
    if (!silent) {
      const token = state.push('math', '', 0);
      token.content = content;
      token.meta = { display, source: src.slice(start, end + close.length) };
    }
    state.pos = end + close.length;
    return true;
  }
  return false;
}

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
Object.assign(SUB, { '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ' });
Object.assign(SUB, { i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ' });
Object.assign(SUB, { s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' });
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
Object.assign(SUP, { '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ' });
Object.assign(SUP, { '*': '*', '′': '′', '°': '°', x: 'ˣ', T: 'ᵀ' });

const SYMBOLS = {
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  ast: '*',
  star: '⋆',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  simeq: '≃',
  sim: '∼',
  equiv: '≡',
  propto: '∝',
  ll: '≪',
  gg: '≫',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  to: '→',
  rightarrow: '→',
  longrightarrow: '⟶',
  leftarrow: '←',
  longleftarrow: '⟵',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Longrightarrow: '⟹',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  iff: '⇔',
  implies: '⇒',
  rightleftharpoons: '⇌',
  uparrow: '↑',
  downarrow: '↓',
  mapsto: '↦',
  degree: '°',
  circ: '∘',
  ldots: '…',
  dots: '…',
  cdots: '⋯',
  sum: 'Σ',
  prod: 'Π',
  int: '∫',
  oint: '∮',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  cup: '∪',
  cap: '∩',
  forall: '∀',
  exists: '∃',
  emptyset: '∅',
  varnothing: '∅',
  neg: '¬',
  land: '∧',
  lor: '∨',
  wedge: '∧',
  vee: '∨',
  perp: '⊥',
  parallel: '∥',
  angle: '∠',
  prime: '′',
  bullet: '•',
  checkmark: '✓',
  triangle: '△',
  square: '□',
  hbar: 'ℏ',
  ell: 'ℓ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  log: 'log',
  ln: 'ln',
  exp: 'exp',
  lim: 'lim',
  max: 'max',
  min: 'min',
  det: 'det',
  mod: 'mod',
  gcd: 'pgcd',
};
const BLACKBOARD = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };

// Indice ou exposant : en caractères Unicode quand tous existent, sinon _x ou ^(x).
function script(text, table, mark) {
  const chars = [...text.replace(/\s+/g, '')];
  if (chars.length && chars.every((c) => table[c])) return chars.map((c) => table[c]).join('');
  return chars.length === 1 ? mark + text : `${mark}(${text})`;
}
// Formule entre parenthèses quand elle contient une opération : « (a + b)/c ».
const grouped = (text) => (/^[\w.,′]+$/u.test(text.trim()) ? text.trim() : `(${text.trim()})`);
// Chimie de \ce{…} : chiffres après un élément ou une parenthèse en indice, charges en exposant.
const chemistry = (formula) =>
  formula
    .replace(/<->|<=>/g, ' ⇌ ')
    .replace(/->/g, ' → ')
    .replace(/([A-Za-z)\]])(\d+)/g, (_, a, n) => a + script(n, SUB, '_'))
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, c) => script(c, SUP, '^'))
    .replace(/([A-Za-z₀-₉)\]])([+-])(?=\s|$)/g, (_, a, c) => a + script(c, SUP, '^')); // NH4+

// Caractères échappés (\_, \{, \}) mis de côté pendant la conversion, rendus à la fin.
const ESCAPED = { _: '\uE000', '{': '\uE001', '}': '\uE002' };
const UNESCAPED = { '\uE000': '_', '\uE001': '{', '\uE002': '}' };
// Fraction ou racine juste après ^ ou _ : gardée comme un seul argument ; suivie de ^ ou _ :
// entre parenthèses, pour que l'exposant porte sur le tout (« (2/3)² », pas « 2/3² »).
const scoped = (text, offset, whole, length) =>
  /[\^_]\s*$/.test(whole.slice(0, offset))
    ? `{${text}}`
    : /^\s*[\^_]/.test(whole.slice(offset + length))
      ? `(${text})`
      : text;

// Texte lisible, ou null si la formule contient des commandes inconnues (matrices, intégrales…).
function latexToText(latex) {
  let s = latex.trim().replace(/\\([_{}])/g, (_, c) => ESCAPED[c]);
  const inner = '((?:[^{}]|\\{[^{}]*\\})*)'; // un niveau d'accolades imbriquées
  const arg = (name, n = 1) => new RegExp(`\\\\${name}\\s*` + `\\{${inner}\\}`.repeat(n), 'g');
  s = s
    .replace(arg('ce'), (_, f) => chemistry(f))
    // \text{…} juste après ^ ou _ : tout le texte est l'argument (« x_\text{max} » → xₘₐₓ).
    .replace(
      arg('(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|operatorname|mbox)'),
      (m, t, o, w) => (/[\^_]\s*$/.test(w.slice(0, o)) ? `{${t}}` : t),
    )
    .replace(arg('mathbb'), (_, c) => BLACKBOARD[c.trim()] ?? c)
    .replace(/\\(?:left|right|big|Big|bigg|Bigg|displaystyle|textstyle|limits)\b/g, '')
    .replace(/\\(?:,|;|:|!|quad|qquad|enspace|thinspace)|\\ |~/g, ' ')
    .replace(/\\([%$&#])/g, '$1')
    .replace(/\^\s*\{?\s*\\circ\s*\}?/g, '°');
  // Flèches annotées : \xrightarrow[dessous]{dessus} → « →(dessus, dessous) ».
  s = s.replace(
    new RegExp(`\\\\x(right|left)arrow\\s*(?:\\[([^\\]]*)\\])?\\s*\\{${inner}\\}`, 'g'),
    (_, side, below, above) =>
      `${side === 'right' ? '→' : '←'}(${[above, below].filter((t) => t?.trim()).join(', ')})`,
  );
  // Fractions et racines, des plus intérieures aux plus extérieures.
  for (let pass = 0; pass < 5; pass += 1) {
    const before = s;
    s = s
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b, o, w) =>
        scoped(`${grouped(a)}/${grouped(b)}`, o, w, m.length),
      )
      .replace(/\\sqrt\s*\[([34])\]\s*\{([^{}]*)\}/g, (m, n, x, o, w) =>
        scoped((n === '3' ? '∛' : '∜') + grouped(x), o, w, m.length),
      )
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, x, o, w) => scoped('√' + grouped(x), o, w, m.length))
      .replace(/\\(?:overline|bar)\s*\{([^{}]*)\}/g, (_, x) => x + '̅')
      .replace(/\\(?:vec)\s*\{([^{}]*)\}/g, (_, x) => x + '⃗')
      .replace(/\\(?:hat)\s*\{([^{}]*)\}/g, (_, x) => x + '̂');
    if (s === before) break;
  }
  s = s
    // « \Delta T » : l'espace après une lettre grecque ne sépare que la commande.
    .replace(/\\([A-Za-z]+)( (?=[A-Za-z]))?/g, (whole, name, space = '') =>
      SYMBOLS[name] ? SYMBOLS[name] + (/^\p{L}$/u.test(SYMBOLS[name]) ? '' : space) : whole,
    )
    .replace(/\^\s*\{([^{}]*)\}|\^\s*(\\?.)/g, (_, a, b) => script(a ?? b, SUP, '^'))
    .replace(/_\s*\{([^{}]*)\}|_\s*(\\?.)/g, (_, a, b) => script(a ?? b, SUB, '_'));
  // Accolades de groupement restantes (« 3{,}5 ») : retirées.
  for (let pass = 0; pass < 5 && /\{[^{}]*\}/.test(s); pass += 1)
    s = s.replace(/\{([^{}]*)\}/g, '$1');
  if (/\\[A-Za-z]|\\\\|[{}]/.test(s)) return null;
  return s
    .replace(/[\uE000-\uE002]/g, (c) => UNESCAPED[c])
    .replace(/\s+/g, ' ')
    .trim();
}

if (typeof module !== 'undefined') module.exports = { createMarkdown, latexToText };
