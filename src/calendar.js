// Calendrier : échéances (rattachées ou non à un projet), échanges par fichiers .ics (RFC 5545)
// et vérification des dates proposées par un modèle dans la page citée d'un document.
// Rien n'est synchronisé avec un compte en ligne : l'utilisateur exporte et importe des fichiers.
// Chargé par le processus principal, l'interface et les tests.
const EVENT_KINDS = ['echeance', 'reunion', 'rappel', 'autre'];
const CALENDAR_LIMITS = { events: 2000, title: 200, notes: 2000, excerpt: 400, icsBytes: 2000000 };

const isDay = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const calendarText = (value, max) => (typeof value === 'string' ? value.slice(0, max) : undefined);
const calendarId = (value) => typeof value === 'string' && /^[\w.@-]{1,200}$/.test(value);

// Provenance d'une échéance proposée par le modèle : document, page, extrait cité.
function eventSource(source) {
  if (!source || typeof source !== 'object') return undefined;
  const page = Number.isInteger(source.page) && source.page > 0 ? source.page : undefined;
  return {
    documentId: calendarText(source.documentId, 100),
    documentName: calendarText(source.documentName, 200),
    page,
    excerpt: calendarText(source.excerpt, CALENDAR_LIMITS.excerpt),
    verified: source.verified === true,
    conversationId: calendarText(source.conversationId, 100),
    model: calendarText(source.model, 200),
    at: calendarText(source.at, 40),
  };
}

// Calendrier reçu de l'interface ou relu sur le disque : structure vérifiée, tailles bornées.
function normalizeCalendar(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const list = Array.isArray(data.events) ? data.events : [];
  if (list.length > CALENDAR_LIMITS.events)
    throw new Error(`Calendrier : ${CALENDAR_LIMITS.events} échéances au plus.`);
  const events = list.map((e) => {
    if (!e || !calendarId(e.id)) throw new Error('Échéance sans identifiant.');
    const title = calendarText(e.title, CALENDAR_LIMITS.title)?.trim();
    if (!title) throw new Error('Une échéance doit avoir un intitulé.');
    if (!isDay(e.date)) throw new Error(`Échéance « ${title} » : date invalide.`);
    return {
      id: e.id,
      title,
      date: e.date,
      time: isTime(e.time) ? e.time : undefined,
      projectId: calendarId(e.projectId) ? e.projectId : undefined,
      kind: EVENT_KINDS.includes(e.kind) ? e.kind : 'echeance',
      done: e.done === true,
      notes: calendarText(e.notes, CALENDAR_LIMITS.notes) || undefined,
      source: eventSource(e.source),
      uid: calendarText(e.uid, 300) || undefined, // identifiant d'un événement importé (.ics)
      createdAt: calendarText(e.createdAt, 40) || new Date().toISOString(),
    };
  });
  return { events: sortEvents(events) };
}

const eventKey = (e) => e.date + 'T' + (e.time || '99:99');
function sortEvents(events) {
  return [...events].sort(
    (a, b) => eventKey(a).localeCompare(eventKey(b)) || a.title.localeCompare(b.title),
  );
}

// Jour local au format AAAA-MM-JJ (pas toISOString, qui passe en temps universel).
function dayOf(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

// Liste : en retard (non faites, avant aujourd'hui), cette semaine (7 jours), plus tard, faites.
function groupEvents(events, today = dayOf()) {
  const week = addDays(today, 7);
  const groups = { late: [], week: [], later: [], done: [] };
  for (const e of sortEvents(events)) {
    if (e.done) groups.done.push(e);
    else if (e.date < today) groups.late.push(e);
    else if (e.date < week) groups.week.push(e);
    else groups.later.push(e);
  }
  groups.done.reverse(); // les plus récentes d'abord
  return groups;
}
// Prochaines échéances non faites (accueil) : retards compris.
function upcomingEvents(events, count = 3, today = dayOf()) {
  const { late, week, later } = groupEvents(events, today);
  return { late, next: [...week, ...later].slice(0, count) };
}

// Grille d'un mois : semaines du lundi au dimanche ; cases hors du mois à null.
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const cells = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++)
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// --- Fichiers .ics (RFC 5545) ------------------------------------------------------------------

