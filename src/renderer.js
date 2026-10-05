const $ = (id) => document.getElementById(id);
let conversations = [],
  current,
  models = [],
  chatting = false,
  pulling = false,
  reply,
  historyReady = false,
  importing = false,
  comparing = false,
  settings = { lastModel: null, models: {} };
// Fonctions appelées quand la liste des modèles installés change (comparaison, réglages).
const modelListeners = [];
// Fonctions appelées quand l'état des boutons doit être recalculé.
const controlListeners = [];
const notice = (message) => {
  $('notice').textContent = message;
  $('notice').hidden = !message;
};
const guard =
  (fn) =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      notice(error.message);
    }
  };
const persist = async () => {
  if (historyReady) await window.localia.save(conversations);
};
// Textes écrits pour macOS, adaptés sur les autres systèmes.
const ON_MAC = window.localia.platform === 'darwin';
const OTHER_SYSTEM_TEXTS = [
  [/Sur votre Mac/g, 'Sur votre ordinateur'],
  [/sur ce Mac Intel de 16 Go/g, 'sur un ordinateur de 16 Go'],
  [/(sur|de|hors de) ce Mac/g, '$1 cet ordinateur'],
  [/ce Mac/g, 'cet ordinateur'],
  [/le trousseau de macOS/g, 'le coffre de clés du système'],
  [/FileVault chiffre tout le disque/g, 'BitLocker chiffre tout le disque'],
  [/le Finder/g, 'l’Explorateur de fichiers'],
  [/Ouvrir dans le Finder/g, 'Ouvrir dans l’Explorateur'],
];
function localText(text) {
  if (ON_MAC) return text;
  for (const [pattern, replacement] of OTHER_SYSTEM_TEXTS)
    text = text.replace(pattern, replacement);
  return text;
}
if (!ON_MAC) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) walker.currentNode.nodeValue = localText(walker.currentNode.nodeValue);
}
const VIEWS = {
  chat: 'Conversations',
  models: 'Bibliothèque',
  compare: 'Comparaison',
  settings: 'Réglages des modèles',
  benchmark: 'Benchmark',
  projects: 'Projets',
  bibliography: 'Bibliographie',
  files: 'Fichiers',
};
function view(name) {
  for (const key of Object.keys(VIEWS)) {
    $(key + '-view').hidden = key !== name;
    $(key + '-tab').classList.toggle('active', key === name);
  }
  $('heading').textContent = VIEWS[name];
}
const installed = (name) => models.some((m) => m.name === name);
function selectModel(name) {
  if (installed(name)) $('model').value = name;
}
async function rememberModel(name) {
  if (!installed(name) || settings.lastModel === name) return;
  settings = await window.localia.saveSettings({ ...settings, lastModel: name });
}
function history() {
  $('history').replaceChildren();
  for (const c of conversations) {
    const b = document.createElement('button');
    b.textContent = c.title;
    b.classList.toggle('selected', c === current);
    b.disabled = chatting || importing;
    b.onclick = () => {
      current = c;
      selectModel(c.model);
      $('task').value = c.task || '';
      $('project').value = c.projectId && projectById(c.projectId) ? c.projectId : '';
      showTaskAdvice(false);
      closeRename();
      render();
      view('chat');
    };
    $('history').append(b);
  }
}
const toHtml = createMarkdown(window.markdownit);
function showMarkdown(element, text) {
  element.innerHTML = toHtml(text);
  for (const link of element.querySelectorAll('a')) {
    link.title = link.getAttribute('href');
    link.onclick = (event) => event.preventDefault();
  }
}
const formatNumber = (v) =>
  (+Number(v).toPrecision(6)).toLocaleString('fr-FR', { maximumFractionDigits: 4 });
