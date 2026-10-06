// Onglet « Compétences » : recettes réutilisables (fichiers Markdown), menu Tâche, appel « /nom ».
let skillErrors = [];

async function loadSkillCatalog() {
  try {
    const catalog = await window.localia.skillsList();
    skills = catalog.skills;
    skillErrors = catalog.errors;
    $('skills-dir').textContent = catalog.dir;
  } catch (error) {
    notice(error.message);
  }
  fillSkillMenu();
  renderSkills();
}

// Menu Tâche : un groupe par famille de compétences, après les tâches de Localia.
function fillSkillMenu() {
  const select = $('task');
  for (const group of [...select.querySelectorAll('optgroup[data-skills]')]) group.remove();
  const families = [...new Set(skills.map((s) => s.family))];
  for (const family of families) {
    const group = document.createElement('optgroup');
    group.label = `Compétences — ${family}`;
    group.dataset.skills = '1';
    for (const s of skills.filter((x) => x.family === family))
      group.append(new Option(`${s.steps.length ? '▸ ' : ''}${s.name}`, `skill:${s.id}`));
    select.append(group);
  }
  if (current?.task) select.value = current.task;
  if (select.value !== (current?.task || '')) select.value = '';
}

function useSkill(skill) {
  view('chat');
  $('task').value = `skill:${skill.id}`;
  $('task').dispatchEvent(new Event('change'));
  $('prompt').focus();
}

function renderSkills() {
  const box = $('skills-list');
  box.replaceChildren();
  if (skillErrors.length) {
    const warn = element('div', 'skill-errors');
    warn.append(element('strong', '', `${skillErrors.length} fichier(s) à corriger :`));
    const list = element('ul', '');
    for (const e of skillErrors) list.append(element('li', '', `${e.file} : ${e.error}`));
    warn.append(list);
    box.append(warn);
  }
  if (!skills.length) box.append(element('p', 'muted', 'Aucune compétence pour le moment.'));
  for (const family of [...new Set(skills.map((s) => s.family))]) {
    box.append(element('h3', '', family));
    const grid = element('div', 'skill-grid');
    for (const s of skills.filter((x) => x.family === family)) {
      const card = element('article', 'skill-card' + (s.steps.length ? ' parcours' : ''));
      card.append(element('strong', '', s.name), element('code', '', s.call));
      if (s.description) card.append(element('p', '', s.description));
      const meta = [
        s.steps.length ? `Parcours en ${s.steps.length} étapes` : null,
        s.task ? `Type : ${taskById(s.task)?.label || s.task}` : null,
        s.files.length ? `Fichiers : ${s.files.join(', ')}` : null,
      ].filter(Boolean);
      if (meta.length) card.append(element('small', 'muted', meta.join(' · ')));
      if (s.steps.length) {
        const steps = element('div', 'skill-steps');
        for (const call of s.steps) {
          const step = skills.find((x) => x.call === call);
          const b = element('button', '', call);
          b.type = 'button';
          b.title = step ? step.name : 'Étape introuvable';
          b.disabled = !step;
          if (step) b.onclick = () => useSkill(step);
          steps.append(b);
        }
        card.append(steps);
      }
      const row = element('div', 'input-row');
      const use = element('button', 'primary', 'Utiliser');
      use.type = 'button';
      use.onclick = () => useSkill(s);
      const edit = element('button', '', 'Modifier le fichier');
      edit.type = 'button';
      edit.onclick = guard(() => window.localia.skillsOpen(s.id));
      row.append(use, edit);
      card.append(row);
      grid.append(card);
    }
    box.append(grid);
  }
}

$('skills-tab').onclick = guard(async () => {
  view('skills');
  await loadSkillCatalog();
});
$('skills-reload').onclick = guard(loadSkillCatalog);
$('skills-folder').onclick = guard(() => window.localia.skillsOpenDir());
$('skills-new').onclick = guard(async () => {
  const name = await window.localia.skillsNew();
  notice(
    `« ${name} » créé et ouvert dans votre éditeur. Remplissez-le, enregistrez, puis cliquez sur « Recharger ».`,
  );
  await loadSkillCatalog();
});

// Suggestions pendant la saisie d'un appel « /… » en début de message ; Tab choisit la première.
function skillSuggestions() {
  const value = $('prompt').value;
  const box = $('skill-suggest');
  const typing = /^\/[a-z0-9-]*$/i.test(value);
  const matches = typing
    ? [
        ...skills.filter((s) => s.call.startsWith(value.toLowerCase())),
        ...[
          { call: '/competences', name: 'Voir toutes les compétences' },
          { call: '/web', name: 'Lire une page web (coller l’adresse après /web)' },
        ].filter((c) => c.call.startsWith(value.toLowerCase())),
      ].slice(0, 8)
    : [];
  box.hidden = !matches.length;
  box.replaceChildren();
  for (const m of matches) {
    const b = element('button', '', '');
    b.type = 'button';
    b.append(element('code', '', m.call), ` ${m.name}`);
    b.onclick = () => {
      $('prompt').value = m.call + ' ';
      box.hidden = true;
      $('prompt').focus();
    };
    box.append(b);
  }
}
$('prompt').addEventListener('input', skillSuggestions);
$('prompt').addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || $('skill-suggest').hidden) return;
  const first = $('skill-suggest').querySelector('button');
  if (!first) return;
  event.preventDefault();
  first.click();
});

loadSkillCatalog();
