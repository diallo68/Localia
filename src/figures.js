// Figures écrites par le modèle et dessinées par Localia (comme les schémas Mermaid, diagrams.js) :
// - ```circuit``` : circuit en échelle (composants en série et vers la masse), dessiné avec les
//   symboles normalisés (résistance, condensateur, bobine, masse) ;
// - ```courbe``` : une ou plusieurs courbes y = f(x) ; Localia calcule elle-même les points (aucun
//   code du modèle n'est exécuté : formule lue par un petit analyseur, fonctions mathématiques seules).
// Sortie : texte SVG autonome (montré comme image dans la réponse et dans l'export PDF).
// Chargé par l'interface et par les tests Node.

const FIGURE_LIMIT = 4000; // caractères de description au plus
const svgEscape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const plainWord = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// --- Circuits -----------------------------------------------------------------------------------------
// Une ligne par élément, de l'entrée vers la sortie :
//   entrée Ve            (ou « input Vin »)
//   série R1 1 kΩ        (ou « series ») : composant sur la ligne du haut
//   masse C1 100 nF      (ou « vers la masse », « dérivation », « shunt », « to ground ») : branche vers la masse ;
//                        plusieurs composants en série dans la branche : « masse L 10 mH + C 1 µF »
//   sortie Vs            (ou « output Vout »)
// Le type d'un composant vient de la première lettre de son nom : R, C, L ; sinon une boîte.
function componentOf(text) {
  const t = text.trim();
  const m = t.match(/^(\S+)\s*(.*)$/);
  if (!m) return null;
  const name = m[1].slice(0, 12);
  const first = name[0].toUpperCase();
  const kind = /[RCL]/.test(first) && /^[RCL][\w']*$/i.test(name) ? first : 'X';
  return { kind, name, value: m[2].trim().slice(0, 24) };
}
function parseCircuit(text) {
  const lines = String(text || '')
    .slice(0, FIGURE_LIMIT)
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l && !/^(circuit|%%)/i.test(l));
  const out = { input: 'Ve', output: 'Vs', elements: [], ignored: [] };
  for (const line of lines) {
    const m = line.match(
      /^(entr[ée]e|input|series|s[ée]rie|sortie|output|(?:vers\s+la\s+)?masse|d[ée]rivation|shunt|parall[eè]le|to\s+ground|ground)(?=[\s:]|$)\s*:?\s*(.*)$/i,
    );
    if (!m) {
      // Composant écrit sans mot clé (« R 10 kΩ ») : placé en série, l'utilisateur corrigera au besoin.
      const bare = /^[RCL]\w*\b/i.test(line) ? componentOf(line) : null;
      if (bare && bare.kind !== 'X') out.elements.push({ type: 'serie', parts: [bare] });
      else out.ignored.push(line);
      continue;
    }
    const key = plainWord(m[1]);
    const rest = m[2].trim();
    if (/^(entree|input)/.test(key)) out.input = rest.slice(0, 12) || 'Ve';
    else if (/^(sortie|output)/.test(key)) out.output = rest.slice(0, 12) || 'Vs';
    else if (/^(serie|series)/.test(key)) {
      const c = componentOf(rest);
      if (c) out.elements.push({ type: 'serie', parts: [c] });
    } else {
      const parts = rest
        .split(/\s*\+\s*|\s*,\s*(?=[RCL]\w*\b)/i)
        .map(componentOf)
        // « masse GND » : la masse elle-même, pas un composant.
        .filter((c) => c && !/^(gnd|masse|ground|terre|0v?)$/i.test(c.name))
        .slice(0, 4);
      if (parts.length) out.elements.push({ type: 'masse', parts });
    }
  }
  if (!out.elements.length)
    throw new Error('aucun composant (lignes « série … » ou « masse … » attendues)');
  if (out.elements.length > 12) throw new Error('12 éléments au plus');
  return out;
}

