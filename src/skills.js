// Compétences : recettes réutilisables écrites en Markdown (une par fichier), avec un en-tête :
//
//   ---
//   nom: Valeurs manquantes
//   appel: /donnees-manquants
//   description: Repérer, compter et traiter les valeurs manquantes.
//   famille: Données brutes
//   tache: donnees            (type de tâche : consigne de base et modèle conseillé)
//   etapes: /a, /b, /c        (facultatif : un parcours, suite ordonnée de compétences)
//   fichiers: modele.md       (facultatif : fichiers du dossier joints au modèle)
//   nom_en, description_en, exemple_en, famille_en   (facultatif : version anglaise)
//   ---
//   Consignes…
//   --- en ---                (facultatif : consignes en anglais, utilisées en mode English)
//   Instructions…
//
// Chargé par le processus principal, l'interface et les tests.
const CALL = /^\/[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_SKILL = 20000;
const RESERVED = ['/competences', '/aide', '/web'];

function frontMatter(text) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
  if (!match) return null;
  const fields = {};
  let list = null;
  for (const line of match[1].split('\n')) {
    const item = /^\s*-\s+(.+)$/.exec(line);
    if (item && list) {
      fields[list].push(item[1].trim());
      continue;
    }
    const pair = /^([a-zA-Zéè_]+)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1].toLowerCase();
    if (pair[2].trim()) {
      fields[key] = pair[2].trim();
      list = null;
    } else {
      fields[key] = [];
      list = key;
    }
  }
  return { fields, body: text.slice(match[0].length).trim() };
}
const listOf = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((v) => v.trim())
    .filter(Boolean);

// Fichier → compétence ; une erreur explique ce qui manque, pour que l'utilisateur corrige.
function parseSkill(text, fileName) {
  const parsed = frontMatter(String(text).replace(/\r\n?/g, '\n'));
  if (!parsed) throw new Error('en-tête « --- » absent en haut du fichier');
  const { fields } = parsed;
  // Consignes anglaises après une ligne « --- en --- » : utilisées quand l'interface est en anglais.
  const [body, bodyEn = ''] = parsed.body.split(/^-{3}\s*en\s*-{3}\s*$/im).map((p) => p.trim());
  const call = String(fields.appel || '').toLowerCase();
  if (!CALL.test(call))
    throw new Error('appel invalide : « / » suivi de lettres minuscules, chiffres ou tirets');
  if (RESERVED.includes(call)) throw new Error(`appel réservé par Localia : ${call}`);
  if (!fields.nom) throw new Error('nom manquant');
  const steps = listOf(fields.etapes).map((s) => s.toLowerCase());
  for (const step of steps) if (!CALL.test(step)) throw new Error(`étape invalide : ${step}`);
  if (!body && !steps.length) throw new Error('consignes vides');
  if (body.length > MAX_SKILL)
    throw new Error('consignes trop longues (20 000 caractères au plus)');
  return {
    id: call.slice(1),
    call,
    name: String(fields.nom).slice(0, 120),
    description: String(fields.description || '').slice(0, 300),
    example: String(fields.exemple || '').slice(0, 300),
    family: String(fields.famille || 'Mes compétences').slice(0, 60),
    task: fields.tache ? String(fields.tache).toLowerCase() : null,
    steps,
    files: listOf(fields.fichiers),
    file: fileName,
    body,
    en: fields.nom_en
      ? {
          name: String(fields.nom_en).slice(0, 120),
          description: String(fields.description_en || '').slice(0, 300),
          example: String(fields.exemple_en || '').slice(0, 300),
          family: String(fields.famille_en || '').slice(0, 60),
          body: bodyEn.slice(0, MAX_SKILL),
        }
      : null,
  };
}

// Compétence dans la langue de l'interface : la version anglaise remplace nom, description,
// exemple, famille et consignes quand elle existe ; sinon le français reste (« fr » : original).
function localizeSkill(skill, lang) {
  // « source » : textes français d'origine, pour le formulaire de modification.
  const source = skill.source || {
    name: skill.name,
    description: skill.description,
    example: skill.example,
    family: skill.family,
    body: skill.body,
  };
  if (lang !== 'en' || !skill.en) return { ...skill, source, lang: 'fr' };
  return {
    ...skill,
    source,
    lang: 'en',
    name: skill.en.name,
    description: skill.en.description || skill.description,
    example: skill.en.example || skill.example,
    family: skill.en.family || skill.family,
    body: skill.en.body || skill.body,
  };
}

