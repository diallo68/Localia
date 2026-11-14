const test = require('node:test');
const assert = require('node:assert/strict');
const cal = require('../src/calendar.js');

const ev = (over) => ({ id: 'e1', title: 'Soumission', date: '2027-01-15', ...over });

test('normalisation : champs bornés, date et heure vérifiées, tri', () => {
  const { events } = cal.normalizeCalendar({
    events: [
      ev({ id: 'b', date: '2027-02-01', kind: 'inconnu', time: '25:00', projectId: 'p1' }),
      ev({
        id: 'a',
        title: '  Réunion  ',
        time: '09:30',
        done: true,
        source: { page: 2, documentName: 'cfp.pdf' },
      }),
    ],
  });
  assert.deepEqual(
    events.map((e) => e.id),
    ['a', 'b'],
  );
  assert.equal(events[0].title, 'Réunion');
  assert.equal(events[0].time, '09:30');
  assert.equal(events[0].source.page, 2);
  assert.equal(events[1].kind, 'echeance');
  assert.equal(events[1].time, undefined);
  assert.throws(
    () => cal.normalizeCalendar({ events: [ev({ date: '2027-02-30' })] }),
    /date invalide/,
  );
  assert.throws(() => cal.normalizeCalendar({ events: [ev({ title: ' ' })] }), /intitulé/);
  assert.throws(() => cal.normalizeCalendar({ events: [ev({ id: '../x' })] }), /identifiant/);
  assert.deepEqual(cal.normalizeCalendar(null), { events: [] });
});

test('groupes de la liste : retard, cette semaine, plus tard, faites', () => {
  const events = [
    ev({ id: 'r', date: '2027-01-10' }),
    ev({ id: 's', date: '2027-01-14' }),
    ev({ id: 'l', date: '2027-01-30' }),
    ev({ id: 'f', date: '2027-01-11', done: true }),
  ];
  const g = cal.groupEvents(events, '2027-01-12');
  assert.deepEqual(
    [g.late, g.week, g.later, g.done].map((x) => x.map((e) => e.id)),
    [['r'], ['s'], ['l'], ['f']],
  );
  assert.deepEqual(
    cal.upcomingEvents(events, 3, '2027-01-12').next.map((e) => e.id),
    ['s', 'l'],
  );
});

test('grille du mois : semaines du lundi au dimanche', () => {
  const g = cal.monthGrid(2027, 2); // 1er février 2027 : un lundi
  assert.equal(g[0][0], '2027-02-01');
  assert.equal(g.length, 4);
  const n = cal.monthGrid(2026, 11); // 1er novembre 2026 : un dimanche
  assert.deepEqual(n[0].slice(5), [null, '2026-11-01']);
  assert.equal(n.flat().filter(Boolean).length, 30);
});

