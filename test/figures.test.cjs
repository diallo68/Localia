const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../src/figures.js');

test('circuit : série, branches vers la masse, écarts des petits modèles absorbés', () => {
  const c = f.parseCircuit('entrée Ve\nsérie R 1 kΩ\nmasse C 100 nF\nsortie Vs');
  assert.deepEqual(
    c.elements.map((e) => [e.type, e.parts.map((p) => p.kind + ':' + p.name + ':' + p.value)]),
    [
      ['serie', ['R:R:1 kΩ']],
      ['masse', ['C:C:100 nF']],
    ],
  );
  // Branche à deux composants ; anglais ; masse écrite comme un composant (Dial-bowe, 14 nov.) ignorée.
  const r = f.parseCircuit(
    'input Vin\nmasse GND\nseries R1 50\nto ground L 10 mH + C 1 µF\noutput Vout',
  );
  assert.equal(r.input, 'Vin');
  assert.deepEqual(
    r.elements.map((e) => e.parts.map((p) => p.kind).join('+')),
    ['R', 'L+C'],
  );
  // Composant sans mot clé : en série.
  assert.equal(f.parseCircuit('R 10 kΩ\nmasse C 10 nF').elements[0].type, 'serie');
  assert.throws(() => f.parseCircuit('bonjour'), /aucun composant/);
  const svg = f.circuitSvg(c);
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="\d+" height="\d+"/);
  assert.match(svg, /R 1 kΩ/);
  assert.doesNotMatch(f.circuitSvg(f.parseCircuit('série R <script>')), /<script>/);
});

test('formules : opérateurs, fonctions, constantes ; rien d’autre n’est accepté', () => {
  const g = f.compileFormula('20*log10(1/sqrt(1+(f/1000)^2))', 'f');
  assert.ok(Math.abs(g(1000) + 3.0103) < 1e-3);
  assert.equal(f.compileFormula('2^3^2', 'x')(0), 512); // puissance à droite
  assert.equal(f.compileFormula('-x^2', 'x')(3), -9);
  assert.ok(Math.abs(f.compileFormula('2*π*x', 'x')(1) - 2 * Math.PI) < 1e-12);
  assert.equal(f.compileFormula('3·x²', 'x')(2), 12);
  for (const bad of ['process.exit()', 'x)', 'alert(1)', 'x + y', 'constructor'])
    assert.throws(() => f.compileFormula(bad, 'x'), /formule illisible/, bad);
});

test('courbe : axes, constantes du bloc, bornes écrites avec une virgule, erreurs claires', () => {
  const c = f.parseCurve(
    'titre : Passe-haut\nx : f, 10 à 100k, log, Hz\ny : G, dB\nR = 10000\nC = 10e-9\nfc = 1/(2*pi*R*C)\nG = 20*log10((f/fc)/sqrt(1+(f/fc)^2))',
  );
  assert.deepEqual([c.x.min, c.x.max, c.x.log, c.x.unit], [10, 100000, true, 'Hz']);
  assert.equal(c.series.length, 1);
  assert.ok(Math.abs(c.constants.fc - 1591.55) < 0.01);
  assert.ok(Math.abs(c.series[0].f(c.constants.fc) + 3.0103) < 1e-3);
  // Dial-bowe, 14 nov. : « x : f, 1, 10000, log, Hz ».
  const d = f.parseCurve('x : f, 1, 10000, log, Hz\nG = f');
  assert.deepEqual([d.x.min, d.x.max, d.x.log, d.x.unit], [1, 10000, true, 'Hz']);
  assert.throws(() => f.parseCurve('G = f'), /ligne « x/);
  assert.throws(() => f.parseCurve('x : f, 0 à 10, log\nG = f'), /minimum positif/);
  assert.throws(() => f.parseCurve('x : f, 1 à 10\nG = f + y'), /« y » inconnu/);
  const svg = f.curveSvg(c);
  assert.match(svg, /<path d="M/);
  assert.match(svg, /échelle log/);
  assert.throws(() => f.curveSvg(f.parseCurve('x : t, 1 à 2\ny = sqrt(-1)')), /aucune valeur/);
});

test('figureSvg : langues reconnues', () => {
  assert.equal(f.figureSvg('python', 'x'), null);
  assert.match(f.figureSvg('courbe', 'x : t, 0 à 1\ny = t^2'), /<svg/);
  assert.match(f.figureSvg('circuit', 'série R'), /<svg/);
});
