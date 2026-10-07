// Crée les PDF fictifs des séries par métier : node benchmark/banque/outils/creer-documents-metiers.cjs
const fs = require('node:fs');
const path = require('node:path');
const { buildPdf } = require('./pdf.cjs');
const { MENTION, documentsMetiers } = require('./documents-metiers.cjs');

const dir = path.join(__dirname, '..', 'metiers', 'documents');
fs.mkdirSync(dir, { recursive: true });
for (const doc of documentsMetiers) {
  const { buffer, pages } = buildPdf(doc.blocs, MENTION);
  fs.writeFileSync(path.join(dir, doc.fichier), buffer);
  console.log(`${doc.fichier} : ${pages} pages`);
}
