// Dictée vocale : bouton micro de la zone de saisie. Un clic pour parler, un second pour terminer ;
// le son est converti en 16 kHz ici, transcrit par Whisper sur l'ordinateur, puis ajouté au message.
const DICTATION_SECONDS = 120;
let dictating = null; // { recorder, stream, timer }
let dictationBusy = false;

function dictateButton(state) {
  const button = $('dictate');
  button.classList.toggle('recording', state === 'recording');
  button.classList.toggle('busy', state === 'busy');
  button.setAttribute('aria-pressed', String(state === 'recording'));
  button.setAttribute('aria-label', tr(state === 'recording' ? 'Terminer la dictée' : 'Dicter'));
}

// Modèle de dictée : téléchargé une seule fois, après accord.
async function ensureDictationModel() {
  const status = await window.localia.dictationStatus();
  if (status.ready) return true;
  const size = Math.round(status.size / 1e6);
  if (
    !confirm(
      isEnglish()
        ? `Dictation uses a speech recognition model (Whisper, ${size} MB), downloaded once from Hugging Face. After that, your voice is transcribed on this computer, without Internet. Download it now?`
        : `La dictée vocale utilise un modèle de reconnaissance de la parole (Whisper, ${size} Mo), téléchargé une seule fois depuis Hugging Face. Ensuite, votre voix est transcrite sur cet ordinateur, sans Internet. Télécharger maintenant ?`,
    )
  )
    return false;
  notice(tr('Téléchargement du modèle de dictée…'));
  const result = await window.localia.dictationDownload();
  notice('');
  return !result?.cancelled;
}

// Son enregistré (WebM/Opus) → échantillons mono à 16 kHz, comme les attend Whisper.
async function toPcm16k(blob) {
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    return new Float32Array(audio.getChannelData(0));
  } finally {
    context.close();
  }
}

async function startDictation() {
  if (!(await ensureDictationModel())) return;
  if (!(await window.localia.microphoneAccess()))
    throw new Error(
      tr(
        'Accès au micro refusé : autorisez Localia dans les réglages du système (Confidentialité › Micro).',
      ),
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const chunks = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  recorder.onstop = guard(async () => {
    clearTimeout(dictating?.timer);
    stream.getTracks().forEach((track) => track.stop());
    dictating = null;
    dictationBusy = true;
    dictateButton('busy');
    try {
      notice(tr('Transcription de la dictée sur cet ordinateur…'));
      const pcm = await toPcm16k(new Blob(chunks, { type: recorder.mimeType }));
      const text = await window.localia.dictationTranscribe(pcm, settings.lang || 'fr');
      notice(text ? '' : tr('Aucune parole reconnue : rapprochez-vous du micro et réessayez.'));
      if (text) {
        const prompt = $('prompt');
        prompt.value = prompt.value.trim() ? `${prompt.value.trimEnd()} ${text}` : text;
        prompt.dispatchEvent(new Event('input', { bubbles: true }));
        prompt.focus();
      }
    } finally {
      dictationBusy = false;
      dictateButton('idle');
    }
  });
  recorder.start();
  dictating = {
    recorder,
    stream,
    timer: setTimeout(
      () => recorder.state === 'recording' && recorder.stop(),
      DICTATION_SECONDS * 1000,
    ),
  };
  dictateButton('recording');
  notice(tr('Parlez… Cliquez de nouveau sur le micro pour terminer (2 minutes au plus).'));
}

$('dictate').onclick = guard(async () => {
  if (dictating) return dictating.recorder.stop();
  if (dictationBusy) return;
  dictationBusy = true;
  dictateButton('busy');
  try {
    await startDictation();
  } finally {
    dictationBusy = false;
    if (!dictating) dictateButton('idle');
  }
});
// Avancement du téléchargement du modèle de dictée.
window.localia.onProgress(({ kind, data }) => {
  if (kind === 'dictation' && data.total)
    notice(
      `${tr('Téléchargement du modèle de dictée…')} ${Math.round((100 * data.received) / data.total)} %`,
    );
});
