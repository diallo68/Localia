const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { downloadFile } = require('../src/download.cjs');
const { CATALOG, downloadUrl } = require('../src/catalog.js');

const content = Buffer.from('GGUF' + 'x'.repeat(200000));
const sha = crypto.createHash('sha256').update(content).digest('hex');
const LOCAL = /^(localhost|127\.0\.0\.1)$/;

// Serveur de test : prend en charge Range ; « /coupe » s'interrompt au milieu ; « /ailleurs » redirige.
async function server() {
  const srv = http.createServer((req, res) => {
    if (req.url === '/ailleurs') {
      res.writeHead(302, { location: 'http://exemple.invalid/x' });
      return res.end();
    }
    const range = /bytes=(\d+)-/.exec(req.headers.range || '');
    const from = range ? Number(range[1]) : 0;
    res.writeHead(range ? 206 : 200, { 'Content-Length': content.length - from });
    if (req.url === '/coupe' && !range) {
      res.write(content.subarray(0, 50000));
      setTimeout(() => res.destroy(), 50);
      return;
    }
    res.end(content.subarray(from));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}
const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'telechargement-'));

test('téléchargement complet vérifié par son empreinte', async () => {
  const { srv, base } = await server();
  const dest = path.join(await tmp(), 'modele.gguf');
  const phases = new Set();
  const r = await downloadFile({
    url: base + '/m',
    dest,
    size: content.length,
    sha256: sha,
    allowedHosts: LOCAL,
    requireHttps: false,
    onProgress: (p) => phases.add(p.phase),
  });
  assert.equal(r.sha256, sha);
  assert.deepEqual(await fs.readFile(dest), content);
  assert.ok(phases.has('vérification'));
  srv.closeAllConnections();
  srv.close();
});

test('coupure puis reprise : seule la fin est retéléchargée', async () => {
  const { srv, base } = await server();
  const dest = path.join(await tmp(), 'modele.gguf');
  await assert.rejects(
    downloadFile({
      url: base + '/coupe',
      dest,
      size: content.length,
      sha256: sha,
      allowedHosts: LOCAL,
      requireHttps: false,
    }),
  );
  const partial = (await fs.stat(dest + '.part')).size;
  assert.ok(partial > 0 && partial < content.length);
  const phases = [];
  await downloadFile({
    url: base + '/m',
    dest,
    size: content.length,
    sha256: sha,
    allowedHosts: LOCAL,
    requireHttps: false,
    onProgress: (p) => phases.push(p.phase),
  });
  assert.equal(phases[0], 'reprise');
  assert.deepEqual(await fs.readFile(dest), content);
  srv.closeAllConnections();
  srv.close();
});

test('empreinte différente : fichier supprimé, rien n’est utilisé', async () => {
  const { srv, base } = await server();
  const dest = path.join(await tmp(), 'modele.gguf');
  await assert.rejects(
    downloadFile({
      url: base + '/m',
      dest,
      size: content.length,
      sha256: '0'.repeat(64),
      allowedHosts: LOCAL,
      requireHttps: false,
    }),
    /Empreinte différente/,
  );
  await assert.rejects(fs.stat(dest));
  await assert.rejects(fs.stat(dest + '.part'));
  srv.closeAllConnections();
  srv.close();
});

test('hôte non autorisé, au départ ou après une redirection', async () => {
  const { srv, base } = await server();
  const dest = path.join(await tmp(), 'modele.gguf');
  await assert.rejects(
    downloadFile({ url: 'https://exemple.org/m.gguf', dest, size: 1, sha256: sha }),
    /Hôte non autorisé/,
  );
  await assert.rejects(
    downloadFile({
      url: base + '/ailleurs',
      dest,
      size: content.length,
      sha256: sha,
      allowedHosts: LOCAL,
      requireHttps: false,
    }),
    /hôte non autorisé|fetch failed/i,
  );
  srv.closeAllConnections();
  srv.close();
});

test('catalogue : empreintes et tailles complètes, identifiants uniques, sans Ministral', () => {
  assert.equal(CATALOG.length, 12);
  assert.equal(new Set(CATALOG.map((m) => m.id)).size, CATALOG.length);
  for (const m of CATALOG) {
    assert.match(m.sha256, /^[0-9a-f]{64}$/, m.id);
    assert.ok(m.size > 5e8, m.id);
    assert.match(m.file, /\.gguf$/, m.id);
    assert.ok(!/ministral|mistral/i.test(m.repo + m.id), m.id);
    // Révision figée : le téléchargement vise un commit précis, pas la branche « main ».
    assert.match(m.revision, /^[0-9a-f]{40}$/, m.id);
    assert.equal(
      downloadUrl(m),
      `https://huggingface.co/${m.repo}/resolve/${m.revision}/${m.file}`,
    );
  }
});
