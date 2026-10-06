// « Lire une page web » : adresses permises, contrôle des adresses IP, décodage, découpage du texte.
// Seul le processus principal télécharge ; la page n'est jamais affichée ni exécutée.
const net = require('node:net');

const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 5;
const SECTION = 2500; // caractères par section (l'équivalent des pages d'un PDF)

// Adresse web acceptée : http ou https, nom d'hôte, sans identifiants ni port inhabituel.
function checkUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error('Adresse invalide : collez une adresse complète (https://…).');
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Seules les adresses http et https sont acceptées.');
  if (url.username || url.password) throw new Error('Adresse avec identifiants refusée.');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port))
    throw new Error('Port inhabituel refusé.');
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(url.hostname))
    throw new Error('Adresse du réseau local refusée.');
  url.hash = '';
  return url;
}

// Adresses privées, locales ou réservées : jamais contactées (Ollama, routeur, autres machines).
function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === '::' ||
      lower === '::1' ||
      /^f[cd]/.test(lower) ||
      /^fe[89ab]/.test(lower) ||
      /^ff/.test(lower)
    );
  }
  return true;
}

// Jeu de caractères : en-tête HTTP, sinon balise meta, sinon UTF-8.
function decodeHtml(bytes, contentType = '') {
  const head = Buffer.from(bytes.subarray(0, 4096)).toString('latin1');
  const charset = (
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ||
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ||
    'utf-8'
  ).toLowerCase();
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// Texte de la page en sections d'environ 2 500 caractères, coupées entre deux paragraphes.
function splitSections(text) {
  const paragraphs = String(text)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
  const pages = [];
  let current = '';
  // Paragraphe très long (page sans structure) : coupé entre deux phrases.
  // Sans fin de phrase repérable : morceaux de taille fixe, pour ne jamais perdre de texte.
  const pieces = paragraphs.flatMap((p) => {
    if (p.length <= SECTION * 1.5) return [p];
    const sentences = p.match(new RegExp(`[^]{1,${SECTION}}(?:[.!?](?=\\s)|$)`, 'g')) || [];
    if (sentences.join('').length === p.length) return sentences.map((x) => x.trim());
    return p.match(new RegExp(`[^]{1,${SECTION}}`, 'g'));
  });
  for (const p of pieces) {
    if (current && current.length + p.length > SECTION) {
      pages.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) pages.push(current);
  return pages.map((text, i) => ({ number: i + 1, text }));
}

module.exports = {
  MAX_BYTES,
  MAX_REDIRECTS,
  checkUrl,
  isPrivateAddress,
  decodeHtml,
  splitSections,
};
