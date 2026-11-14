// Schémas écrits par le modèle en Mermaid (bloc ```mermaid```) : dessinés par Localia dans la
// réponse (renderer.js : drawDiagrams), le code restant la version texte (copie, écoute, exports).
// Ici : réparations des erreurs les plus fréquentes des petits modèles (mesure du 14 nov. 2026,
// docs/IDEE-SCHEMAS.md). Chargé par l'interface et par les tests Node.

const DIAGRAM_MAX = 20000; // caractères de code au plus : au-delà, le code reste affiché tel quel

// Libellé qui contient des parenthèses ou d'autres caractères réservés : mis entre guillemets.
// « A[Spores (oomycète)] » et « -->|Pluie (gouttes)| » font échouer l'analyse de Mermaid.
const MERMAID_RESERVED = /[(){}<>;#]/;
function quoteLabel(text) {
  return '"' + text.replace(/"/g, "'") + '"';
}
function repairMermaid(code) {
  if (typeof code !== 'string') return '';
  let out = code.replace(/\r\n?/g, '\n').trim();
  // Fermeture de bloc recopiée dans le code (``` en fin) : retirée.
  out = out.replace(/\n?`{3,}\s*$/, '');
  const lines = out.split('\n');
  const kind = (lines[0] || '').trim().split(/\s+/)[0].toLowerCase();
  if (kind === 'flowchart' || kind === 'graph') {
    out = lines
      .map((line) =>
        line
          // Nœud rectangulaire : id[texte (avec parenthèses)].
          .replace(/(\b[\w-]+)\[([^\]"]*)\]/g, (whole, id, label) =>
            MERMAID_RESERVED.test(label) ? `${id}[${quoteLabel(label)}]` : whole,
          )
          // Libellé de flèche : -->|texte (avec parenthèses)|.
          .replace(/\|([^|"]*[()][^|"]*)\|/g, (_, label) => `|${quoteLabel(label)}|`),
      )
      .join('\n');
  }
  return out;
}

// Le bloc peut-il être confié à Mermaid ? Type de schéma connu et taille raisonnable.
const DIAGRAM_KINDS = [
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'statediagram-v2',
  'erdiagram',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'journey',
  'quadrantchart',
];
function diagramKind(code) {
  const first = String(code || '')
    .trim()
    .split('\n')[0]
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
  return DIAGRAM_KINDS.includes(first) ? first : null;
}
function drawable(code) {
  return typeof code === 'string' && code.length <= DIAGRAM_MAX && Boolean(diagramKind(code));
}

// Consigne ajoutée aux conversations : schémas en Mermaid, circuits et courbes dans les formats de
// figures.js, jamais en caractères (ils partaient en boucle chez Dial-bowe v1, test d'usage n° 5).
const DIAGRAM_INSTRUCTION = {
  fr: [
    'Localia dessine trois sortes de figures écrites dans ta réponse ; utilise-les quand l’utilisateur demande un schéma, un circuit ou une courbe, et n’écris jamais de schéma en caractères (art ASCII).',
    '1. Organigramme, étapes, séquence, cycle, schéma-bloc : bloc ```mermaid```.',
    '2. Circuit électrique (filtre, diviseur de tension, montage RC, RL ou RLC), même si l’utilisateur dit « schéma » : bloc ```circuit``` et non mermaid, une ligne par élément de l’entrée vers la sortie, par exemple :\n```circuit\nentrée Ve\nsérie R 1 kΩ\nmasse C 100 nF\nsortie Vs\n```\n(« série » : composant sur la ligne du haut ; « masse » : composant entre ce point et la masse ; plusieurs composants dans une branche : « masse L 10 mH + C 1 µF »).',
    '3. Courbe : bloc ```courbe``` avec le titre, l’axe x (nom, minimum à maximum, log si besoin, unité), l’axe y et une formule par courbe (opérateurs + - * / ^, fonctions sqrt, log10, ln, exp, sin, cos, atan, constante pi), par exemple :\n```courbe\ntitre : Gain du filtre passe-bas\nx : f, 10 à 100000, log, Hz\ny : G, dB\nG = 20*log10(1/sqrt(1+(f/1000)^2))\n```',
  ].join('\n'),
  en: [
    'Localia draws three kinds of figures written in your answer; use them when the user asks for a diagram, a circuit or a curve, and never draw diagrams with characters (ASCII art).',
    '1. Flowchart, steps, sequence, cycle, block diagram: ```mermaid``` block.',
    '2. Electrical circuit (filter, voltage divider, RC, RL or RLC network), even if the user says “diagram”: ```circuit``` block, not mermaid, one line per element from input to output, for example:\n```circuit\ninput Vin\nseries R 1 kΩ\nground C 100 nF\noutput Vout\n```\n(“series”: component on the top line; “ground”: component between this point and ground; several components in one branch: “ground L 10 mH + C 1 µF”).',
    '3. Curve: ```courbe``` block with the title, the x axis (name, minimum to maximum, log if needed, unit), the y axis and one formula per curve (operators + - * / ^, functions sqrt, log10, ln, exp, sin, cos, atan, constant pi), for example:\n```courbe\ntitle: Gain of the low-pass filter\nx: f, 10 to 100000, log, Hz\ny: G, dB\nG = 20*log10(1/sqrt(1+(f/1000)^2))\n```',
  ].join('\n'),
};

if (typeof module !== 'undefined')
  module.exports = { repairMermaid, diagramKind, drawable, DIAGRAM_MAX, DIAGRAM_INSTRUCTION };