// Symbole horizontal centré en (cx, cy), longueur 60 (fils compris).
function symbol(kind, cx, cy, name) {
  const lead = (x1, x2) => `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}"/>`;
  if (kind === 'R')
    return (
      lead(cx - 30, cx - 20) +
      `<rect x="${cx - 20}" y="${cy - 8}" width="40" height="16" fill="#fff"/>` +
      lead(cx + 20, cx + 30)
    );
  if (kind === 'C')
    return (
      lead(cx - 30, cx - 5) +
      `<line x1="${cx - 5}" y1="${cy - 15}" x2="${cx - 5}" y2="${cy + 15}" stroke-width="2.5"/>` +
      `<line x1="${cx + 5}" y1="${cy - 15}" x2="${cx + 5}" y2="${cy + 15}" stroke-width="2.5"/>` +
      lead(cx + 5, cx + 30)
    );
  if (kind === 'L') {
    let d = `M${cx - 20} ${cy}`;
    for (let i = 0; i < 4; i++) d += ` a5 5 0 0 1 10 0`;
    return lead(cx - 30, cx - 20) + `<path d="${d}" fill="none"/>` + lead(cx + 20, cx + 30);
  }
  return (
    lead(cx - 30, cx - 22) +
    `<rect x="${cx - 22}" y="${cy - 12}" width="44" height="24" fill="#fff"/>` +
    `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" stroke="none" fill="#111">${svgEscape(name.slice(0, 6))}</text>` +
    lead(cx + 22, cx + 30)
  );
}

function circuitSvg(circuit) {
  const SLOT = 100;
  const TOP = 50;
  const depth = Math.max(
    1,
    ...circuit.elements.filter((e) => e.type === 'masse').map((e) => e.parts.length),
  );
  const BOTTOM = TOP + 40 + depth * 70;
  const width = 80 + circuit.elements.length * SLOT + 60;
  const height = BOTTOM + 50;
  const g = [];
  const label = (x, y, text, anchor = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="13" stroke="none" fill="#111">${svgEscape(text)}</text>`;
  const terminal = (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff"/>`;
  let x = 40;
  g.push(terminal(x, TOP), terminal(x, BOTTOM), label(x, TOP - 14, circuit.input));
  for (const e of circuit.elements) {
    if (e.type === 'serie') {
      const c = e.parts[0];
      g.push(`<line x1="${x}" y1="${TOP}" x2="${x + 20}" y2="${TOP}"/>`);
      g.push(symbol(c.kind, x + 50, TOP, c.name));
      g.push(`<line x1="${x + 80}" y1="${TOP}" x2="${x + SLOT}" y2="${TOP}"/>`);
      g.push(label(x + 50, TOP - 18, [c.name, c.value].filter(Boolean).join(' ')));
    } else {
      const bx = x + SLOT / 2;
      g.push(
        `<line x1="${x}" y1="${TOP}" x2="${x + SLOT}" y2="${TOP}"/>`,
        `<circle cx="${bx}" cy="${TOP}" r="3" fill="#111"/>`,
      );
      const span = (BOTTOM - TOP) / e.parts.length;
      e.parts.forEach((c, i) => {
        const cy = TOP + span * (i + 0.5);
        const half = span / 2;
        g.push(`<line x1="${bx}" y1="${cy - half}" x2="${bx}" y2="${cy - 30}"/>`);
        g.push(`<g transform="rotate(90 ${bx} ${cy})">${symbol(c.kind, bx, cy, c.name)}</g>`);
        g.push(`<line x1="${bx}" y1="${cy + 30}" x2="${bx}" y2="${cy + half}"/>`);
        g.push(label(bx + 24, cy + 4, [c.name, c.value].filter(Boolean).join(' '), 'start'));
      });
      g.push(`<circle cx="${bx}" cy="${BOTTOM}" r="3" fill="#111"/>`);
    }
    x += SLOT;
  }
  g.push(`<line x1="${x}" y1="${TOP}" x2="${x + 40}" y2="${TOP}"/>`);
  x += 40;
  g.push(terminal(x, TOP), terminal(x, BOTTOM), label(x, TOP - 14, circuit.output));
  // Ligne de masse et symbole de masse.
  g.unshift(`<line x1="40" y1="${BOTTOM}" x2="${x}" y2="${BOTTOM}"/>`);
  const gx = (40 + x) / 2;
  g.push(
    `<line x1="${gx}" y1="${BOTTOM}" x2="${gx}" y2="${BOTTOM + 14}"/>`,
    ...[16, 10, 4].map(
      (w, i) =>
        `<line x1="${gx - w}" y1="${BOTTOM + 14 + i * 6}" x2="${gx + w}" y2="${BOTTOM + 14 + i * 6}"/>`,
    ),
  );
  return svgDocument(
    x + 40,
    height,
    `<g stroke="#111" stroke-width="1.6" fill="none">${g.join('')}</g>`,
  );
}

const svgDocument = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;

// --- Formules ----------------------------------------------------------------------------------------
// Analyseur descendant : nombres, une variable, + - * / ^, parenthèses, fonctions et constantes ci-dessous.
const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan: Math.atan,
  asin: Math.asin,
  acos: Math.acos,
};
const CONSTANTS = { pi: Math.PI, π: Math.PI, e: Math.E };
function compileFormula(source, variable, constants = {}) {
  const text = String(source)
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/²/g, '^2');
  if (text.length > 300) throw new Error('formule trop longue');
  const tokens = text.match(/\d+(?:[.,]\d+)?(?:e[+-]?\d+)?|[A-Za-zπ_][\w]*|[-+*/^()]|\S/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const fail = (what) => {
    throw new Error(`formule illisible (${what})`);
  };
  // Chaque fonction renvoie (x) => valeur.
  function primary() {
    const t = next();
    if (t === undefined) fail('fin inattendue');
    if (/^\d/.test(t)) {
      const v = Number(t.replace(',', '.'));
      return () => v;
    }
    if (t === '(') {
      const inner = expression();
      if (next() !== ')') fail('parenthèse non fermée');
      return inner;
    }
    if (t === '-') {
      const inner = power();
      return (x) => -inner(x);
    }
    if (t === '+') return power();
    const name = t.toLowerCase();
    if (t === variable) return (x) => x;
    if (Object.hasOwn(FUNCTIONS, name)) {
      if (next() !== '(') fail(`« ${t} » sans parenthèse`);
      const arg = expression();
      if (next() !== ')') fail('parenthèse non fermée');
      const f = FUNCTIONS[name];
      return (x) => f(arg(x));
    }
    if (Object.hasOwn(constants, t)) {
      const v = constants[t];
      return () => v;
    }
    if (Object.hasOwn(CONSTANTS, name)) {
      const v = CONSTANTS[name];
      return () => v;
    }
    fail(`« ${t} » inconnu`);
  }
  function power() {
    const base = primary();
    if (peek() === '^') {
      next();
      const exponent = power();
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }
  function term() {
    let left = power();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const right = power();
      const l = left;
      left = op === '*' ? (x) => l(x) * right(x) : (x) => l(x) / right(x);
    }
    return left;
  }
  function expression() {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = term();
      const l = left;
      left = op === '+' ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  }
  const f = expression();
  if (i < tokens.length) fail(`« ${tokens[i]} » en trop`);
  return f;
}

