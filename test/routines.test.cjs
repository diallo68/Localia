const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoutines,
  resumeInterrupted,
  runsForDocuments,
  nextRun,
  routinePrompt,
} = require('../src/routines.js');

const routine = {
  id: 'r1',
  trigger: 'document-ajoute',
  projectId: 'p1',
  enabled: true,
};

test('routines vérifiées : déclencheur connu, projet obligatoire, état inconnu → erreur', () => {
  const data = normalizeRoutines({
    routines: [routine],
    runs: [{ id: 'x', routineId: 'r1', state: 'bizarre', docName: 'a.pdf' }],
  });
  assert.equal(data.routines[0].name, 'Synthèse des nouveaux documents');
  assert.equal(data.runs[0].state, 'erreur');
  assert.equal(data.paused, false);
  assert.throws(() => normalizeRoutines({ routines: [{ ...routine, trigger: 'minuit' }] }));
  assert.throws(() => normalizeRoutines({ routines: [{ ...routine, projectId: '' }] }));
  assert.deepEqual(normalizeRoutines(null), {
    paused: false,
    routines: [],
    runs: [],
    scheduled: undefined,
  });
  // Départ programmé du Benchmark : gardé s'il est complet, ignoré sinon.
  const scheduled = { at: '2026-10-16T08:00:00.000Z', template: { questions: [], models: ['m'] } };
  assert.deepEqual(normalizeRoutines({ scheduled }).scheduled, scheduled);
  assert.equal(
    normalizeRoutines({ scheduled: { at: 'demain', template: {} } }).scheduled,
    undefined,
  );
});

test('déclencheur : une exécution par document et par routine active du projet, sans doublon', () => {
  const data = normalizeRoutines({
    routines: [
      routine,
      { ...routine, id: 'r2', enabled: false },
      { ...routine, id: 'r3', projectId: 'p2' },
    ],
  });
  const docs = [
    { id: 'd1', name: 'a.pdf' },
    { id: 'd2', name: 'b.pdf' },
  ];
  assert.equal(runsForDocuments(data, 'p1', docs).length, 2);
  assert.equal(runsForDocuments(data, 'p1', docs).length, 0);
  assert.deepEqual(
    data.runs.map((r) => [r.routineId, r.docName, r.state]),
    [
      ['r1', 'a.pdf', 'en-attente'],
      ['r1', 'b.pdf', 'en-attente'],
    ],
  );
  assert.equal(nextRun(data).docName, 'a.pdf');
  data.paused = true;
  assert.equal(nextRun(data), null);
});

test('reprise : une exécution restée en cours repart en attente, marquée reprise', () => {
  const data = resumeInterrupted(
    normalizeRoutines({
      routines: [routine],
      runs: [
        { id: 'a', routineId: 'r1', state: 'en-cours', step: 'generation' },
        { id: 'b', routineId: 'r1', state: 'a-relire', text: 'Synthèse' },
      ],
    }),
  );
  assert.deepEqual(
    data.runs.map((r) => [r.state, r.step, r.resumed]),
    [
      ['en-attente', undefined, true],
      ['a-relire', undefined, undefined],
    ],
  );
});

test('consigne : synthèse sourcée, citations entre crochets, rien d’inventé', () => {
  assert.match(routinePrompt('a.pdf'), /\[a\.pdf — page 2\]/);
  assert.match(routinePrompt('a.pdf'), /N’ajoute rien/);
  assert.match(routinePrompt('a.pdf', 'en'), /Do not add anything/);
});
