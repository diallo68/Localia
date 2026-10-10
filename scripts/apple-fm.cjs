// Compile l'aide Swift du modèle d'Apple (native/apple-fm) en binaire universel (Apple Silicon et
// Intel) : npm run build:apple-fm. Il faut Xcode 26 ou plus (SDK macOS 26). Le binaire obtenu est
// gardé dans le dépôt (native/apple-fm/bin) et copié dans l'application par electron-builder.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'native', 'apple-fm');
const out = path.join(dir, 'bin', 'localia-apple-fm');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-fm-'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const parts = ['arm64', 'x86_64'].map((arch) => {
  const file = path.join(tmp, arch);
  execFileSync(
    'xcrun',
    [
      'swiftc',
      '-O',
      '-target',
      `${arch}-apple-macos14.0`,
      '-o',
      file,
      path.join(dir, 'main.swift'),
    ],
    { stdio: 'inherit' },
  );
  return file;
});
execFileSync('lipo', ['-create', ...parts, '-output', out], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Aide Apple Intelligence :', out);
