const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../src/remote.cjs');

test('clé : longue, aléatoire, comparée sans fuite de durée', () => {
  const a = r.newToken();
  assert.ok(a.length >= 40);
  assert.notEqual(a, r.newToken());
  assert.equal(r.sameToken(a, a), true);
  assert.equal(r.sameToken(a.slice(0, -1) + 'x', a), false);
  assert.equal(r.sameToken('', ''), false, 'clé vide jamais acceptée');
  assert.equal(r.sameToken(undefined, a), false);
});

test('adresses joignables : réseau local et Tailscale seulement', () => {
  const list = r.addresses({
    lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    en0: [
      { family: 'IPv4', address: '192.168.1.20', internal: false },
      { family: 'IPv6', address: 'fe80::1', internal: false },
    ],
    utun4: [{ family: 'IPv4', address: '100.101.12.3', internal: false }],
    en5: [{ family: 'IPv4', address: '41.223.10.5', internal: false }],
  });
  assert.deepEqual(
    list.map((a) => [a.address, a.kind]),
    [
      ['192.168.1.20', 'local'],
      ['100.101.12.3', 'tailscale'],
    ],
  );
});

test('essais de clé limités : blocage après 10 échecs en une minute', () => {
  const limiter = r.rateLimiter(10, 60000);
  for (let i = 0; i < 10; i++) limiter.fail('1.2.3.4', 1000);
  assert.equal(limiter.blocked('1.2.3.4', 2000), true);
  assert.equal(limiter.blocked('5.6.7.8', 2000), false);
  assert.equal(limiter.blocked('1.2.3.4', 62000), false, 'débloqué après une minute');
});

test('en-tête Host : seulement une adresse de l’ordinateur, avec le bon port', () => {
  const allowed = ['127.0.0.1', '192.168.1.20'];
  assert.equal(r.hostAllowed('192.168.1.20:47800', allowed, 47800), true);
  assert.equal(r.hostAllowed('192.168.1.20:8080', allowed, 47800), false);
  assert.equal(r.hostAllowed('site-malveillant.com:47800', allowed, 47800), false);
  assert.equal(r.hostAllowed(undefined, allowed, 47800), false);
});
