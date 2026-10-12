// Réponse exportée en Word (.docx) : la page envoie des blocs simples (titres, paragraphes,
// listes, code, tableaux, avec gras, italique et code dans le texte) ; on écrit le XML de Word et
// l'archive ZIP ici, sans dépendance.
const zlib = require('node:zlib');

function writeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const packed = zlib.deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const crc = zlib.crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // noms en UTF-8
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
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

// Caractères interdits en XML retirés, puis échappement.
const xml = (text) =>
  String(text)
    .replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const MAX_BLOCKS = 5000;
const MAX_TEXT = 2_000_000;

function run({ text = '', bold, italic, code }) {
  const props =
    (bold ? '<w:b/>' : '') +
    (italic ? '<w:i/>' : '') +
    (code
      ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="F2F2F2"/>'
      : '');
  // Retours à la ligne dans un même paragraphe : sauts de ligne de Word.
  return String(text)
    .split('\n')
    .map(
      (part, i) =>
        `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`,
    )
    .join('');
}
const runs = (list) => (Array.isArray(list) ? list : []).map(run).join('');
const paragraph = (content, style, extra = '') =>
  `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${content}</w:p>`;

function blockXml(block) {
  switch (block?.type) {
    case 'heading':
      return paragraph(runs(block.runs), `Titre${Math.min(3, Math.max(1, block.level | 0))}`);
    case 'list':
      return (block.items || [])
        .slice(0, 1000)
        .map((item, i) =>
          paragraph(
            run({ text: block.ordered ? `${i + 1}. ` : '• ' }) + runs(item),
            null,
            '<w:ind w:left="567" w:hanging="283"/>',
          ),
        )
        .join('');
    case 'code':
      return paragraph(run({ text: block.text || '', code: true }), 'Code');
    case 'quote':
      return paragraph(runs(block.runs), 'Citation');
    case 'table': {
      const rows = (block.rows || []).slice(0, 1000);
      if (!rows.length) return '';
      const border =
        '<w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/>';
      return (
        `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${border}</w:tblBorders></w:tblPr>` +
        rows
          .map(
            (row, r) =>
              `<w:tr>${(row || [])
                .slice(0, 50)
                .map((cell) => `<w:tc>${paragraph(run({ text: cell, bold: r === 0 }))}</w:tc>`)
                .join('')}</w:tr>`,
          )
          .join('') +
        '</w:tbl>' +
        paragraph('')
      );
    }
    default:
      return paragraph(runs(block?.runs));
  }
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Titre"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titre2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titre3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:fill="F2F2F2"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Citation"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Discret"><w:name w:val="Subtle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

// Document complet : titre, date, question, blocs de la réponse, rappel de prudence.
function answerDocx({ title, date, question, blocks, model }) {
  if (!Array.isArray(blocks) || blocks.length > MAX_BLOCKS) throw new Error('Réponse invalide.');
  if (JSON.stringify(blocks).length > MAX_TEXT) throw new Error('Réponse trop longue.');
  const body =
    paragraph(run({ text: title || 'Réponse de Localia' }), 'Titre') +
    paragraph(run({ text: `Localia · ${date || ''}` }), 'Discret') +
    (question
      ? paragraph(run({ text: 'Question : ', bold: true }) + run({ text: question }), 'Citation')
      : '') +
    blocks.map(blockXml).join('') +
    paragraph(
      run({
        text: `Réponse écrite sur cet ordinateur par ${model || 'un modèle local'}, sans Internet. Une IA peut se tromper : vérifiez les points importants.`,
      }),
      'Discret',
    );
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return writeZip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': STYLES,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  });
}

module.exports = { writeZip, answerDocx };
