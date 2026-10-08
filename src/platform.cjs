// Ce qui dépend du système : emplacement d'Ollama, version du système, chiffrement du disque,
// dossiers interdits aux actions sur fichiers, noms affichés. macOS (Intel et Apple Silicon),
// Windows ; Linux au mieux.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');

const platform = process.platform;

const run = (command, args, timeout = 3000) =>
  new Promise((resolve) =>
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout) =>
      resolve(error ? null : String(stdout).trim()),
    ),
  );

// Emplacements usuels d'Ollama ; OLLAMA_PATH l'emporte s'il est défini.
function ollamaCandidates(env = process.env, system = platform) {
  if (system === 'win32') {
    const local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return [
      path.win32.join(local, 'Programs', 'Ollama', 'ollama.exe'),
      path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
    ];
  }
  if (system === 'darwin')
    return [
      '/usr/local/bin/ollama', // Mac Intel, et lien créé par l'application Ollama
      '/opt/homebrew/bin/ollama', // Homebrew sur Apple Silicon
      '/Applications/Ollama.app/Contents/Resources/ollama',
    ];
  return ['/usr/local/bin/ollama', '/usr/bin/ollama', '/snap/bin/ollama'];
}
function ollamaPath() {
  if (process.env.OLLAMA_PATH && fs.existsSync(process.env.OLLAMA_PATH))
    return process.env.OLLAMA_PATH;
  return ollamaCandidates().find((p) => fs.existsSync(p)) || null;
}

async function systemInfo() {
  if (platform === 'darwin') {
    const [version, cores] = await Promise.all([
      run('/usr/bin/sw_vers', ['-productVersion']),
      run('/usr/sbin/sysctl', ['-n', 'hw.physicalcpu']),
    ]);
    return {
      os: version ? `macOS ${version}` : null,
      macos: version,
      physicalCores: cores ? Number(cores) : null,
    };
  }
  if (platform === 'win32') {
    const cores = await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '(Get-CimInstance Win32_Processor | Measure-Object NumberOfCores -Sum).Sum',
      ],
      8000,
    );
    return { os: `${os.version()} (${os.release()})`, physicalCores: cores ? Number(cores) : null };
  }
  return { os: `${os.version()} ${os.release()}`, physicalCores: null };
}

// Cartes graphiques : nom et mémoire dédiée (Go), quand le système la donne.
async function graphicsCards() {
  if (platform === 'darwin') {
    const out = await run('/usr/sbin/system_profiler', ['SPDisplaysDataType', '-json'], 10000);
    try {
      return (JSON.parse(out).SPDisplaysDataType || []).map((g) => {
        const vram = /(\d+(?:\.\d+)?)\s*(GB|MB)/i.exec(
          g.spdisplays_vram || g._spdisplays_vram || '',
        );
        return {
          name: g.sppci_model || g._name,
          vramGB: vram ? Number(vram[1]) / (vram[2].toUpperCase() === 'MB' ? 1024 : 1) : null,
          shared: Boolean(g.spdisplays_vram_shared) || g.sppci_bus === 'spdisplays_builtin',
          cores: g.sppci_cores ? Number(g.sppci_cores) : null,
        };
      });
    } catch {
      return [];
    }
  }
  if (platform === 'linux') {
    const nvidia = await run(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      5000,
    );
    return (nvidia || '')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [name, mb] = l.split(',').map((x) => x.trim());
        return { name, vramGB: Math.round(Number(mb) / 1024), shared: false };
      });
  }
  if (platform === 'win32') {
    // nvidia-smi donne la vraie mémoire des cartes NVIDIA (Windows la plafonne à 4 Go).
    const nvidia = await run(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      5000,
    );
    const cards = (nvidia || '')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [name, mb] = l.split(',').map((x) => x.trim());
        return { name, vramGB: Math.round(Number(mb) / 1024), shared: false };
      });
    const out = await run(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json',
      ],
      8000,
    );
    try {
      for (const g of [].concat(JSON.parse(out) || []))
        if (!cards.some((c) => c.name === g.Name))
          cards.push({
            name: g.Name,
            vramGB: g.AdapterRAM ? Math.round(g.AdapterRAM / 2 ** 30) : null,
            shared: false,
          });
    } catch {}
    return cards;
  }
  return [];
}

// Chiffrement de tout le disque : FileVault sur macOS ; inconnu ailleurs (BitLocker demande les
// droits administrateur pour être interrogé).
async function diskEncryption() {
  if (platform !== 'darwin') return null;
  const status = await run('/usr/bin/fdesetup', ['status']);
  return status ? /is On/i.test(status) : null;
}