// Texte du fichier d'une compétence remplie dans le formulaire (une ligne par champ d'en-tête).
const oneLine = (v, max) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
function skillText(f) {
  const head = [
    ['nom', oneLine(f.name, 120)],
    ['appel', oneLine(f.call, 41).toLowerCase()],
    ['description', oneLine(f.description, 300)],
    ['exemple', oneLine(f.example, 300)],
    ['famille', oneLine(f.family, 60) || 'Mes compétences'],
    ['tache', oneLine(f.task, 20).toLowerCase()],
    ['etapes', (f.steps || []).join(', ')],
    ['fichiers', (f.files || []).join(', ')],
    ['nom_en', oneLine(f.en?.name, 120)],
    ['description_en', f.en?.name ? oneLine(f.en?.description, 300) : ''],
    ['exemple_en', f.en?.name ? oneLine(f.en?.example, 300) : ''],
    ['famille_en', f.en?.name ? oneLine(f.en?.family, 60) : ''],
  ].filter(([, v]) => v);
  const body = String(f.body || '').trim();
  const bodyEn = f.en?.name ? String(f.en.body || '').trim() : '';
  return (
    ['---', ...head.map(([k, v]) => `${k}: ${v}`), '---', '', body].join('\n') +
    (bodyEn ? `\n\n--- en ---\n\n${bodyEn}` : '') +
    '\n'
  );
}

// Toutes les compétences d'un dossier : doublons d'appel et étapes inconnues signalés.
function buildCatalog(entries, lang = 'fr') {
  const skills = [];
  const errors = [];
  for (const { name, text } of entries) {
    try {
      const skill = parseSkill(text, name);
      const twin = skills.find((s) => s.call === skill.call);
      if (twin) throw new Error(`appel ${skill.call} déjà utilisé par ${twin.file}`);
      skills.push(skill);
    } catch (error) {
      errors.push({ file: name, error: error.message });
    }
  }
  const calls = new Set(skills.map((s) => s.call));
  for (const s of skills)
    for (const step of s.steps)
      if (!calls.has(step)) errors.push({ file: s.file, error: `étape inconnue : ${step}` });
  const shown = skills.map((s) => localizeSkill(s, lang));
  shown.sort((a, b) => a.family.localeCompare(b.family, lang) || a.file.localeCompare(b.file));
  return { skills: shown, errors };
}

// « /appel suite du message » : compétence appelée et texte restant (null si pas d'appel).
function parseInvocation(message, skills) {
  const match = /^\s*(\/[a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/i.exec(String(message));
  if (!match) return null;
  const call = match[1].toLowerCase();
  if (RESERVED.includes(call)) return { reserved: call, rest: (match[2] || '').trim() };
  const skill = skills.find((s) => s.call === call);
  return skill ? { skill, rest: (match[2] || '').trim() } : null;
}

// Consigne envoyée au modèle pour une compétence (et, pour un parcours, la liste des étapes).
function skillInstruction(skill, skills) {
  const en = skill.lang === 'en';
  const parts = [
    en ? `Skill “${skill.name}” (${skill.call}).` : `Compétence « ${skill.name} » (${skill.call}).`,
  ];
  if (skill.body) parts.push(skill.body);
  if (skill.steps.length) {
    parts.push(
      en
        ? 'Steps of this path, in order (the user can call each one separately):'
        : 'Étapes de ce parcours, dans l’ordre (l’utilisateur peut appeler chacune séparément) :',
      ...skill.steps.map((call, i) => {
        const step = skills.find((s) => s.call === call);
        const name = step ? step.name.replace(/^\d+\.\s*/, '') : null;
        return `${i + 1}. ${call} — ${step ? `${name}${en ? ':' : ' :'} ${step.description}` : en ? 'unknown step' : 'étape inconnue'}`;
      }),
    );
  }
  return parts.join('\n\n');
}

if (typeof module !== 'undefined')
  module.exports = {
    CALL,
    RESERVED,
    parseSkill,
    localizeSkill,
    skillText,
    buildCatalog,
    parseInvocation,
    skillInstruction,
  };
