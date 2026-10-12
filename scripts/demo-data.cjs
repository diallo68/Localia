// Profil de démonstration fictif pour les captures du README (scripts/captures-readme.cjs).
const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
fs.mkdirSync(path.join(dir, 'documents'), { recursive: true });
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const now = Date.parse('2026-10-09T10:30:00Z');
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const write = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data));

write('settings.json', {
  metier: 'finance',
  mode: 'avance',
  firstName: 'Awa',
  lang: 'fr',
  guideDone: true,
  lastModel: 'qwen3:8b',
  models: {},
  online: { bibliography: false },
  remote: { enabled: false },
});

const docId = 'demo-doc-bilan';
fs.writeFileSync(
  path.join(dir, 'documents', docId + '.json'),
  JSON.stringify({
    id: docId,
    name: 'Bilan_2025_Boulangerie_Durand.pdf',
    pages: [
      {
        number: 1,
        text: 'Bilan d’activité 2025 – Boulangerie Durand (entreprise fictive). Chiffre d’affaires : 412 000 €.',
      },
    ],
  }),
);
const answer = `D’après le bilan, l’année 2025 se résume ainsi :

| Indicateur | 2025 | Évolution |
|---|---|---|
| Chiffre d’affaires | 412 000 € | +6 % |
| Vente en ligne | 9 % des ventes | 3 % en 2024 |
| Marge | −2 points | électricité +18 % |

- Le bilan prévoit **45 000 €** d’investissements en 2026, surtout pour le four (p. 4).
- Le financement associe un **prêt de 30 000 €** et **15 000 €** de trésorerie (p. 5).

Vérifiez ces montants avec les comptes annuels.`;
write('conversations.json', [
  {
    id: 'demo-c1',
    title: 'Bilan 2025 : chiffres clés',
    model: 'qwen3:8b',
    updatedAt: iso(1),
    projectId: 'demo-p1',
    document: {
      id: docId,
      name: 'Bilan_2025_Boulangerie_Durand.pdf',
      pageCount: 6,
      characters: 8200,
      emptyPages: [],
    },
    messages: [
      {
        role: 'user',
        content: 'D’après ce bilan, quels sont les chiffres clés de 2025 ?',
      },
      { role: 'assistant', content: answer, model: 'qwen3:8b', interrupted: false },
    ],
  },
  {
    id: 'demo-c2',
    title: 'Courriel de relance client',
    model: 'gemma3:12b',
    updatedAt: iso(26),
    messages: [
      {
        role: 'user',
        content: 'Aide-moi à relancer poliment un client qui n’a pas payé sa facture.',
      },
      {
        role: 'assistant',
        content:
          'Objet : Facture n° 2025-118 en attente de règlement\n\nBonjour Madame Martin,\n\nSauf erreur de notre part…',
        model: 'gemma3:12b',
      },
    ],
  },
  {
    id: 'demo-c3',
    title: 'Résumé d’un contrat de location',
    model: 'qwen3:8b',
    updatedAt: iso(70),
    messages: [
      { role: 'user', content: 'Résume ce contrat de location en cinq points.' },
      { role: 'assistant', content: 'Voici les cinq points principaux…', model: 'qwen3:8b' },
    ],
  },
]);
write('projects.json', [
  {
    id: 'demo-p1',
    name: 'Bilan 2025 – Boulangerie Durand',
    description: 'Bilan annuel et projets 2026.',
    createdAt: iso(400),
    notes: [
      {
        id: 'n1',
        title: 'Points à vérifier',
        text: 'Montant de l’aide régionale pour le four : à confirmer.',
        createdAt: iso(5),
      },
    ],
    documents: [],
  },
  {
    id: 'demo-p2',
    name: 'Site web de l’association',
    description: '',
    createdAt: iso(300),
    notes: [],
    documents: [],
  },
]);

