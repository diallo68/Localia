// Moteur intégré (llama.cpp par node-llama-cpp), dans un processus séparé : un modèle qui plante
// ne fait pas planter Localia. Reçoit des conversations au format d'Ollama et renvoie des morceaux
// au même format (message.content, message.thinking, puis statistiques finales).
// LOCALIA_FAKE_LLAMA=1 (tests automatiques) : réponses simulées, sans modèle ni moteur natif.
const fake = process.env.LOCALIA_FAKE_LLAMA === '1';
let llamaModule = null;
let llama = null;
let loaded = null; // { path, model, context, contextSize }
let unloadTimer = null;
const running = new Map(); // id → AbortController

const post = (message) => process.parentPort.postMessage(message);
const now = () => process.hrtime.bigint();
const ns = (from, to) => Number(to - from);

async function engine() {
  if (!llama) {
    llamaModule = await import('node-llama-cpp');
    llama = await llamaModule.getLlama();
  }
  return llama;
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
    const l = await engine();
    const model = await l.loadModel({ modelPath: path });
    loaded = { path, model, context: null, contextSize: 0 };
    loadNs = ns(started, now());
  }
  if (!loaded.context || loaded.contextSize !== contextSize) {
    await loaded.context?.dispose();
    loaded.context = await loaded.model.createContext({ contextSize });
    loaded.contextSize = contextSize;
  }
  return loadNs;
}

// Format de conversation du modèle. Réflexion désactivée (think === false) : Gemma 4 sans la
// consigne <|think|>, Qwen découragé de réfléchir ; le budget de réflexion nul (plus bas) coupe
// court à ce qui resterait.
function chatWrapper(model, think) {
  const { resolveChatWrapper } = llamaModule;
  if (think !== false) return resolveChatWrapper(model);
  return resolveChatWrapper(model, {
    customWrapperSettings: { gemma4: { reasoning: false }, qwen: { thoughts: 'discourage' } },
  });
}

// Le modèle sait-il réfléchir (segments de raisonnement prévus par son format de conversation) ?
async function canThink(path, fileInfo) {
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
    const loadNs = await prepare(path, contextSize);
    const { LlamaChatSession } = llamaModule;
    const sequence = loaded.context.getSequence();
    const before = {
      input: sequence.tokenMeter.usedInputTokens,
      output: sequence.tokenMeter.usedOutputTokens,
    };
    const session = new LlamaChatSession({
      contextSequence: sequence,
      autoDisposeSequence: false,
      chatWrapper: chatWrapper(loaded.model, think),
    });
    const { items, question } = history(messages);
    session.setChatHistory(items);
    let firstToken = null;
    const result = await session.promptWithMeta(question, {
      signal: controller.signal,
      stopOnAbortSignal: true,
      maxTokens: options.num_predict || undefined,
      temperature: options.temperature,
      topP: options.top_p,
      topK: options.top_k,
      seed: options.seed,
      repeatPenalty: options.repeat_penalty ? { penalty: options.repeat_penalty } : undefined,
      budgets: think === false ? { thoughtTokens: 0 } : undefined,
      onResponseChunk: (chunk) => {
        firstToken ||= now();
        if (chunk.type === 'segment' && chunk.segmentType === 'thought')
          post({ type: 'chunk', id, data: { message: { thinking: chunk.text } } });
        else if (!chunk.type)
          post({ type: 'chunk', id, data: { message: { content: chunk.text } } });
      },
    });
    const end = now();
    const promptEnd = firstToken || end;
    const used = {
      input: sequence.tokenMeter.usedInputTokens - before.input,
      output: sequence.tokenMeter.usedOutputTokens - before.output,
    };
    session.dispose({ disposeSequence: false });
    sequence.dispose();
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
    const l = await engine();
    const model = await l.loadModel({ modelPath: path });
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
  if (data.type === 'chat') chat(data);
  else if (data.type === 'check') check(data);
  else if (data.type === 'capabilities') capabilities(data);
  else if (data.type === 'abort') running.get(data.id)?.abort();
  else if (data.type === 'unload') unload();
});
post({ type: 'ready' });
