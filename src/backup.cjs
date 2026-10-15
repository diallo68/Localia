// Sauvegarde complète des données de Localia dans un seul fichier, chiffré par une phrase de passe
// choisie au moment de la sauvegarde (indépendante du trousseau de cet ordinateur : la sauvegarde
// se restaure aussi sur un autre ordinateur).
// Format : en-tête « LOCALIA-SAUVEGARDE-1 », paramètres (sel, vecteur, étiquette), puis le contenu
// compressé (gzip) et chiffré (AES-256-GCM, clé dérivée par scrypt). Le contenu liste chaque fichier
// avec son empreinte SHA-256, vérifiée à la lecture.
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const MAGIC = Buffer.from('LOCALIA-SAUVEGARDE-1\n');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MIN_PASSPHRASE = 10;

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const deriveKey = (passphrase, salt) => crypto.scryptSync(passphrase, salt, 32, SCRYPT);

function checkPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE)
    throw new Error(`Phrase de passe trop courte : ${MIN_PASSPHRASE} caractères au moins.`);
}

// files : { 'conversations.json': texte, … } ; documents : { identifiant: texte, … }.
function packBackup(
  { files, documents, version, createdAt = new Date().toISOString() },
  passphrase,
) {
  checkPassphrase(passphrase);
  const manifest = {};
  for (const [name, text] of Object.entries(files)) manifest[`fichier:${name}`] = sha256(text);
  for (const [id, text] of Object.entries(documents)) manifest[`document:${id}`] = sha256(text);
  const content = JSON.stringify({ format: 1, version, createdAt, manifest, files, documents });
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(content)), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

// Contenu d'une sauvegarde : phrase de passe vérifiée (étiquette GCM), puis chaque empreinte.
function unpackBackup(buffer, passphrase) {
  checkPassphrase(passphrase);
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error('Ce fichier n’est pas une sauvegarde Localia.');
  let at = MAGIC.length;
  const salt = buffer.subarray(at, (at += 16));
  const iv = buffer.subarray(at, (at += 12));
  const tag = buffer.subarray(at, (at += 16));
  let content;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    content = zlib.gunzipSync(
      Buffer.concat([decipher.update(buffer.subarray(at)), decipher.final()]),
    );
  } catch {
    throw new Error('Phrase de passe incorrecte, ou fichier de sauvegarde modifié ou incomplet.');
  }
  const data = JSON.parse(content.toString('utf8'));
  if (data.format !== 1 || !data.manifest || !data.files || !data.documents)
    throw new Error('Format de sauvegarde inconnu.');
  const damaged = [];
  const listed = new Set(Object.keys(data.manifest));
  const check = (key, text) => {
    if (typeof text !== 'string' || data.manifest[key] !== sha256(text)) damaged.push(key);
    listed.delete(key);
  };
  for (const [name, text] of Object.entries(data.files)) check(`fichier:${name}`, text);
  for (const [id, text] of Object.entries(data.documents)) check(`document:${id}`, text);
  damaged.push(...listed); // listés dans le manifeste mais absents
  if (damaged.length)
    throw new Error(
      `Sauvegarde endommagée : ${damaged.length} élément(s) ne correspondent pas à leur empreinte.`,
    );
  return data;
}

module.exports = { MIN_PASSPHRASE, packBackup, unpackBackup };
