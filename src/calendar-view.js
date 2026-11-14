// Page « Calendrier » : échéances (mois ou liste), rattachées ou non à un projet ; export et import
// de fichiers .ics ; dates d'un document proposées par le modèle, vérifiées dans la page citée et
// ajoutées seulement après accord. Aussi : échéances dans la vue d'un projet et sur l'accueil.
let calendarData = { events: [] };
let calendarLoaded = false;
let calendarMode = 'month';
let calendarFilter = ''; // '' : tous ; '-' : sans projet ; sinon l'identifiant d'un projet
let calendarCursor = (() => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
})();
let editingEventId = null;
let pendingDates = null; // dates proposées pour un document, en attente de l'accord
let datesRunning = false;

const EVENT_KIND_LABELS = {
  echeance: 'Échéance',
  reunion: 'Réunion',
  rappel: 'Rappel',
  autre: 'Autre',
};
const eventById = (id) => calendarData.events.find((e) => e.id === id) || null;
const calendarLocale = () => (isEnglish() ? 'en-GB' : 'fr-FR');
const localDate = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDay = (
  day,
  options = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
) => localDate(day).toLocaleDateString(calendarLocale(), options);

async function loadCalendar() {
  try {
    calendarData = await window.localia.loadCalendar();
    calendarLoaded = true;
  } catch (error) {
    notice(error.message);
  }
  renderCalendarEverywhere();
}
async function saveCalendar() {
  if (!calendarLoaded)
    throw new Error('Le calendrier n’a pas pu être chargé : rien n’est enregistré.');
  calendarData = await window.localia.saveCalendar(calendarData);
  renderCalendarEverywhere();
}
// Tous les endroits où des échéances sont affichées.
function renderCalendarEverywhere() {
  if (!$('calendar-view').hidden) renderCalendar();
  const project = typeof projectById === 'function' ? projectById(openProjectId) : null;
  if (project && !$('projects-view').hidden) renderProjectEvents(project);
  renderAccueilEvents();
  if (!$('home-view').hidden && typeof renderHome === 'function') renderHome();
}

function visibleEvents() {
  if (!calendarFilter) return calendarData.events;
  if (calendarFilter === '-') return calendarData.events.filter((e) => !e.projectId);
  return calendarData.events.filter((e) => e.projectId === calendarFilter);
}
// Liste des projets dans un menu ; extra : options placées avant les projets.
function fillEventProjectSelect(select, extra, selected) {
  select.replaceChildren();
  for (const [value, label] of extra) select.append(new Option(tr(label), value));
  for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name)))
    select.append(new Option(p.name, p.id));
  select.value = [...select.options].some((o) => o.value === selected)
    ? selected
    : extra[0]?.[0] || '';
}

// Ligne d'une échéance (liste, projet, accueil) : case « faite », intitulé, date et détails.
function eventMeta(e, { withDate = true, withProject = true } = {}) {
  const parts = [];
  if (withDate) parts.push(formatDay(e.date) + (e.time ? ' · ' + e.time : ''));
  else if (e.time) parts.push(e.time);
  if (e.kind !== 'echeance') parts.push(tr(EVENT_KIND_LABELS[e.kind]));
  const project = withProject && e.projectId ? projectById(e.projectId) : null;
  if (project) parts.push(project.name);
  return parts.join(' · ');
}
function eventRow(e, options = {}) {
  const row = element('div', 'event-row' + (e.done ? ' done' : ''));
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = e.done;
  box.setAttribute('aria-label', tr('Faite') + ' : ' + e.title);
  box.onchange = guard(async () => {
    e.done = box.checked;
    await saveCalendar();
  });
  const text = element('span', 'event-text');
  const title = element('button', 'event-title link-button', e.title);
  title.type = 'button';
  title.onclick = () => openEventDialog(e);
  text.append(title, element('small', 'muted', eventMeta(e, options)));
  if (e.source?.documentName) {
    const source = element('button', 'page-ref event-source');
    source.type = 'button';
    source.textContent = `${e.source.documentName}${e.source.page ? ', p. ' + e.source.page : ''}`;
    source.title = tr('Ouvrir la page citée');
    source.disabled = !e.source.documentId || !e.source.page;
    source.onclick = guard(() =>
      openAttachedPage({ id: e.source.documentId, name: e.source.documentName }, e.source.page),
    );
    text.append(source);
  }
  row.append(box, text);
  return row;
}

