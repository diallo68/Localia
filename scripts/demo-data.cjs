// Profil de démonstration fictif pour les captures du README (scripts/captures-readme.cjs).
// node scripts/demo-data.cjs <dossier> [en] : « en » donne un profil en anglais.
const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
const EN = process.argv[3] === 'en';
const t = (fr, en) => (EN ? en : fr);
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
  lang: t('fr', 'en'),
  guideDone: true,
  lastModel: 'qwen3:8b',
  models: {},
  online: { bibliography: false },
  remote: { enabled: false },
});

const docId = 'demo-doc-bilan';
const DOC_NAME = t('Bilan_2025_Boulangerie_Durand.pdf', 'Durand_Bakery_2025_Report.pdf');
fs.writeFileSync(
  path.join(dir, 'documents', docId + '.json'),
  JSON.stringify({
    id: docId,
    name: DOC_NAME,
    pages: [
      {
        number: 1,
        text: t(
          'Bilan d’activité 2025 – Boulangerie Durand (entreprise fictive). Chiffre d’affaires : 412 000 €.',
          'Annual report 2025 – Durand Bakery (fictional business). Revenue: €412,000.',
        ),
      },
    ],
  }),
);
const answer = t(
  `D’après le bilan, l’année 2025 se résume ainsi :

| Indicateur | 2025 | Évolution |
|---|---|---|
| Chiffre d’affaires | 412 000 € | +6 % |
| Vente en ligne | 9 % des ventes | 3 % en 2024 |
| Marge | −2 points | électricité +18 % |

- Le bilan prévoit **45 000 €** d’investissements en 2026, surtout pour le four (p. 4).
- Le financement associe un **prêt de 30 000 €** et **15 000 €** de trésorerie (p. 5).

Vérifiez ces montants avec les comptes annuels.`,
  `According to the report, 2025 can be summed up as follows:

| Indicator | 2025 | Change |
|---|---|---|
| Revenue | €412,000 | +6% |
| Online sales | 9% of sales | 3% in 2024 |
| Margin | −2 points | electricity +18% |

- The report plans **€45,000** of investment in 2026, mainly for the oven (p. 4).
- It is financed by a **€30,000 loan** and **€15,000** from cash reserves (p. 5).

Check these figures against the annual accounts.`,
);
write('conversations.json', [
  {
    id: 'demo-c1',
    title: t('Bilan 2025 : chiffres clés', '2025 report: key figures'),
    model: 'qwen3:8b',
    updatedAt: iso(1),
    projectId: 'demo-p1',
    document: {
      id: docId,
      name: DOC_NAME,
      pageCount: 6,
      characters: 8200,
      emptyPages: [],
    },
    messages: [
      {
        role: 'user',
        content: t(
          'D’après ce bilan, quels sont les chiffres clés de 2025 ?',
          'According to this report, what are the key figures for 2025?',
        ),
      },
      { role: 'assistant', content: answer, model: 'qwen3:8b', interrupted: false },
    ],
  },
  {
    id: 'demo-c2',
    title: t('Courriel de relance client', 'Payment reminder email'),
    model: 'gemma3:12b',
    updatedAt: iso(26),
    messages: [
      {
        role: 'user',
        content: t(
          'Aide-moi à relancer poliment un client qui n’a pas payé sa facture.',
          'Help me send a polite reminder to a client who has not paid their invoice.',
        ),
      },
      {
        role: 'assistant',
        content: t(
          'Objet : Facture n° 2025-118 en attente de règlement\n\nBonjour Madame Martin,\n\nSauf erreur de notre part…',
          'Subject: Invoice no. 2025-118 awaiting payment\n\nDear Ms Martin,\n\nUnless we are mistaken…',
        ),
        model: 'gemma3:12b',
      },
    ],
  },
  {
    id: 'demo-c3',
    title: t('Résumé d’un contrat de location', 'Lease agreement summary'),
    model: 'qwen3:8b',
    updatedAt: iso(70),
    messages: [
      {
        role: 'user',
        content: t(
          'Résume ce contrat de location en cinq points.',
          'Summarise this lease in five points.',
        ),
      },
      {
        role: 'assistant',
        content: t('Voici les cinq points principaux…', 'Here are the five main points…'),
        model: 'qwen3:8b',
      },
    ],
  },
]);
write('projects.json', [
  {
    id: 'demo-p1',
    name: t('Bilan 2025 – Boulangerie Durand', '2025 Report – Durand Bakery'),
    description: t('Bilan annuel et projets 2026.', 'Annual report and 2026 plans.'),
    nextStep: t(
      'Confirmer le montant de l’aide régionale pour le four',
      'Confirm the amount of the regional grant for the oven',
    ),
    createdAt: iso(400),
    notes: [
      {
        id: 'n0',
        title: t('Chiffre d’affaires 2025', '2025 revenue'),
        text: t(
          'Chiffre d’affaires 2025 : 412 000 €, en hausse de 6 %.',
          '2025 revenue: €412,000, up 6%.',
        ),
        createdAt: iso(30),
        source: {
          kind: 'reponse',
          conversationId: 'demo-c1',
          conversationTitle: t('Bilan 2025 : chiffres clés', '2025 report: key figures'),
          model: 'qwen3:8b',
          at: iso(30),
        },
      },
      {
        id: 'n1',
        title: t('Points à vérifier', 'To check'),
        text: t(
          'Montant de l’aide régionale pour le four : à confirmer.',
          'Amount of the regional grant for the oven: to be confirmed.',
        ),
        createdAt: iso(5),
      },
    ],
    documents: [],
  },
  {
    id: 'demo-p2',
    name: t('Site web de l’association', 'Charity website'),
    description: '',
    createdAt: iso(300),
    notes: [],
    documents: [],
  },
]);

