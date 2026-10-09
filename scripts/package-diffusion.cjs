// Paquet macOS signé (Developer ID) et notarié, pour une diffusion hors de ce Mac.
// Prérequis et étapes : docs/DIFFUSION-MACOS.md. Le paquet local non signé reste `npm run package`.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const pkg = require('../package.json');

function fail(message) {
  console.error(`\nDiffusion impossible : ${message}\nVoir docs/DIFFUSION-MACOS.md.\n`);
  process.exit(1);
}

if (process.platform !== 'darwin') fail('la signature Apple se fait sur un Mac.');
const identities = (() => {
  try {
    return execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
})();
const developerIds = identities
  .split('\n')
  .map((line) => /"(Developer ID Application: [^"]+)"/.exec(line)?.[1])
  .filter(Boolean);
const identity = process.env.CSC_NAME || developerIds[0];
if (!identity)
  fail('aucun certificat « Developer ID Application » dans le trousseau (compte Apple Developer).');
const missing = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'].filter(
  (name) => !process.env[name],
);
if (missing.length) fail(`variables manquantes pour la notarisation : ${missing.join(', ')}.`);

const entitlements = path.join(__dirname, '..', 'build', 'entitlements.mac.plist');
const arch = process.argv.includes('--arm64') ? 'arm64' : 'x64';
console.log(`Signature avec « ${identity} », architecture ${arch}, puis notarisation par Apple…`);
require('electron-builder')
  .build({
    mac: ['dmg', 'zip'],
    [arch]: true,
    config: {
      ...pkg.build,
      mac: {
        ...pkg.build.mac,
        identity: identity.replace(/^Developer ID Application: /, ''),
        target: undefined,
        hardenedRuntime: true,
        gatekeeperAssess: false,
        entitlements,
        entitlementsInherit: entitlements,
        notarize: true,
      },
    },
  })
  .then((files) => console.log('\nPaquets prêts :\n' + files.join('\n')))
  .catch((error) => fail(error.message));