// Panneau des vérifications automatiques : calculs refaits, pages, citations, chiffres, document piégé.
// Chaque ligne porte un symbole et un texte : la couleur n'est jamais le seul repère.
function checksPanel(report) {
  if (!report) return null;
  const items = [];
  for (const a of report.documentAlerts || [])
    items.push([
      'warn',
      `Le document contient une instruction adressée à l’IA (page ${a.page}) : « ${a.excerpt.slice(0, 140)} ». Elle ne doit pas être suivie.`,
    ]);
  const calculations = report.calculations || [];
  const wrong = calculations.filter((c) => !c.ok);
  for (const c of wrong)
    items.push([
      'warn',
      `Calcul faux : ${c.expression}. Résultat exact : ${formatNumber(c.expected)}.`,
    ]);
  const right = calculations.length - wrong.length;
  if (right) items.push(['ok', `${right} calcul(s) refait(s) par Localia : juste(s).`]);
  for (const p of report.pages || [])
    items.push(['warn', `Référence impossible : « ${p.reference} » (${p.reason}).`]);
  const quotes = report.quotes || [];
  const found = quotes.filter((q) => q.found.length);
  if (found.length)
    items.push([
      'ok',
      `${found.length} citation(s) retrouvée(s) mot pour mot (page(s) ${[...new Set(found.flatMap((q) => q.found))].join(', ')}).`,
    ]);
  for (const q of quotes.filter((x) => !x.found.length))
    items.push([
      'warn',
      `Citation introuvable mot pour mot : « ${q.quote} » (traduction, reformulation ou invention ?).`,
    ]);
  const numbers = report.numbers || [];
  if (numbers.length)
    items.push([
      'info',
      `Nombres absents du document, calculés ou inventés, à vérifier : ${numbers.slice(0, 10).join(' ; ')}${numbers.length > 10 ? '…' : ''}.`,
    ]);
  const plan = report.plan;
  if (plan && !plan.readable) items.push(['warn', `Plan d’actions illisible : ${plan.error}.`]);
  if (plan?.readable && plan.valid)
    items.push(['ok', `${plan.valid} action(s) du plan possible(s) dans le dossier décrit.`]);
  for (const a of plan?.invalid || [])
    items.push(['warn', `Action impossible : ${a.action} (${a.error}).`]);
  if (!items.length) return null;
  const alerts = items.filter(([level]) => level === 'warn').length;
  const box = document.createElement('details');
  box.className = 'checks' + (alerts ? ' has-alerts' : '');
  box.open = alerts > 0;
  const summary = document.createElement('summary');
  summary.textContent = alerts
    ? `Vérifications automatiques : ${alerts} alerte(s)`
    : 'Vérifications automatiques : aucun problème détecté';
  const list = document.createElement('ul');
  const icons = { ok: '✓', warn: '⚠', info: 'ℹ' };
  for (const [level, text] of items) {
    const li = document.createElement('li');
    li.className = level;
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = icons[level];
    icon.setAttribute('aria-hidden', 'true');
    li.append(icon, text);
    list.append(li);
  }
  box.append(summary, list);
  return box;
}
function messageNode(message, question) {
  const node = document.createElement('article');
  node.className = 'message ' + message.role;
  const label = document.createElement('strong');
  label.className = 'author';
  label.textContent = message.role === 'user' ? 'Vous' : 'Localia';
  let content;
  if (message.role === 'assistant' && message.content) {
    content = document.createElement('div');
    content.className = 'markdown';
    showMarkdown(content, message.content);
  } else {
    content = document.createElement(message.role === 'user' ? 'p' : 'div');
    if (message.role === 'assistant') content.className = 'markdown';
    content.textContent = message.content || 'Préparation de la réponse…';
  }
  node.append(label, content);
  if (message.role === 'assistant') {
    const panel = checksPanel(message.checks);
    if (panel) node.append(panel);
    if (message.content) {
      const remember = document.createElement('button');
      remember.type = 'button';
      remember.className = 'remember';
      remember.textContent = '＋ Mémoire du projet';
      remember.title = 'Ajouter cette réponse aux notes du projet de la conversation';
      remember.onclick = guard(() => addToMemory(message.content, question?.content));
      node.append(remember);
    }
  }
  $('messages').append(node);
  return content;
}
const welcome = $('welcome').cloneNode(true);
function renderAttachment() {
  const doc = current?.document;
  $('attachment').hidden = !doc;
  if (doc) {
    $('attachment-name').textContent = doc.name;
    $('attachment-info').textContent =
      `${doc.pageCount} page(s) · Texte lu localement. ${doc.characters > 9500 ? 'Document long : seuls des extraits seront transmis selon la question.' : ''} ${doc.emptyPages.length ? 'Pages sans texte non analysées : ' + doc.emptyPages.join(', ') : ''} Images et mise en page non analysées.` +
      (doc.alerts?.length
        ? ` ⚠ Ce document contient une instruction adressée à l’IA (page ${doc.alerts.map((a) => a.page).join(', ')}) : elle ne doit pas être suivie.`
        : '');
  }
}
function render() {
  renderAttachment();
  $('delete-conversation').hidden = !current;
  $('rename-conversation').hidden = !current;
  $('messages').replaceChildren();
  if (!current?.messages.length) {
    $('messages').append(welcome.cloneNode(true));
    for (const b of $('messages').querySelectorAll('[data-prompt]'))
      b.onclick = () => {
        $('prompt').value = b.dataset.prompt;
        $('prompt').focus();
      };
  } else current.messages.forEach((m, i, list) => messageNode(m, list[i - 1]));
  history();
}
function controls() {
  $('attach-pdf').disabled = chatting || importing || !historyReady;
  $('remove-pdf').disabled = chatting || importing;
  $('attach-pdf').textContent = importing ? 'Lecture…' : '＋ PDF';
  $('send').disabled = chatting || importing || !models.length || !historyReady;
  $('model').disabled = chatting;
  $('stop').hidden = !chatting;
  $('new').disabled = chatting || importing || !historyReady;
  $('delete-conversation').disabled = chatting || importing || !historyReady;
  $('rename-conversation').disabled = chatting || importing || !historyReady;
  $('send').disabled ||= comparing;
  $('attach-pdf').disabled ||= comparing;
  for (const listener of controlListeners) listener();
  $('download').disabled = pulling;
  $('custom-form').querySelector('button').disabled = pulling;
  history();
}
async function refresh() {
  try {
    models = (await window.localia.models()).sort((a, b) => a.size - b.size);
    $('status').textContent = '● Ollama connecté';
    $('connect').hidden = true;
  } catch (error) {
    models = [];
    $('status').textContent = '○ Ollama arrêté';
    $('connect').hidden = false;
  }
  const selected = $('model').value || current?.model || settings.lastModel;
  $('model').replaceChildren();
  if (!models.length) {
    const o = new Option('Aucun modèle disponible', '');
    $('model').add(o);
  }
  for (const m of models) $('model').add(new Option(m.name, m.name));
  selectModel(selected);
  $('installed').replaceChildren();
  if (!models.length)
    $('installed').textContent =
      'Aucun modèle disponible. Démarrez Ollama, puis téléchargez votre premier modèle.';
  for (const m of models) {
    const row = document.createElement('div');
    row.className = 'installed-row';
    const title = document.createElement('span');
    title.textContent = m.name;
    const size = document.createElement('small');
    size.textContent = (m.size / 1e9).toFixed(2) + ' Go';
    row.append(title, size);
    $('installed').append(row);
  }
  for (const listener of modelListeners) listener();
  controls();
}
$('attach-pdf').onclick = guard(async () => {
  notice('');
  importing = true;
  controls();
  try {
    const doc = await window.localia.attachPdf();
    if (!doc) return;
    const previous = current?.document?.id;
    if (!current) {
      current = { id: crypto.randomUUID(), title: doc.name, messages: [] };
      conversations.unshift(current);
    }
    current.document = doc;
    await persist();
    if (previous) await window.localia.deleteDocument(previous);
    render();
    $('prompt').focus();
  } finally {
    importing = false;
    controls();
  }
});
// Nouvelle conversation sur un document déjà importé (PDF d'un élément Zotero).
async function openDocumentConversation(doc) {
  const { title, ...document } = doc;
  current = { id: crypto.randomUUID(), title: title.slice(0, 120), messages: [], document };
  conversations.unshift(current);
  await persist();
  view('chat');
  render();
  $('prompt').focus();
}
$('remove-pdf').onclick = guard(async () => {
  const id = current?.document?.id;
  if (!id) return;
  delete current.document;
  await persist();
  renderAttachment();
  await window.localia.deleteDocument(id);
});
$('delete-conversation').onclick = guard(async () => {
  const conversation = current;
  if (!conversation || chatting || importing) return;
  if (
    !confirm(
      `Supprimer définitivement « ${conversation.title} » ? Les messages et le texte du PDF joint seront effacés de ce Mac.`,
    )
  )
    return;
  conversations = conversations.filter((c) => c !== conversation);
  current = null;
  await persist();
  render();
  view('chat');
  if (conversation.document) await window.localia.deleteDocument(conversation.document.id);
});
$('chat-tab').onclick = () => view('chat');
$('models-tab').onclick = () => view('models');
$('new').onclick = () => {
  current = null;
  $('task').value = '';
  showTaskAdvice(false);
  closeRename();
  $('prompt').value = '';
  render();
  view('chat');
};
$('refresh').onclick = guard(refresh);
$('connect').onclick = guard(async () => {
  notice('');
  $('connect').disabled = true;
  $('status').textContent = 'Démarrage…';
  try {
    await window.localia.start();
    await refresh();
  } finally {
    $('connect').disabled = false;
  }
});
$('composer').onsubmit = guard(async (event) => {
  event.preventDefault();
  const content = $('prompt').value.trim();
  if (!content || chatting || importing || comparing || !historyReady) return;
  if (!models.length) {
    view('models');
    return;
  }
  notice('');
  if (!current) {
    current = { id: crypto.randomUUID(), title: content.slice(0, 55), messages: [] };
    conversations.unshift(current);
  }
  const userMessage = { role: 'user', content };
  current.messages.push(userMessage);
  $('prompt').value = '';
  chatting = true;
  render();
  controls();
  const answer = { role: 'assistant', content: '' };
  const conversation = current;
  conversation.model = $('model').value;
  conversation.task = $('task').value || undefined;
  conversation.projectId = $('project').value || undefined;
  runNotes = [];
  rememberModel(conversation.model).catch((e) => notice(e.message));
  reply = messageNode(answer);
  let completed = false;
  try {
    await persist();
    const result = await window.localia.run('chat', {
      model: conversation.model,
      task: conversation.task,
      projectId: conversation.projectId,
      documentId: conversation.document?.id,
      messages: conversation.messages
        .filter((m) => !m.interrupted)
        .map(({ role, content }) => ({ role, content })),
    });
    answer.content = result.text || '';
    completed = !result.cancelled;
  } catch (error) {
    notice(error.message);
  } finally {
    answer.content = answer.content || reply.dataset.answer || '';
    if (answer.content) {
      const saved = { ...answer, interrupted: !completed };
      conversation.messages.push(saved);
      // Vérifications automatiques de la réponse (sans modèle).
      saved.checks = await window.localia
        .verifyAnswer({
          answer: saved.content,
          question: content,
          documentId: conversation.document?.id,
        })
        .catch(() => undefined);
    } else {
      conversation.messages.pop();
      $('prompt').value = content;
    }
    chatting = false;
    reply = null;
    await persist().catch((e) => notice(e.message));
    render();
    controls();
    $('prompt').focus();
  }
});
$('prompt').onkeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('composer').requestSubmit();
  }
};
$('stop').onclick = guard(() => window.localia.cancel('chat'));
async function download(model) {
  if (pulling) return;
  notice('');
  pulling = true;
  controls();
  $('transfer').hidden = false;
  $('transfer-name').textContent = model;
  $('transfer-status').textContent = 'Connexion au catalogue…';
  $('progress').removeAttribute('value');
  try {
    const result = await window.localia.run('pull', { model });
    $('transfer-status').textContent = result.cancelled
      ? 'Téléchargement annulé. Vous pourrez le reprendre.'
      : 'Modèle prêt à être utilisé.';
    if (!result.cancelled) $('progress').value = 100;
  } catch (error) {
    $('transfer-status').textContent = 'Le téléchargement a échoué.';
    notice(error.message);
  } finally {
    pulling = false;
    await refresh();
  }
}
$('download').onclick = () => download('qwen2.5:1.5b');
$('custom-form').onsubmit = (event) => {
  event.preventDefault();
  download($('custom-model').value.trim());
};
$('cancel-download').onclick = guard(() => window.localia.cancel('pull'));
// Informations sur ce qui a été transmis au modèle pour la dernière question.
let runNotes = [];
const runNotice = (text) => {
  if (!runNotes.includes(text)) runNotes.push(text);
  notice(runNotes.join(' '));
};
window.localia.onProgress(({ kind, data }) => {
  if (kind === 'document') {
    runNotice(
      (data.partial ? 'Analyse partielle — extraits des pages ' : 'Texte transmis — pages ') +
        data.pages.join(', ') +
        '. Les images et la mise en page ne sont pas analysées.',
    );
  }
  if (kind === 'memory') {
    runNotice(
      `Mémoire du projet « ${data.project} » transmise : ${data.notes.length} note(s)${data.partial ? ', les plus proches de la question' : ''} (${data.notes.map((n) => n.title).join(', ')}).`,
    );
  }
  if (kind === 'context') {
    runNotice(
      'Conversation longue : le modèle peut ne plus voir les premiers messages. Ouvrez une nouvelle conversation et rappelez les points importants si besoin.',
    );
  }
  if (kind === 'chat' && reply) {
    reply.dataset.answer = (reply.dataset.answer || '') + (data.message?.content || '');
    if (!reply.dataset.pending) {
      reply.dataset.pending = '1';
      const target = reply;
      requestAnimationFrame(() => {
        delete target.dataset.pending;
        if (target.dataset.answer) showMarkdown(target, target.dataset.answer);
        else target.textContent = 'Le modèle réfléchit…';
        $('messages').scrollTop = $('messages').scrollHeight;
      });
    }
  }
  if (kind === 'pull') {
    $('transfer-status').textContent = data.status || 'Téléchargement…';
    if (data.total) {
      $('progress').value = Math.min(100, Math.round((100 * (data.completed || 0)) / data.total));
    } else $('progress').removeAttribute('value');
  }
});
$('model').onchange = guard(async () => {
  await rememberModel($('model').value);
  showTaskAdvice(false);
});

