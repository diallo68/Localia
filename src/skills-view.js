// Onglet « Compétences » : recettes réutilisables (fichiers Markdown), menu Compétence, appel « /nom ».
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

// Menu Compétence : un groupe par famille, séparé des tâches de Localia.
function fillSkillMenu() {
  const select = $('skill');
  for (const group of [...select.querySelectorAll('optgroup[data-skills]')]) group.remove();
  const families = [...new Set(skills.map((s) => s.family))];
  for (const family of families) {
    const group = document.createElement('optgroup');
    group.label = family;
    group.dataset.skills = '1';
    for (const s of skills.filter((x) => x.family === family))
      group.append(new Option(`${s.steps.length ? '▸ ' : ''}${s.name}`, `skill:${s.id}`));
    select.append(group);
  }
  const chosen = conversationChoices(current).skill;
  select.value = chosen;
  if (select.value !== chosen) select.value = '';
}

function useSkill(skill) {
  view('chat');
  $('skill').value = `skill:${skill.id}`;
  $('skill').dispatchEvent(new Event('change'));
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
      if (s.example) {
        const example = element('p', 'skill-example');
        example.append(element('span', '', 'Exemple :'), ' ', element('q', '', s.example));
        card.append(example);
      }
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
      const change = element('button', '', 'Modifier');
      change.type = 'button';
      change.onclick = () => openSkillForm(s);
      const edit = element('button', '', 'Modifier le fichier');
      edit.type = 'button';
      edit.onclick = guard(() => window.localia.skillsOpen(s.id));
      row.append(use, change, edit);
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
// Formulaire de compétence : création, ou modification d'une compétence existante.
let skillEditing = null; // compétence modifiée (null : nouvelle)
const slug = (text) =>
  '/' +
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
function openSkillForm(skill = null) {
  skillEditing = skill;
  const src = skill?.source || skill || {};
  $('skill-form-title').textContent = skill
    ? tr('Modifier la compétence') + ` ${skill.call}`
    : tr('Nouvelle compétence');
  $('skill-f-name').value = src.name || '';
  $('skill-f-call').value = skill?.call || '';
  $('skill-f-call').dataset.auto = skill ? '' : '1';
  $('skill-f-family').value = src.family || '';
  $('skill-f-description').value = src.description || '';
  $('skill-f-body').value = src.body || '';
  $('skill-f-example').value = src.example || '';
  $('skill-families').replaceChildren(
    ...[...new Set(skills.map((x) => x.source?.family || x.family))].map((f) => new Option(f)),
  );
  $('skill-f-task').replaceChildren(
    new Option(tr('Aucun (consigne générale)'), ''),
    ...TASKS.filter((t) => !t.files).map((t) => new Option(taskText(t, 0), t.id)),
  );
  $('skill-f-task').value = skill?.task || '';
  const en = skill?.en || {};
  $('skill-f-name-en').value = en.name || '';
  $('skill-f-family-en').value = en.family || '';
  $('skill-f-description-en').value = en.description || '';
  $('skill-f-body-en').value = en.body || '';
  $('skill-f-example-en').value = en.example || '';
  $('skill-f-english').open = Boolean(en.name) || isEnglish();
  $('skill-f-try').hidden = !skill;
  $('skill-form').hidden = false;
  $('skill-form').scrollIntoView({ block: 'start' });
  $('skill-f-name').focus();
}
// Appel proposé à partir du nom, tant que l'utilisateur ne l'a pas changé lui-même.
$('skill-f-name').oninput = () => {
  if ($('skill-f-call').dataset.auto) $('skill-f-call').value = slug($('skill-f-name').value);
};
$('skill-f-call').oninput = () => {
  $('skill-f-call').dataset.auto = '';
};
$('skill-f-cancel').onclick = () => {
  $('skill-form').hidden = true;
  skillEditing = null;
};
$('skill-f-try').onclick = () => {
  const skill = skills.find((x) => x.call === $('skill-f-call').value.trim().toLowerCase());
  if (skill) useSkill(skill);
};
$('skill-form').onsubmit = guard(async (event) => {
  event.preventDefault();
  const value = (id) => $(id).value.trim();
  const fields = {
    name: value('skill-f-name'),
    call: value('skill-f-call').toLowerCase(),
    family: value('skill-f-family'),
    task: value('skill-f-task'),
    description: value('skill-f-description'),
    body: $('skill-f-body').value,
    example: value('skill-f-example'),
    steps: skillEditing?.steps || [],
    files: skillEditing?.files || [],
    en: value('skill-f-name-en')
      ? {
          name: value('skill-f-name-en'),
          family: value('skill-f-family-en'),
          description: value('skill-f-description-en'),
          body: $('skill-f-body-en').value,
          example: value('skill-f-example-en'),
        }
      : null,
  };
  if (!fields.call.startsWith('/')) fields.call = '/' + fields.call;
  const saved = await window.localia.skillsSave({ file: skillEditing?.file || null, fields });
  await loadSkillCatalog();
  skillEditing = skills.find((x) => x.file === saved.file) || null;
  $('skill-form-title').textContent = tr('Modifier la compétence') + ` ${fields.call}`;
  $('skill-f-try').hidden = !skillEditing;
  notice(
    tr('Compétence enregistrée') +
      ` : ${fields.call} (${saved.file}). ` +
      tr('Essayez-la dans une conversation, avec un document joint si besoin.'),
  );
});

$('skills-new').onclick = () => openSkillForm();
$('skills-new-file').onclick = guard(async () => {
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
