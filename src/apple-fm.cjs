// Modèle intégré d'Apple (Apple Intelligence, framework Foundation Models) : quatrième moteur.
// Le modèle est fourni par macOS 26 et plus, sur un Mac Apple Silicon où Apple Intelligence est
// activé. Localia passe par une petite aide en Swift (native/apple-fm) qui répond en lignes JSON ;
// tout reste sur l'ordinateur. Le modèle s'appelle « apple/intelligence ».
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MODEL = 'apple/intelligence';
const isApple = (name) => name === MODEL;

// Raisons d'indisponibilité données par macOS, en clair.
const REASONS = {
  osTooOld: 'il faut macOS 26 ou plus récent',
  deviceNotEligible: 'ce Mac n’est pas compatible (il faut un Mac Apple Silicon)',
  appleIntelligenceNotEnabled:
    'Apple Intelligence n’est pas activé (Réglages Système → Apple Intelligence et Siri)',
  modelNotReady: 'le modèle d’Apple est encore en cours de téléchargement par macOS',
  unavailable: 'le modèle d’Apple n’est pas disponible',
};
const ERRORS = {
  exceededContextWindowSize:
    'la conversation ou le document dépasse ce que le modèle d’Apple peut lire (4 096 jetons environ). Raccourcissez-les ou choisissez un autre modèle.',
  guardrailViolation: 'le modèle d’Apple a refusé de répondre (filtre de sécurité d’Apple).',
  refusal: 'le modèle d’Apple a refusé de répondre.',
  unsupportedLanguageOrLocale: 'cette langue n’est pas prise en charge par le modèle d’Apple.',
  assetsUnavailable: 'le modèle d’Apple n’est pas prêt sur ce Mac.',
  rateLimited: 'macOS limite pour l’instant les demandes au modèle d’Apple. Réessayez.',
  concurrentRequests: 'une autre demande au modèle d’Apple est en cours. Réessayez.',
};

// Emplacement de l'aide : LOCALIA_APPLE_FM (tests), application construite, puis dépôt.
function helperPath(env = process.env) {
  if (env.LOCALIA_APPLE_FM) return env.LOCALIA_APPLE_FM;
  if (process.platform !== 'darwin') return null;
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'apple-fm', 'localia-apple-fm'),
    path.join(__dirname, '..', 'native', 'apple-fm', 'bin', 'localia-apple-fm'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// Lance l'aide avec une demande et transmet chacune de ses lignes JSON.
function runHelper(request, { onLine, signal, env } = {}) {
  const helper = helperPath(env);
  if (!helper) return Promise.reject(new Error('Aide Apple Intelligence absente.'));
  return new Promise((resolve, reject) => {
    const child = spawn(helper, [], { env: env || process.env, stdio: ['pipe', 'pipe', 'ignore'] });
    let buffer = '';
    let failure = null;
    const abort = () => child.kill();
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line) continue;
        try {
          onLine?.(JSON.parse(line));
        } catch (error) {
          failure ||= error;
        }
      }
    });
    child.on('error', reject);
    child.on('close', () => {
      signal?.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else resolve();
    });
    child.stdin.end(JSON.stringify(request));
  });
}

// Disponibilité du modèle : { available, reason } (raison en clair si indisponible).
async function status(env) {
  let result = { available: false, reason: REASONS.unavailable };
  try {
    await runHelper(
      { action: 'status' },
      {
        env,
        onLine: (line) => {
          if (line.type === 'status')
            result = line.available
              ? { available: true, reason: null }
              : { available: false, reason: REASONS[line.reason] || REASONS.unavailable };
        },
      },
    );
  } catch {
    return { available: false, reason: null };
  }
  return result;
}

// Conversation au format d'Ollama → consigne (messages système) et texte de la demande. Le
// modèle d'Apple reçoit une seule demande : les échanges précédents y sont recopiés.
function toPrompt(messages) {
  const instructions = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = messages.filter((m) => m.role !== 'system');
  const last = turns.at(-1);
  const earlier = turns.slice(0, -1);
  const history = earlier
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Utilisateur'} : ${m.content}`)
    .join('\n\n');
  return {
    instructions: instructions || null,
    prompt: history
      ? `Échanges précédents :\n\n${history}\n\nNouvelle demande :\n${last?.content || ''}`
      : last?.content || '',
  };
}

// Réponse en flux renvoyée au format d'Ollama. macOS ne donne pas le nombre de jetons : il est
// estimé (4 caractères par jeton) pour garder une vitesse comparable dans le Benchmark.
async function chat({ body, signal, onData, env }) {
  if (body.messages.some((m) => m.images?.length))
    throw new Error('Le modèle d’Apple ne lit pas les photos dans Localia. Retirez la photo.');
  const o = body.options || {};
  const start = process.hrtime.bigint();
  let first = null;
  let text = '';
  let failure = null;
  await runHelper(
    {
      action: 'chat',
      ...toPrompt(body.messages),
      temperature: o.temperature ?? null,
      maxTokens: o.num_predict > 0 ? o.num_predict : null,
    },
    {
      env,
      signal,
      onLine: (line) => {
        if (line.type === 'delta' || line.type === 'replace') {
          first ||= process.hrtime.bigint();
          // « replace » : macOS a réécrit le début ; seule la partie nouvelle est ajoutée.
          const delta = line.type === 'delta' ? line.text : line.text.slice(text.length);
          text = line.type === 'delta' ? text + line.text : line.text;
          if (delta) onData({ message: { content: delta } });
        } else if (line.type === 'error') {
          failure = line;
        }
      },
    },
  );
  if (signal?.aborted) return;
  if (failure)
    throw new Error(
      'Modèle d’Apple : ' +
        (ERRORS[failure.code] || REASONS[failure.code] || failure.message || 'erreur inconnue.'),
    );
  const end = process.hrtime.bigint();
  const promptEnd = first || end;
  onData({
    done: true,
    done_reason: 'stop',
    total_duration: Number(end - start),
    load_duration: 0,
    prompt_eval_count: null,
    prompt_eval_duration: Number(promptEnd - start),
    eval_count: Math.max(1, Math.round(text.length / 4)),
    eval_duration: Number(end - promptEnd),
  });
}

module.exports = { MODEL, isApple, helperPath, status, toPrompt, chat, REASONS };
