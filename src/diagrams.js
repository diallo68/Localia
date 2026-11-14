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

// Consigne ajoutée aux conversations : un schéma s'écrit en Mermaid, jamais en caractères (les
// schémas en caractères partaient en boucle chez Dial-bowe v1, test d'usage n° 5).
const DIAGRAM_INSTRUCTION = {
  fr: 'Si l’utilisateur demande un schéma (organigramme, étapes, schéma-bloc, séquence, cycle), écris-le en Mermaid dans un bloc ```mermaid``` : Localia le dessine. N’écris jamais de schéma en caractères (art ASCII). Pour un circuit électrique, chaque composant (résistance R, condensateur C, bobine L, masse) est un nœud relié à ses voisins.',
  en: 'If the user asks for a diagram (flowchart, steps, block diagram, sequence, cycle), write it in Mermaid in a ```mermaid``` block: Localia draws it. Never draw diagrams with characters (ASCII art). For an electrical circuit, each component (resistor R, capacitor C, inductor L, ground) is a node linked to its neighbours.',
};

if (typeof module !== 'undefined')
  module.exports = { repairMermaid, diagramKind, drawable, DIAGRAM_MAX, DIAGRAM_INSTRUCTION };
