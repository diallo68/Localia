const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parentPort, workerData } = require('node:worker_threads');
// Pages scannées (sans texte) : rendues en image puis lues par reconnaissance de caractères (OCR,
// Tesseract en local, français et anglais). Lent (quelques secondes par page) : nombre limité.
const MAX_OCR_PAGES = 60;
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
let ocr;
async function recognize(page) {
  const { createCanvas } = require('@napi-rs/canvas');
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, 2000 / Math.max(base.width, 1)) });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  if (!ocr) {
    const { createWorker } = require('tesseract.js');
    ocr = await createWorker('fra+eng', 1, {
      langPath: languages(),
      cacheMethod: 'none',
      errorHandler: () => {},
    });
  }
  const { data } = await ocr.recognize(canvas.toBuffer('image/png'));
  return { text: data.text.replace(/[ \t]+\n/g, '\n').trim(), confidence: data.confidence };
}
(async () => {
  let task;
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    task = getDocument({
      data: new Uint8Array(workerData),
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: true,
    });
    const pdf = await task.promise;
    if (pdf.numPages > 200)
      throw new Error('Ce PDF dépasse la limite de 200 pages. Séparez-le en plusieurs documents.');
    const pages = [],
      emptyPages = [],
      ocrPages = [];
    let size = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = content.items
        .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
        .join('')
        .trim();
      if (!text && ocrPages.length < MAX_OCR_PAGES) {
        parentPort.postMessage({ progress: { page: number, pageCount: pdf.numPages } });
        const read = await recognize(page);
        text = read.text;
        if (text) ocrPages.push({ number, confidence: Math.round(read.confidence) });
      }
      size += text.length;
      if (size > 1000000)
        throw new Error('Ce PDF contient trop de texte. Séparez-le en plusieurs documents.');
      pages.push({ number, text });
      if (!text) emptyPages.push(number);
      page.cleanup();
    }
    if (!size)
      throw new Error(
        'Aucun texte trouvé dans ce PDF, même par reconnaissance de caractères (OCR) : pages blanches, images sans écriture ou scan illisible.',
      );
    parentPort.postMessage({ pages, pageCount: pdf.numPages, emptyPages, ocrPages });
  } catch (error) {
    parentPort.postMessage({
      error:
        error.name === 'PasswordException'
          ? 'Ce PDF est protégé par mot de passe. Importez une copie déverrouillée.'
          : error.message,
    });
  } finally {
    await ocr?.terminate().catch(() => {});
    await task?.destroy();
  }
})();