// --- Assistant de recherche : type de tâche et modèle conseillé par le Benchmark ---
for (const task of TASKS.filter((t) => !t.files)) $('task').add(new Option(task.label, task.id));
const percentText = (v) => (v == null ? '—' : Math.round(v * 100) + ' %');
const minutesText = (s) =>
  s == null
    ? '—'
    : s < 60
      ? Math.round(s) + ' s'
      : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
function taskAdvice(taskId) {
  const task = taskById(taskId);
  if (!task) return null;
  const graded = typeof comparisons === 'undefined' ? [] : comparisons;
  return recommendModels(
    graded,
    models.map((m) => m.name),
    (r) => gradeValues(r, ALL_GRADERS),
  ).find((x) => x.task.id === task.id);
}
// Affiche le conseil ; choisit le modèle conseillé seulement si on le demande (nouvelle tâche).
function showTaskAdvice(choose) {
  const advice = taskAdvice($('task').value);
  const box = $('task-advice');
  box.hidden = !advice;
  if (!advice) return;
  const parts = [];
  if (advice.best) {
    if (choose) selectModel(advice.best.model);
    const b = advice.best;
    parts.push(
      `Conseillé par votre Benchmark : ${b.model} — ${percentText(b.correct)} de réponses correctes, ${percentText(b.invention)} avec invention, environ ${minutesText(b.medianSeconds)} par réponse (${b.n} réponses notées${advice.reliable ? '' : ', conseil indicatif'}).`,
    );
    if (b.correct < 0.5)
      parts.push(
        'Aucun modèle n’atteint 50 % de réponses correctes pour cette tâche : vérifiez toujours le résultat.',
      );
    if (advice.fast)
      parts.push(
        `Plus rapide et presque aussi fiable : ${advice.fast.model} (${percentText(advice.fast.correct)}, environ ${minutesText(advice.fast.medianSeconds)}).`,
      );
    if ($('model').value !== b.model) parts.push(`Vous utilisez ${$('model').value}.`);
  } else
    parts.push(
      'Pas encore assez de réponses notées dans votre Benchmark pour conseiller un modèle pour cette tâche.',
    );
  if (advice.task.warning) parts.push(advice.task.warning);
  box.textContent = parts.join(' ');
}
$('project').onchange = guard(async () => {
  if (current) {
    current.projectId = $('project').value || undefined;
    await persist();
  }
});
$('task').onchange = guard(async () => {
  if (current) {
    current.task = $('task').value || undefined;
    await persist();
  }
  showTaskAdvice(true);
  await rememberModel($('model').value);
});
$('model-settings').onclick = () => openSettings($('model').value);
function closeRename() {
  $('rename-form').hidden = true;
}
$('rename-conversation').onclick = () => {
  if (!current) return;
  $('rename-form').hidden = false;
  $('rename-input').value = current.title;
  $('rename-input').select();
};
$('rename-cancel').onclick = closeRename;
$('rename-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const title = $('rename-input').value.trim().slice(0, 120);
  if (!title || !current) return;
  current.title = title;
  closeRename();
  history();
  await persist();
});