// --- Page Calendrier -----------------------------------------------------------------------------

function renderCalendar() {
  fillEventProjectSelect(
    $('calendar-filter'),
    [
      ['', 'Tous les projets'],
      ['-', 'Sans projet'],
    ],
    calendarFilter,
  );
  $('calendar-mode-month').setAttribute('aria-pressed', String(calendarMode === 'month'));
  $('calendar-mode-list').setAttribute('aria-pressed', String(calendarMode === 'list'));
  $('calendar-month').hidden = calendarMode !== 'month';
  $('calendar-list').hidden = calendarMode !== 'list';
  if (calendarMode === 'month') renderMonth();
  else renderEventList();
}

function renderMonth() {
  const { year, month } = calendarCursor;
  const title = new Date(year, month - 1, 1).toLocaleDateString(calendarLocale(), {
    month: 'long',
    year: 'numeric',
  });
  $('calendar-month-title').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  const grid = $('calendar-grid');
  grid.replaceChildren();
  // Noms des jours, du lundi au dimanche (le 4 janvier 2027 est un lundi).
  const head = element('div', 'calendar-row calendar-days');
  head.setAttribute('role', 'row');
  for (let i = 0; i < 7; i++) {
    const name = new Date(2027, 0, 4 + i).toLocaleDateString(calendarLocale(), {
      weekday: 'short',
    });
    const cell = element('span', 'calendar-dayname', name);
    cell.setAttribute('role', 'columnheader');
    head.append(cell);
  }
  grid.append(head);
  const today = dayOf();
  const byDay = new Map();
  for (const e of visibleEvents()) byDay.set(e.date, [...(byDay.get(e.date) || []), e]);
  for (const week of monthGrid(year, month)) {
    const row = element('div', 'calendar-row');
    row.setAttribute('role', 'row');
    for (const day of week) {
      const cell = element('div', 'calendar-cell');
      cell.setAttribute('role', 'gridcell');
      if (!day) {
        cell.classList.add('empty');
        row.append(cell);
        continue;
      }
      if (day === today) cell.classList.add('today');
      const add = element('button', 'calendar-daynum', String(Number(day.slice(8))));
      add.type = 'button';
      add.title = tr('Ajouter une échéance le') + ' ' + formatDay(day);
      add.onclick = () => openEventDialog(null, { date: day });
      cell.append(add);
      const events = byDay.get(day) || [];
      for (const e of events.slice(0, 3)) {
        const chip = element(
          'button',
          'calendar-chip kind-' +
            e.kind +
            (e.done ? ' done' : '') +
            (!e.done && day < today ? ' late' : ''),
          (e.time ? e.time + ' ' : '') + e.title,
        );
        chip.type = 'button';
        chip.title = e.title + ' — ' + eventMeta(e);
        chip.onclick = () => openEventDialog(e);
        cell.append(chip);
      }
      if (events.length > 3) {
        const more = element('button', 'calendar-more link-button', `+${events.length - 3}`);
        more.type = 'button';
        more.title = tr('Voir la liste');
        more.onclick = () => {
          calendarMode = 'list';
          renderCalendar();
        };
        cell.append(more);
      }
      row.append(cell);
    }
    grid.append(row);
  }
}

function renderEventList() {
  const box = $('calendar-list');
  box.replaceChildren();
  const groups = groupEvents(visibleEvents());
  const sections = [
    ['late', 'En retard'],
    ['week', 'Cette semaine'],
    ['later', 'Plus tard'],
  ];
  let any = false;
  for (const [key, label] of sections) {
    if (!groups[key].length) continue;
    any = true;
    const section = element('section', 'calendar-group' + (key === 'late' ? ' late' : ''));
    section.append(element('h3', '', `${tr(label)} (${groups[key].length})`));
    for (const e of groups[key]) section.append(eventRow(e));
    box.append(section);
  }
  if (groups.done.length) {
    const details = element('details', 'calendar-group');
    details.append(element('summary', '', `${tr('Faites')} (${groups.done.length})`));
    for (const e of groups.done) details.append(eventRow(e));
    box.append(details);
  }
  if (!any && !groups.done.length)
    box.append(
      element('p', 'muted', 'Aucune échéance. Ajoutez-en une ou importez un fichier .ics.'),
    );
}

