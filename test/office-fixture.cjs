// Fichiers de test fabriqués à la volée : archive ZIP (Word, Excel) et PDF scanné (une image).
const zlib = require('node:zlib');

function zipFixture(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const packed = zlib.deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(zlib.crc32(data), 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(zlib.crc32(data), 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(header, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const paragraph = (text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
function docxFixture() {
  const body = [
    paragraph('Rapport &amp; bilan de la campagne'),
    '<w:p><w:r><w:t>Parcelle</w:t></w:r><w:r><w:tab/><w:t>Timbi-Madina</w:t></w:r></w:p>',
    '<w:p><w:r><w:delText>texte supprimé</w:delText></w:r></w:p>',
    '<w:tbl><w:tblPr/><w:tr><w:tc>' +
      paragraph('Mois') +
      '</w:tc><w:tc>' +
      paragraph('Pluie (mm)') +
      '</w:tc></w:tr><w:tr><w:tc>' +
      paragraph('Juillet') +
      '</w:tc><w:tc>' +
      paragraph('481') +
      '</w:tc></w:tr></w:tbl>',
    paragraph('Conclusion : traitement conseillé.'),
  ].join('');
  return zipFixture({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
  });
}

function xlsxFixture() {
  const sheet = (rows) => `<worksheet><sheetData>${rows}</sheetData></worksheet>`;
  return zipFixture({
    'xl/workbook.xml':
      '<workbook><workbookPr/><sheets><sheet name="Météo" sheetId="1" r:id="rId1"/><sheet name="Cachée" sheetId="2" state="hidden" r:id="rId2"/><sheet name="Notes" sheetId="3" r:id="rId3"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="/xl/worksheets/sheet3.xml"/></Relationships>',
    'xl/sharedStrings.xml':
      '<sst><si><t>Date</t></si><si><t>Pluie</t></si><si><r><t>Station </t></r><r><t>Timbi</t></r></si><si><t>Relevés 2022</t></si></sst>',
    'xl/styles.xml':
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': sheet(
      '<row r="1"><c r="A1" t="s"><v>3</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"><v>1</v></c><c r="C3" t="s"><v>2</v></c></row>' +
        '<row r="4"><c r="A4" s="1"><v>44743</v></c><c r="B4"><v>12.5</v></c><c r="C4" t="inlineStr"><is><t>ok</t></is></c></row>' +
        '<row r="5"><c r="A5" s="1"><v>44744</v></c><c r="C5" t="b"><v>1</v></c></row>',
    ),
    'xl/worksheets/sheet2.xml': sheet('<row r="1"><c r="A1"><v>1</v></c></row>'),
    'xl/worksheets/sheet3.xml': sheet(
      '<row r="1"><c r="A1" t="str"><v>Total &lt; 500</v></c><c r="B1"><f>SUM(1)</f><v>1</v></c></row>',
    ),
  });
}

// PDF d'une page qui ne contient qu'une image (comme un scan) : texte dessiné en noir sur blanc.
function scannedPdfFixture(lines) {
  const { createCanvas } = require('@napi-rs/canvas');
  const width = 1240,
    height = 900;
  const canvas = createCanvas(width, height);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#000';
  g.font = '40px Arial';
  lines.forEach((line, i) => g.fillText(line, 80, 140 + i * 80));
  const rgba = g.getImageData(0, 0, width, height).data;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const image = zlib.deflateSync(rgb);
  const content = Buffer.from('q 612 0 0 444 0 0 cm /Im1 Do Q');
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 444] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`,
      ),
      image,
      Buffer.from('\nendstream'),
    ]),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
      content,
      Buffer.from('\nendstream'),
    ]),
  ];
  const parts = [Buffer.from('%PDF-1.4\n')];
  let size = parts[0].length;
  const offsets = [];
  objects.forEach((object, i) => {
    offsets.push(size);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(chunk);
    size += chunk.length;
  });
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`,
    ),
  );
  return Buffer.concat(parts);
}

module.exports = { zipFixture, docxFixture, xlsxFixture, scannedPdfFixture };
