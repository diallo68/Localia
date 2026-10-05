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
//   ---
//   Consignes…
//
// Chargé par le processus principal, l'interface et les tests.
const CALL = /^\/[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_SKILL = 20000;
const RESERVED = ['/competences', '/aide'];

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
  const { fields, body } = parsed;
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
    family: String(fields.famille || 'Mes compétences').slice(0, 60),
    task: fields.tache ? String(fields.tache).toLowerCase() : null,
    steps,
    files: listOf(fields.fichiers),
    file: fileName,
    body,
  };
}

// Toutes les compétences d'un dossier : doublons d'appel et étapes inconnues signalés.
function buildCatalog(entries) {
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
  skills.sort((a, b) => a.family.localeCompare(b.family, 'fr') || a.file.localeCompare(b.file));
  return { skills, errors };
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
  const parts = [`Compétence « ${skill.name} » (${skill.call}).`];
  if (skill.body) parts.push(skill.body);
  if (skill.steps.length) {
    parts.push(
      'Étapes de ce parcours, dans l’ordre (l’utilisateur peut appeler chacune séparément) :',
      ...skill.steps.map((call, i) => {
        const step = skills.find((s) => s.call === call);
        const name = step ? step.name.replace(/^\d+\.\s*/, '') : null;
        return `${i + 1}. ${call} — ${step ? `${name} : ${step.description}` : 'étape inconnue'}`;
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
    buildCatalog,
    parseInvocation,
    skillInstruction,
  };