// --- Formulaire d'une échéance ------------------------------------------------------------------

function openEventDialog(event, defaults = {}) {
  editingEventId = event?.id || null;
  const e = event || {
    title: '',
    date: defaults.date || dayOf(),
    kind: 'echeance',
    projectId:
      defaults.projectId || (calendarFilter && calendarFilter !== '-' ? calendarFilter : ''),
  };
  $('event-dialog-title').textContent = tr(event ? 'Modifier l’échéance' : 'Nouvelle échéance');
  $('event-title').value = e.title;
  $('event-date').value = e.date;
  $('event-time').value = e.time || '';
  $('event-kind').value = e.kind;
  fillEventProjectSelect($('event-project'), [['', 'Sans projet']], e.projectId || '');
  $('event-notes').value = e.notes || '';
  $('event-done').checked = Boolean(e.done);
  $('event-delete').hidden = !event;
  const source = e.source;
  $('event-source').hidden = !source?.documentName;
  if (source?.documentName)
    $('event-source').textContent =
      `${tr('Source')} : ${source.documentName}${source.page ? ', p. ' + source.page : ''}` +
      (source.excerpt ? ` — « ${source.excerpt} »` : '') +
      (source.verified ? '' : ` (${tr('date non retrouvée dans le document')})`);
  $('event-dialog').returnValue = '';
  $('event-dialog').showModal();
  $('event-title').focus();
}
$('event-dialog').addEventListener(
  'close',
  guard(async () => {
    const action = $('event-dialog').returnValue;
    if (action === 'delete' && editingEventId) {
      calendarData.events = calendarData.events.filter((e) => e.id !== editingEventId);
      await saveCalendar();
      notice(tr('Échéance supprimée.'));
    } else if (action === 'save') {
      const fields = {
        title: $('event-title').value.trim(),
        date: $('event-date').value,
        time: $('event-time').value || undefined,
        kind: $('event-kind').value,
        projectId: $('event-project').value || undefined,
        notes: $('event-notes').value.trim() || undefined,
        done: $('event-done').checked,
      };
      if (!fields.title || !isDay(fields.date))
        throw new Error(tr('Intitulé et date obligatoires.'));
      const existing = eventById(editingEventId);
      if (existing) Object.assign(existing, fields);
      else
        calendarData.events.push({
          id: crypto.randomUUID(),
          ...fields,
          createdAt: new Date().toISOString(),
        });
      await saveCalendar();
      // Nouvelle échéance hors du mois affiché : le mois suit.
      const [y, m] = fields.date.split('-').map(Number);
      if (!existing && calendarMode === 'month') {
        calendarCursor = { year: y, month: m };
        if (!$('calendar-view').hidden) renderCalendar();
      }
    }
    editingEventId = null;
  }),
);

// --- Export et import .ics ------------------------------------------------------------------------

$('calendar-export').onclick = guard(async () => {
  const events = visibleEvents();
  if (!events.length) throw new Error(tr('Aucune échéance à exporter.'));
  const project = calendarFilter && calendarFilter !== '-' ? projectById(calendarFilter) : null;
  const name = project ? `Localia — ${project.name}` : 'Localia';
  const saved = await window.localia.exportIcs({ events, name });
  if (saved)
    notice(
      `${events.length} ${tr('échéance(s) exportée(s) dans')} « ${saved} ». ` +
        tr('Ouvrez ce fichier avec Calendrier, Outlook ou Google Agenda pour les y ajouter.'),
    );
});
$('calendar-import').onclick = guard(async () => {
  if (!calendarLoaded)
    throw new Error('Le calendrier n’a pas pu être chargé : rien n’est enregistré.');
  const file = await window.localia.importIcs();
  if (!file) return;
  const projectId = calendarFilter && calendarFilter !== '-' ? calendarFilter : undefined;
  const merged = mergeImported(calendarData.events, file.events, {
    newId: () => crypto.randomUUID(),
    projectId,
  });
  calendarData.events = merged.events;
  await saveCalendar();
  const project = projectId ? projectById(projectId) : null;
  notice(
    `« ${file.name} » : ${merged.added} ${tr('échéance(s) ajoutée(s)')}` +
      (project ? ` ${tr('au projet')} « ${project.name} »` : '') +
      (merged.duplicates ? `, ${merged.duplicates} ${tr('déjà présente(s)')}` : '') +
      (file.skipped ? `, ${file.skipped} ${tr('ignorée(s) (sans intitulé ou sans date)')}` : '') +
      '.',
  );
});

