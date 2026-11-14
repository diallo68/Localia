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

// Consigne ajoutée aux conversations : schémas en Mermaid, circuits et courbes en code Python exécuté
// par Localia (python-figures.cjs), jamais en caractères (ils partaient en boucle chez Dial-bowe v1).
const DIAGRAM_INSTRUCTION = {
  fr: [
    'Localia affiche les figures écrites dans ta réponse ; utilise-les quand l’utilisateur demande un schéma, un circuit, une courbe ou un graphique, et n’écris jamais de schéma en caractères (art ASCII).',
    '- Organigramme, étapes, séquence, cycle : bloc ```mermaid```.',
    '- Circuit électrique, courbe, graphique, schéma scientifique : programme Python complet dans un bloc ```python```, que Localia exécute sur cet ordinateur pour afficher la figure (matplotlib pour les courbes et graphiques ; schemdraw pour les circuits). Seuls numpy, matplotlib et schemdraw sont disponibles.',
    '- schemdraw : `import schemdraw`, `import schemdraw.elements as elm`, `with schemdraw.Drawing() as d:`, puis un ajout `d += …` par composant ; éléments elm.Resistor, elm.Capacitor, elm.Inductor, elm.Ground, elm.Line, elm.Dot, elm.SourceV, elm.Opamp ; directions .right(), .left(), .up(), .down(). Dessine les composants que demande la question, pas plus.',
  ].join('\n'),
  en: [
    'Localia displays the figures written in your answer; use them when the user asks for a diagram, a circuit, a curve or a chart, and never draw diagrams with characters (ASCII art).',
    '- Flowchart, steps, sequence, cycle: ```mermaid``` block.',
    '- Electrical circuit, curve, chart, scientific diagram: complete Python program in a ```python``` block, which Localia runs on this computer to display the figure (matplotlib for curves and charts; schemdraw for circuits). Only numpy, matplotlib and schemdraw are available.',
    '- schemdraw: `import schemdraw`, `import schemdraw.elements as elm`, `with schemdraw.Drawing() as d:`, then one `d += …` per component; elements elm.Resistor, elm.Capacitor, elm.Inductor, elm.Ground, elm.Line, elm.Dot, elm.SourceV, elm.Opamp; directions .right(), .left(), .up(), .down(). Draw the components the question asks for, no more.',
  ].join('\n'),
};

// Code Python de dessin d'une réponse (blocs ```python``` qui utilisent matplotlib ou schemdraw ;
// un bloc resté ouvert en fin de réponse compte aussi).
function figureCode(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/```(?:python|py)[ \t]*\n([\s\S]*?)(?:```|$)/g))
    if (/\b(matplotlib|schemdraw)\b/.test(m[1])) out.push(m[1]);
  return out.slice(0, 4);
}
// Demande de correction : le code a échoué ; le modèle reçoit l'erreur de Python et réécrit.
function figureFixRequest(errors, lang) {
  const list = (Array.isArray(errors) ? errors : [])
    .filter((e) => typeof e === 'string' && e.trim())
    .slice(0, 4)
    .map((e) => e.slice(-1200));
  if (!list.length) return null;
  return lang === 'en'
    ? `Localia ran the Python code of your answer to draw the figure; it failed:\n${list.map((e) => '```\n' + e + '\n```').join('\n')}\n\nRewrite your answer with corrected, complete code (only numpy, matplotlib and schemdraw are available). Keep the explanations. Do not mention this correction.`
    : `Localia a exécuté le code Python de ta réponse pour dessiner la figure ; il a échoué :\n${list.map((e) => '```\n' + e + '\n```').join('\n')}\n\nRéécris ta réponse avec un code corrigé et complet (seuls numpy, matplotlib et schemdraw sont disponibles). Garde les explications. Ne parle pas de cette correction.`;
}

if (typeof module !== 'undefined')
  module.exports = {
    figureCode,
    figureFixRequest,
    repairMermaid,
    diagramKind,
    drawable,
    DIAGRAM_MAX,
    DIAGRAM_INSTRUCTION,
  };
