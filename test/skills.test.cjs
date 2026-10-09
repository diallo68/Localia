const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const s = require('../src/skills.js');

const file = (fields, body = 'Consignes.') =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n${body}`;

test('compétence lue depuis son en-tête ; erreurs explicites', () => {
  const skill = s.parseSkill(
    file({
      nom: 'Valeurs manquantes',
      appel: '/donnees-manquants',
      famille: 'Données brutes',
      tache: 'donnees',
    }),
    'a.md',
  );
  assert.equal(skill.id, 'donnees-manquants');
  assert.equal(skill.task, 'donnees');
  assert.equal(skill.body, 'Consignes.');
  assert.throws(() => s.parseSkill('Pas d’en-tête', 'b.md'), /en-tête/);
  assert.throws(
    () => s.parseSkill(file({ nom: 'X', appel: 'sans-barre' }), 'c.md'),
    /appel invalide/,
  );
  assert.throws(() => s.parseSkill(file({ nom: 'X', appel: '/competences' }), 'd.md'), /réservé/);
  assert.throws(() => s.parseSkill(file({ appel: '/x-y' }), 'e.md'), /nom manquant/);
  // Liste d'étapes en YAML (tirets) acceptée.
  const parcours = s.parseSkill('---\nnom: P\nappel: /p\netapes:\n  - /a\n  - /b\n---\n', 'p.md');
  assert.deepEqual(parcours.steps, ['/a', '/b']);
});

test('catalogue : appel en double et étape inconnue signalés', () => {
  const { skills, errors } = s.buildCatalog([
    { name: 'a.md', text: file({ nom: 'A', appel: '/a' }) },
    { name: 'b.md', text: file({ nom: 'B', appel: '/a' }) },
    { name: 'p.md', text: file({ nom: 'P', appel: '/p', etapes: '/a, /zz' }, '') },
  ]);
  assert.deepEqual(
    skills.map((x) => x.call),
    ['/a', '/p'],
  );
  assert.match(errors[0].error, /déjà utilisé par a\.md/);
  assert.match(errors[1].error, /étape inconnue : \/zz/);
});

test('appel « /nom texte » en début de message', () => {
  const skills = [s.parseSkill(file({ nom: 'Relecture', appel: '/relecture-ieee' }), 'r.md')];
  const call = s.parseInvocation('/relecture-ieee  Relis la section 3', skills);
  assert.equal(call.skill.id, 'relecture-ieee');
  assert.equal(call.rest, 'Relis la section 3');
  assert.equal(s.parseInvocation('/RELECTURE-IEEE', skills).rest, '');
  assert.equal(s.parseInvocation('/competences', skills).reserved, '/competences');
  assert.equal(s.parseInvocation('/inconnue texte', skills), null);
  assert.equal(s.parseInvocation('Relis /relecture-ieee', skills), null);
  assert.equal(s.parseInvocation('/usr/local/bin', skills), null);
});

test('les 42 compétences de départ sont valides, parcours complets, appels uniques', () => {
  const dir = path.join(__dirname, '..', 'src', 'skills');
  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
  const { skills, errors } = s.buildCatalog(entries);
  assert.deepEqual(errors, []);
  assert.equal(skills.length, 42);
  const parcours = skills.filter((x) => x.steps.length).map((x) => [x.call, x.steps.length]);
  assert.deepEqual(parcours.sort(), [
    ['/appli', 9],
    ['/article', 9],
    ['/donnees-brutes', 9],
    ['/these', 7],
  ]);
  const { taskById } = require('../src/tasks.js');
  for (const x of skills) assert.ok(!x.task || taskById(x.task), `${x.call} : tâche ${x.task}`);
  const instruction = s.skillInstruction(
    skills.find((x) => x.call === '/donnees-brutes'),
    skills,
  );
  assert.match(instruction, /5\. \/donnees-manquants — Valeurs manquantes :/);
});

test('compétence : exemple facultatif lu dans l’en-tête', () => {
  const { buildCatalog } = require('../src/skills.js');
  const text = (extra) =>
    `---\nnom: Essai\nappel: /essai\ndescription: Une phrase.\n${extra}---\nConsignes.\n`;
  const [withExample] = buildCatalog([
    { name: 'a.md', text: text('exemple: /essai Résume ce rapport : trois points.\n') },
  ]).skills;
  assert.equal(withExample.example, '/essai Résume ce rapport : trois points.');
  const [without] = buildCatalog([{ name: 'b.md', text: text('') }]).skills;
  assert.equal(without.example, '');
});

test('compétences fournies : chacune a un exemple qui commence par son appel', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { buildCatalog } = require('../src/skills.js');
  const dir = path.join(__dirname, '../src/skills');
  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
  const { skills, errors } = buildCatalog(entries);
  assert.deepEqual(errors, []);
  for (const s of skills) assert.ok(s.example.startsWith(s.call + ' '), s.call);
});
