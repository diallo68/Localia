// Dictée vocale : la voix enregistrée par la page est transcrite sur l'ordinateur par Whisper
// (whisper.cpp). Le modèle (57 Mo) est téléchargé une seule fois, avec l'accord de l'utilisateur,
// puis tout se fait sans Internet. Le son n'est jamais enregistré sur le disque.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const MODEL = {
  file: 'ggml-base-q5_1.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
  size: 59707625,
  sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898',
};
const SAMPLE_RATE = 16000;
const MAX_SECONDS = 120;
const LANGUAGES = ['fr', 'en'];

// Texte transcrit : segments réunis, annotations de Whisper retirées ([Musique], (rires)…).
function cleanTranscript(segments) {
  return segments
    .map((s) => (typeof s === 'string' ? s : s.text || ''))
    .join(' ')
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createDictation({
  dir,
  downloadFile,
  loadWhisper = () => require('smart-whisper').Whisper,
  threads = Math.max(2, Math.floor(os.cpus().length / 2)),
}) {
  const modelPath = path.join(dir, MODEL.file);
  let whisper = null;
  let downloading = null;
  const ready = async () => (await fs.stat(modelPath).catch(() => null))?.size === MODEL.size;
  return {
    MODEL,
    async status() {
      return { ready: await ready(), size: MODEL.size, downloading: Boolean(downloading) };
    },
    async download(onProgress = () => {}) {
      // Contrôle et réservation avant toute attente : deux demandes simultanées ne lancent
      // jamais deux téléchargements.
      if (downloading) throw new Error('Le modèle de dictée est déjà en cours de téléchargement.');
      const controller = (downloading = new AbortController());
      try {
        if (await ready()) return { ready: true };
        await fs.mkdir(dir, { recursive: true });
        if (controller.signal.aborted) return { cancelled: true };
        await downloadFile({ ...MODEL, dest: modelPath, signal: controller.signal, onProgress });
      } catch (error) {
        if (controller.signal.aborted) return { cancelled: true };
        throw error;
      } finally {
        downloading = null;
      }
      return { ready: true };
    },
    cancel() {
      downloading?.abort();
    },
    async transcribe(pcm, lang) {
      if (!(pcm instanceof Float32Array) || !pcm.length) throw new Error('Aucun son enregistré.');
      if (pcm.length > SAMPLE_RATE * MAX_SECONDS)
        throw new Error(`Dictée limitée à ${MAX_SECONDS / 60} minutes.`);
      if (pcm.length < SAMPLE_RATE / 2)
        throw new Error('Enregistrement trop court : parlez plus longtemps.');
      if (!(await ready())) throw new Error('Modèle de dictée absent : téléchargez-le d’abord.');
      if (!whisper) {
        const Whisper = loadWhisper();
        // Modèle libéré de la mémoire après 2 minutes sans dictée.
        whisper = new Whisper(modelPath, {
          gpu: process.platform === 'darwin' && os.arch() === 'arm64',
          offload: 120,
        });
      }
      const task = await whisper.transcribe(pcm, {
        language: LANGUAGES.includes(lang) ? lang : 'fr',
        n_threads: threads,
        suppress_non_speech_tokens: true,
      });
      return cleanTranscript(await task.result);
    },
    async close() {
      await whisper?.free();
      whisper = null;
    },
  };
}

// LOCALIA_FAKE_WHISPER=1 (tests automatiques) : téléchargement et transcription simulés.
const fake = {
  async downloadFile({ dest, size, onProgress }) {
    onProgress({ received: size / 2, total: size });
    const handle = await fs.open(dest, 'w');
    await handle.truncate(size);
    await handle.close();
  },
  loadWhisper: () =>
    class {
      async transcribe(pcm, { language }) {
        const seconds = (pcm.length / SAMPLE_RATE).toFixed(1);
        return {
          result: Promise.resolve([
            { text: ` Texte dicté en ${language}, ${seconds} s [Musique]` },
          ]),
        };
      }
      async free() {}
    },
};

module.exports = { MODEL, SAMPLE_RATE, MAX_SECONDS, cleanTranscript, createDictation, fake };
