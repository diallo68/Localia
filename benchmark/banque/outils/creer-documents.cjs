// Crée les PDF fictifs de la banque de questions : node benchmark/banque/outils/creer-documents.cjs
const fs = require('node:fs');
const path = require('node:path');
const { buildPdf } = require('./pdf.cjs');
const { MENTION, documents } = require('./documents.cjs');

const dir = path.join(__dirname, '..', 'documents');
fs.mkdirSync(dir, { recursive: true });
for (const doc of documents) {
  const { buffer, pages } = buildPdf(doc.blocs, MENTION);
  fs.writeFileSync(path.join(dir, doc.fichier), buffer);
  console.log(`${doc.fichier} : ${pages} pages`);
}
