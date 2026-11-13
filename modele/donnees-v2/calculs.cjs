// Égalités écrites dans les réponses, refaites par verify.js de Localia (checkCalculations).
// Entrée : lignes JSON {id, texte} ; sortie : lignes JSON {id, calculs: [{expression, ok, expected}]}.
// Usage : node calculs.cjs <dossier_src_localia> < reponses.jsonl
const path = require('node:path');
const { checkCalculations } = require(path.resolve(process.argv[2], 'verify.js'));
const lignes = require('node:fs').readFileSync(0, 'utf8').split('\n').filter(Boolean);
for (const l of lignes) {
  const { id, texte } = JSON.parse(l);
  process.stdout.write(JSON.stringify({ id, calculs: checkCalculations(texte || '') }) + '\n');
}
