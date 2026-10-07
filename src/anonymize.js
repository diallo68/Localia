// Anonymisation avant l'envoi au modèle (métiers Santé, Juridique, Administration, Finance) :
// les données personnelles repérées sont remplacées par des étiquettes stables dans toute la
// conversation ([PERSONNE 1], [IBAN 1]…), puis remises dans la réponse affichée.
// Repérage par motifs, sans modèle : il ne voit pas tout. La liste « mots toujours masqués »
// des réglages complète ce qu'il manque (noms sans civilité, lieux, sociétés…).

const UPPER = 'A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ';
const LOWER = 'a-zàâäçéèêëîïôöùûüÿ';
const NAME = `[${UPPER}][${LOWER}]+(?:[-'’][${UPPER}]?[${LOWER}]+)*`;
const SURNAME = `[${UPPER}]{2,}(?:[-'’ ][${UPPER}]{2,})?`;
// Sigles en capitales qui ne sont pas des noms de famille.
const NOT_SURNAMES = new Set(
  'ONU UE PDF ONG TVA IBAN BIC SARL SAS SA SNC EURL CNSS CNAM CPAM URSSAF SIRET SIREN RIB HT TTC USD EUR GNF FCFA XOF IRM ECG VIH COVID OMS PIB ETAT CEDEAO UEMOA'.split(
    ' ',
  ),
);

// [étiquette, motif, numéro du groupe à masquer (0 : tout)]
const DETECTORS = [
  ['EMAIL', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, 0],
  ['IBAN', /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g, 0],
  ['CARTE', /\b(?:\d{4}[ -]?){3}\d{4}\b/g, 0],
  ['NIR', /\b[12][ ]?\d{2}[ ]?(?:0[1-9]|1[0-2])[ ]?\d{2}[ ]?\d{3}[ ]?\d{3}(?:[ ]?\d{2})?\b/g, 0],
  ['TÉLÉPHONE', /(?:\+\d{1,3}[ .-]?)(?:\d[ .-]?){7,12}\d|\b0[1-9](?:[ .-]?\d{2}){4}\b/g, 0],
  [
    'DATE DE NAISSANCE',
    /\b(?:née?\s+le|date\s+de\s+naissance\s*:?|DDN\s*:?)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}(?:er)?\s+[a-zéû]+\s+\d{4})/gi,
    1,
  ],
  [
    'NUMÉRO',
    /\b(?:n°|no\.?|numéro|IPP|dossier|matricule|passeport|CNI|contrat)\s*[:#]?\s*([A-Z0-9](?=[A-Z0-9/-]*\d)[A-Z0-9/-]{3,})/gi,
    1,
  ],
  [
    'ADRESSE',
    new RegExp(
      `\\b\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+(?:rue|avenue|av\\.|boulevard|bd|chemin|allée|impasse|place|route|quai|cours)\\s+[^\\n,;]{2,60}?(?:,?\\s+\\d{5}\\s+[${UPPER}][\\w-]+)?(?=[,;.\\n]|$)`,
      'gi',
    ),
    0,
  ],
  // Civilité suivie d'un nom : « M. Diallo », « Dr Mamadou Bah », « Maître Camara ».
  [
    'PERSONNE',
    new RegExp(
      `\\b(?:M\\.|Mme|Mlle|Monsieur|Madame|Mademoiselle|Dr\\.?|Docteur|Pr\\.?|Professeur|Maître|Me)\\s+((?:${NAME}|${SURNAME})(?:\\s+(?:${NAME}|${SURNAME})){0,3})`,
      'g',
    ),
    1,
  ],
  // « Mamadou DIALLO » et « DIALLO Mamadou » : prénom et nom en capitales.
  ['PERSONNE', new RegExp(`\\b(${NAME}\\s+${SURNAME})\\b`, 'g'), 1],
  ['PERSONNE', new RegExp(`\\b(${SURNAME}\\s+${NAME})\\b`, 'g'), 1],
];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// map : { "[PERSONNE 1]": "Mamadou DIALLO", … } (celle de la conversation, complétée au besoin).
function createAnonymizer(map = {}, words = []) {
  const labels = { ...map };
  const byValue = new Map(Object.entries(labels).map(([label, value]) => [value, label]));
  const counts = {};
  const labelFor = (kind, value) => {
    const clean = value.trim();
    if (byValue.has(clean)) return byValue.get(clean);
    const used = Object.keys(labels).filter((l) => l.startsWith(`[${kind} `)).length;
    const label = `[${kind} ${used + 1}]`;
    labels[label] = clean;
    byValue.set(clean, label);
    return label;
  };
  const isSurnameOk = (value) =>
    !value.split(/\s+/).some((part) => NOT_SURNAMES.has(part.replace(/[^A-Z]/g, '')));
  function mask(text) {
    let result = String(text ?? '');
    // Mots toujours masqués (réglages), du plus long au plus court.
    for (const word of [...words].sort((a, b) => b.length - a.length)) {
      if (!word.trim()) continue;
      result = result.replace(
        new RegExp(`(?<![\\w])${escapeRegex(word.trim())}(?![\\w])`, 'gi'),
        (found) => {
          counts['MOT MASQUÉ'] = (counts['MOT MASQUÉ'] || 0) + 1;
          return labelFor('MOT MASQUÉ', found);
        },
      );
    }
    for (const [kind, pattern, group] of DETECTORS) {
      result = result.replace(pattern, (...match) => {
        const whole = match[0];
        const part = match[group];
        if (!part || /\[[A-ZÉ ]+ \d+\]/.test(part)) return whole; // déjà une étiquette
        if (kind === 'PERSONNE' && !isSurnameOk(part)) return whole;
        counts[kind] = (counts[kind] || 0) + 1;
        return whole.replace(part, labelFor(kind, part));
      });
    }
    return result;
  }
  // Étiquettes remises par leurs valeurs dans la réponse du modèle.
  function unmask(text) {
    let result = String(text ?? '');
    for (const label of Object.keys(labels).sort((a, b) => b.length - a.length))
      result = result.split(label).join(labels[label]);
    return result;
  }
  return { mask, unmask, map: labels, counts };
}

// Résumé des éléments masqués pour le bandeau : « 2 personnes, 1 IBAN ».
function anonymizedSummary(counts) {
  const names = {
    PERSONNE: ['personne', 'personnes'],
    EMAIL: ['adresse e-mail', 'adresses e-mail'],
    IBAN: ['IBAN', 'IBAN'],
    CARTE: ['numéro de carte', 'numéros de carte'],
    NIR: ['numéro de sécurité sociale', 'numéros de sécurité sociale'],
    TÉLÉPHONE: ['téléphone', 'téléphones'],
    'DATE DE NAISSANCE': ['date de naissance', 'dates de naissance'],
    NUMÉRO: ['numéro de dossier ou de pièce', 'numéros de dossier ou de pièce'],
    ADRESSE: ['adresse', 'adresses'],
    'MOT MASQUÉ': ['mot de votre liste', 'mots de votre liste'],
  };
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${(names[kind] || [kind, kind])[n > 1 ? 1 : 0]}`)
    .join(', ');
}

if (typeof module !== 'undefined') module.exports = { createAnonymizer, anonymizedSummary };
