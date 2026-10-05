const { parentPort, workerData } = require('node:worker_threads');
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
      emptyPages = [];
    let size = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
        .join('')
        .trim();
      size += text.length;
      if (size > 1000000)
        throw new Error('Ce PDF contient trop de texte. Séparez-le en plusieurs documents.');
      pages.push({ number, text });
      if (!text) emptyPages.push(number);
      page.cleanup();
    }
    if (!size)
      throw new Error(
        'Ce PDF ne contient pas de texte extractible. Il est peut-être scanné : une reconnaissance de caractères (OCR) est nécessaire, non disponible dans cette version.',
      );
    parentPort.postMessage({ pages, pageCount: pdf.numPages, emptyPages });
  } catch (error) {
    parentPort.postMessage({
      error:
        error.name === 'PasswordException'
          ? 'Ce PDF est protégé par mot de passe. Importez une copie déverrouillée.'
          : error.message,
    });
  } finally {
    await task?.destroy();
  }
})();
