// Onglet « Bibliographie » : citations d'un PDF (hors ligne), existence des références et recherche
// d'articles (en ligne, sur autorisation explicite).
const VERDICT_ICONS = { trouvée: '✓', 'à vérifier': '⚠', introuvable: '✗', erreur: '⨯' };

function onlineAllowed() {
  return settings.online?.bibliography === true;
}
function biblioControls() {
  $('biblio-online').checked = onlineAllowed();
  const offline = !onlineAllowed();
  for (const id of ['biblio-verify', 'biblio-query']) $(id).disabled = offline;
  $('biblio-search-form').querySelector('button').disabled = offline;
  $('biblio-verify').title = offline ? 'Autorisez d’abord la recherche en ligne' : '';
}
function fillBiblioProjects() {
  const select = $('biblio-project');
  const previous = select.value;
  select.replaceChildren(new Option('Aucun', ''));
  for (const p of projects) select.add(new Option(p.name, p.id));
  select.value = projectById(previous) ? previous : '';
}

$('bibliography-tab').onclick = () => {
  view('bibliography');
  biblioControls();
  fillBiblioProjects();
  showZoteroStatus();
  renderWatch().catch((error) => notice(error.message));
};
async function showZoteroStatus() {
  const box = $('zotero-status');
  try {
    const status = await window.localia.zoteroStatus();
    box.textContent = `Zotero connecté : ${status.total} élément(s), dont ${status.withRecord} avec une notice (auteur, titre, année). Les PDF sans notice ne servent pas aux comparaisons.`;
  } catch (error) {
    box.textContent = error.message;
  }
}
$('biblio-online').onchange = guard(async () => {
  settings = await window.localia.saveSettings({
    ...settings,
    online: { bibliography: $('biblio-online').checked },
  });
  biblioControls();
  renderWatch().catch(() => {});
});

// Citations « Auteur [n] » d'un PDF : le texte est extrait puis effacé une fois l'analyse faite.
$('biblio-pdf').onclick = guard(async () => {
  notice('');
  $('biblio-pdf-status').textContent = 'Lecture du PDF…';
  const doc = await window.localia.attachPdf();
  if (!doc) {
    $('biblio-pdf-status').textContent = '';
    return;
  }
  try {
    const result = await window.localia.biblioCheckDocument(doc.id);
    renderCitations(result);
    $('biblio-references').value = result.references.map((r) => r.text).join('\n');
  } finally {
    await window.localia.deleteDocument(doc.id);
  }
});
function renderCitations(result) {
  const box = $('biblio-citations');
  box.replaceChildren();
  const problems = result.citations.filter((c) => !c.ok);
  $('biblio-pdf-status').textContent = !result.references.length
    ? `${result.name} : aucune liste de références numérotées « [n] » trouvée.`
    : `${result.name} : ${result.references.length} références, ${result.citations.length} citation(s) d’auteur vérifiée(s), ${problems.length} problème(s). Les références sont copiées ci-dessous pour la vérification en ligne.`;
  if (!result.citations.length) return;
  box.append(
    scrollable(
      table(
        ['', 'Citation dans le texte', 'Page', 'Référence [n] dans la bibliographie'],
        [...problems, ...result.citations.filter((c) => c.ok)].map((c) => [
          { text: c.ok ? '✓' : '⚠', className: c.ok ? 'verdict-ok' : 'verdict-warn' },
          `${c.name} [${c.n}]`,
          c.page,
          c.reference
            ? (c.ok ? '' : `Le nom « ${c.name.replace(' et al.', '')} » n’y figure pas : `) +
              c.reference
            : `Aucune référence [${c.n}] dans la bibliographie.`,
        ]),
      ),
    ),
  );
}

