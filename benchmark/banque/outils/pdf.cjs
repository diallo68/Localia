// Petit générateur de PDF texte (Helvetica, WinAnsi) : titres, paragraphes coupés à la largeur de
// la page, tableaux simples en texte, pied de page avec numéro. Sert à créer les documents fictifs
// de la banque de questions ; aucune dépendance.
const WIN_ANSI = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c, ' ': 0xa0, ' ': 0xa0,
};
function encode(text) {
  const bytes = [];
  for (const ch of text) {
    const code = WIN_ANSI[ch] ?? ch.codePointAt(0);
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return Buffer.from(bytes)
    .toString('latin1')
    .replace(/[()\\]/g, '\\$&');
}

// Largeur approximative d'une ligne en Helvetica : coupe par mots.
function wrap(text, size) {
  const max = Math.floor(500 / (size * 0.5));
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

// blocks : [{ titre }, { texte }, { tableau: [[…], …] }, { saut: true }]
function buildPdf(blocks, footer) {
  const pages = [[]];
  let y = 750;
  const add = (text, size, gap = 0, bold = false) => {
    if (y - size - gap < 70) {
      pages.push([]);
      y = 750;
    }
    y -= gap;
    pages.at(-1).push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 56 ${y} Td (${encode(text)}) Tj ET`);
    y -= size * 1.35;
  };
  for (const b of blocks) {
    if (b.saut) {
      pages.push([]);
      y = 750;
    } else if (b.titre) for (const l of wrap(b.titre, b.taille || 14)) add(l, b.taille || 14, 8, true);
    else if (b.texte) {
      wrap(b.texte, 10.5).forEach((l, i) => add(l, 10.5, i ? 0 : 6));
    } else if (b.tableau) {
      const widths = b.tableau[0].map((_, c) => Math.max(...b.tableau.map((r) => String(r[c]).length)));
      b.tableau.forEach((row, i) =>
        add(row.map((cell, c) => String(cell).padEnd(widths[c] + 2)).join(''), 9.5, i ? 0 : 6, i === 0),
      );
    }
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const kids = [];
  pages.forEach((lines, i) => {
    const stream = [
      ...lines,
      `BT /F1 8 Tf 56 40 Td (${encode(`${footer} — page ${i + 1} sur ${pages.length}`)}) Tj ET`,
    ].join('\n');
    const id = objects.length + 1;
    kids.push(id);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map((n) => `${n} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { buffer: Buffer.from(pdf, 'latin1'), pages: pages.length };
}

module.exports = { buildPdf };
