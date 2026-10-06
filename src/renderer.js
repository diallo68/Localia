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
// Compétences (fichiers du dossier Compétences), chargées par skills-view.js.
let skills = [];
// Tâche et compétence d'une conversation. Avant leur séparation, une compétence était rangée
// dans « task » (« skill:… ») : elle est relue comme compétence.
function conversationChoices(c) {
  const old = String(c?.task || '').startsWith('skill:');
  return { task: old ? '' : c?.task || '', skill: c?.skill || (old ? c.task : '') };
}
const skillOf = (value) =>
  String(value || '').startsWith('skill:')
    ? skills.find((s) => s.id === String(value).slice(6)) || null
    : null;
// Fonctions appelées quand la liste des modèles installés change (comparaison, réglages).
const modelListeners = [];
// Fonctions appelées quand l'état des boutons doit être recalculé.
const controlListeners = [];
// Zone de dépôt de l'accueil : retirée de la page pendant une conversation, d'où la référence gardée.
const dropZone = $('drop-zone');
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
  if (!historyReady) return;
  if (current) current.updatedAt = new Date().toISOString();
  await window.localia.save(conversations);
};
// Textes écrits pour macOS, adaptés sur les autres systèmes.
const ON_MAC = window.localia.platform === 'darwin';
const OTHER_SYSTEM_TEXTS = [
  [/Sur votre Mac/g, 'Sur votre ordinateur'],
  [/Sur ce Mac/g, 'Sur cet ordinateur'],
  [/Ce Mac/g, 'Cet ordinateur'],
  [/sur ce Mac Intel de 16 Go/g, 'sur un ordinateur de 16 Go'],
  [/(sur|de|hors de) ce Mac/g, '$1 cet ordinateur'],
  [/ce Mac/g, 'cet ordinateur'],
  [/le trousseau de macOS/g, 'le coffre de clés du système'],
  [
    /FileVault chiffre tout le disque/g,
    window.localia.platform === 'linux'
      ? 'le chiffrement du disque (LUKS) protège tout le disque'
      : 'BitLocker chiffre tout le disque',
  ],
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
  compare: 'Benchmark',
  settings: 'Réglages des modèles',
  benchmark: 'Benchmark',
  projects: 'Projets',
  bibliography: 'Bibliographie',
  files: 'Fichiers',
  skills: 'Compétences',
  guide: 'Guide de démarrage',
  performance: 'Performances de votre ordinateur',
};
let lastBenchStep = 'compare';
function view(name) {
  for (const key of Object.keys(VIEWS)) {
    $(key + '-view').hidden = key !== name;
    $(key + '-tab').classList.toggle('active', key === name);
  }
  $('heading').textContent = VIEWS[name];
  // Benchmark : une entrée dans la colonne, deux étapes (lancer une série, résultats et notation).
  const bench = name === 'compare' || name === 'benchmark';
  $('bench-steps').hidden = !bench;
  $('bench-nav').classList.toggle('active', bench);
  if (bench) lastBenchStep = name;
  // La conversation a sa propre barre (projet, tâche, modèle, exécution) : pas d'en-tête.
  document.body.dataset.view = name;
}
// Groupes de la colonne de gauche repliables ; l'état est retenu sur cet ordinateur.
for (const section of document.querySelectorAll('.nav-section')) {
  const toggle = section.querySelector('.section-toggle');
  const key = 'localia.section.' + section.dataset.section;
  const apply = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    section.classList.toggle('collapsed', !open);
  };
  try {
    apply(localStorage.getItem(key) !== 'closed');
  } catch {
    apply(true);
  }
  toggle.onclick = () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    apply(open);
    try {
      localStorage.setItem(key, open ? 'open' : 'closed');
    } catch {
      // Stockage indisponible : le groupe reste dans cet état jusqu'à la fermeture.
    }
  };
}
// Date de la dernière activité d'une conversation, pour l'historique.
const DAY = 24 * 3600 * 1000;
function shortDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date >= today) return 'Aujourd’hui, ' + time;
  if (date >= today - DAY) return 'Hier, ' + time;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
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
    const title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = c.title;
    b.append(title);
    const when = shortDate(c.updatedAt);
    if (when) {
      const date = document.createElement('small');
      date.textContent = when;
      b.append(date);
    }
    b.title = c.title;
    b.classList.toggle('selected', c === current);
    b.disabled = chatting || importing;
    b.onclick = () => {
      current = c;
      selectModel(c.model);
      const choice = conversationChoices(c);
      $('task').value = choice.task;
      $('skill').value = choice.skill;
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
  // Réponses anciennes, enregistrées sans leur modèle : celui de la conversation.
  const model = message.role === 'assistant' && (message.model || current?.model);
  if (model) {
    const tag = document.createElement('span');
    tag.className = 'model-tag';
    tag.textContent = model;
    tag.title = message.model
      ? 'Modèle qui a écrit cette réponse'
      : 'Modèle de la conversation (réponse enregistrée avant que Localia note son modèle)';
    label.append(' · ', tag);
  }
  if (message.remote) {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.textContent = 'depuis un autre appareil';
    label.append(' ', tag);
  }
  if (message.skill) {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.textContent = `/${message.skill}`;
    tag.title = 'Compétence appliquée à ce message';
    label.append(' ', tag);
  }
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
    if (doc.web) {
      $('attachment-info').textContent =
        `Page web · ${new URL(doc.source).hostname} · ${doc.pageCount} section(s) · lue le ${new Date(doc.fetchedAt).toLocaleDateString('fr-FR')}. Seul le texte est gardé.` +
        (doc.alerts?.length
          ? ` ⚠ Cette page contient une instruction adressée à l’IA (section ${doc.alerts.map((a) => a.page).join(', ')}) : elle ne doit pas être suivie.`
          : '');
      return;
    }
    $('attachment-info').textContent =
      `${doc.pageCount} page(s) · Texte lu localement. ${doc.characters > 9500 ? 'Document long : seuls des extraits seront transmis selon la question.' : ''} ${doc.emptyPages.length ? 'Pages sans texte non analysées : ' + doc.emptyPages.join(', ') : ''} Images et mise en page non analysées.` +
      (doc.alerts?.length
        ? ` ⚠ Ce document contient une instruction adressée à l’IA (page ${doc.alerts.map((a) => a.page).join(', ')}) : elle ne doit pas être suivie.`
        : '');
    if (doc.source)
      $('attachment-info').textContent += ` Source : ${new URL(doc.source).hostname}.`;
  }
}
// Fichiers texte joints (consignes, code, données) : nom, résumé, aperçu du portrait, retrait.
function renderFiles() {
  const files = current?.files || [];
  const box = $('file-chips');
  box.hidden = !files.length;
  box.replaceChildren();
  for (const f of files) {
    const chip = element('div', 'file-chip');
    chip.append(
      element('strong', '', f.name),
      element(
        'small',
        'muted',
        f.kind === 'table' ? `tableau · ${f.summary} · portrait transmis` : f.summary,
      ),
    );
    if (f.preview) {
      const details = element('details', '');
      details.append(element('summary', '', 'Aperçu'), element('pre', '', f.preview));
      chip.append(details);
    }
    const remove = element('button', '', 'Retirer');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Retirer ${f.name}`);
    remove.onclick = guard(async () => {
      current.files = current.files.filter((x) => x !== f);
      await persist();
      renderFiles();
      await window.localia.deleteDocument(f.id);
    });
    chip.append(remove);
    box.append(chip);
  }
}
function render() {
  renderAttachment();
  renderFiles();
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
  $('attach').disabled = chatting || importing || !historyReady;
  $('remove-pdf').disabled = chatting || importing;
  $('attach').classList.toggle('busy', importing);
  $('attach').setAttribute('aria-label', importing ? 'Lecture en cours…' : 'Joindre un fichier');
  $('send').disabled = chatting || importing || !models.length || !historyReady;
  $('model').disabled = chatting;
  $('stop').hidden = !chatting;
  $('new').disabled = chatting || importing || !historyReady;
  $('delete-conversation').disabled = chatting || importing || !historyReady;
  $('rename-conversation').disabled = chatting || importing || !historyReady;
  $('send').disabled ||= comparing;
  $('attach').disabled ||= comparing;
  dropZone.disabled = $('attach').disabled;
  for (const listener of controlListeners) listener();
  $('download').disabled = pulling;
  $('custom-form').querySelector('button').disabled = pulling;
  history();
}
// Carte « Exécution locale » : résumé de l'état affiché dans l'en-tête des autres pages.
function engineCard() {
  const text = $('status').textContent;
  const ready = text.startsWith('●');
  $('engine-state').textContent = ready
    ? 'Activée'
    : /Aucun modèle/.test(text)
      ? 'Aucun modèle'
      : /arrêté/.test(text)
        ? 'Ollama arrêté'
        : 'Vérification…';
  $('engine-state').classList.toggle('ready', ready);
  $('engine-detail').textContent =
    text.replace(/^[●○]\s*/, '') +
    (ready ? ' — les réponses sont calculées sur ce Mac, sans Internet.' : '');
  $('engine-connect').hidden = $('connect').hidden;
  const model = models.find((m) => m.name === $('model').value);
  const local = model?.engine === 'integre';
  if (ready && model) {
    $('engine-state').textContent = local ? 'Moteur intégré' : 'Ollama';
    $('engine-detail').textContent = local
      ? 'Moteur intégré de Localia : le modèle tourne dans Localia même, sans Ollama ni Internet.'
      : 'Ollama : le modèle tourne dans Ollama, sur ce Mac, sans Internet.';
  }
  for (const [id, on] of [
    ['engine-local', local],
    ['engine-ollama', Boolean(model) && !local],
  ])
    $(id).setAttribute('aria-pressed', String(on));
  $('engine-local').disabled = chatting || !models.some((m) => m.engine === 'integre');
  $('engine-ollama').disabled = chatting || !models.some((m) => m.engine !== 'integre');
}
// Bascule entre le moteur intégré et Ollama : même modèle de l'autre côté s'il existe
// (« integre/qwen3:8b » ↔ « qwen3:8b »), sinon le dernier utilisé, sinon le plus petit.
function switchEngine(toLocal) {
  const name = $('model').value;
  const twin = toLocal ? 'integre/' + name : name.replace(/^integre\//, '');
  const side = models.filter((m) => (m.engine === 'integre') === toLocal);
  const target =
    side.find((m) => m.name === twin) || side.find((m) => m.name === settings.lastModel) || side[0];
  if (!target || target.name === name) return;
  $('model').value = target.name;
  $('model').dispatchEvent(new Event('change'));
  engineCard();
}
new MutationObserver(engineCard).observe($('status'), { childList: true, characterData: true });
$('engine-card').onclick = () => {
  const open = $('engine-panel').hidden;
  $('engine-panel').hidden = !open;
  $('engine-card').setAttribute('aria-expanded', String(open));
  engineCard();
};
$('engine-refresh').onclick = () => $('refresh').click();
$('engine-local').onclick = () => switchEngine(true);
$('engine-ollama').onclick = () => switchEngine(false);
$('model').addEventListener('change', () => engineCard());
$('engine-connect').onclick = () => $('connect').click();
$('engine-library').onclick = () => $('models-tab').click();
async function refresh() {
  try {
    models = (await window.localia.models()).sort((a, b) => a.size - b.size);
    const ollama = models.some((m) => m.engine !== 'integre');
    $('status').textContent = ollama ? '● Ollama connecté' : '● Moteur intégré (Ollama arrêté)';
    $('connect').hidden = ollama;
  } catch (error) {
    models = [];
    // Ni modèle intégré ni Ollama actif : « Démarrer Ollama » seulement s'il est installé.
    const setup = await window.localia.setupStatus().catch(() => null);
    $('status').textContent = setup?.ollamaPath ? '○ Ollama arrêté' : '○ Aucun modèle installé';
    $('connect').hidden = !setup?.ollamaPath;
  }
  engineCard();
  const selected = $('model').value || current?.model || settings.lastModel;
  $('model').replaceChildren();
  if (!models.length) {
    const o = new Option('Aucun modèle disponible', '');
    $('model').add(o);
  }
  // Deux groupes : le moteur intégré de Localia et Ollama (même nom de modèle possible des deux côtés).
  for (const [engine, label] of [
    ['integre', 'Moteur intégré de Localia'],
    ['ollama', 'Ollama'],
  ]) {
    const list = models.filter((m) => (m.engine === 'integre') === (engine === 'integre'));
    if (!list.length) continue;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const m of list) group.append(new Option(m.name, m.name));
    $('model').append(group);
  }
  selectModel(selected);
  $('installed').replaceChildren();
  if (!models.length)
    $('installed').textContent =
      'Aucun modèle disponible. Démarrez Ollama, puis téléchargez votre premier modèle.';
  const localNames = new Set(models.filter((m) => m.engine === 'integre').map((m) => m.name));
  for (const m of models) {
    const row = document.createElement('div');
    row.className = 'installed-row';
    const title = document.createElement('span');
    title.textContent = m.name;
    if (m.engine === 'integre') {
      const badge = element('small', 'engine-badge', 'moteur intégré');
      title.append(' ', badge);
    }
    const size = document.createElement('small');
    size.textContent = (m.size / 1e9).toFixed(2) + ' Go';
    row.append(title, size);
    // Moteur intégré : reprendre un modèle d'Ollama sans le retélécharger, ou le retirer.
    if (m.engine === 'integre') {
      const remove = element('button', '', 'Retirer');
      remove.type = 'button';
      remove.title = 'Retire le modèle du moteur intégré (le fichier d’Ollama n’est pas supprimé)';
      remove.onclick = guard(async () => {
        await window.localia.localRemove(m.name);
        await refresh();
      });
      row.append(remove);
    } else if (!localNames.has('integre/' + m.name)) {
      const use = element('button', '', 'Utiliser avec le moteur intégré');
      use.type = 'button';
      use.onclick = guard(async () => {
        use.disabled = true;
        use.textContent = 'Vérification (jusqu’à 30 s)…';
        try {
          await window.localia.localImport(m.name);
          notice(`« integre/${m.name} » est prêt : il fonctionne sans Ollama.`);
        } finally {
          await refresh();
        }
      });
      row.append(use);
    }
    $('installed').append(row);
  }
  for (const listener of modelListeners) listener();
  controls();
}
// Texte lisible d'une page HTML : analysée sans être affichée (DOMParser n'exécute rien et ne
// charge rien) ; navigation, menus, pieds de page et scripts retirés ; article ou contenu principal.
function pageText(html) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  page
    .querySelectorAll(
      'script, style, noscript, template, svg, canvas, iframe, object, form, nav, header, footer, aside, button, select, [hidden], [aria-hidden="true"]',
    )
    .forEach((el) => el.remove());
  const candidates = [
    page.querySelector('article'),
    page.querySelector('main'),
    page.querySelector('[role="main"]'),
  ];
  let root = candidates.find((el) => el && el.textContent.trim().length > 500) || page.body;
  if (!root) return { title: page.title, text: '' };
  for (const el of root.querySelectorAll('li')) el.prepend('• ');
  for (const el of root.querySelectorAll('td, th')) el.append(' | ');
  for (const el of root.querySelectorAll('br')) el.replaceWith('\n');
  for (const el of root.querySelectorAll(
    'p, div, section, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre, table, figcaption, dt, dd',
  ))
    el.after('\n\n');
  const title =
    page.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    page.querySelector('h1')?.textContent ||
    page.title;
  const text = root.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: (title || '').replace(/\s+/g, ' ').trim(), text };
}

// Page web lue (sur demande) : elle devient le document de la conversation, comme un PDF.
async function readWebPage(address) {
  const value = String(address || '').trim();
  if (!value) throw new Error('Collez l’adresse de la page (https://…).');
  notice('');
  importing = true;
  controls();
  try {
    const fetched = await window.localia.webFetch(value);
    let doc;
    if (fetched.kind === 'pdf') doc = fetched.doc;
    else {
      const { title, text } =
        fetched.kind === 'text' ? { title: '', text: fetched.html } : pageText(fetched.html);
      doc = await window.localia.webSave({ url: fetched.url, title, text });
    }
    const previous = current?.document?.id;
    if (!current) {
      current = { id: crypto.randomUUID(), title: doc.name.slice(0, 120), messages: [] };
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
}

// Fichier joint (trombone ou dépôt) : un PDF remplace le document de la conversation ;
// un autre fichier s'ajoute aux fichiers joints (5 au plus). Même traitement pour un fichier choisi et un fichier déposé dans la fenêtre.
async function addAttachment(read) {
  notice('');
  importing = true;
  controls();
  try {
    const added = await read();
    if (!added) return;
    const name = added.kind === 'pdf' ? added.doc.name : added.file.name;
    if (added.kind === 'file' && (current?.files || []).length >= 5) {
      await window.localia.deleteDocument(added.file.id);
      throw new Error('5 fichiers au plus par conversation : retirez-en un d’abord.');
    }
    if (!current) {
      current = { id: crypto.randomUUID(), title: name, messages: [] };
      conversations.unshift(current);
    }
    const previous = added.kind === 'pdf' ? current.document?.id : null;
    if (added.kind === 'pdf') current.document = added.doc;
    else current.files = [...(current.files || []), added.file];
    await persist();
    if (previous) await window.localia.deleteDocument(previous);
    render();
    $('prompt').focus();
  } finally {
    importing = false;
    controls();
  }
}
$('attach').onclick = guard(() => addAttachment(() => window.localia.attach()));
dropZone.onclick = () => $('attach').click();
// Dépôt de fichiers sur la conversation : le contenu est lu ici puis transmis, jamais le chemin.
const chatView = $('chat-view');
let dragDepth = 0;
const dropAllowed = () => !$('attach').disabled && $('chat-view').hidden === false;
chatView.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer?.types.includes('Files') || !dropAllowed()) return;
  event.preventDefault();
  dragDepth++;
  chatView.classList.add('dragging');
});
chatView.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files') || !dropAllowed()) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
chatView.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) chatView.classList.remove('dragging');
});
chatView.addEventListener(
  'drop',
  guard(async (event) => {
    event.preventDefault();
    dragDepth = 0;
    chatView.classList.remove('dragging');
    if (!dropAllowed()) return;
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length > 1) notice('Un fichier à la fois : seul le premier est ajouté.');
    const [file] = files;
    if (!file) return;
    if (file.size > 50_000_000) throw new Error('Fichier limité à 50 Mo.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    await addAttachment(() => window.localia.attachData(file.name, bytes));
  }),
);
// Hors de la conversation, un fichier lâché ne doit pas remplacer la page.
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());
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
  for (const f of conversation.files || []) await window.localia.deleteDocument(f.id);
});
$('chat-tab').onclick = () => view('chat');
$('bench-nav').onclick = () => $(lastBenchStep + '-tab').click();
$('models-tab').onclick = () => view('models');
$('new').onclick = () => {
  current = null;
  $('task').value = '';
  $('skill').value = '';
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
  const result = await sendPrompt();
  if (result?.error) notice(result.error);
});
// Première adresse web d'un message (ponctuation finale retirée) et le texte qui l'entoure.
function linkIn(text) {
  const match = /\bhttps?:\/\/[^\s<>"'«»]+/i.exec(text || '');
  if (!match) return null;
  const address = match[0].replace(/[.,;:!?)\]]+$/, '');
  const rest = (text.slice(0, match.index) + text.slice(match.index + address.length))
    .replace(/\s+/g, ' ')
    .trim();
  return { address, rest };
}
// Envoi du message de la zone de saisie, depuis le Mac ou depuis un autre appareil (remoteId).
// Renvoie { ok, error, conversationId, text } pour l'appareil distant.
async function sendPrompt({ remoteId } = {}) {
  let content = $('prompt').value.trim();
  if (!content) return { ok: false, error: null };
  if (chatting || importing || comparing || !historyReady)
    return { ok: false, error: 'Localia est occupée sur le Mac : réessayez dans un moment.' };
  // « /appel texte » : compétence pour ce message ; « /competences » : liste des compétences.
  const invocation = parseInvocation(content, skills);
  if (invocation?.reserved === '/web') {
    $('skill-suggest').hidden = true;
    if (!invocation.rest)
      return {
        ok: false,
        error: 'Collez l’adresse de la page après /web, ou simplement dans votre message.',
      };
    await readWebPage(invocation.rest);
    $('prompt').value = '';
    return { ok: true, conversationId: current?.id, text: 'Page web ajoutée à la conversation.' };
  }
  if (invocation?.reserved) {
    $('prompt').value = '';
    $('skill-suggest').hidden = true;
    $('skills-tab').click();
    return { ok: true, text: 'Liste des compétences ouverte sur le Mac.' };
  }
  if (!invocation && /^\/[a-z0-9-]+(\s|$)/i.test(content))
    return {
      ok: false,
      error: `Compétence inconnue : ${content.split(/\s/)[0]}. Tapez /competences pour voir la liste, ou retirez la barre oblique.`,
    };
  if (!models.length) {
    view('models');
    return { ok: false, error: 'Aucun modèle installé sur le Mac.' };
  }
  // Adresse https://… dans le message : la page est lue et devient le document de la
  // conversation ; le reste du message est la question (seule, l'adresse ajoute la page).
  const link = linkIn(invocation ? invocation.rest : content);
  if (link) {
    if (current?.document?.source !== link.address) await readWebPage(link.address);
    if (invocation) invocation.rest = link.rest;
    else if (!link.rest) {
      $('prompt').value = '';
      notice('Page web ajoutée à la conversation : posez votre question.');
      return { ok: true, conversationId: current?.id, text: 'Page web ajoutée à la conversation.' };
    } else content = link.rest;
  }
  notice('');
  const messageSkill = invocation?.skill || null;
  // Appel seul (« /donnees-brutes ») : rien d'autre à écrire, la compétence suffit.
  if (messageSkill)
    content =
      invocation.rest ||
      `Applique la compétence « ${messageSkill.name} »${
        current?.document || current?.files?.length ? ' aux fichiers joints' : ''
      }.`;
  if (!current) {
    current = { id: crypto.randomUUID(), title: content.slice(0, 55), messages: [] };
    conversations.unshift(current);
  }
  const userMessage = { role: 'user', content };
  if (messageSkill) userMessage.skill = messageSkill.id;
  if (remoteId) userMessage.remote = true;
  current.messages.push(userMessage);
  $('prompt').value = '';
  $('skill-suggest').hidden = true;
  chatting = true;
  render();
  controls();
  const answer = { role: 'assistant', content: '' };
  const conversation = current;
  conversation.model = $('model').value;
  conversation.task = $('task').value || undefined;
  conversation.skill = $('skill').value || undefined;
  conversation.projectId = $('project').value || undefined;
  startRunNotes();
  rememberModel(conversation.model).catch((e) => notice(e.message));
  // Modèle qui a écrit la réponse, affiché à côté de « Localia » (et conservé avec le message).
  answer.model = conversation.model;
  reply = messageNode(answer);
  let completed = false;
  let failure = null;
  try {
    await persist();
    const result = await window.localia.run('chat', {
      model: conversation.model,
      // Compétence : celle du message (« /appel »), sinon celle choisie dans le menu Compétence.
      task: conversation.task,
      skill: messageSkill?.id || skillOf(conversation.skill)?.id,
      remoteId,
      projectId: conversation.projectId,
      documentId: conversation.document?.id,
      fileIds: (conversation.files || []).map((f) => f.id),
      messages: conversation.messages
        .filter((m) => !m.interrupted)
        .map(({ role, content }) => ({ role, content })),
    });
    answer.content = result.text || '';
    completed = !result.cancelled;
  } catch (error) {
    failure = error.message;
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
  return {
    ok: completed,
    error: failure || (completed ? null : 'Réponse interrompue.'),
    conversationId: conversation.id,
    text: answer.content,
  };
}

// Question envoyée depuis un autre appareil : traitée comme un message tapé sur le Mac.
window.localia.onProgress(({ kind, data }) => {
  if (kind !== 'remote') return;
  (async () => {
    if (chatting || importing || comparing || !historyReady)
      return {
        ok: false,
        error: 'Localia est occupée sur le Mac (conversation, lecture ou comparaison en cours).',
      };
    if (data.conversationId) {
      const found = conversations.find((c) => c.id === data.conversationId);
      if (!found) return { ok: false, error: 'Conversation introuvable sur le Mac.' };
      current = found;
    } else current = null;
    view('chat');
    render();
    if (data.model && installed(data.model)) $('model').value = data.model;
    $('prompt').value = data.text;
    return sendPrompt({ remoteId: data.requestId });
  })()
    .catch((error) => ({ ok: false, error: error.message }))
    .then((result) => window.localia.remoteDone(data.requestId, result));
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
// Modèle de départ choisi selon la mémoire de l'ordinateur (guide-view.js).
$('download').onclick = () => download($('download').dataset.model || 'gemma3:4b');
$('custom-form').onsubmit = (event) => {
  event.preventDefault();
  download($('custom-model').value.trim());
};
$('cancel-download').onclick = guard(() => window.localia.cancel('pull'));
// Informations sur ce qui a été transmis au modèle pour la dernière question.
let runNotes = [];
// Nouvelle demande : le bandeau repart de zéro (préfixe : question d'une série, ex. « Q07 — »).
function startRunNotes(prefix = '') {
  runNotes = prefix ? [prefix] : [];
  notice('');
}
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
  if (kind === 'skill') runNotice(`Compétence appliquée : ${data.name} (${data.call}).`);
  if (kind === 'files-context')
    runNotice(
      `Fichiers transmis au modèle : ${data.names.join(', ')} (tableaux : portrait seulement).`,
    );
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
  const skill = skillOf($('skill').value);
  const chosenTask = taskById($('task').value);
  const advice = taskAdvice($('task').value || skill?.task);
  const box = $('task-advice');
  // Suggestion de premier message (Tab pour la reprendre) selon la tâche ou la compétence.
  $('prompt').placeholder = chosenTask?.example
    ? `Ex. ${chosenTask.example} (Tab pour l’utiliser)`
    : skill
      ? `Décrivez ce que vous attendez : la compétence « ${skill.name} » s’applique.`
      : 'Posez votre question, ou collez l’adresse d’une page web…';
  box.hidden = !advice && !skill && !chosenTask;
  if (box.hidden) return;
  const parts = [];
  // Ce que le choix change pour les prochains messages.
  if (chosenTask?.effect) parts.push(`Tâche « ${chosenTask.label} » : ${chosenTask.effect}`);
  if (skill) {
    parts.push(`Compétence ${skill.call} : ${skill.description}`);
    // Compétence prévue pour une autre tâche : les deux consignes risquent de se contredire.
    const planned = skill.task && taskById(skill.task);
    if (chosenTask && planned && planned.id !== chosenTask.id)
      parts.push(
        `Attention : cette compétence est prévue pour la tâche « ${planned.label} », pas « ${chosenTask.label} » ; les deux consignes peuvent se contredire. Choisissez la tâche « ${planned.label} », ou retirez la compétence.`,
      );
    if (skill.steps.length)
      parts.push(`Parcours en ${skill.steps.length} étapes : ${skill.steps.join(', ')}.`);
  }
  if (!advice) {
    box.textContent = parts.join(' ');
    return;
  }
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
for (const id of ['task', 'skill'])
  $(id).onchange = guard(async () => {
    if (current) {
      current[id] = $(id).value || undefined;
      await persist();
    }
    showTaskAdvice(true);
    await rememberModel($('model').value);
  });
// Tab dans une zone de saisie vide : reprend la suggestion de la tâche.
$('prompt').addEventListener('keydown', (event) => {
  const example = taskById($('task').value)?.example;
  if (event.key !== 'Tab' || event.shiftKey || $('prompt').value || !example) return;
  event.preventDefault();
  $('prompt').value = example;
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