// --- Dates d'un document, proposées par le modèle -----------------------------------------------

function openDatesForm(projectId) {
  const select = $('calendar-dates-doc');
  select.replaceChildren();
  const withDocs = projects.filter((p) => p.documents.length && (!projectId || p.id === projectId));
  for (const p of withDocs) {
    const group = document.createElement('optgroup');
    group.label = p.name;
    for (const d of p.documents) group.append(new Option(d.name, `${p.id}|${d.id}`));
    select.append(group);
  }
  if (!select.options.length)
    throw new Error(
      tr(
        projectId
          ? 'Ce projet n’a aucun document. Ajoutez-en un, puis cherchez ses dates.'
          : 'Aucun document dans vos projets. Ajoutez un document à un projet, puis cherchez ses dates.',
      ),
    );
  $('calendar-dates-status').textContent = '';
  $('calendar-dates-form').hidden = false;
  select.focus();
}
$('calendar-dates').onclick = guard(() => openDatesForm(null));
$('calendar-dates-cancel').onclick = guard(async () => {
  if (datesRunning) await window.localia.cancel('dates');
  $('calendar-dates-form').hidden = true;
});
$('calendar-dates-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  if (datesRunning) return;
  const [projectId, docId] = $('calendar-dates-doc').value.split('|');
  const model = $('model').value || models[0]?.name;
  if (!model) throw new Error(tr('Aucun modèle installé.'));
  const status = $('calendar-dates-status');
  datesRunning = true;
  try {
    if (typeof yieldRoutine === 'function') await yieldRoutine();
    status.textContent = `${tr('Le modèle cherche les dates du document')} (${model})…`;
    const result = await window.localia.run('dates', { model, projectId, docId });
    if (result.cancelled) {
      status.textContent = tr('Recherche arrêtée.');
      return;
    }
    status.textContent = tr('Vérification des dates dans le document…');
    const checked = await window.localia.verifyDates({ projectId, docId, text: result.text || '' });
    status.textContent = '';
    if (!checked.proposals.length) {
      status.textContent = tr('Aucune date trouvée dans ce document.');
      return;
    }
    pendingDates = { projectId, docId, model, ...checked };
    showDatesDialog();
  } finally {
    datesRunning = false;
    if (typeof pumpRoutines === 'function') pumpRoutines();
  }
});