const utf8Bytes = (text) => new TextEncoder().encode(text).length;
const icsEscape = (text) =>
  String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
const icsUnescape = (text) =>
  text.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

// Lignes repliées à 75 octets (UTF-8), sans couper un caractère.
function foldLine(line) {
  const out = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Bytes(ch);
    const limit = out.length ? 74 : 75; // les lignes de suite commencent par une espace
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const compactDay = (day) => day.replace(/-/g, '');
const icsStamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

// Export : une journée entière (DATE) ou une heure locale sans fuseau (« heure flottante »),
// lue comme l'heure du lieu où le fichier est ouvert.
function toIcs(events, { projects = [], now = new Date(), name = 'Localia' } = {}) {
  const projectName = (id) => projects.find((p) => p.id === id)?.name;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Localia//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + icsEscape(name),
  ];
  for (const e of sortEvents(events)) {
    const description = [
      projectName(e.projectId) ? 'Projet : ' + projectName(e.projectId) : '',
      e.notes || '',
      e.source?.documentName
        ? `Source : ${e.source.documentName}${e.source.page ? ', p. ' + e.source.page : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    lines.push('BEGIN:VEVENT', 'UID:' + (e.uid || e.id + '@localia'), 'DTSTAMP:' + icsStamp(now));
    if (e.time) {
      const start = compactDay(e.date) + 'T' + e.time.replace(':', '') + '00';
      lines.push('DTSTART:' + start);
    } else {
      lines.push(
        'DTSTART;VALUE=DATE:' + compactDay(e.date),
        'DTEND;VALUE=DATE:' + compactDay(addDays(e.date, 1)),
      );
    }
    lines.push('SUMMARY:' + icsEscape(e.title));
    if (description) lines.push('DESCRIPTION:' + icsEscape(description));
    if (projectName(e.projectId)) lines.push('CATEGORIES:' + icsEscape(projectName(e.projectId)));
    if (e.done) lines.push('X-LOCALIA-DONE:TRUE');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// Import tolérant : événements (VEVENT) avec un résumé et une date de début. Les dates en temps
// universel (suffixe Z) sont ramenées à l'heure locale de cet ordinateur ; les autres fuseaux
// (TZID) sont lus comme heure locale, ce qui suffit pour une échéance.
function fromIcs(text) {
  if (typeof text !== 'string') throw new Error('Fichier .ics illisible.');
  if (utf8Bytes(text) > CALENDAR_LIMITS.icsBytes)
    throw new Error('Fichier .ics trop volumineux (2 Mo au plus).');
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Ce fichier n’est pas un calendrier (.ics).');
  const lines = text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .split(/\r?\n/);
  const events = [];
  let current = null;
  let skipped = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) current = {};
    else if (/^END:VEVENT$/i.test(line)) {
      if (current?.title && current.date) events.push(current);
      else skipped++;
      current = null;
    } else if (current) {
      const match = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/i);
      if (!match) continue;
      const [, name, params, value] = match;
      const key = name.toUpperCase();
      if (key === 'SUMMARY')
        current.title = icsUnescape(value).trim().slice(0, CALENDAR_LIMITS.title);
      else if (key === 'DESCRIPTION')
        current.notes = icsUnescape(value).slice(0, CALENDAR_LIMITS.notes);
      else if (key === 'UID') current.uid = value.trim().slice(0, 300);
      else if (key === 'X-LOCALIA-DONE') current.done = /true/i.test(value);
      else if (key === 'DTSTART') Object.assign(current, icsDate(value.trim(), params));
    }
  }
  return { events, skipped };
}
function icsDate(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return {};
  const [, y, mo, d, h, mi, , z] = m;
  if (!h || /VALUE=DATE(?!-)/i.test(params)) return { date: `${y}-${mo}-${d}` };
  if (z) {
    const local = new Date(Date.UTC(+y, mo - 1, +d, +h, +mi));
    const pad = (n) => String(n).padStart(2, '0');
    return { date: dayOf(local), time: `${pad(local.getHours())}:${pad(local.getMinutes())}` };
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

// Fusion d'un import : un événement déjà présent (même UID) n'est pas ajouté une seconde fois.
function mergeImported(existing, imported, { newId, projectId, now = new Date().toISOString() }) {
  const uids = new Set(existing.map((e) => e.uid || e.id + '@localia'));
  const added = [];
  let duplicates = 0;
  for (const e of imported) {
    if (e.uid && uids.has(e.uid)) {
      duplicates++;
      continue;
    }
    if (e.uid) uids.add(e.uid);
    added.push({
      id: newId(),
      title: e.title,
      date: e.date,
      time: e.time,
      notes: e.notes,
      done: e.done === true,
      uid: e.uid,
      projectId,
      kind: 'echeance',
      createdAt: now,
    });
  }
  return { events: [...existing, ...added], added: added.length, duplicates };
}

// --- Dates proposées par le modèle : vérifiées dans la page citée ------------------------------

const MONTHS = {
  fr: [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre',
  ],
  en: [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ],
};
const SHORT_MONTHS = {
  fr: ['janv', 'fevr', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
};
const plain = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
// Même transformation, caractère par caractère, avec la position de chacun dans le texte
// d'origine : l'extrait montré à l'utilisateur garde les accents et les majuscules.
function plainIndexed(text) {
  let out = '';
  const origin = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const c = plain(text[i]);
    if (c === ' ' || /\s/.test(text[i])) {
      if (space) continue;
      space = true;
      out += ' ';
      origin.push(i);
      continue;
    }
    space = false;
    for (const x of c) {
      out += x;
      origin.push(i);
    }
  }
  return { out, origin };
}
const excerptOf = (text, origin, start, end) =>
  text
    .slice(origin[Math.max(0, start - 80)], origin[Math.min(origin.length - 1, end + 80)] + 1)
    .replace(/\s+/g, ' ')
    .trim();

// Toutes les écritures d'une date AAAA-MM-JJ qu'on peut trouver dans un texte (FR et EN).
function dateSpellings(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const out = new Set([
    day,
    `${dd}/${mm}/${y}`,
    `${d}/${m}/${y}`,
    `${dd}.${mm}.${y}`,
    `${dd}-${mm}-${y}`,
    `${y}/${mm}/${dd}`,
  ]);
  // Ordre américain (mois/jour) seulement s'il est sans ambiguïté : « 04/10/2027 » est le
  // 4 octobre dans un document français, il ne doit pas valider le 10 avril.
  if (d > 12) for (const x of [`${mm}/${dd}/${y}`, `${m}/${d}/${y}`]) out.add(x);
  for (const lang of ['fr', 'en']) {
    for (const month of [MONTHS[lang][m - 1], SHORT_MONTHS[lang][m - 1]]) {
      const dayWords = d === 1 ? [String(d), '1er', '1st'] : [String(d), dd];
      for (const w of dayWords) {
        out.add(`${w} ${month} ${y}`);
        out.add(`${w} ${month}. ${y}`);
        out.add(`${month} ${w}, ${y}`);
        out.add(`${month} ${w} ${y}`);
        out.add(`${month}. ${w}, ${y}`);
        out.add(`${w}th ${month} ${y}`);
        out.add(`${w}st ${month} ${y}`);
        out.add(`${w}nd ${month} ${y}`);
        out.add(`${w}rd ${month} ${y}`);
      }
    }
  }
  return [...out].map(plain);
}

// Plage de dates écrite en une fois : « du 12 au 14 juin 2027 », « June 12-14, 2027 ». Seuls
// les deux bouts de la plage sont reconnus (pas les jours du milieu).
function findRange(d, m, y, page) {
  const day = String(d);
  for (const lang of ['fr', 'en'])
    for (const month of new Set([MONTHS[lang][m - 1], SHORT_MONTHS[lang][m - 1]])) {
      const patterns = [
        new RegExp(
          `(?<![0-9])(\\d{1,2})(?:er|st|nd|rd|th)? ?(?:au|a|-|–|et|to|and) ?(\\d{1,2})(?:st|nd|rd|th)? ${month}\\.? ${y}(?![0-9])`,
          'g',
        ),
        new RegExp(
          `${month}\\.? (\\d{1,2})(?:st|nd|rd|th)? ?(?:-|–|to|and) ?(\\d{1,2})(?:st|nd|rd|th)?,? ${y}(?![0-9])`,
          'g',
        ),
      ];
      for (const re of patterns)
        for (const match of page.matchAll(re))
          if (match[1] === day || match[2] === day)
            return [match.index, match.index + match[0].length];
    }
  return null;
}

// La date figure-t-elle dans le texte de la page ? Renvoie l'extrait trouvé (pour la source).
function findDateInText(day, text) {
  if (!isDay(day) || typeof text !== 'string') return null;
  const { out: page, origin } = plainIndexed(text);
  for (const spelling of dateSpellings(day)) {
    // Bornes : « 5/1/2027 » ne doit pas être trouvé dans « 15/1/2027 ».
    let from = 0;
    let index;
    while ((index = page.indexOf(spelling, from)) >= 0) {
      const before = page[index - 1];
      const after = page[index + spelling.length];
      if (!/[0-9a-z]/.test(before || '') && !/[0-9]/.test(after || ''))
        return excerptOf(text, origin, index, index + spelling.length - 1);
      from = index + 1;
    }
  }
  const [y, m, d] = day.split('-').map(Number);
  const range = findRange(d, m, y, page);
  return range ? excerptOf(text, origin, range[0], range[1] - 1) : null;
}

// Date écrite par un modèle, sous l'une des formes courantes : « 2027-01-15 », « 15/01/2027 »,
// « 15 janvier 2027 », « 1er mars 2027 », « March 1st, 2027 », « 15 janv. 2027 ».
const MONTH_INDEX = new Map(
  ['fr', 'en'].flatMap((lang) => [
    ...MONTHS[lang].map((name, i) => [name, i + 1]),
    ...SHORT_MONTHS[lang].map((name, i) => [name, i + 1]),
  ]),
);
const MONTH_NAMES = [...MONTH_INDEX.keys()].sort((a, b) => b.length - a.length).join('|');
function parseDate(text) {
  const t = plain(text);
  const iso = (y, m, d) => {
    const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return isDay(day) ? day : null;
  };
  let m = t.match(/(?<![0-9])(\d{4})-(\d{2})-(\d{2})(?![0-9])/);
  if (m) return iso(m[1], m[2], m[3]);
  m = t.match(/(?<![0-9])(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?![0-9])/);
  if (m) return iso(m[3], m[2], m[1]);
  m = t.match(
    new RegExp(`(?<![0-9])(\\d{1,2})(?:er|st|nd|rd|th)? (${MONTH_NAMES})\\.? (\\d{4})(?![0-9])`),
  );
  if (m) return iso(m[3], MONTH_INDEX.get(m[2]), m[1]);
  m = t.match(
    new RegExp(`(?<![a-z])(${MONTH_NAMES})\\.? (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})(?![0-9])`),
  );
  if (m) return iso(m[3], MONTH_INDEX.get(m[1]), m[2]);
  return null;
}

// Consigne envoyée au modèle pour proposer des échéances depuis un document.
function datesPrompt(lang = 'fr') {
  return lang === 'en'
    ? 'List every date in the document that is a deadline, an event or a time limit (submission, meeting, payment, expiry…). One line per date, exactly in this format, nothing else:\n' +
        'YYYY-MM-DD | short title | p. N\n' +
        'Use the page number where the date is written. If the year is not written, do not list the date. If there is no date, write: NONE'
    : 'Liste toutes les dates du document qui sont une échéance, un événement ou une limite (soumission, réunion, paiement, expiration…). Une ligne par date, exactement dans ce format, rien d’autre :\n' +
        'AAAA-MM-JJ | intitulé court | p. N\n' +
        'Indique la page où la date est écrite. Si l’année n’est pas écrite, ne liste pas la date. S’il n’y a aucune date, écris : AUCUNE';
}

// Lecture de la réponse du modèle. Format demandé : « AAAA-MM-JJ | intitulé | p. N ». Les petits
// modèles s'en écartent (date en toutes lettres, colonnes dans un autre ordre, page manquante) :
// chaque ligne qui contient une date est gardée ; la date est ensuite cherchée dans le document.
function parseProposals(text) {
  const out = [];
  const seen = new Set();
  const isPage = (cell) => /^(?:p(?:age)?\.?\s*)?\d{1,4}$/i.test(cell);
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
    const date = parseDate(line);
    if (!date) continue;
    const cells = line
      .split('|')
      .map((c) => c.replace(/^[*_\s]+|[*_\s]+$/g, '').trim())
      .filter(Boolean);
    const pageCell = line.match(/\bp(?:age)?\.?\s*(\d{1,4})\b/i);
    let page = pageCell ? Number(pageCell[1]) : null;
    if (!page) {
      const bare = cells.find((c) => /^\d{1,4}$/.test(c) && cells.indexOf(c) > 0);
      if (bare) page = Number(bare);
    }
    // Intitulé : la cellule la plus longue qui n'est ni la date seule ni un numéro de page.
    const titles = cells.filter((c) => !isPage(c) && !(parseDate(c) === date && c.length <= 25));
    // Aucune cellule de texte (« 2027-01-15 | 15 janvier 2027 | p. 2 ») : la plus longue sert d'intitulé.
    const fallback = cells.filter((c) => !isPage(c));
    let title = (cells.length > 1 ? (titles.length ? titles : fallback) : [line])
      .sort((a, b) => b.length - a.length)[0]
      ?.replace(/\s*[:–-]\s*$/, '');
    if (cells.length === 1)
      title = line
        .replace(/\b(?:p(?:age)?\.?\s*\d{1,4})\b/i, '')
        .replace(/[*_]+|\(\s*\)/g, '')
        .replace(/[|:–]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    title = (title || '').slice(0, CALENDAR_LIMITS.title);
    const key = date + '|' + plain(title);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push({ date, title, page: page || null });
  }
  return out;
}

// Vérification sans modèle : la date doit être écrite sur la page citée (pages : { numéro: texte }).
function verifyProposals(proposals, pages) {
  return proposals.map((p) => {
    const excerpt = findDateInText(p.date, pages[p.page] || '');
    if (excerpt) return { ...p, verified: true, excerpt };
    // Date présente ailleurs dans le document : page corrigée, mais signalée.
    for (const [n, text] of Object.entries(pages)) {
      const other = findDateInText(p.date, text);
      if (other)
        return { ...p, verified: true, excerpt: other, page: Number(n), pageCorrected: p.page };
    }
    return { ...p, verified: false };
  });
}

if (typeof module !== 'undefined')
  module.exports = {
    EVENT_KINDS,
    CALENDAR_LIMITS,
    isDay,
    normalizeCalendar,
    sortEvents,
    dayOf,
    addDays,
    groupEvents,
    upcomingEvents,
    monthGrid,
    toIcs,
    fromIcs,
    mergeImported,
    dateSpellings,
    findDateInText,
    datesPrompt,
    parseDate,
    parseProposals,
    verifyProposals,
  };
