// Accès depuis les autres appareils (téléphone, ordinateur) : petit serveur web, désactivé par
// défaut, protégé par une clé secrète transmise par QR code. Les questions passent par la fenêtre
// de Localia (mêmes conversations, mêmes vérifications) ; aucune donnée ne quitte le Mac en dehors
// des réponses envoyées à l'appareil autorisé.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_PORT = 47800;
const MAX_BODY = 100_000;

const newToken = () => crypto.randomBytes(32).toString('base64url');
// Comparaison en temps constant : la durée ne révèle rien de la clé.
function sameToken(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}

// Adresses de l'ordinateur joignables par les autres appareils : réseau local (Wi-Fi, câble) et
// Tailscale (100.64.0.0/10, réseau privé chiffré, pour l'accès depuis l'extérieur).
function addresses(interfaces) {
  const list = [];
  for (const [name, entries] of Object.entries(interfaces || {}))
    for (const e of entries || []) {
      if (e.family !== 'IPv4' && e.family !== 4) continue;
      if (e.internal) continue;
      const [a, b] = e.address.split('.').map(Number);
      const tailscale = a === 100 && b >= 64 && b <= 127;
      const local = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
      if (!tailscale && !local) continue;
      list.push({ address: e.address, interface: name, kind: tailscale ? 'tailscale' : 'local' });
    }
  return list.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'local' ? -1 : 1));
}

// Trop d'essais de clé faux depuis une même adresse : blocage d'une minute.
function rateLimiter(limit = 10, windowMs = 60000) {
  const failures = new Map();
  return {
    blocked(ip, now = Date.now()) {
      const f = failures.get(ip);
      return Boolean(f && now - f.since < windowMs && f.count >= limit);
    },
    fail(ip, now = Date.now()) {
      const f = failures.get(ip);
      if (!f || now - f.since >= windowMs) failures.set(ip, { since: now, count: 1 });
      else f.count++;
    },
  };
}

// En-tête Host attendu (une adresse de l'ordinateur et le bon port) : protège contre le
// « DNS rebinding », où un site malveillant ferait parler le navigateur à ce serveur.
function hostAllowed(host, allowed, port) {
  const match = /^\[?([^\]]+?)\]?(?::(\d+))?$/.exec(String(host || ''));
  return Boolean(match && allowed.includes(match[1]) && Number(match[2] || 80) === port);
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['app.css', 'text/css; charset=utf-8'],
  '/markdown-it.min.js': ['../vendor/markdown-it.min.js', 'text/javascript; charset=utf-8'],
};
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

// deps : { token(), allowedHosts(), api(route, method, body, res, client) }
function createServer(deps) {
  const limiter = rateLimiter();
  const json = (res, status, value) => {
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(value));
  };
  return http.createServer(async (req, res) => {
    const ip = req.socket.remoteAddress || '';
    const url = new URL(req.url, 'http://localia');
    if (!hostAllowed(req.headers.host, deps.allowedHosts(), req.socket.localPort))
      return json(res, 421, { erreur: 'Adresse non reconnue.' });
    if (req.method === 'GET' && STATIC[url.pathname]) {
      const [file, type] = STATIC[url.pathname];
      res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type });
      return res.end(await fs.readFile(path.join(__dirname, 'remote', file)));
    }
    if (!url.pathname.startsWith('/api/')) return json(res, 404, { erreur: 'Introuvable.' });
    if (limiter.blocked(ip))
      return json(res, 429, { erreur: 'Trop d’essais : attendez une minute.' });
    const given = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!sameToken(given, deps.token())) {
      limiter.fail(ip);
      return json(res, 401, { erreur: 'Clé absente ou périmée : scannez à nouveau le QR code.' });
    }
    let body = null;
    if (req.method === 'POST') {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return json(res, 413, { erreur: 'Message trop long.' });
        chunks.push(chunk);
      }
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        return json(res, 400, { erreur: 'Requête invalide.' });
      }
    }
    try {
      await deps.api(url.pathname.slice(5), req.method, body, res, {
        ip,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
        json: (status, value) => json(res, status, value),
        stream: () => {
          res.writeHead(200, {
            ...SECURITY_HEADERS,
            'Content-Type': 'text/event-stream; charset=utf-8',
            Connection: 'keep-alive',
          });
          return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        },
      });
    } catch (error) {
      if (!res.headersSent) json(res, 500, { erreur: error.message });
      else res.end();
    }
  });
}

module.exports = {
  DEFAULT_PORT,
  newToken,
  sameToken,
  addresses,
  rateLimiter,
  hostAllowed,
  createServer,
};
