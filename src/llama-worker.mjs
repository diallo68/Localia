import { appendFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
// Moteur intégré (llama.cpp par node-llama-cpp), dans un processus séparé : un modèle qui plante
// ne fait pas planter Localia. Reçoit des conversations au format d'Ollama et renvoie des morceaux
// au même format (message.content, message.thinking, puis statistiques finales).
// LOCALIA_FAKE_LLAMA=1 (tests automatiques) : réponses simulées, sans modèle ni moteur natif.
const fake = process.env.LOCALIA_FAKE_LLAMA === '1';
// Carte graphique (réglage de Localia) : « auto » (llama.cpp l'utilise si elle est prise en charge
// et place sur elle ce qui tient dans sa mémoire), « toujours » (tout le modèle sur la carte) ou
// « jamais » (aucune couche sur la carte : processeur seulement). Le moteur est chargé de la même
// façon dans les trois cas : sur un Mac à puce Apple, seule sa version Metal existe.
const gpuMode = ['toujours', 'jamais'].includes(process.env.LOCALIA_GPU)
  ? process.env.LOCALIA_GPU
  : 'auto';
let llamaModule = null;
let llama = null;
let threads = 1; // fils de calcul de llama.cpp (voir engine)
let loaded = null; // { path, model, context, contextSize, sequence }
let unloadTimer = null;
const running = new Map(); // id → AbortController

const post = (message) => process.parentPort.postMessage(message);
// Diagnostic : LOCALIA_ENGINE_DEBUG=<fichier> y trace les étapes du moteur.
const debug = process.env.LOCALIA_ENGINE_DEBUG
  ? (...parts) =>
      appendFileSync(
        process.env.LOCALIA_ENGINE_DEBUG,
        `${new Date().toISOString()} ${parts.join(' ')}\n`,
      )
  : () => {};
const now = () => process.hrtime.bigint();
const ns = (from, to) => Number(to - from);

async function engine() {
  if (!llama) {
    llamaModule = await import('node-llama-cpp');
    llama = await llamaModule.getLlama();
    // Fils de calcul : au moins la moitié des cœurs logiques. Sous Windows, llama.cpp ne voyait
    // parfois qu'un cœur utile (machine de test à 4 cœurs : environ 25 s par jeton).
    threads = Math.max(llama.cpuMathCores || 1, Math.floor(availableParallelism() / 2) || 1);
    if (llama.maxThreads && llama.maxThreads < threads) llama.maxThreads = threads;
    debug(
      'moteur',
      llama.gpu || 'cpu',
      llama.buildType,
      'cœurs utiles',
      llama.cpuMathCores,
      'fils',
      threads,
      '|',
      String(llama.systemInfo || '').slice(0, 300),
    );
  }
  return llama;
}

// Chargement d'un fichier de modèle selon le réglage de la carte graphique.
async function loadModelFile(path) {
  const l = await engine();
  if (gpuMode === 'jamais') return l.loadModel({ modelPath: path, gpuLayers: 0 });
  if (gpuMode === 'auto') return l.loadModel({ modelPath: path });
  if (!l.gpu)
    throw new Error(
      'Aucune carte graphique utilisable par le moteur sur cet ordinateur : choisissez « Automatique » ou « Jamais » dans Performances.',
    );
  return l.loadModel({ modelPath: path, gpuLayers: 'max' });
}

// Carte graphique réellement utilisée par le moteur : type (metal, cuda, vulkan) ou false.
async function engineInfo({ id }) {
  try {
    if (fake)
      return post({
        type: 'checked',
        id,
        info: { mode: gpuMode, gpu: false, devices: [], vramGB: null },
      });
    const l = await engine();
    const gpu = gpuMode === 'jamais' ? false : l.gpu;
    const devices = gpu ? await l.getGpuDeviceNames().catch(() => []) : [];
    const vram = gpu ? await l.getVramState().catch(() => null) : null;
    post({
      type: 'checked',
      id,
      info: {
        mode: gpuMode,
        gpu: gpu || false,
        devices,
        vramGB: vram?.total ? Math.round((vram.total / 2 ** 30) * 10) / 10 : null,
      },
    });
  } catch (error) {
    post({ type: 'error', id, message: error?.message || String(error) });
  }
}

async function unload() {
  clearTimeout(unloadTimer);
  if (!loaded) return;
  const { context, model } = loaded;
  loaded = null;
  await context.dispose().catch(() => {});
  await model.dispose().catch(() => {});
}

// Modèle chargé et contexte de la taille demandée (rechargés seulement si nécessaire).
async function prepare(path, contextSize) {
  const started = now();
  let loadNs = 0;
  if (loaded && loaded.path !== path) await unload();
  if (!loaded) {
    const model = await loadModelFile(path);
    loaded = { path, model, context: null, contextSize: 0 };
    loadNs = ns(started, now());
  }
  if (!loaded.context || loaded.contextSize !== contextSize) {
    await loaded.context?.dispose();
    loaded.context = await loaded.model.createContext({ contextSize, threads });
    loaded.contextSize = contextSize;
    // Une seule séquence, gardée et vidée avant chaque demande : une séquence rendue n'est pas
    // libérée tout de suite, et la demande suivante échouait parfois (« No sequences left »).
    loaded.sequence = loaded.context.getSequence();
  }
  return loadNs;
}

// Format de conversation du modèle. Réflexion désactivée (think === false) : Gemma 4 sans la
// consigne <|think|>, Qwen découragé de réfléchir ; le budget de réflexion nul (plus bas) coupe
// court à ce qui resterait.
// MedGemma 1.5 écrit parfois son raisonnement entre les jetons spéciaux <unused94> et <unused95>,
// que le format Gemma ne connaît pas : ces jetons sont repérés dans le flux (voir chat), et le
// raisonnement est rangé à part comme celui des autres modèles.
function isMedGemma(fileInfo, path) {
  return /medgemma/i.test(`${fileInfo?.metadata?.general?.name || ''} ${path || ''}`);
}
function chatWrapper(model, think) {
  const { resolveChatWrapper } = llamaModule;
  if (think !== false) return resolveChatWrapper(model);
  return resolveChatWrapper(model, {
    customWrapperSettings: { gemma4: { reasoning: false }, qwen: { thoughts: 'discourage' } },
  });
}

// Le modèle sait-il réfléchir (segments de raisonnement prévus par son format de conversation) ?
async function canThink(path, fileInfo) {
  if (isMedGemma(fileInfo, path)) return true;
  const { resolveChatWrapper } = await import('node-llama-cpp');
  const wrapper = resolveChatWrapper({ fileInfo, filename: path, warningLogs: false });
  return Boolean(wrapper?.settings?.segments?.thought);
}

// Historique d'Ollama (system, user, assistant) → historique de node-llama-cpp.
function history(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const items = system ? [{ type: 'system', text: system }] : [];
  const rest = messages.filter((m) => m.role !== 'system');
  const last = rest.pop();
  if (!last || last.role !== 'user')
    throw new Error('Le dernier message doit venir de l’utilisateur.');
  for (const m of rest)
    items.push(
      m.role === 'user'
        ? { type: 'user', text: m.content }
        : { type: 'model', response: [m.content] },
    );
  return { items, question: last.content };
}

async function chat({ id, path, messages, options = {}, think, keepAlive }) {
  const controller = new AbortController();
  let session = null;
  running.set(id, controller);
  clearTimeout(unloadTimer);
  const start = now();
  try {
    if (fake) {
      // Réponse simulée : deux morceaux, comme un vrai modèle.
      const { question } = history(messages);
      const parts = ['Réponse du moteur intégré ', `à « ${question.slice(0, 40)} »`];
      for (const content of parts) {
        if (controller.signal.aborted) break;
        await new Promise((r) => setTimeout(r, 20));
        post({ type: 'chunk', id, data: { message: { content } } });
      }
      const end = now();
      post({
        type: 'done',
        id,
        data: {
          done: true,
          done_reason: 'stop',
          total_duration: ns(start, end),
          load_duration: 0,
          prompt_eval_count: 12,
          prompt_eval_duration: 1e8,
          eval_count: 2,
          eval_duration: 1e8,
        },
      });
      return;
    }
    const contextSize = options.num_ctx || 4096;
    debug('demande', id, 'contexte', contextSize);
    const loadNs = await prepare(path, contextSize);
    debug('modèle prêt', id);
    const { LlamaChatSession } = llamaModule;
    const sequence = loaded.sequence;
    await sequence.clearHistory();
    debug('séquence vidée', id);
    const before = {
      input: sequence.tokenMeter.usedInputTokens,
      output: sequence.tokenMeter.usedOutputTokens,
    };
    session = new LlamaChatSession({
      contextSequence: sequence,
      autoDisposeSequence: false,
      chatWrapper: chatWrapper(loaded.model, think),
    });
    const { items, question } = history(messages);
    session.setChatHistory(items);
    let firstToken = null;
    let chunks = 0;
    // MedGemma : début et fin du raisonnement repérés par leurs jetons spéciaux.
    const thoughtMarks = isMedGemma(loaded.model.fileInfo, path)
      ? {
          open: loaded.model.tokenize('<unused94>', true)[0],
          close: loaded.model.tokenize('<unused95>', true)[0],
        }
      : null;
    let inThought = false;
    // MedGemma, réflexion désactivée : son format ne prévoit pas de segment de raisonnement
    // (budgets sans effet), on interdit donc le jeton qui l'ouvre.
    const tokenBias =
      thoughtMarks && think === false
        ? llamaModule.TokenBias.for(loaded.model).set(thoughtMarks.open, 'never')
        : undefined;
    const result = await session.promptWithMeta(question, {
      signal: controller.signal,
      stopOnAbortSignal: true,
      // Longueur maximale toujours fixée : sans elle, un modèle qui n'écrit pas son jeton de fin
      // continuait sans fin (vu sous Windows). Par défaut, la taille du contexte.
      maxTokens: options.num_predict > 0 ? options.num_predict : contextSize,
      temperature: options.temperature,
      topP: options.top_p,
      topK: options.top_k,
      seed: options.seed,
      repeatPenalty: options.repeat_penalty ? { penalty: options.repeat_penalty } : undefined,
      budgets: think === false ? { thoughtTokens: 0 } : undefined,
      tokenBias,
      onToken: thoughtMarks
        ? (tokens) => {
            for (const token of tokens) {
              firstToken ||= now();
              if (token === thoughtMarks.open) inThought = true;
              else if (token === thoughtMarks.close) inThought = false;
              else {
                const text = loaded.model.detokenize([token], false);
                post({
                  type: 'chunk',
                  id,
                  data: { message: inThought ? { thinking: text } : { content: text } },
                });
              }
            }
          }
        : undefined,
      onResponseChunk: (chunk) => {
        if (thoughtMarks) return;
        if (!firstToken) debug('premier morceau', id, (ns(start, now()) / 1e9).toFixed(1), 's');
        firstToken ||= now();
        chunks++;
        if (chunks % 16 === 0)
          debug(
            'écriture',
            id,
            chunks,
            'morceaux en',
            (ns(firstToken, now()) / 1e9).toFixed(1),
            's',
          );
        if (chunk.type === 'segment' && chunk.segmentType === 'thought')
          post({ type: 'chunk', id, data: { message: { thinking: chunk.text } } });
        else if (!chunk.type)
          post({ type: 'chunk', id, data: { message: { content: chunk.text } } });
      },
    });
    debug('réponse finie', id, result.stopReason);
    const end = now();
    const promptEnd = firstToken || end;
    const used = {
      input: sequence.tokenMeter.usedInputTokens - before.input,
      output: sequence.tokenMeter.usedOutputTokens - before.output,
    };
    post({
      type: 'done',
      id,
      data: {
        done: true,
        done_reason: result.stopReason === 'maxTokens' ? 'length' : 'stop',
        total_duration: ns(start, end),
        load_duration: loadNs,
        prompt_eval_count: used.input,
        prompt_eval_duration: Math.max(0, ns(start, promptEnd) - loadNs),
        eval_count: used.output,
        eval_duration: ns(promptEnd, end),
      },
    });
  } catch (error) {
    post({ type: 'error', id, message: error?.message || String(error) });
  } finally {
    // Session rendue même après une erreur ou un arrêt : la séquence sert à la demande suivante.
    session?.dispose({ disposeSequence: false });
    running.delete(id);
    // Maintien en mémoire : 0 = déchargé tout de suite ; sinon après le délai (5 min par défaut).
    const seconds = keepAlive == null ? 300 : keepAlive;
    unloadTimer = setTimeout(unload, Math.max(0, seconds) * 1000);
  }
}

// Capacités d'un modèle déjà enregistré, d'après l'en-tête du fichier (sans le charger).
async function capabilities({ id, path }) {
  try {
    if (fake) return post({ type: 'checked', id, info: { thinking: true } });
    const { readGgufFileInfo } = await import('node-llama-cpp');
    const info = await readGgufFileInfo(path, { readTensorInfo: false });
    post({ type: 'checked', id, info: { thinking: await canThink(path, info) } });
  } catch (error) {
    post({ type: 'error', id, message: error?.message || String(error) });
  }
}

// Vérifie qu'un fichier GGUF est utilisable par ce moteur : il est réellement chargé puis libéré.
async function check({ id, path }) {
  try {
    if (fake)
      return post({
        type: 'checked',
        id,
        info: { architecture: 'qwen3', contextLength: 32768, thinking: true },
      });
    const { readGgufFileInfo } = await import('node-llama-cpp');
    const info = await readGgufFileInfo(path, { readTensorInfo: false });
    // Chargement complet (sans contexte) : une lecture partielle ne voit pas toutes les
    // incompatibilités (ex. paramètres absents des fichiers convertis par Ollama pour Gemma 3).
    await unload();
    const model = await loadModelFile(path);
    await model.dispose();
    const arch = info.metadata?.general?.architecture;
    post({
      type: 'checked',
      id,
      info: {
        architecture: arch || null,
        sizeLabel: info.metadata?.general?.size_label || null,
        contextLength: arch ? (info.metadata?.[arch]?.context_length ?? null) : null,
        thinking: await canThink(path, info),
      },
    });
  } catch (error) {
    post({ type: 'error', id, message: error?.message || String(error) });
  }
}

// Le processus reste actif tant que Localia ne l'arrête pas : l'écoute des messages et le travail
// natif de llama.cpp ne le retiennent pas toujours, et il se terminait parfois en plein travail.
setInterval(() => {}, 1 << 30);
process.parentPort.on('message', ({ data }) => {
  debug('message reçu', data.type, data.id ?? '');
  if (data.type === 'chat') chat(data);
  else if (data.type === 'check') check(data);
  else if (data.type === 'capabilities') capabilities(data);
  else if (data.type === 'engine') engineInfo(data);
  else if (data.type === 'abort') running.get(data.id)?.abort();
  else if (data.type === 'unload') unload();
});
post({ type: 'ready' });
