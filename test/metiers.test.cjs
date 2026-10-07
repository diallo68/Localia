const { test } = require('node:test');
const assert = require('node:assert/strict');
const { METIERS, COMMON_TASKS, metierById, metierTaskGroups } = require('../src/metiers.js');
const { taskById } = require('../src/tasks.js');

test('métiers : tâches et suggestions existent, chaque tâche a son effet et son exemple', () => {
  assert.equal(METIERS.length, 9);
  for (const metier of METIERS) {
    const tasks = metierTaskGroups(metier.id).flatMap((g) => g.tasks);
    for (const id of [...tasks, ...metier.suggestions.map((s) => s.task)]) {
      const task = taskById(id);
      assert.ok(task, `${metier.id} : tâche inconnue ${id}`);
      assert.ok(task.effect && task.example && task.instruction, `${id} : texte manquant`);
    }
    assert.equal(new Set(tasks).size, tasks.length, `${metier.id} : tâche en double`);
  }
  for (const id of COMMON_TASKS) assert.ok(taskById(id), id);
});

test('métiers : anonymisation pour les données sensibles, bibliographie pour l’enseignement', () => {
  assert.deepEqual(
    METIERS.filter((m) => m.anonymize).map((m) => m.id),
    ['sante', 'juridique', 'administration', 'finance'],
  );
  assert.deepEqual(
    METIERS.filter((m) => m.tools?.includes('bibliography')).map((m) => m.id),
    ['enseignement'],
  );
  // Le groupe commun ne répète pas une tâche déjà proposée par le métier.
  const groups = metierTaskGroups('administration');
  assert.equal(groups.at(-1).label, 'Pour tous');
  assert.ok(!groups.at(-1).tasks.includes('courrier'));
  assert.equal(metierById('inconnu'), null);
});
