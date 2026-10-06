// Localia sur un autre appareil : la clé vient du QR code (partie « #cle=… » de l'adresse, jamais
// envoyée telle quelle au serveur) et est gardée sur cet appareil.
const $ = (id) => document.getElementById(id);
const markdown = window.markdownit({ html: false, linkify: true });
let key = null;
let conversationId = null;
let sending = false;

try {
  const fromQr = /#cle=([\w-]+)/.exec(location.hash)?.[1];
  if (fromQr) localStorage.setItem('localia-cle', fromQr);
  key = fromQr || localStorage.getItem('localia-cle');
} catch {
  key = /#cle=([\w-]+)/.exec(location.hash)?.[1] || null;
}
if (location.hash) history.replaceState(null, '', '/');

function showError(message) {
  $('error').hidden = !message;
  $('error').textContent = message || '';
}
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.erreur || `Erreur ${response.status}.`);
  }
  return response;
}

function bubble(role, text) {
  const node = document.createElement('article');
  node.className = `message ${role}`;
  if (role === 'assistant') node.innerHTML = markdown.render(text || '…');
  else node.textContent = text;
  $('messages').append(node);
  return node;
}

async function loadStatus() {
  const etat = await (await api('etat')).json();
  $('status').textContent = etat.ollama
    ? `● Mac connecté${etat.occupe ? ' · occupé' : ''}`
    : '○ Ollama arrêté sur le Mac';
  const select = $('model');
  const previous = select.value || etat.lastModel;
  select.replaceChildren(...etat.models.map((m) => new Option(m, m)));
  if (etat.models.includes(previous)) select.value = previous;
}
async function loadConversations() {
  const list = await (await api('conversations')).json();
  const nav = $('conversations');
  nav.replaceChildren();
  if (!list.length) nav.textContent = 'Aucune conversation pour le moment.';
  for (const c of list) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = c.title || 'Sans titre';
    const info = document.createElement('small');
    info.textContent = ` · ${c.messages} message(s)${c.document ? ' · ' + c.document : ''}`;
    button.append(info);
    button.onclick = () => openConversation(c.id).catch((e) => showError(e.message));
    nav.append(button);
  }
}
async function openConversation(id) {
  showError('');
  conversationId = id;
  $('messages').replaceChildren();
  $('chat-document').hidden = true;
  if (id) {
    const c = await (await api(`conversations/${encodeURIComponent(id)}`)).json();
    $('chat-title').textContent = c.title || 'Conversation';
    if (c.document) {
      $('chat-document').hidden = false;
      $('chat-document').textContent = `Document : ${c.document}`;
    }
    for (const m of c.messages) bubble(m.role, m.content);
  } else $('chat-title').textContent = 'Nouvelle conversation';
  $('list-view').hidden = true;
  $('chat-view').hidden = false;
  window.scrollTo(0, document.body.scrollHeight);
}

// Réponse reçue au fil de l'écriture (événements « texte »), puis « fin ».
async function send(text) {
  sending = true;
  $('send').disabled = true;
  $('send').textContent = 'Réponse en cours…';
  showError('');
  bubble('user', text);
  const answer = bubble('assistant', '');
  let received = '';
  try {
    const response = await api('question', {
      method: 'POST',
      body: JSON.stringify({ text, conversationId, model: $('model').value || null }),
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = JSON.parse(/^data: (.+)$/m.exec(block)?.[1] || '{}');
        if (event === 'texte') {
          received += data.delta;
          answer.innerHTML = markdown.render(received);
        } else if (event === 'fin') {
          if (!data.ok) showError(data.error || 'La réponse n’a pas abouti.');
          if (!received && data.text) answer.innerHTML = markdown.render(data.text);
          if (!received && !data.text) answer.remove();
          if (data.conversationId) conversationId = data.conversationId;
        }
      }
    }
  } catch (error) {
    showError(error.message);
    if (!received) answer.remove();
  } finally {
    sending = false;
    $('send').disabled = false;
    $('send').textContent = 'Envoyer';
  }
}

$('composer').onsubmit = (event) => {
  event.preventDefault();
  const text = $('prompt').value.trim();
  if (!text || sending) return;
  $('prompt').value = '';
  send(text);
};
$('new').onclick = () => openConversation(null).catch((e) => showError(e.message));
$('back').onclick = () => {
  $('chat-view').hidden = true;
  $('list-view').hidden = false;
  loadConversations().catch((e) => showError(e.message));
  loadStatus().catch(() => {});
};

(async () => {
  if (!key) {
    $('status').textContent = '○ Non connecté';
    showError(
      'Scannez le QR code affiché sur le Mac (Réglages → Accès depuis vos autres appareils).',
    );
    return;
  }
  try {
    await loadStatus();
    await loadConversations();
  } catch (error) {
    $('status').textContent = '○ Non connecté';
    showError(error.message);
  }
})();
