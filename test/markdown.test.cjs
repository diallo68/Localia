const { test } = require('node:test');
const assert = require('node:assert/strict');
const markdownit = require('markdown-it');
const { createMarkdown, latexToText } = require('../src/markdown.js');

const render = createMarkdown(markdownit);

test('gras, listes, code et retours à la ligne mis en forme', () => {
  const html = render('Coupure en **septembre 2021**.\nSuite\n\n- un\n- deux\n\n```\nx = 1\n```');
  assert.match(html, /<strong>septembre 2021<\/strong>/);
  assert.match(html, /<br>/);
  assert.match(html, /<ul>\s*<li>un<\/li>/);
  assert.match(html, /<pre><code>x = 1\n<\/code><\/pre>/);
});

test('HTML du modèle affiché comme texte, jamais exécuté', () => {
  const html = render('<script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test('images ignorées et liens javascript: refusés', () => {
  assert.doesNotMatch(render('![logo](https://exemple.fr/a.png)'), /<img/);
  assert.doesNotMatch(render('[clic](javascript:alert(1))'), /href="javascript/);
});

test('formules LaTeX converties en texte lisible', () => {
  const html = render(
    'Glucose ($\\text{C}_6\\text{H}_{12}\\text{O}_6$) :\n' +
      '$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow[\\text{Chlorophylle}]{\\text{Lumière}} \\text{C}_6\\text{H}_{12}\\text{O}_6$$',
  );
  assert.match(html, /<span class="math">C₆H₁₂O₆<\/span>/);
  assert.match(
    html,
    /<span class="math math-display">6CO₂ \+ 6H₂O →\(Lumière, Chlorophylle\) C₆H₁₂O₆<\/span>/,
  );
  assert.doesNotMatch(html, /<em>|\$/); // plus d'italique parasite ni de $
  assert.equal(latexToText('\\frac{a+b}{c} \\times 100 \\approx 3{,}5\\%'), '(a+b)/c × 100 ≈ 3,5%');
  assert.equal(latexToText('x^2 + y^{-1} \\le \\sqrt{x^2+1}'), 'x² + y⁻¹ ≤ √(x²+1)');
  assert.equal(latexToText('\\Delta T = T_2 - T_1'), 'ΔT = T₂ - T₁');
  assert.equal(latexToText('25^\\circ C'), '25°C');
  assert.equal(latexToText('\\ce{2H2 + O2 -> 2H2O}'), '2H₂ + O₂ → 2H₂O');
  assert.match(render('\\(E = mc^2\\) et \\[x \\in \\mathbb{R}\\]'), /E = mc²<\/span>.*x ∈ ℝ/);
});

test('formule trop complexe gardée telle quelle en code', () => {
  assert.match(
    render('$\\begin{pmatrix}1&2\\end{pmatrix}$'),
    /<code>\$\\begin\{pmatrix\}1&amp;2\\end\{pmatrix\}\$<\/code>/,
  );
});

test('les montants en dollars ne sont pas pris pour des formules', () => {
  for (const text of [
    'Entre 5 $ et 10 $.',
    'Coûte $20 (environ 18 €), puis $30 au total.',
    'De $5 et $10, ou 3$ puis 4$.',
  ])
    assert.doesNotMatch(render(text), /class="math"|<code>/, text);
  assert.match(render('`$x_1$`'), /<code>\$x_1\$<\/code>/); // le code reste du code
});

test('formules : portée des exposants et caractères échappés conservés', () => {
  assert.equal(latexToText('\\frac{2}{3}^2'), '(2/3)²'); // 4/9, pas 2/9
  assert.equal(latexToText('\\sqrt{x}^2'), '(√x)²');
  assert.equal(latexToText('x^\\frac{1}{2}'), 'x^(1/2)');
  assert.equal(latexToText('x_\\text{max}'), 'xₘₐₓ');
  assert.equal(latexToText('\\{1,2\\}'), '{1,2}');
  assert.equal(latexToText('\\text{user\\_name}'), 'user_name');
  assert.equal(latexToText('\\ce{NH4+ + OH- -> NH3 + H2O}'), 'NH₄⁺ + OH⁻ → NH₃ + H₂O');
  assert.match(render('$a\\$b$'), /<span class="math">a\$b<\/span>/);
  assert.doesNotMatch(render('$10 + taxe de 2$'), /class="math"/);
  assert.match(render('$5 \\text{ kg} \\times 3$'), /5 kg × 3/);
});

test('beaucoup de « \\( » sans fermeture : rendu rapide', () => {
  const start = performance.now();
  render('\\('.repeat(20000));
  assert.ok(performance.now() - start < 2000);
});
