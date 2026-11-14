const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/diagrams.js');

test('réparations : libellés avec parenthèses mis entre guillemets, fermeture recopiée retirée', () => {
  // Erreurs réelles relevées le 14 nov. 2026 (qwen3-4b, Qwen3.5-9B).
  const code =
    'graph TD\n  D[Infection de la tuber (pomme de terre)] --> E[Sporulation]\n  E -->|Pluie (gouttes)| A\n```';
  assert.equal(
    d.repairMermaid(code),
    'graph TD\n  D["Infection de la tuber (pomme de terre)"] --> E[Sporulation]\n  E -->|"Pluie (gouttes)"| A',
  );
  // Déjà correct : inchangé ; autre type de schéma : seules les fins de ligne et la fermeture changent.
  assert.equal(
    d.repairMermaid('graph LR\n  A["déjà (ok)"] --> B'),
    'graph LR\n  A["déjà (ok)"] --> B',
  );
  const seq = 'sequenceDiagram\n  a->>b: demande (page)';
  assert.equal(d.repairMermaid(seq + '\r\n'), seq);
});

test('types de schémas reconnus et taille bornée', () => {
  assert.equal(d.diagramKind('flowchart TD\n A-->B'), 'flowchart');
  assert.equal(d.diagramKind('  sequenceDiagram\n a->>b: x'), 'sequencediagram');
  assert.equal(d.drawable('gantt\n title x'), true);
  assert.equal(d.drawable('Voici un schéma'), false);
  assert.equal(d.drawable('graph TD\n' + 'A-->B\n'.repeat(5000)), false);
  assert.match(d.DIAGRAM_INSTRUCTION.fr, /```mermaid```/);
  assert.match(d.DIAGRAM_INSTRUCTION.fr, /```python```/);
  assert.equal(
    d.figureCode('```python\nimport matplotlib\n```\n```python\nprint(1)\n```').length,
    1,
  );
  assert.match(d.figureFixRequest(['NameError: x'], 'fr'), /NameError: x/);
  assert.equal(d.figureFixRequest([], 'fr'), null);
  assert.match(d.DIAGRAM_INSTRUCTION.en, /ASCII/);
});
