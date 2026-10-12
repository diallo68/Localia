const { parentPort, workerData } = require('node:worker_threads');
const { createOcr } = require('./ocr.cjs');
// Photo d'un projet (document photographié, tableau, affiche…) : image décodée, réduite si elle est
// très grande, puis texte lu par reconnaissance de caractères. Rien ne quitte l'ordinateur.
const MAX_SIDE = 2600;
(async () => {
  let ocr;
  try {
    const { loadImage, createCanvas } = require('@napi-rs/canvas');
    const image = await loadImage(Buffer.from(workerData));
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height, 1));
    const canvas = createCanvas(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    );
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    ocr = await createOcr();
    const { data } = await ocr.recognize(canvas.toBuffer('image/png'));
    parentPort.postMessage({
      text: data.text.replace(/[ \t]+\n/g, '\n').trim(),
      confidence: data.confidence,
      width: image.width,
      height: image.height,
    });
  } catch (error) {
    parentPort.postMessage({ error: error?.message || String(error) });
  } finally {
    await ocr?.terminate().catch(() => {});
  }
})();