function referencesToCheck() {
  const references = $('biblio-references')
    .value.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 15);
  if (!references.length) throw new Error('Collez au moins une référence (une par ligne).');
  return references;
}
$('zotero-verify').onclick = guard(async () => {
  const references = referencesToCheck();
  $('biblio-verify-status').textContent =
    `Comparaison de ${references.length} référence(s) à Zotero…`;
  renderVerified(await window.localia.zoteroVerify(references.slice(0, 300)), 'Zotero');
});
$('biblio-verify').onclick = guard(async () => {
  const references = referencesToCheck();
  $('biblio-verify').disabled = true;
  $('biblio-verify-status').textContent = `Vérification de ${references.length} référence(s)…`;
  try {
    renderVerified(await window.localia.biblioVerify(references.slice(0, 100)));
  } finally {
    biblioControls();
  }
});
function renderVerified(results, source = 'Crossref') {
  const counts = { trouvée: 0, 'à vérifier': 0, introuvable: 0, erreur: 0 };
  for (const r of results) counts[r.verdict]++;
  const missing = source === 'Zotero' ? 'absente(s) de votre bibliothèque' : 'introuvable(s)';
  $('biblio-verify-status').textContent =
    `${source} : ${counts.trouvée} trouvée(s), ${counts['à vérifier']} à vérifier, ${counts.introuvable} ${missing}` +
    (counts.erreur ? `, ${counts.erreur} non vérifiée(s) (erreur de connexion).` : '.');
  const box = $('biblio-verified');
  box.replaceChildren(
    scrollable(
      table(
        ['', 'Référence', `Notice la plus proche (${source})`, 'Détail'],
        results.map((r) => [
          {
            text: `${VERDICT_ICONS[r.verdict]} ${source === 'Zotero' && r.verdict === 'introuvable' ? 'absente' : r.verdict}`,
            className: r.verdict === 'trouvée' ? 'verdict-ok' : 'verdict-warn',
          },
          r.reference,
          r.work ? formatReference(r.work) : '—',
          r.error ||
            (r.work
              ? [
                  `titre ${Math.round(r.titleCoverage * 100)} %`,
                  r.authorMatch ? 'premier auteur ✓' : 'premier auteur ✗',
                  r.yearMatch ? 'année ✓' : 'année ✗',
                ].join(' · ')
              : '—'),
        ]),
      ),
    ),
  );
}

$('biblio-search-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const query = $('biblio-query').value.trim();
  if (!query) return;
  const box = $('biblio-results');
  box.replaceChildren(element('p', 'muted', 'Recherche…'));
  const works = await window.localia.biblioSearch(query);
  box.replaceChildren();
  if (!works.length) box.append(element('p', 'muted', 'Aucun résultat.'));
  for (const work of works) box.append(workCard(work));
});
$('zotero-search-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const query = $('zotero-query').value.trim();
  if (!query) return;
  const box = $('zotero-results');
  box.replaceChildren(element('p', 'muted', 'Recherche…'));
  const works = await window.localia.zoteroSearch(query);
  box.replaceChildren();
  if (!works.length)
    box.append(element('p', 'muted', 'Aucun élément de votre bibliothèque ne correspond.'));
  for (const work of works) box.append(workCard(work, true));
});

// Fiche d'un article : copier la référence, l'ajouter à un projet ; pour Zotero, l'ouvrir dans
// Zotero ou poser une question sur son PDF.
function workCard(work, zotero = false, extra = []) {
  const card = element('article', 'biblio-card');
  card.append(element('strong', '', work.title || 'Sans titre'));
  card.append(element('p', '', formatReference(work)));
  if (work.citedBy != null)
    card.append(element('small', 'muted', `Cité ${work.citedBy} fois (OpenAlex)`));
  if (zotero && work.itemType === 'attachment')
    card.append(element('small', 'muted', 'PDF sans notice : complétez-la dans Zotero.'));
  const row = element('div', 'input-row');
  const button = (label, onclick) => {
    const b = element('button', '', label);
    b.type = 'button';
    b.onclick = guard(() => onclick(b));
    row.append(b);
  };
  // Un PDF sans notice n'a pas de référence à copier : seulement l'ouvrir ou l'interroger.
  const hasRecord = work.itemType !== 'attachment';
  if (hasRecord)
    button('Copier la référence', async (b) => {
      await navigator.clipboard.writeText(formatReference(work));
      b.textContent = 'Copiée';
    });
  if (hasRecord)
    button('Ajouter au projet', async (b) => {
      const project = projectById($('biblio-project').value);
      if (!project) throw new Error('Choisissez un projet (menu « Ajouter au projet »).');
      project.notes.push({
        id: crypto.randomUUID(),
        title: `Source : ${work.title}`.slice(0, 200),
        text: formatReference(work),
        createdAt: new Date().toISOString(),
      });
      await persistProjects();
      b.textContent = `Ajoutée à « ${project.name} »`;
      b.disabled = true;
    });
  if (zotero) {
    button('Ouvrir dans Zotero', () => window.localia.zoteroOpen(work.key));
    if (work.attachments > 0 || work.itemType === 'attachment')
      button('Poser une question sur ce PDF', async (b) => {
        b.disabled = true;
        b.textContent = 'Lecture du PDF…';
        try {
          await openDocumentConversation(await window.localia.zoteroPdf(work.key));
        } finally {
          b.disabled = false;
          b.textContent = 'Poser une question sur ce PDF';
        }
      });
  }
  for (const { label, onclick } of extra) button(label, onclick);
  card.append(row);
  return card;
}

