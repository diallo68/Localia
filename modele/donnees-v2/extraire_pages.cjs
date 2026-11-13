// Lit chaque document téléchargé (manifeste.jsonl de telecharger.py) comme Localia le lit (extractPdf de
// src/documents.cjs) et enregistre ses pages. Texte (.md, Wikipédia) : converti en PDF par cupsfilter (macOS), comme
// un document qu'on joindrait, pour avoir des numéros de page.
// Reprise automatique : un document déjà lu n'est pas relu.
// Usage : node extraire_pages.cjs <dossier_sources> <dossier_src_localia>
// Sortie : <dossier_sources>/pages/<id>.json ({ id, name, pages: [{ number, text }] }) et pages/stats.jsonl.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

(async () => {
  const [dossier, src] = process.argv.slice(2);
  const { extractPdf } = require(path.resolve(src, 'documents.cjs'));
  const out = path.join(dossier, 'pages');
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'localia-pages-'));
  const stats = path.join(out, 'stats.jsonl');
  const manifeste = fs.readFileSync(path.join(dossier, 'manifeste.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  let n = 0;
  for (const doc of manifeste) {
    const cible = path.join(out, doc.id + '.json');
    if (fs.existsSync(cible)) continue;
    const ext = path.extname(doc.fichier);
    let pdf = path.join(dossier, doc.fichier);
    try {
      if (ext === '.md') {
        const txt = path.join(tmp, 'doc.txt');
        fs.copyFileSync(pdf, txt);
        pdf = path.join(tmp, 'doc.pdf');
        fs.writeFileSync(pdf, execFileSync('cupsfilter', ['-m', 'application/pdf', txt], { stdio: ['ignore', 'pipe', 'ignore'] }));
      }
      const lu = await extractPdf(pdf);
      const pages = lu.pages.map((p, i) => {
        const text = typeof p === 'string' ? p : p.text;
        return { number: p.number || i + 1, text: ext === '.md' ? String(text).replace(/ {2,}/g, ' ') : String(text) };
      });
      const mots = pages.reduce((k, p) => k + p.text.split(/\s+/).filter(Boolean).length, 0);
      fs.writeFileSync(cible, JSON.stringify({ id: doc.id, name: doc.id + '.pdf', pages }));
      fs.appendFileSync(stats, JSON.stringify({ id: doc.id, pages: pages.length, mots, vides: pages.filter((p) => p.text.trim().length < 50).length }) + '\n');
    } catch (e) {
      fs.appendFileSync(stats, JSON.stringify({ id: doc.id, erreur: String(e).slice(0, 200) }) + '\n');
    }
    if (++n % 50 === 0) console.log(`${n} documents lus`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`fin : ${n} documents lus`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