// Dossiers qui ne peuvent pas être confiés aux actions sur fichiers.
// Chemin réel (Windows : noms courts « RUNNER~1 » développés) ; le chemin tel quel s'il n'existe pas.
const realPath = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p;
  }
};
function forbiddenRoot(
  root,
  dataDir,
  system = platform,
  home = os.homedir(),
  env = process.env,
  real = realPath,
) {
  const p = system === 'win32' ? path.win32 : path.posix;
  const norm = (s) => (system === 'win32' ? p.normalize(s).toLowerCase() : s);
  const r = norm(root);
  const inside = (base) => {
    const b = norm(base);
    return r === b || r.startsWith(b.endsWith(p.sep) ? b : b + p.sep);
  };
  if (r === norm(p.parse(root).root) || r === norm(home)) return 'dossier trop large';
  if (dataDir && inside(dataDir)) return 'dossier de réglages';
  if (system === 'win32') {
    const systemDirs = [
      env.SystemRoot || 'C:\\Windows',
      env.ProgramFiles || 'C:\\Program Files',
      env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      env.ProgramData || 'C:\\ProgramData',
    ];
    if (systemDirs.some(inside)) return 'dossier système';
    // Dossier temporaire (dans AppData) : ses sous-dossiers restent permis, comme sous macOS.
    const temps = [env.TEMP || os.tmpdir()].flatMap((t) => [t, real(t)]);
    if (temps.some((t) => inside(t) && r !== norm(t))) return null;
    if (inside(p.join(home, 'AppData'))) return 'dossier de réglages';
    return null;
  }
  if (system === 'linux') {
    const systemDirs = [
      '/bin',
      '/boot',
      '/dev',
      '/etc',
      '/lib',
      '/lib64',
      '/opt',
      '/proc',
      '/root',
      '/run',
      '/sbin',
      '/snap',
      '/srv',
      '/sys',
      '/usr',
      '/var',
    ];
    const temporary = ['/tmp', '/var/tmp'];
    if (!temporary.some((s) => r.startsWith(s + '/')) && systemDirs.some(inside))
      return 'dossier système';
    if (['.config', '.local', '.cache'].some((d) => inside(p.join(home, d))))
      return 'dossier de réglages';
    return null;
  }
  // Sous macOS, /tmp et les dossiers temporaires de l'utilisateur sont dans /private.
  const temporary = ['/private/tmp', '/private/var/folders'];
  const systemDirs = [
    '/System',
    '/Library',
    '/Applications',
    '/usr',
    '/bin',
    '/sbin',
    '/private',
    '/etc',
  ];
  if (!temporary.some((s) => r.startsWith(s + '/')) && systemDirs.some(inside))
    return 'dossier système';
  if (inside(p.join(home, 'Library'))) return 'dossier de réglages';
  return null;
}

// Noms affichés dans les messages.
const NAMES = {
  darwin: { keystore: 'le trousseau de macOS', fileManager: 'le Finder', trash: 'la Corbeille' },
  win32: {
    keystore: 'la protection des données de Windows',
    fileManager: 'l’Explorateur de fichiers',
    trash: 'la Corbeille',
  },
};
NAMES.linux = {
  keystore: 'le trousseau du système (GNOME Keyring ou KWallet)',
  fileManager: 'le gestionnaire de fichiers',
  trash: 'la corbeille',
};
const names = NAMES[platform] || {
  keystore: 'le coffre de clés du système',
  fileManager: 'le gestionnaire de fichiers',
  trash: 'la corbeille',
};

// Mémoire disponible sur macOS d'après `vm_stat` : pages libres, inactives et spéculatives
// (récupérables sans gêner les applications). os.freemem() n'en compte qu'une petite partie.
function availableFromVmStat(text) {
  const pageSize = Number(/page size of (\d+) bytes/.exec(text)?.[1]);
  const pages = (label) => Number(new RegExp(`Pages ${label}:\\s+(\\d+)`).exec(text)?.[1] || 0);
  if (!pageSize) return null;
  return (pages('free') + pages('inactive') + pages('speculative')) * pageSize;
}

// Mémoire vive : totale et utilisée, en octets.
async function memoryUse(exec = run) {
  const total = os.totalmem();
  let available = os.freemem();
  if (platform === 'darwin') {
    const fromVm = availableFromVmStat((await exec('/usr/bin/vm_stat', [])) || '');
    if (fromVm) available = Math.min(total, fromVm);
  }
  return { total, used: total - available };
}

module.exports = {
  platform,
  ollamaCandidates,
  ollamaPath,
  systemInfo,
  graphicsCards,
  diskEncryption,
  forbiddenRoot,
  names,
  availableFromVmStat,
  memoryUse,
};
