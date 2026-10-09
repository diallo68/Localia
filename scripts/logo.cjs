// Logo de Localia : un cercle (l'iris) qui montre le soleil levant sur l'horizon et une pile de
// serveurs ; l'humain regarde l'IA, l'avenir se lève derrière elle. Six couleurs de fond gardées.
//   npm run logo            → fond choisi (blanc) : SVG, icônes de l'application
//   npm run logo -- creme   → change de fond (blanc, creme, ciel, nuit, sarcelle, anthracite)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const FONDS = {
  blanc: { nom: 'Blanc', bg: '#ffffff', fg: '#1f2f57', led: '#ffffff', ring: '#1f2f57' },
  creme: { nom: 'Crème', bg: '#f7efdf', fg: '#1f2f57', led: '#f7efdf', ring: '#1f2f57' },
  ciel: { nom: 'Bleu ciel', bg: '#4f7fc4', fg: '#fbf7ef', led: '#4f7fc4', ring: '#1f2f57' },
  nuit: { nom: 'Bleu nuit', bg: '#1f2f57', fg: '#fbf7ef', led: '#1f2f57', ring: '#1f2f57' },
  sarcelle: { nom: 'Sarcelle', bg: '#0f5d53', fg: '#fbf7ef', led: '#0f5d53', ring: '#0a3f38' },
  anthracite: { nom: 'Anthracite', bg: '#2a2e33', fg: '#fbf7ef', led: '#2a2e33', ring: '#1b1e22' },
};
const CHOISI = 'blanc';

// Le cercle seul, dans un carré de 100 (signe sans fond).
function cercle(f, id) {
  return `<defs>
    <linearGradient id="soleil-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd890"/><stop offset="1" stop-color="#f2a541"/></linearGradient>
    <clipPath id="iris-${id}"><circle cx="50" cy="50" r="33.5"/></clipPath>
  </defs>
  <circle cx="50" cy="50" r="38" fill="${f.ring}"/>
  <circle cx="50" cy="50" r="33.5" fill="${f.bg}"/>
  <g clip-path="url(#iris-${id})">
    <path d="M28 60 A22 22 0 0 1 72 60 Z" fill="url(#soleil-${id})"/>
    <g fill="${f.fg}">
      <rect x="39.5" y="48.6" width="21" height="8.2" rx="1.8"/>
      <rect x="39.5" y="38.6" width="21" height="8.2" rx="1.8"/>
      <rect x="39.5" y="28.6" width="21" height="8.2" rx="1.8"/>
      <rect x="39.5" y="57.4" width="21" height="2.6"/>
    </g>
    <g fill="${f.led}"><circle cx="44" cy="52.7" r="1.6"/><circle cx="44" cy="42.7" r="1.6"/><circle cx="44" cy="32.7" r="1.6"/></g>
    <g fill="#f2a541"><rect x="48.5" y="51.7" width="8.5" height="2" rx="1"/><rect x="48.5" y="41.7" width="8.5" height="2" rx="1"/><rect x="48.5" y="31.7" width="8.5" height="2" rx="1"/></g>
    <line x1="10" y1="60" x2="90" y2="60" stroke="${f.fg}" stroke-width="2"/>
    <g stroke="#f2a541" stroke-linecap="round"><line x1="38" y1="67" x2="62" y2="67" stroke-width="2.6"/><line x1="43" y1="73.5" x2="57" y2="73.5" stroke-width="2.2"/></g>
  </g>`;
}
const svg = (inner, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${title}">\n${inner}\n</svg>\n`;
// Signe seul : le cercle agrandi pour remplir le carré.
const signe = (f, id) =>
  svg(
    `<g transform="translate(50 50) scale(1.263) translate(-50 -50)">${cercle(f, id)}</g>`,
    'Localia',
  );
// Icône d'application : le cercle sur le fond Aube, carré aux coins arrondis.
function icone(f, id, { marge = 0 } = {}) {
  const taille = 100 - 2 * marge;
  const echelle = taille / 100;
  return svg(
    `<defs><linearGradient id="aube-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf7ec"/><stop offset="1" stop-color="#f6dcae"/></linearGradient></defs>
  <g transform="translate(${marge} ${marge}) scale(${echelle})">
    <rect width="100" height="100" rx="22.4" fill="url(#aube-${id})"/>
    ${cercle(f, id)}
  </g>`,
    'Localia',
  );
}

const racine = path.join(__dirname, '..');
const dossier = path.join(racine, 'build', 'logo');
fs.mkdirSync(dossier, { recursive: true });
for (const [cle, f] of Object.entries(FONDS)) {
  fs.writeFileSync(path.join(dossier, `${cle}-signe.svg`), signe(f, cle));
  fs.writeFileSync(path.join(dossier, `${cle}-icone.svg`), icone(f, cle));
}

const choix = process.argv[2] || CHOISI;
const f = FONDS[choix];
if (!f) {
  console.error(`Fond inconnu : ${choix}. Fonds possibles : ${Object.keys(FONDS).join(', ')}.`);
  process.exit(1);
}
// Logo affiché dans l'application (colonne de gauche, écran métier).
fs.mkdirSync(path.join(racine, 'src', 'assets'), { recursive: true });
fs.writeFileSync(path.join(racine, 'src', 'assets', 'logo.svg'), signe(f, 'app'));
// Icônes : 1024 px plein (Windows et Linux, converties par electron-builder) et grille macOS
// (carré de 824 px centré, marge transparente), assemblée en .icns.
const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'localia-logo-'));
fs.writeFileSync(path.join(tmp, 'plein.svg'), icone(f, 'plein'));
fs.writeFileSync(path.join(tmp, 'mac.svg'), icone(f, 'mac', { marge: (100 / 1024) * 100 }));
const electron = require('electron');
execFileSync(electron, [path.join(__dirname, 'logo-rendu.cjs'), tmp], { stdio: 'inherit' });
fs.copyFileSync(path.join(tmp, 'plein.png'), path.join(racine, 'build', 'icon.png'));
if (process.platform === 'darwin') {
  const set = path.join(tmp, 'icon.iconset');
  fs.mkdirSync(set);
  for (const n of [16, 32, 128, 256, 512])
    for (const [suffixe, taille] of [
      ['', n],
      ['@2x', n * 2],
    ])
      execFileSync(
        'sips',
        [
          '-z',
          String(taille),
          String(taille),
          path.join(tmp, 'mac.png'),
          '--out',
          path.join(set, `icon_${n}x${n}${suffixe}.png`),
        ],
        { stdio: 'ignore' },
      );
  execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(racine, 'build', 'icon.icns')]);
} else console.warn('Icône macOS (.icns) : à produire sur un Mac.');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(
  `Logo « ${f.nom} » : src/assets/logo.svg, build/icon.png, build/icon.icns ; six fonds dans build/logo/.`,
);
