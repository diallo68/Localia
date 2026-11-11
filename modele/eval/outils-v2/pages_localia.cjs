// Lit chaque document d'un jeu comme Localia (extractPdf de src/documents.cjs) et enregistre ses pages.
// PDF : lu tel quel. Texte (.md) : converti en PDF par cupsfilter (macOS), comme un document qu'on joindrait.
// Usage : node pages_localia.cjs <dossier_jeu> <dossier_src_localia>
// Sortie : <dossier_jeu>/pages/<doc>.json ({ name, pages: [{ number, text }] }) et <dossier_jeu>/pages/<doc>.txt (lecture).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

(async () => {
  const [dossier, src] = process.argv.slice(2);
  const { extractPdf } = require(path.resolve(src, 'documents.cjs'));
  const docs = path.join(dossier, 'documents');
  const out = path.join(dossier, 'pages');
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'localia-pages-'));
  for (const f of fs.readdirSync(docs).sort()) {
    const ext = path.extname(f);
    const name = path.basename(f, ext);
    let pdf = path.join(docs, f);
    if (ext === '.md') {
      const txt = path.join(tmp, name + '.txt');
      fs.copyFileSync(pdf, txt);
      pdf = path.join(tmp, name + '.pdf');
      fs.writeFileSync(pdf, execFileSync('cupsfilter', ['-m', 'application/pdf', txt], { stdio: ['ignore', 'pipe', 'ignore'] }));
    } else if (ext !== '.pdf') continue;
    const lu = await extractPdf(pdf);
    // cupsfilter place chaque mot à une position fixe : espaces multiples ramenés à un seul.
    const pages = lu.pages.map((p, i) => {
      const text = typeof p === 'string' ? p : p.text;
      return { number: p.number || i + 1, text: ext === '.md' ? String(text).replace(/ {2,}/g, ' ') : String(text) };
    });
    fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ name: name + '.pdf', pages }));
    fs.writeFileSync(path.join(out, name + '.txt'), pages.map((p) => `=== Page ${p.number} ===\n${p.text}`).join('\n\n'));
    console.log(`${name} : ${pages.length} page(s), ${pages.reduce((n, p) => n + p.text.split(/\s+/).length, 0)} mots`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
