// Chiffrement des données sur le disque : AES-256-GCM avec une clé aléatoire de 256 bits.
// Un fichier chiffré commence par un en-tête reconnaissable ; un fichier sans en-tête est lu tel
// quel (données d'avant le chiffrement, ou chiffrement désactivé). La clé elle-même est protégée
// par le coffre de clés du système (main.cjs) et peut être exportée comme clé de secours.
const crypto = require('node:crypto');

const MAGIC = Buffer.from('LOCALIA-CHIFFRE-1\n');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const RECOVERY_PREFIX = 'LOCALIA-CLE-1:';

const newKey = () => crypto.randomBytes(32);
const isEncrypted = (buffer) =>
  buffer.length >= MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC);

function encrypt(text, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

// Texte d'un fichier lu sur le disque, chiffré ou non. Une modification du fichier chiffré ou une
// mauvaise clé est détectée (étiquette d'authentification GCM).
function decrypt(buffer, key) {
  if (!isEncrypted(buffer)) return buffer.toString('utf8');
  if (!key)
    throw new Error(
      'Données chiffrées, mais la clé est indisponible (coffre de clés du système refusé ou réinitialisé). Importez la clé de secours dans Réglages des modèles → Données.',
    );
  const start = MAGIC.length;
  const iv = buffer.subarray(start, start + IV_BYTES);
  const tag = buffer.subarray(start + IV_BYTES, start + IV_BYTES + TAG_BYTES);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(buffer.subarray(start + IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Fichier chiffré illisible : clé différente ou fichier modifié.');
  }
}

const recoveryText = (key) => RECOVERY_PREFIX + key.toString('base64');
function parseRecovery(text) {
  const match = String(text).match(/LOCALIA-CLE-1:([A-Za-z0-9+/]{43}=)/);
  if (!match) throw new Error('Ce fichier ne contient pas de clé de secours Localia.');
  return Buffer.from(match[1], 'base64');
}

module.exports = { newKey, isEncrypted, encrypt, decrypt, recoveryText, parseRecovery };
