const BASE = 'http://127.0.0.1:11434';
const { Agent } = require('undici');
// Ollama n'envoie le début de sa réponse qu'après avoir lu toute la demande. Avec un gros modèle et
// un long document sur processeur, cela dépasse les 5 minutes d'attente par défaut de fetch :
// pas de limite ici, l'utilisateur peut toujours arrêter ou mettre en pause.
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
function modelName(value) {
  if (
    typeof value !== 'string' ||
    value.length > 150 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/.test(value) ||
    /cloud/i.test(value)
  )
    throw new Error('Choisissez un nom de modèle local valide.');
  return value;
}
async function request(path, body, signal) {
  let response;
  try {
    response = await fetch(BASE + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: signal || AbortSignal.timeout(5000),
      dispatcher,
    });
  } catch (error) {
    if (signal?.aborted && signal.reason?.name !== 'TimeoutError') throw error;
    // Délai dépassé : Ollama tourne mais il est occupé (un gros modèle lit un document, par exemple).
    if (error.name === 'TimeoutError' || signal?.reason?.name === 'TimeoutError')
      throw new Error('Ollama n’a pas répondu à temps : il est peut-être occupé. Réessayez.');
    if (error.cause?.code === 'ECONNREFUSED')
      throw new Error('Ollama est inaccessible. Cliquez sur « Démarrer Ollama ».');
    throw new Error(
      `La connexion à Ollama a été interrompue (${error.cause?.code || error.message}). Réessayez.`,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Ollama : erreur ${response.status}`);
  }
  return response;
}
async function readStream(body, onData) {
  let buffer = '';
  const decoder = new TextDecoder();
  const consume = (line) => {
    if (!line.trim()) return;
    const data = JSON.parse(line);
    if (data.error) throw new Error(data.error);
    onData(data);
  };
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      consume(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
    }
  }
  buffer += decoder.decode();
  consume(buffer);
}
module.exports = { modelName, request, readStream };