// --- Courbes -----------------------------------------------------------------------------------------
// titre : Gain du filtre passe-bas
// x : f, 10 à 100000, log, Hz          (nom, minimum, maximum, « log » facultatif, unité facultative)
// y : G, dB                            (nom, unité facultative)
// G = 20*log10(1/sqrt(1+(f/1591)^2))   (une à quatre courbes ; le nom avant « = » sert de légende)
const parseNumber = (t) => {
  const m = String(t)
    .replace(/\s/g, '')
    .replace(',', '.')
    .match(/^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(k|M|m|µ|u|n)?$/i);
  if (!m) return NaN;
  const scale = { k: 1e3, M: 1e6, m: 1e-3, µ: 1e-6, u: 1e-6, n: 1e-9 }[m[2]] ?? 1;
  return Number(m[1]) * scale;
};
function parseCurve(text) {
  const out = { title: '', x: null, y: { name: 'y', unit: '' }, series: [] };
  for (const raw of String(text || '')
    .slice(0, FIGURE_LIMIT)
    .split('\n')) {
    const line = raw.trim();
    if (!line || /^(courbe|curve|%%)$/i.test(line)) continue;
    let m = line.match(/^(titre|title)\s*:\s*(.+)$/i);
    if (m) {
      out.title = m[2].slice(0, 120);
      continue;
    }
    m = line.match(/^x\s*:\s*(.+)$/i);
    if (m) {
      const parts = m[1].split(/\s*[,;]\s*/);
      const name = parts[0].trim();
      let range = (parts[1] || '').split(/\s+(?:à|a|to|-|…|\.\.)\s+|\s*\.\.\s*/);
      let rest = parts.slice(2);
      // Bornes séparées par une virgule (« x : f, 1, 10000, log ») : écart fréquent des petits modèles.
      if (range.length < 2 && Number.isFinite(parseNumber(parts[2]))) {
        range = [parts[1], parts[2]];
        rest = parts.slice(3);
      }
      const min = parseNumber(range[0]);
      const max = parseNumber(range[1]);
      if (!/^[A-Za-zπ_]\w*$/.test(name) || !(max > min))
        throw new Error('ligne « x : nom, min à max » illisible');
      const log = rest.some((p) => /^log/i.test(p.trim()));
      if (log && min <= 0) throw new Error('échelle log : minimum positif attendu');
      const unit = rest.find((p) => !/^(log|lin)/i.test(p.trim()))?.trim() || '';
      out.x = { name, min, max, log, unit: unit.slice(0, 12) };
      continue;
    }
    m = line.match(/^y\s*:\s*(.+)$/i);
    if (m) {
      const [name, unit = ''] = m[1].split(/\s*[,;]\s*/);
      out.y = { name: name.trim().slice(0, 20), unit: unit.trim().slice(0, 12) };
      continue;
    }
    m = line.match(/^([^=]{1,30})=(.+)$/);
    if (m && out.series.length < 12) out.series.push({ label: m[1].trim(), formula: m[2].trim() });
  }
  if (!out.x) throw new Error('ligne « x : nom, min à max » absente');
  // Ligne « nom = … » sans la variable de l'axe x (« R = 10000 », « fc = 1/(2*pi*R*C) ») : constante,
  // utilisable dans les lignes suivantes ; les autres sont des courbes (quatre au plus).
  const constants = {};
  const curves = [];
  for (const s of out.series) {
    const name = s.label.replace(/\s*\(.*\)$/, '').trim();
    const uses = new RegExp(`(^|[^\\w])${out.x.name}([^\\w]|$)`).test(s.formula);
    if (!uses && /^[A-Za-zπ_]\w*$/.test(name)) {
      const value = compileFormula(
        s.formula.replace(/\s*[A-Za-zΩµ°%]+$/, ''),
        out.x.name,
        constants,
      )(0);
      if (Number.isFinite(value)) {
        constants[name] = value;
        continue;
      }
    }
    curves.push(s);
  }
  out.series = curves.slice(0, 4);
  if (!out.series.length)
    throw new Error('aucune formule « nom = … » qui dépende de ' + out.x.name);
  for (const s of out.series) s.f = compileFormula(s.formula, out.x.name, constants);
  out.constants = constants;
  return out;
}