function showDatesDialog() {
  const { documentName, proposals, projectId } = pendingDates;
  const ok = proposals.filter((p) => p.verified).length;
  $('dates-intro').textContent =
    `« ${documentName} » : ${proposals.length} ${tr('date(s) proposée(s) par le modèle')}, ` +
    `${ok} ${tr('vérifiée(s) dans le document')}. ${tr('Projet')} : ${projectById(projectId)?.name || ''}.`;
  const list = $('dates-list');
  list.replaceChildren();
  proposals.forEach((p, i) => {
    const row = element('div', 'dates-row' + (p.verified ? '' : ' unverified'));
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = p.verified; // une date non retrouvée n'est jamais cochée d'office
    box.dataset.index = i;
    box.id = 'date-proposal-' + i;
    box.setAttribute('aria-label', tr('Garder') + ' : ' + p.title);
    const title = document.createElement('input');
    title.value = p.title;
    title.maxLength = 200;
    title.dataset.index = i;
    title.className = 'dates-title';
    title.setAttribute('aria-label', tr('Intitulé'));
    const info = element('span', 'dates-info');
    info.append(
      element('strong', '', formatDay(p.date)),
      element(
        'span',
        p.verified ? 'tag cool' : 'tag warm',
        tr(p.verified ? 'vérifiée' : 'à vérifier'),
      ),
      element(
        'small',
        'muted',
        `p. ${p.page}` +
          (p.pageCorrected ? ` (${tr('le modèle citait la p.')} ${p.pageCorrected})` : '') +
          (p.excerpt ? ` — « ${p.excerpt} »` : ''),
      ),
    );
    row.append(box, title, info);
    list.append(row);
  });
  $('dates-dialog').returnValue = '';
  $('dates-dialog').showModal();
}
$('dates-dialog').addEventListener(
  'close',
  guard(async () => {
    if ($('dates-dialog').returnValue !== 'save' || !pendingDates) {
      pendingDates = null;
      return;
    }
    const { proposals, projectId, docId, documentName, model } = pendingDates;
    const titles = Object.fromEntries(
      [...$('dates-list').querySelectorAll('.dates-title')].map((t) => [
        t.dataset.index,
        t.value.trim(),
      ]),
    );
    const kept = [...$('dates-list').querySelectorAll('input[type=checkbox]:checked')].map(
      (b) => proposals[b.dataset.index],
    );
    pendingDates = null;
    if (!kept.length) return;
    const now = new Date().toISOString();
    for (const p of kept)
      calendarData.events.push({
        id: crypto.randomUUID(),
        title: titles[proposals.indexOf(p)] || p.title,
        date: p.date,
        kind: 'echeance',
        projectId,
        source: {
          documentId: docId,
          documentName,
          page: p.page,
          excerpt: p.excerpt,
          verified: p.verified,
          model,
          at: now,
        },
        createdAt: now,
      });
    await saveCalendar();
    $('calendar-dates-form').hidden = true;
    notice(`${kept.length} ${tr('échéance(s) ajoutée(s) au calendrier.')}`);
  }),
);

// --- Projet et accueil ------------------------------------------------------------------------------

function renderProjectEvents(project) {
  const box = $('project-events');
  box.replaceChildren();
  const { late, next } = upcomingEvents(
    calendarData.events.filter((e) => e.projectId === project.id),
    5,
  );
  for (const e of [...late, ...next]) box.append(eventRow(e, { withProject: false }));
  if (!late.length && !next.length) box.append(element('p', 'muted', 'Aucune échéance à venir.'));
}
$('project-event-add').onclick = () => openEventDialog(null, { projectId: openProjectId });
$('project-event-dates').onclick = guard(() => {
  $('calendar-tab').click();
  openDatesForm(openProjectId);
});

// Accueil (mode simple) : retards et trois prochaines échéances ; rien si le calendrier est vide.
function renderAccueilEvents() {
  const box = $('accueil-events');
  if (!box) return;
  const { late, next } = upcomingEvents(calendarData.events, 3);
  $('accueil-events-section').hidden = !late.length && !next.length;
  box.replaceChildren();
  for (const e of [...late.slice(0, 3), ...next]) box.append(eventRow(e));
}
$('accueil-events-all').onclick = () => $('calendar-tab').click();

// --- Navigation -------------------------------------------------------------------------------------

$('calendar-tab').onclick = () => {
  view('calendar');
  renderCalendar();
};
$('simple-calendar').onclick = () => $('calendar-tab').click();
$('calendar-add').onclick = () => openEventDialog(null);
$('calendar-filter').onchange = () => {
  calendarFilter = $('calendar-filter').value;
  renderCalendar();
};
$('calendar-mode-month').onclick = () => {
  calendarMode = 'month';
  renderCalendar();
};
$('calendar-mode-list').onclick = () => {
  calendarMode = 'list';
  renderCalendar();
};
const moveMonth = (delta) => {
  const d = new Date(calendarCursor.year, calendarCursor.month - 1 + delta, 1);
  calendarCursor = { year: d.getFullYear(), month: d.getMonth() + 1 };
  renderMonth();
};
$('calendar-prev').onclick = () => moveMonth(-1);
$('calendar-next').onclick = () => moveMonth(1);
$('calendar-today').onclick = () => {
  const d = new Date();
  calendarCursor = { year: d.getFullYear(), month: d.getMonth() + 1 };
  renderMonth();
};