// --- Veille bibliographique ------------------------------------------------------------------
const FREQUENCY_LABELS = { weekly: 'chaque semaine', daily: 'chaque jour' };
async function renderWatch() {
  const watch = await window.localia.watchLoad();
  $('watch-offline').hidden = onlineAllowed() || !watch.topics.length;
  const topics = $('watch-topics');
  topics.replaceChildren();
  for (const topic of watch.topics) {
    const row = element('div', 'folder-row');
    const found = watch.items.filter((i) => i.topicId === topic.id);
    row.append(
      element('strong', '', topic.query),
      element(
        'small',
        'muted',
        `${FREQUENCY_LABELS[topic.frequency]} · ${
          topic.lastRun
            ? `dernière recherche ${new Date(topic.lastRun).toLocaleString('fr-FR')}`
            : 'pas encore lancée'
        } · ${found.length} article(s) trouvé(s)${topic.lastError ? ` · ⚠ ${topic.lastError}` : ''}`,
      ),
    );
    const run = element('button', '', 'Chercher maintenant');
    run.type = 'button';
    run.onclick = guard(async () => {
      run.disabled = true;
      run.textContent = 'Recherche…';
      try {
        const added = await window.localia.watchRun(topic.id);
        notice(added ? '' : `Aucun nouvel article pour « ${topic.query} ».`);
      } finally {
        await renderWatch();
      }
    });
    const remove = element('button', '', 'Ne plus suivre');
    remove.type = 'button';
    remove.onclick = guard(async () => {
      if (
        !confirm(
          `Ne plus suivre « ${topic.query} » ? Ses articles trouvés seront retirés de la veille.`,
        )
      )
        return;
      await window.localia.watchRemove(topic.id);
      await renderWatch();
    });
    row.append(run, remove);
    topics.append(row);
  }
  const fresh = watch.items.filter((i) => i.status === 'new');
  const box = $('watch-items');
  box.replaceChildren();
  if (watch.topics.length && !fresh.length)
    box.append(element('p', 'muted', 'Aucun nouvel article à examiner.'));
  for (const item of fresh) {
    const topic = watch.topics.find((t) => t.id === item.topicId);
    const card = workCard(item.work, false, [
      {
        label: 'Ajouter à Zotero',
        onclick: async () => {
          await window.localia.watchZotero(item.id);
          await renderWatch();
        },
      },
      {
        label: 'Marquer comme vu',
        onclick: async () => {
          await window.localia.watchMark(item.id, 'seen');
          await renderWatch();
        },
      },
    ]);
    card.prepend(element('small', 'muted', `Nouveau · ${topic?.query || ''}`));
    box.append(card);
  }
  showWatchBadge(fresh.length);
}
function showWatchBadge(count) {
  $('bibliography-tab').textContent = count ? `❡ Bibliographie (${count})` : '❡ Bibliographie';
}
$('watch-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  await window.localia.watchAdd($('watch-query').value, $('watch-frequency').value);
  $('watch-form').reset();
  await renderWatch();
});
window.localia.onProgress(({ kind }) => {
  if (kind === 'watch') renderWatch().catch(() => {});
  if (kind === 'watch-open') $('bibliography-tab').click();
});
// Nombre de nouveaux articles affiché dès le démarrage.
window.localia
  .watchLoad()
  .then((w) => showWatchBadge(w.items.filter((i) => i.status === 'new').length))
  .catch(() => {});

window.localia.onProgress(({ kind, data }) => {
  if (kind === 'biblio')
    $('biblio-verify-status').textContent = `Vérification : ${data.done} / ${data.total}…`;
});
