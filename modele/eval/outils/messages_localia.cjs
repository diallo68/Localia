// Messages exactement tels que Localia les envoie pour une question sur un PDF joint : la fiche est convertie en PDF
// (cupsfilter, macOS), lue par extractPdf, puis documentMessages (src/chat.cjs) choisit les extraits et ajoute la
// consigne système de Localia. Évaluation seulement : ces consignes ont été écrites avec Claude et n'entrent jamais
// dans les données d'entraînement.
// Usage : node messages_localia.cjs <dossier_jeu> <sortie.jsonl>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SRC = path.resolve(__dirname, '../../../src');
const { extractPdf } = require(path.join(SRC, 'documents.cjs'));
const { documentMessages } = require(path.join(SRC, 'chat.cjs'));

(async () => {
  const [dossier, sortie] = process.argv.slice(2);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'localia-pdf-'));
  const cas = fs.readFileSync(path.join(dossier, 'cas.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const docs = {};
  const lignes = [];
  for (const c of cas) {
    if (!docs[c.doc]) {
      const txt = path.join(tmp, c.doc + '.txt');
      fs.copyFileSync(path.join(dossier, 'documents', c.doc + '.md'), txt);
      const pdf = path.join(tmp, c.doc + '.pdf');
      fs.writeFileSync(pdf, execFileSync('cupsfilter', ['-m', 'application/pdf', txt], { stdio: ['ignore', 'pipe', 'ignore'] }));
      const lu = await extractPdf(pdf);
      // cupsfilter place chaque mot à une position fixe : pdf.js lit alors plusieurs espaces entre les mots, artefact
      // de la conversion et non de Localia ; ramenés à un seul espace.
      const pages = lu.pages.map((p) => (typeof p === 'string' ? p.replace(/ {2,}/g, ' ') : { ...p, text: String(p.text).replace(/ {2,}/g, ' ') }));
      docs[c.doc] = { name: c.doc + '.pdf', pages, emptyPages: lu.emptyPages || [], type: 'pdf' };
    }
    const m = documentMessages(docs[c.doc], [{ role: 'user', content: c.consigne }], '', { numCtx: 8192 });
    lignes.push(JSON.stringify({ id: c.id, partiel: m.partial, pages: m.pages, messages: m.messages }));
  }
  fs.writeFileSync(sortie, lignes.join('\n') + '\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${lignes.length} cas, ${Object.keys(docs).length} documents -> ${sortie}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
