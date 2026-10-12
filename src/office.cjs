// Documents Word (.docx) et classeurs Excel (.xlsx) : ce sont des archives ZIP de fichiers XML.
// Lecture locale, sans dépendance : on décompresse les seules parties utiles, avec des limites
// de taille (archive piégée) et on ne garde que le texte et les valeurs des cellules.
const zlib = require('node:zlib');

const MAX_PART = 60 * 1024 * 1024; // taille décompressée maximale d'une partie
const MAX_ROWS = 100000; // lignes lues par feuille
const MAX_CELLS = 2_000_000; // cellules lues dans tout le classeur

// Table des fichiers de l'archive : nom → { method, size, compressed, offset }.
function readZip(buffer) {
  const start = Math.max(0, buffer.length - 65557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= start; i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('Fichier abîmé ou qui n’est pas un document Office.');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50)
      throw new Error('Fichier abîmé : table des contenus illisible.');
    const nameLength = buffer.readUInt16LE(p + 28);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
    entries.set(name, {
      method: buffer.readUInt16LE(p + 10),
      compressed: buffer.readUInt32LE(p + 20),
      size: buffer.readUInt32LE(p + 24),
      offset: buffer.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + buffer.readUInt16LE(p + 30) + buffer.readUInt16LE(p + 32);
  }
  return {
    has: (name) => entries.has(name),
    read(name) {
      const entry = entries.get(name);
      if (!entry) return null;
      if (entry.size > MAX_PART) throw new Error('Document trop volumineux une fois décompressé.');
      const local = entry.offset;
      if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
        throw new Error('Fichier abîmé : contenu illisible.');
      const begin = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(begin, begin + entry.compressed);
      if (entry.method === 0) return data.toString('utf8');
      if (entry.method !== 8) throw new Error('Compression non prise en charge dans ce document.');
      return zlib.inflateRawSync(data, { maxOutputLength: MAX_PART }).toString('utf8');
    },
  };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescapeXml = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) =>
    code[0] === '#'
      ? String.fromCodePoint(
          code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)),
        )
      : (ENTITIES[code] ?? all),
  );
const attribute = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
};

