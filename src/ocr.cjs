// Reconnaissance de caractères (OCR) en local : Tesseract, français et anglais. Utilisée pour les
// pages scannées des PDF (pdf-worker.cjs) et les photos des projets (image-worker.cjs).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Données de langue de node_modules (dans l'application, hors de l'archive app.asar), réunies
// dans un même dossier temporaire : Tesseract lit toutes les langues dans un seul dossier.
function languages() {
  const dir = path.join(os.tmpdir(), 'localia-ocr-4.0.0_best_int');
  fs.mkdirSync(dir, { recursive: true });
  for (const code of ['fra', 'eng']) {
    const source = path.join(
      path
        .dirname(require.resolve(`@tesseract.js-data/${code}/package.json`))
        .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`),
      '4.0.0_best_int',
      `${code}.traineddata.gz`,
    );
    const target = path.join(dir, `${code}.traineddata.gz`);
    if (fs.statSync(target, { throwIfNoEntry: false })?.size !== fs.statSync(source).size)
      fs.copyFileSync(source, target);
  }
  return dir;
}
function createOcr() {
  const { createWorker } = require('tesseract.js');
  return createWorker('fra+eng', 1, {
    langPath: languages(),
    cacheMethod: 'none',
    errorHandler: () => {},
  });
}

module.exports = { languages, createOcr };
