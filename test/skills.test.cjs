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

test('compétence bilingue : version anglaise en mode English, français sinon', () => {
  const { parseSkill, localizeSkill, buildCatalog, skillInstruction } = require('../src/skills.js');
  const text = `---
nom: Résumé
appel: /resume
description: Résumé court.
famille: Article
nom_en: Summary
description_en: Short summary.
famille_en: Article (EN)
---
Rédige un résumé de 100 mots.
--- en ---
Write a 100-word summary.
`;
  const skill = parseSkill(text, 'resume.md');
  assert.equal(skill.body, 'Rédige un résumé de 100 mots.');
  const en = localizeSkill(skill, 'en');
  assert.equal(en.name, 'Summary');
  assert.equal(en.family, 'Article (EN)');
  assert.equal(en.body, 'Write a 100-word summary.');
  assert.match(
    skillInstruction(en, [en]),
    /^Skill “Summary” \(\/resume\)\.\n\nWrite a 100-word summary\./,
  );
  assert.equal(localizeSkill(skill, 'fr').name, 'Résumé');
  // Sans version anglaise : le français reste, même en mode English.
  const fr = parseSkill(
    text.replace(/nom_en[\s\S]*?---\n/, '---\n').split('--- en ---')[0],
    'r.md',
  );
  assert.equal(localizeSkill(fr, 'en').name, 'Résumé');
  assert.equal(buildCatalog([{ name: 'resume.md', text }], 'en').skills[0].name, 'Summary');
});

test('compétences fournies : toutes ont une version anglaise complète', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { buildCatalog } = require('../src/skills.js');
  const dir = path.join(__dirname, '..', 'src', 'skills');
  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
  const { skills, errors } = buildCatalog(entries, 'en');
  assert.deepEqual(errors, []);
  for (const s of skills) {
    assert.equal(s.lang, 'en', s.file);
    assert.ok(s.en.description && s.en.family && s.en.example, s.file);
    assert.ok(s.en.body || s.steps.length, s.file);
    assert.doesNotMatch(s.en.body, /^(nom|appel|famille)\s*:/m, s.file);
  }
});

test('formulaire : texte du fichier relu à l’identique, version anglaise comprise', () => {
  const { skillText, parseSkill } = require('../src/skills.js');
  const text = skillText({
    name: 'Communiqué\nde presse',
    call: '/communique',
    description: 'Faits → communiqué.',
    family: '',
    task: 'redaction',
    body: 'Rédige un communiqué.\n\n--- pas une séparation',
    example: '/communique 150 mots',
    steps: [],
    files: [],
    en: { name: 'Press release', description: 'Facts → release.', body: 'Write a release.' },
  });
  const skill = parseSkill(text, 'communique.md');
  assert.equal(skill.name, 'Communiqué de presse');
  assert.equal(skill.family, 'Mes compétences');
  assert.equal(skill.task, 'redaction');
  assert.equal(skill.body, 'Rédige un communiqué.\n\n--- pas une séparation');
  assert.equal(skill.en.name, 'Press release');
  assert.equal(skill.en.body, 'Write a release.');
  // Sans nom anglais : aucune partie anglaise.
  assert.doesNotMatch(
    skillText({ name: 'A', call: '/a', body: 'x', en: { body: 'y' } }),
    /en ---|_en/,
  );
});
