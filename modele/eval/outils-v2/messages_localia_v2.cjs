// Messages exactement tels que Localia (branche refonte-interface) les envoie pour une question sur un document
// joint : pages lues par pages_localia.cjs, puis documentMessages (src/chat.cjs) avec le contexte choisi par
// Localia (8 192, porté à 16 384 si le document ne tient pas) et la langue de la question.
// Évaluation seulement : les consignes de Localia ont été écrites avec Claude et n'entrent jamais dans les données
// d'entraînement.
// Usage : node messages_localia_v2.cjs <dossier_jeu> <dossier_src_localia> <sortie.jsonl>
const fs = require('node:fs');
const path = require('node:path');

const [dossier, src, sortie] = process.argv.slice(2);
const { documentMessages, contextSize, documentContextSize } = require(path.resolve(src, 'chat.cjs'));
const cas = fs.readFileSync(path.join(dossier, 'cas.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const docs = {};
const lignes = [];
for (const c of cas) {
  if (!docs[c.doc]) {
    const lu = JSON.parse(fs.readFileSync(path.join(dossier, 'pages', c.doc + '.json'), 'utf8'));
    docs[c.doc] = { name: lu.name, pages: lu.pages, emptyPages: [], type: 'pdf' };
  }
  const doc = docs[c.doc];
  const characters = doc.pages.reduce((n, p) => n + p.text.length, 0);
  const numCtx = documentContextSize(contextSize({}, null, true), undefined, characters);
  const lang = c.langue === 'en' ? 'en' : 'fr';
  // Même règle que src/main.cjs : demande de résumé → résumé, introduction et conclusions en priorité.
  const summary = /\b(r[ée]sum|synth[eè]s|summar)/i.test(c.consigne);
  const m = documentMessages(doc, [{ role: 'user', content: c.consigne }], '', { numCtx, lang, summary });
  lignes.push(JSON.stringify({ id: c.id, num_ctx: numCtx, partiel: m.partial, pages: m.pages, messages: m.messages }));
}
fs.writeFileSync(sortie, lignes.join('\n') + '\n');
console.log(`${lignes.length} cas, ${Object.keys(docs).length} documents -> ${sortie}`);