test('ICS : aller-retour, journée entière qui ne change pas de jour, échappement, lignes repliées', () => {
  const long = 'Rapport final ; version, relue ' + 'é'.repeat(60);
  const events = [
    ev({ id: 'a', title: long, notes: 'ligne 1\nligne 2', projectId: 'p1' }),
    ev({ id: 'b', title: 'Réunion', date: '2027-03-31', time: '14:05' }),
  ];
  const ics = cal.toIcs(events, {
    projects: [{ id: 'p1', name: 'Thèse' }],
    now: new Date('2026-11-14T12:00:00Z'),
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270115\r\nDTEND;VALUE=DATE:20270116/);
  assert.match(ics, /DTSTART:20270331T140500/);
  for (const line of ics.split('\r\n'))
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const back = cal.fromIcs(ics);
  assert.equal(back.events.length, 2);
  assert.equal(back.events[0].title, long);
  assert.equal(back.events[0].date, '2027-01-15');
  assert.equal(back.events[0].time, undefined);
  assert.match(back.events[0].notes, /Projet : Thèse\nligne 1\nligne 2/);
  assert.equal(back.events[0].uid, 'a@localia');
  assert.deepEqual([back.events[1].date, back.events[1].time], ['2027-03-31', '14:05']);
});

test('ICS : fichiers exportés par Calendrier d’Apple et par Outlook', () => {
  const apple = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Inc.//macOS 15.1//EN',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:5B1C-APPLE',
    'DTSTART;TZID=Europe/Paris:20270204T093000',
    'DTEND;TZID=Europe/Paris:20270204T103000',
    'SUMMARY:Comité de suivi',
    'DESCRIPTION:Salle B\\, bâtiment 2',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:5B1D-APPLE',
    'DTSTART;VALUE=DATE:20270301',
    'SUMMARY:Congés',
    'END:VEVENT',
    'BEGIN:VTODO',
    'SUMMARY:pas un événement',
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\r\n');
  const a = cal.fromIcs(apple);
  assert.deepEqual(
    a.events.map((e) => [e.title, e.date, e.time]),
    [
      ['Comité de suivi', '2027-02-04', '09:30'],
      ['Congés', '2027-03-01', undefined],
    ],
  );
  assert.equal(a.events[0].notes, 'Salle B, bâtiment 2');
  const outlook =
    'BEGIN:VCALENDAR\nPRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN\nVERSION:2.0\nBEGIN:VEVENT\n' +
    'UID:040000008200E00074C5B7101A82E008\nSUMMARY;LANGUAGE=fr-FR:Date limite du rapport annuel de l’équipe de reche\n rche\n' +
    'DTSTART;VALUE=DATE:20270615\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20270101T000000Z\nEND:VEVENT\nEND:VCALENDAR\n';
  const o = cal.fromIcs(outlook);
  assert.equal(o.events.length, 1);
  assert.equal(o.events[0].title, 'Date limite du rapport annuel de l’équipe de recherche');
  assert.equal(o.skipped, 1); // événement sans résumé
  assert.throws(() => cal.fromIcs('bonjour'), /pas un calendrier/);
});

test('ICS : heure en temps universel ramenée à l’heure locale', () => {
  const { events } = cal.fromIcs(
    'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:x\nDTSTART:20270115T230000Z\nEND:VEVENT\nEND:VCALENDAR',
  );
  const local = new Date(Date.UTC(2027, 0, 15, 23, 0));
  assert.equal(events[0].date, cal.dayOf(local));
  assert.equal(events[0].time, String(local.getHours()).padStart(2, '0') + ':00');
});

test('import : un événement déjà présent (même UID) n’est pas ajouté deux fois', () => {
  let n = 0;
  const existing = [ev({ id: 'a' }), ev({ id: 'b', uid: 'X1' })];
  const r = cal.mergeImported(
    existing,
    [
      { title: 'Soumission', date: '2027-01-15', uid: 'a@localia' },
      { title: 'Autre', date: '2027-01-16', uid: 'X1' },
      { title: 'Nouvelle', date: '2027-01-17', uid: 'X2' },
      { title: 'Nouvelle', date: '2027-01-17', uid: 'X2' },
    ],
    { newId: () => 'n' + ++n, projectId: 'p1' },
  );
  assert.equal(r.added, 1);
  assert.equal(r.duplicates, 3);
  assert.equal(r.events.at(-1).projectId, 'p1');
});

test('dates proposées par le modèle : lecture des lignes et vérification dans la page citée', () => {
  const reponse = [
    'Voici les dates :',
    '2027-01-15 | Soumission des articles | p. 2',
    '- 2027-03-01 | **Notification aux auteurs** | page 3',
    '2027-04-10 | Version finale | p. 3',
    '2027-02-30 | Date impossible | p. 1',
    '2027-01-15 | Soumission des articles | p. 2',
  ].join('\n');
  const props = cal.parseProposals(reponse);
  assert.deepEqual(
    props.map((p) => [p.date, p.title, p.page]),
    [
      ['2027-01-15', 'Soumission des articles', 2],
      ['2027-03-01', 'Notification aux auteurs', 3],
      ['2027-04-10', 'Version finale', 3],
    ],
  );
  const pages = {
    1: 'Appel à communications',
    2: 'Date limite de soumission : 15 janvier 2027 (minuit).',
    3: 'Notification: March 1st, 2027. Camera-ready: 10/04/2027.',
  };
  const v = cal.verifyProposals(props, pages);
  assert.deepEqual(
    v.map((p) => p.verified),
    [true, true, true],
  );
  assert.match(v[0].excerpt, /15 janvier 2027/);
  // Page fausse : la date est retrouvée ailleurs, page corrigée et signalée.
  const moved = cal.verifyProposals([{ date: '2027-01-15', title: 'x', page: 3 }], pages)[0];
  assert.deepEqual([moved.verified, moved.page, moved.pageCorrected], [true, 2, 3]);
  // Date inventée : non vérifiée.
  assert.equal(
    cal.verifyProposals([{ date: '2027-05-05', title: 'x', page: 2 }], pages)[0].verified,
    false,
  );
});

test('recherche d’une date : formats FR et EN, sans fausse correspondance', () => {
  const ok = [
    'le 1er février 2027',
    'avant le 01/02/2027',
    'February 1, 2027',
    '1 Feb. 2027',
    'deadline 2027-02-01',
    'le 1 fevrier 2027',
  ];
  for (const t of ok) assert.ok(cal.findDateInText('2027-02-01', t), t);
  assert.equal(cal.findDateInText('2027-02-01', 'le 11 février 2027'), null);
  assert.equal(cal.findDateInText('2027-02-01', 'le 01/02/20271'), null);
  assert.equal(cal.findDateInText('2027-02-01', 'février 2027'), null);
  // Ordre américain : accepté seulement sans ambiguïté.
  assert.ok(cal.findDateInText('2027-04-15', 'due 04/15/2027'));
  assert.equal(cal.findDateInText('2027-04-10', 'le 04/10/2027'), null);
});

test('dates écrites par un petit modèle hors du format : lues quand même, puis vérifiées', () => {
  // Réponses réelles (14 nov. 2026) : Dial-bowe écrit la date en toutes lettres et cite la page 1
  // partout ; la base Qwen3.5-2B numérote les lignes et met la date en dernier.
  const dialBowe =
    '15 janvier 2027 | Date limite de soumission | 1\n1er mars 2027 | Notification aux auteurs | 1';
  const base =
    '1 | Date limite de soumission des résumés | 15 janvier 2027\n5 | Frais | 50 000 GNF';
  assert.deepEqual(
    cal.parseProposals(dialBowe).map((p) => [p.date, p.title, p.page]),
    [
      ['2027-01-15', 'Date limite de soumission', 1],
      ['2027-03-01', 'Notification aux auteurs', 1],
    ],
  );
  assert.deepEqual(
    cal.parseProposals(base).map((p) => [p.date, p.title]),
    [['2027-01-15', 'Date limite de soumission des résumés']],
  );
  assert.deepEqual(
    cal.parseProposals('- **March 1st, 2027** : notification (p. 2)').map((p) => [p.date, p.page]),
    [['2027-03-01', 2]],
  );
  assert.equal(
    cal.parseProposals('2027-01-15 | 15 janvier 2027 | p. 2')[0].title,
    '15 janvier 2027',
  );
  const pages = {
    1: 'Appel à communications.',
    2: 'Soumission : 15 janvier 2027. Notification : 1er mars 2027.',
  };
  const v = cal.verifyProposals(cal.parseProposals(dialBowe), pages);
  assert.deepEqual(
    v.map((p) => [p.verified, p.page, p.pageCorrected]),
    [
      [true, 2, 1],
      [true, 2, 1],
    ],
  );
  assert.equal(cal.parseDate('le 3 sept. 2027'), '2027-09-03');
  assert.equal(cal.parseDate('31/02/2027'), null);
});

test('plages de dates et extrait fidèle au texte du document', () => {
  const texte = 'Le colloque se tiendra du 12 au 14 juin 2027 à l’Université.';
  assert.equal(cal.findDateInText('2027-06-12', texte), texte);
  assert.ok(cal.findDateInText('2027-06-14', texte));
  assert.equal(cal.findDateInText('2027-06-13', texte), null); // jour du milieu : non affirmé
  assert.ok(cal.findDateInText('2027-06-14', 'Conference: June 12-14, 2027, Conakry'));
  assert.equal(
    cal.findDateInText('2027-01-15', 'Date   limite : 15 Janvier 2027 (minuit).'),
    'Date limite : 15 Janvier 2027 (minuit).',
  );
});