// Routine du projet : chaque document ajouté est résumé avec ses sources, puis relu.
write('routines.json', {
  routines: [
    {
      id: 'demo-r1',
      name: t(
        'Synthèse des nouveaux documents de « Bilan 2025 – Boulangerie Durand »',
        'Summary of new documents of “2025 Report – Durand Bakery”',
      ),
      trigger: 'document-ajoute',
      projectId: 'demo-p1',
      model: 'qwen3:8b',
      enabled: true,
      createdAt: iso(48),
    },
  ],
  runs: [
    {
      id: 'demo-run1',
      routineId: 'demo-r1',
      projectId: 'demo-p1',
      docId: docId,
      docName: DOC_NAME,
      state: 'a-relire',
      model: 'qwen3:8b',
      createdAt: iso(2),
      startedAt: iso(2),
      endedAt: iso(1.9),
      text: t(
        `- Chiffre d’affaires 2025 : 412 000 € [${DOC_NAME} — page 1].\n- Le document ne compte qu’une page : les investissements prévus en 2026 et leur financement n’y figurent pas.`,
        `- 2025 revenue: €412,000 [${DOC_NAME} — page 1].\n- The document has a single page: the investments planned for 2026 and their funding are not in it.`,
      ),
      checks: {
        sources: {
          citations: [
            {
              name: DOC_NAME,
              docId,
              place: 'page',
              number: 1,
              status: 'confirme',
              basis: 'chiffres',
              claim: t('Chiffre d’affaires 2025 : 412 000 €', '2025 revenue: €412,000'),
              excerpt: t(
                'Bilan d’activité 2025 – Boulangerie Durand (entreprise fictive). Chiffre d’affaires : 412 000 €.',
                'Annual report 2025 – Durand Bakery (fictional business). Revenue: €412,000.',
              ),
            },
          ],
          uncited: [],
        },
      },
    },
  ],
});

const QUESTIONS_FR = [
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
const QUESTIONS_EN = [
  ['E01 Quiz on a text', 'Writing'],
  ['E02 Exam marking scheme', 'Calculation'],
  ['E03 Lesson plan', 'Writing'],
  ['E04 Article summary', 'Summary'],
  ['E05 Missing information', 'Honesty'],
  ['S01 Dose by body weight', 'Calculation'],
  ['S02 Patient file summary', 'Summary'],
  ['S03 Blood pressure', 'Extraction'],
  ['S04 Medical report', 'Writing'],
  ['S05 Unmentioned allergy', 'Honesty'],
  ['F01 VAT on an invoice', 'Calculation'],
  ['F02 Inconsistent total', 'Inconsistencies'],
  ['F03 Budget forecast', 'Calculation'],
  ['F04 Amount to extract', 'Extraction'],
  ['F05 Missing due date', 'Honesty'],
];
const QUESTIONS = EN ? QUESTIONS_EN : QUESTIONS_FR;
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
  title: t('Série « métiers » de démonstration', 'Demonstration “professions” series'),
  env: {
    capturedAt: iso(30),
    localia: '0.5.0',
    ollama: '0.35.0',
    machine: {
      cpu: t('Processeur de démonstration', 'Demonstration processor'),
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
    prompt: t(
      `Question de démonstration : ${label.slice(4)}.`,
      `Demonstration question: ${label.slice(4)}.`,
    ),
    expected: t('Réponse attendue (démonstration).', 'Expected answer (demonstration).'),
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
          comment: t('Note de démonstration.', 'Demonstration note.'),
          at: iso(20),
        };
      };
      return {
        q,
        model,
        status: 'done',
        text: t('Réponse de démonstration.', 'Demonstration answer.'),
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
