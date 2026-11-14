// Boucles de répétition : un petit modèle peut répéter sans fin la même ligne (schéma en caractères)
// ou la même phrase. Localia regarde la fin du texte reçu : si un même motif s'y répète au moins
// MIN_REPETITIONS fois sur au moins MIN_SPAN caractères, la génération est arrêtée et le texte coupé
// après la première occurrence du motif. Seuils prudents : les lignes d'un tableau ou d'une liste
// diffèrent, et un vrai texte répète rarement douze fois de suite la même ligne.

const MIN_REPETITIONS = 12;
const MIN_SPAN = 200;
const MAX_PERIOD = 600;

// Renvoie { period, repetitions, cut } si la fin de text est une boucle, sinon null.
// cut : longueur du texte à garder (tout ce qui précède la boucle, plus une occurrence du motif).
function findLoop(
  text,
  { minRepetitions = MIN_REPETITIONS, minSpan = MIN_SPAN, maxPeriod = MAX_PERIOD } = {},
) {
  const n = typeof text === 'string' ? text.length : 0;
  for (let period = 1; period <= maxPeriod && period * minRepetitions <= n; period++) {
    // Longueur de la fin du texte où chaque caractère est égal à celui situé « period » plus tôt
    // (le motif peut être coupé en cours d'écriture : la comparaison se fait caractère par caractère).
    let same = 0;
    while (same < n - period && text[n - 1 - same] === text[n - 1 - same - period]) same++;
    const span = same + period;
    if (span >= minSpan && span / period >= minRepetitions) {
      // Le motif ne doit pas être fait que d'espaces (indentation, lignes vides).
      if (!text.slice(n - period).trim()) continue;
      // Le motif repéré peut commencer en milieu de ligne ou de phrase (« fréquences. » et
      // « Introduction. » finissent pareil) : la coupe avance jusqu'à la fin de ligne, sinon jusqu'à
      // l'espace suivant, sans dépasser une occurrence de plus.
      let cut = n - span + period;
      const motif = text.slice(n - period);
      const boundary = motif.includes('\n') ? '\n' : ' ';
      if (text[cut - 1] !== boundary) {
        const next = text.slice(cut, cut + period).indexOf(boundary);
        if (next >= 0) cut += next + 1;
      }
      return { period, repetitions: Math.floor(span / period), cut };
    }
  }
  return null;
}

// Surveillance d'un flux : vérifie la fin du texte toutes les STEP lettres reçues.
const STEP = 80;
function loopWatcher(options) {
  let checkedAt = 0;
  return (text) => {
    if (text.length - checkedAt < STEP) return null;
    checkedAt = text.length;
    return findLoop(text, options);
  };
}

module.exports = { findLoop, loopWatcher, MIN_REPETITIONS };