const QUESTIONS = [
  ['E01 QCM sur un texte', 'Rédaction'],
  ['E02 Barème d’un examen', 'Calcul'],
  ['E03 Plan de cours', 'Rédaction'],
  ['E04 Résumé d’un article', 'Synthèse'],
  ['E05 Information absente', 'Honnêteté'],
  ['S01 Dose selon le poids', 'Calcul'],
  ['S02 Synthèse d’un dossier', 'Synthèse'],
  ['S03 Tension artérielle', 'Extraction'],
  ['S04 Compte rendu', 'Rédaction'],
  ['S05 Allergie non mentionnée', 'Honnêteté'],
  ['F01 TVA d’une facture', 'Calcul'],
  ['F02 Total incohérent', 'Incohérences'],
  ['F03 Budget prévisionnel', 'Calcul'],
  ['F04 Montant à extraire', 'Extraction'],
  ['F05 Échéance absente', 'Honnêteté'],
];
const MODELS = {
  'gemma3:12b': {
    ok: 0.82,
    inv: 0.06,
    secs: 64,
    tps: 5.8,
    size: 8.1e9,
    fam: 'gemma3',
    params: '12.2B',
  },
  'qwen3:8b': {
    ok: 0.72,
    inv: 0.16,
    secs: 48,
    tps: 7.4,
    size: 5.2e9,
    fam: 'qwen3',
    params: '8.2B',
  },
  'qwen3-4b-local:latest': {
    ok: 0.5,
    inv: 0.27,
    secs: 22,
    tps: 12.1,
    size: 2.5e9,
    fam: 'qwen3',
    params: '4.0B',
  },
};
const verdictFor = (p) => {
  const r = rand();
  return r < p.ok ? 'correct' : r < p.ok + (1 - p.ok) * 0.55 ? 'partiel' : 'faux';
};
const records = [1, 2].map((rep) => ({
  id: 'demo-serie-' + rep,
  date: iso(30 - rep),
  groupId: 'demo-groupe',
  repetition: rep,
  repetitions: 2,
  title: 'Série « métiers » de démonstration',
  env: {
    capturedAt: iso(30),
    localia: '0.5.0',
    ollama: '0.35.0',
    machine: {
      cpu: 'Processeur de démonstration',
      physicalCores: 8,
      logicalCores: 16,
      memoryGB: 16,
      arch: 'x64',
      platform: 'darwin',
      os: 'macOS 15',
    },
    models: Object.fromEntries(
      Object.entries(MODELS).map(([name, m]) => [
        name,
        {
          engine: 'ollama',
          size: m.size,
          family: m.fam,
          parameterSize: m.params,
          quantization: 'Q4_K_M',
          source: 'ollama',
        },
      ]),
    ),
  },
  questions: QUESTIONS.map(([label, category]) => ({
    label,
    category,
    prompt: `Question de démonstration : ${label.slice(4)}.`,
    expected: 'Réponse attendue (démonstration).',
  })),
  models: Object.keys(MODELS),
  results: QUESTIONS.flatMap((_, q) =>
    Object.entries(MODELS).map(([model, p]) => {
      const total = p.secs * (0.6 + rand() * 0.8);
      const out = Math.round(total * p.tps * 0.7);
      const grade = () => {
        const verdict = verdictFor(p);
        const invention = verdict !== 'correct' && rand() < p.inv * 2.5;
        return {
          verdict,
          invention,
          rating:
            verdict === 'correct' ? 4 + (rand() < 0.5 ? 1 : 0) : verdict === 'partiel' ? 3 : 2,
          comment: 'Note de démonstration.',
          at: iso(20),
        };
      };
      return {
        q,
        model,
        status: 'done',
        text: 'Réponse de démonstration.',
        stats: {
          totalMs: Math.round(total * 1000),
          loadMs: 3000,
          promptTokens: 900,
          promptMs: Math.round(total * 300),
          outputTokens: out,
          outputMs: Math.round((out / p.tps) * 1000),
          doneReason: 'stop',
        },
        grades: { Claude: grade(), ChatGPT: grade() },
      };
    }),
  ),
}));
write('comparisons.json', records);
console.log('profil de démonstration prêt :', dir);