// Graduations « rondes » (1, 2, 5 × 10^k).
function niceTicks(min, max, count = 6) {
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step)
    ticks.push(+v.toPrecision(12));
  return ticks;
}
const formatTick = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6 || (a > 0 && a < 1e-3)) return v.toExponential(0).replace('e+', 'e');
  if (a >= 1e3 && Number.isInteger(v)) return v >= 1e3 && v % 1e3 === 0 ? `${v / 1e3}k` : String(v);
  return String(+v.toPrecision(4)).replace('.', ',');
};
const COLORS = ['#0f5d53', '#b45309', '#1d5fd1', '#9d174d'];

function curveSvg(curve) {
  const W = 640;
  const H = 380;
  const L = 64;
  const R = 20;
  const T = curve.title ? 40 : 20;
  const B = 54;
  const { x } = curve;
  const N = 400;
  const xs = Array.from({ length: N }, (_, i) =>
    x.log ? x.min * (x.max / x.min) ** (i / (N - 1)) : x.min + ((x.max - x.min) * i) / (N - 1),
  );
  const data = curve.series.map((s) => xs.map((v) => s.f(v)));
  const finite = data.flat().filter(Number.isFinite);
  if (!finite.length)
    throw new Error('la formule ne donne aucune valeur calculable sur cet intervalle');
  let ymin = Math.min(...finite);
  let ymax = Math.max(...finite);
  if (ymax - ymin < 1e-9) {
    ymin -= 1;
    ymax += 1;
  }
  const pad = (ymax - ymin) * 0.05;
  ymin -= pad;
  ymax += pad;
  const px = (v) =>
    L +
    (x.log ? Math.log10(v / x.min) / Math.log10(x.max / x.min) : (v - x.min) / (x.max - x.min)) *
      (W - L - R);
  const py = (v) => T + ((ymax - v) / (ymax - ymin)) * (H - T - B);
  const g = [];
  const text = (tx, ty, s, anchor = 'middle', size = 11) =>
    `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-size="${size}" fill="#333">${svgEscape(s)}</text>`;
  // Graduations et quadrillage.
  const xTicks = x.log
    ? (() => {
        const t = [];
        for (let k = Math.floor(Math.log10(x.min)); k <= Math.ceil(Math.log10(x.max)); k++)
          for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
            const v = m * 10 ** k;
            if (v >= x.min * 0.999 && v <= x.max * 1.001) t.push({ v, major: m === 1 });
          }
        return t;
      })()
    : niceTicks(x.min, x.max).map((v) => ({ v, major: true }));
  for (const { v, major } of xTicks) {
    g.push(
      `<line x1="${px(v).toFixed(1)}" y1="${T}" x2="${px(v).toFixed(1)}" y2="${H - B}" stroke="${major ? '#d4d4d4' : '#eeeeee'}"/>`,
    );
    if (major) g.push(text(px(v), H - B + 16, formatTick(v)));
  }
  for (const v of niceTicks(ymin, ymax)) {
    g.push(
      `<line x1="${L}" y1="${py(v).toFixed(1)}" x2="${W - R}" y2="${py(v).toFixed(1)}" stroke="#d4d4d4"/>`,
    );
    g.push(text(L - 6, py(v) + 4, formatTick(v), 'end'));
  }
  g.push(
    `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="#888"/>`,
  );
  // Courbes (interrompues là où la formule n'a pas de valeur).
  data.forEach((ys, k) => {
    let d = '';
    let pen = false;
    ys.forEach((v, i) => {
      if (!Number.isFinite(v) || v < ymin || v > ymax) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${px(xs[i]).toFixed(1)} ${py(v).toFixed(1)}`;
      pen = true;
    });
    g.push(`<path d="${d}" fill="none" stroke="${COLORS[k]}" stroke-width="2.2"/>`);
  });
  const unit = (u) => (u ? ` (${u})` : '');
  g.push(
    text(
      (L + W - R) / 2,
      H - 12,
      x.name + unit(x.unit) + (x.log ? ' — échelle log' : ''),
      'middle',
      12,
    ),
  );
  g.push(
    `<text x="16" y="${(T + H - B) / 2}" text-anchor="middle" font-size="12" fill="#333" transform="rotate(-90 16 ${(T + H - B) / 2})">${svgEscape(curve.y.name + unit(curve.y.unit))}</text>`,
  );
  if (curve.title) g.push(text(W / 2, 22, curve.title, 'middle', 14));
  if (curve.series.length > 1) {
    g.push(
      `<rect x="${W - R - 158}" y="${T + 4}" width="152" height="${curve.series.length * 16 + 6}" fill="#fff" fill-opacity="0.9" stroke="#ddd"/>`,
    );
    curve.series.forEach((s, k) => {
      const ly = T + 14 + k * 16;
      g.push(
        `<line x1="${W - R - 150}" y1="${ly - 4}" x2="${W - R - 130}" y2="${ly - 4}" stroke="${COLORS[k]}" stroke-width="2.2"/>`,
      );
      g.push(text(W - R - 126, ly, s.label.slice(0, 22), 'start'));
    });
  }
  return svgDocument(W, H, g.join(''));
}

// Bloc de réponse → SVG, ou erreur explicite. language : « circuit » ou « courbe » (et leurs synonymes).
const FIGURE_LANGUAGES = {
  circuit: 'circuit',
  schema: 'circuit',
  courbe: 'courbe',
  curve: 'courbe',
  graphe: 'courbe',
  plot: 'courbe',
};
function figureSvg(language, text) {
  const kind = FIGURE_LANGUAGES[String(language).toLowerCase()];
  if (!kind) return null;
  return kind === 'circuit' ? circuitSvg(parseCircuit(text)) : curveSvg(parseCurve(text));
}

if (typeof module !== 'undefined')
  module.exports = {
    parseCircuit,
    circuitSvg,
    compileFormula,
    parseCurve,
    curveSvg,
    niceTicks,
    figureSvg,
    FIGURE_LANGUAGES,
  };
