// Outil de calcul : le modèle écrit ses opérations, Localia les refait (verify.js) et, si l'une est
// fausse, renvoie au modèle les résultats exacts pour qu'il réécrive sa réponse. Les petits modèles
// se trompent souvent en arithmétique ; ils recopient bien un résultat donné. Aucune consigne
// d'écriture n'est ajoutée : imposer « un calcul par ligne » faisait écrire à Dial-bowe-GN-224-2B
// des lignes sans signe d'opération (« 37 285 000 = 10 345 000 », 11 nov. 2026), alors qu'il
// écrit de lui-même ses calculs en entier.

const MAX_RECALC = 20;

const formatNumber = (value, lang) =>
  (+Number(value).toPrecision(10)).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 4,
    useGrouping: false,
  });

// Calculs faux de la réponse ({ expression: « a × b = c », expected }) → lignes « a × b = exact ».
function correctedLines(calculations, lang) {
  return (Array.isArray(calculations) ? calculations : [])
    .filter((c) => typeof c?.expression === 'string' && Number.isFinite(c?.expected))
    .slice(0, MAX_RECALC)
    .map((c) => {
      const expression = c.expression.slice(0, 300);
      const cut = expression.search(/\s(=|≈|~)\s(?!.*\s(=|≈|~)\s)/);
      const left = cut >= 0 ? expression.slice(0, cut).trim() : expression;
      const written = cut >= 0 ? expression.slice(cut).replace(/^\s*(=|≈|~)\s*/, '') : '';
      const exact = formatNumber(c.expected, lang);
      return lang === 'en'
        ? `- ${left} = ${exact}${written ? ` (not ${written})` : ''}`
        : `- ${left} = ${exact}${written ? ` (et non ${written})` : ''}`;
    });
}

// Message envoyé au modèle après sa réponse : les résultats exacts et la demande de réécriture.
function correctionRequest(calculations, lang) {
  const lines = correctedLines(calculations, lang);
  if (!lines.length) return null;
  return lang === 'en'
    ? `Localia redid your calculations with a calculator. Exact results:\n${lines.join('\n')}\n\nRewrite your answer with the same presentation and the same explanations: only replace the wrong results and those that depend on them, writing these calculations in full. If a result is not a whole number, also give its rounded value when useful. Do not mention this correction.`
    : `Localia a refait tes calculs avec une calculatrice. Résultats exacts :\n${lines.join('\n')}\n\nRéécris ta réponse avec la même présentation et les mêmes explications : remplace seulement les résultats faux et ceux qui en dépendent, en écrivant ces calculs en entier. Si un résultat n’est pas un nombre entier, donne aussi sa valeur arrondie quand c’est utile. Ne parle pas de cette correction.`;
}

module.exports = { correctedLines, correctionRequest };
