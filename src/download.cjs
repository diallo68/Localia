// Téléchargement d'un fichier de modèle : reprise après coupure (fichier « .part » et requête
// Range), empreinte SHA-256 calculée au fil de l'eau et comparée à celle annoncée, hôtes permis
// seulement (Hugging Face et son réseau de diffusion). Le fichier final n'apparaît qu'une fois vérifié.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');

const HF_HOSTS = /(^|\.)(huggingface\.co|hf\.co)$/i;

async function hashFile(file, hash) {
  await new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', resolve)
      .on('error', reject);
  });
}

async function downloadFile({
  url,
  dest,
  size,
  sha256,
  signal,
  onProgress = () => {},
  allowedHosts = HF_HOSTS,
  requireHttps = true, // désactivé seulement par les tests (serveur local)
  fetchImpl = fetch,
}) {
  const start = new URL(url);
  if (requireHttps && start.protocol !== 'https:')
    throw new Error('Téléchargement en https seulement.');
  if (!allowedHosts.test(start.hostname)) throw new Error(`Hôte non autorisé : ${start.hostname}.`);
  const part = dest + '.part';
  const hash = crypto.createHash('sha256');
  let received = 0;
  // Reprise : le début déjà reçu est relu pour poursuivre le calcul de l'empreinte.
  const existing = await fsp.stat(part).catch(() => null);
  if (existing && existing.size > 0 && existing.size < size) {
    onProgress({ received: existing.size, total: size, phase: 'reprise' });
    await hashFile(part, hash);
    received = existing.size;
  } else if (existing) await fsp.rm(part, { force: true });

  const response = await fetchImpl(start, {
    headers: {
      'User-Agent': 'Localia (modèles)',
      ...(received ? { Range: `bytes=${received}-` } : {}),
    },
    signal,
  });
  // Après les redirections : toujours chez Hugging Face (ou l'hôte de test).
  const final = new URL(response.url || start.href);
  if (!allowedHosts.test(final.hostname))
    throw new Error(`Redirection vers un hôte non autorisé : ${final.hostname}.`);
  if (received && response.status === 200) {
    // Le serveur ignore la reprise : on repart de zéro.
    await fsp.rm(part, { force: true });
    return downloadFile({
      url,
      dest,
      size,
      sha256,
      signal,
      onProgress,
      allowedHosts,
      requireHttps,
      fetchImpl,
    });
  }
  if (!response.ok) throw new Error(`Téléchargement refusé (${response.status}).`);
  const out = fs.createWriteStream(part, { flags: received ? 'a' : 'w', mode: 0o600 });
  let last = 0;
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      received += chunk.length;
      if (received > size) throw new Error('Fichier plus gros qu’annoncé : téléchargement arrêté.');
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
      if (Date.now() - last > 300) {
        last = Date.now();
        onProgress({ received, total: size, phase: 'téléchargement' });
      }
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }
  if (received !== size)
    throw new Error('Téléchargement incomplet : relancez-le pour le reprendre.');
  onProgress({ received, total: size, phase: 'vérification' });
  const digest = hash.digest('hex');
  if (digest !== sha256) {
    await fsp.rm(part, { force: true });
    throw new Error(
      'Empreinte différente de celle annoncée : fichier supprimé, rien n’est utilisé.',
    );
  }
  await fsp.rename(part, dest);
  return { file: dest, sha256: digest, size };
}

module.exports = { HF_HOSTS, downloadFile };