// Texte d'un document Word : paragraphes séparés par une ligne vide, tableaux ligne par ligne
// (cellules séparées par « | »). Le texte supprimé en mode révision (w:delText) est ignoré.
function docxText(buffer) {
  const zip = readZip(buffer);
  const xml = zip.read('word/document.xml');
  if (xml === null) throw new Error('Ce fichier n’est pas un document Word (.docx).');
  let text = '';
  let tables = 0;
  const token =
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>|<\/w:tc>|<\/w:tr>|<w:tbl\b[^>]*>|<\/w:tbl>/g;
  for (const m of xml.matchAll(token)) {
    const tag = m[0];
    if (m[1] !== undefined) text += unescapeXml(m[1]);
    else if (tag === '<w:tab/>') text += '\t';
    else if (tag.startsWith('<w:br') || tag.startsWith('<w:cr')) text += '\n';
    else if (tag === '</w:p>') text += tables ? ' ' : '\n\n';
    else if (tag === '</w:tc>') text = text.replace(/ +$/, '') + ' | ';
    else if (tag === '</w:tr>') text = text.replace(/ \| $/, '') + '\n';
    else if (tag.startsWith('<w:tbl')) tables++;
    else if (tag === '</w:tbl>') {
      tables--;
      if (!tables) text += '\n';
    }
  }
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Présentation PowerPoint (.pptx) : texte de chaque diapositive (paragraphes, tableaux) et ses
// notes de l'orateur, dans l'ordre de la présentation ; diapositives masquées ignorées.
function pptxSlides(buffer) {
  const zip = readZip(buffer);
  const presentation = zip.read('ppt/presentation.xml');
  if (presentation === null)
    throw new Error('Ce fichier n’est pas une présentation PowerPoint (.pptx).');
  const rels = zip.read('ppt/_rels/presentation.xml.rels') || '';
  const targets = new Map(
    [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [
      attribute(m[0], 'Id'),
      attribute(m[0], 'Target'),
    ]),
  );
  const order = [...presentation.matchAll(/<p:sldId\b[^>]*>/g)]
    .map((m) => targets.get(attribute(m[0], 'r:id')))
    .filter(Boolean)
    .map((t) => 'ppt/' + t.replace(/^\/?ppt\//, '').replace(/^\.\.\//, ''));
  const text = (xml) =>
    xml
      // Cellule de tableau : ses paragraphes sur une même ligne.
      .replace(/<a:tc\b[^]*?<\/a:tc>/g, (cell) => cell.replace(/<\/a:p>/g, ' '))
      .replace(/<a:br\b[^>]*\/>/g, '\n')
      .replace(/<\/a:p>/g, '\n')
      .replace(/<\/a:tc>/g, ' | ')
      .replace(/<\/a:tr>/g, '\n')
      .replace(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>|<[^>]+>/g, (_, t) => (t ? unescapeXml(t) : ''))
      .replace(/ +\| /g, ' | ')
      .replace(/ \| \n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  const slides = [];
  order.forEach((part, index) => {
    const xml = zip.read(part);
    if (!xml || /<p:sld\b[^>]*\sshow="0"/.test(xml)) return;
    const relsPart = part.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const notesTarget = /Target="([^"]*notesSlide\d+\.xml)"/.exec(zip.read(relsPart) || '')?.[1];
    const notesXml = notesTarget
      ? zip.read('ppt/' + notesTarget.replace(/^\.\.\//, '').replace(/^\/?ppt\//, ''))
      : null;
    // Notes : seulement le corps (pas le numéro ni l'image de la diapositive).
    const notes = notesXml
      ? text(
          [...notesXml.matchAll(/<p:sp>[^]*?<\/p:sp>/g)]
            .filter((m) => /type="body"/.test(m[0]))
            .map((m) => m[0])
            .join(''),
        )
      : '';
    const body = text(xml);
    if (body || notes)
      slides.push({
        number: index + 1,
        text: body + (notes ? `\n\nNotes de l’orateur : ${notes}` : ''),
      });
  });
  return slides;
}

// Formats de nombre qui sont des dates : identifiants prédéfinis d'Excel, ou format personnalisé
// contenant jour, mois ou année (hors texte entre guillemets et couleurs entre crochets).
const DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function dateStyles(stylesXml) {
  if (!stylesXml) return [];
  const custom = new Map();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*\/?>/g)) {
    const code = (attribute(m[0], 'formatCode') || '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
    custom.set(
      Number(attribute(m[0], 'numFmtId')),
      /[dmy]/i.test(code) && !/^[#0.,%\s]*$/.test(code),
    );
  }
  const xfs = /<cellXfs\b[^>]*>([^]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfs) return [];
  return [...xfs[1].matchAll(/<xf\b[^>]*?\/?>/g)].map((m) => {
    const id = Number(attribute(m[0], 'numFmtId') || 0);
    return DATE_FORMATS.has(id) || custom.get(id) === true;
  });
}
// Numéro de série Excel → date (AAAA-MM-JJ, avec l'heure si elle n'est pas minuit).
function serialDate(serial, date1904) {
  const ms = Math.round((serial + (date1904 ? -24107 : -25569)) * 86400000);
  if (!Number.isFinite(ms)) return String(serial);
  const iso = new Date(ms).toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ');
}
const columnIndex = (ref) => {
  const letters = /^[A-Z]+/.exec(ref || '');
  if (!letters) return -1;
  return [...letters[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
};
const cellText = (xml) =>
  [...xml.replace(/<rPh\b[^]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)]
    .map((m) => unescapeXml(m[1]))
    .join('');

// Feuilles visibles d'un classeur Excel : [{ name, rows: [[cellule, …], …], truncated }].
function xlsxSheets(buffer) {
  const zip = readZip(buffer);
  const workbook = zip.read('xl/workbook.xml');
  if (workbook === null) throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx).');
  const date1904 = /<workbookPr\b[^>]*\sdate1904="(1|true)"/.test(workbook);
  const rels = new Map(
    [...(zip.read('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)].map(
      (m) => [attribute(m[0], 'Id'), attribute(m[0], 'Target')],
    ),
  );
  const shared = [
    ...(zip.read('xl/sharedStrings.xml') || '').matchAll(/<si>([^]*?)<\/si>|<si\/>/g),
  ].map((m) => (m[1] ? cellText(m[1]) : ''));
  const isDate = dateStyles(zip.read('xl/styles.xml'));
  let cells = 0;
  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    if (/\sstate="(hidden|veryHidden)"/.test(m[0])) continue;
    const target = rels.get(attribute(m[0], 'r:id')) || '';
    const part = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = zip.read(part);
    if (xml === null) continue;
    const rows = [];
    let truncated = false;
    for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([^]*?)<\/row>)/g)) {
      if (rows.length >= MAX_ROWS || cells >= MAX_CELLS) {
        truncated = true;
        break;
      }
      const number = Number(attribute(row[1], 'r')) || rows.length + 1;
      while (rows.length < number - 1) rows.push([]);
      const values = [];
      for (const c of (row[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([^]*?)<\/c>)/g)) {
        const type = attribute(c[1], 't');
        const inner = c[2] || '';
        const raw = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
        let value = '';
        if (type === 's') value = shared[Number(raw)] ?? '';
        else if (type === 'inlineStr') value = cellText(inner);
        else if (type === 'b') value = raw === '1' ? 'VRAI' : raw === '0' ? 'FAUX' : '';
        else if (raw !== undefined) {
          value = unescapeXml(raw);
          const number = Number(value);
          if (type !== 'str' && type !== 'e' && value !== '' && Number.isFinite(number))
            value = isDate[Number(attribute(c[1], 's') || 0)]
              ? serialDate(number, date1904)
              : String(number);
        }
        const index = columnIndex(attribute(c[1], 'r'));
        values[index >= 0 ? index : values.length] = value.replace(/\s*\n\s*/g, ' ').trim();
        cells++;
      }
      rows.push(Array.from(values, (v) => v ?? ''));
    }
    // Lignes et colonnes vides en fin de feuille retirées.
    while (rows.length && rows[rows.length - 1].every((v) => !v)) rows.pop();
    const width = Math.max(
      0,
      ...rows.map((r) => r.reduceRight((w, v, i) => w || (v ? i + 1 : 0), 0)),
    );
    sheets.push({
      name: attribute(m[0], 'name') || `Feuille ${sheets.length + 1}`,
      rows: rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')),
      truncated,
    });
  }
  return sheets;
}

module.exports = { readZip, docxText, pptxSlides, xlsxSheets, serialDate, unescapeXml };
