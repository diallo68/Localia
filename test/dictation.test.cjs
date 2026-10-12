const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { MODEL, cleanTranscript, createDictation, fake } = require('../src/dictation.cjs');

test('transcription nettoyée : segments réunis, annotations de Whisper retirées', () => {
  assert.equal(
    cleanTranscript([
      { text: ' Bonjour,' },
      { text: ' [Musique] quelle pluie (rires) en juillet ?' },
    ]),
    'Bonjour, quelle pluie en juillet ?',
  );
  assert.equal(cleanTranscript([{ text: ' [BLANK_AUDIO]' }]), '');
});

test('dictée : modèle téléchargé une fois, puis transcription locale', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-dictee-'));
  try {
    const progress = [];
    let downloads = 0;
    const dictation = createDictation({
      dir,
      loadWhisper: fake.loadWhisper,
      downloadFile: async (options) => {
        downloads++;
        assert.equal(options.url, MODEL.url);
        assert.equal(options.sha256, MODEL.sha256);
        await fake.downloadFile(options);
      },
    });
    assert.equal((await dictation.status()).ready, false);
    await assert.rejects(dictation.transcribe(new Float32Array(16000), 'fr'), /téléchargez-le/);
    assert.deepEqual(await dictation.download((p) => progress.push(p)), { ready: true });
    assert.equal(progress.length, 1);
    assert.equal((await dictation.status()).ready, true);
    await dictation.download();
    assert.equal(downloads, 1, 'pas de second téléchargement');
    assert.equal(
      await dictation.transcribe(new Float32Array(32000), 'en'),
      'Texte dicté en en, 2.0 s',
    );
    assert.equal(
      await dictation.transcribe(new Float32Array(16000), 'pular'),
      'Texte dicté en fr, 1.0 s',
      'langue inconnue : français',
    );
    await assert.rejects(dictation.transcribe(new Float32Array(0), 'fr'), /Aucun son/);
    await assert.rejects(dictation.transcribe(new Float32Array(4000), 'fr'), /trop court/);
    await assert.rejects(dictation.transcribe(new Float32Array(16000 * 121), 'fr'), /2 minutes/);
    await assert.rejects(dictation.transcribe([0.1, 0.2], 'fr'), /Aucun son/);
    await dictation.close();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('dictée : téléchargement annulé sans erreur', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'localia-dictee-'));
  try {
    const dictation = createDictation({
      dir,
      downloadFile: ({ signal }) =>
        new Promise((resolve, reject) => {
          if (signal.aborted) reject(new Error('interrompu'));
          signal.addEventListener('abort', () => reject(new Error('interrompu')));
        }),
    });
    const pending = dictation.download();
    await assert.rejects(dictation.download(), /déjà en cours/);
    dictation.cancel();
    assert.deepEqual(await pending, { cancelled: true });
    assert.equal((await dictation.status()).ready, false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
