const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TASKS } = require('../src/tasks.js');
const { METIERS } = require('../src/metiers.js');

// i18n.js est un script de page : chargé ici avec les mêmes noms globaux.
function loadI18n(lang) {
  const source = require('node:fs').readFileSync(require.resolve('../src/i18n.js'), 'utf8');
  const sandbox = new Function(
    'TASKS',
    'METIERS',
    'settings',
    'document',
    'MutationObserver',
    `${source.replace(/new MutationObserver[\s\S]*$/, '')}; return { tr, taskText, TASKS_EN, METIERS_EN, EN };`,
  );
  return sandbox(TASKS, METIERS, { lang }, {}, class {});
}

test('anglais : chaque tâche des conversations et chaque métier ont leur traduction', () => {
  const { TASKS_EN, METIERS_EN } = loadI18n('en');
  for (const task of TASKS.filter((t) => !t.files)) {
    const en = TASKS_EN[task.id];
    assert.ok(en && en.length === 3 && en.every(Boolean), `tâche ${task.id} non traduite`);
  }
  for (const metier of METIERS) assert.ok(METIERS_EN[metier.id]?.label, metier.id);
});

test('anglais : textes exacts, sur plusieurs lignes ou avec une partie variable ; français inchangé', () => {
  const en = loadI18n('en');
  assert.equal(en.tr('  Nouvelle conversation '), '  New conversation ');
  assert.equal(
    en.tr(
      'Localia adapte ses tâches, ses compétences et les modèles conseillés à votre\n   travail. Vous pourrez en changer à tout moment.',
    ),
    'Localia adapts its tasks, skills and recommended models to your work. You can change it at any time.',
  );
  assert.equal(en.tr('20 questions détectées : Q01, Q02.'), '20 questions detected: Q01, Q02.');
  assert.equal(en.tr('Texte inconnu'), 'Texte inconnu');
  assert.equal(
    en.taskText(
      TASKS.find((t) => t.id === 'qcm'),
      0,
    ),
    'Create a multiple-choice quiz',
  );
  const fr = loadI18n('fr');
  assert.equal(fr.tr('Nouvelle conversation'), 'Nouvelle conversation');
  assert.equal(
    fr.taskText(
      TASKS.find((t) => t.id === 'qcm'),
      0,
    ),
    'Créer un QCM',
  );
});
