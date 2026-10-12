// Métiers de Localia : tâches proposées (par groupes), suggestions de l'accueil, outils visibles,
// consigne de métier et anonymisation. Chargé comme script dans l'interface et par le processus
// principal et les tests (CommonJS). Les tâches elles-mêmes sont dans tasks.js.

// Tâches utiles à tous les métiers, ajoutées en dernier groupe du menu Tâche.
const COMMON_TASKS = ['synthese', 'traduction', 'courrier', 'donnees', 'photo', 'question'];

const METIERS = [
  {
    id: 'enseignement',
    label: 'Enseignement / Recherche',
    icon: 'graduation',
    groups: [
      { label: 'Enseignant', tasks: ['cours', 'qcm', 'examen', 'copie'] },
      {
        label: 'Chercheur',
        tasks: ['relecture', 'article', 'these', 'extraction', 'calcul', 'redaction', 'code'],
      },
    ],
    tools: ['bibliography'],
    suggestions: [
      {
        group: 'Enseignant',
        task: 'cours',
        title: 'Préparer un cours',
        sub: 'Plan, objectifs, exemples, activités',
      },
      {
        group: 'Enseignant',
        task: 'qcm',
        title: 'Créer un QCM',
        sub: 'Questions et corrigé, à partir d’un chapitre',
      },
      {
        group: 'Enseignant',
        task: 'examen',
        title: 'Préparer un examen ou un contrôle',
        sub: 'Sujet, barème et corrigé',
      },
      {
        group: 'Enseignant',
        task: 'copie',
        title: 'Corriger une copie',
        sub: 'Avec votre grille, photo de la copie acceptée',
      },
      {
        group: 'Chercheur',
        task: 'relecture',
        title: 'Relire un article',
        sub: 'Incohérences, chiffres et références',
      },
      {
        group: 'Chercheur',
        task: 'article',
        title: 'Rédiger un article',
        sub: 'Plan, introduction, méthodes, discussion',
      },
      {
        group: 'Chercheur',
        task: 'these',
        title: 'Rédiger une thèse',
        sub: 'Chapitres, état de l’art, cohérence',
      },
    ],
  },
  {
    id: 'sante',
    label: 'Santé',
    icon: 'health',
    anonymize: true,
    groups: [
      {
        label: 'Santé',
        tasks: ['sante-cr', 'sante-synthese', 'sante-courrier', 'sante-patient', 'sante-resume'],
      },
    ],
    instruction:
      'Tu aides un professionnel de santé : rédiger, lire, résumer et structurer des documents, et répondre aux questions générales de santé (maladies, examens, traitements, prévention) de façon factuelle, claire et prudente. Tu ne poses pas de diagnostic pour un patient précis et ne prescris rien ; pour un cas précis, rappelle de consulter un professionnel. Quand un document est fourni, appuie-toi sur lui. Si le texte contient des étiquettes comme [PERSONNE 1] (noms et identifiants masqués), garde-les telles quelles ; n’en ajoute jamais d’autres.',
    notice:
      'Aide à la rédaction, pas un avis médical. Les noms, dates de naissance, numéros et adresses sont masqués avant l’envoi au modèle.',
    suggestions: [
      { task: 'sante-cr', title: 'Compte rendu de consultation', sub: 'À partir de vos notes' },
      {
        task: 'sante-synthese',
        title: 'Synthèse d’un dossier',
        sub: 'Chronologie, avec les pages',
      },
      {
        task: 'sante-patient',
        title: 'Explication pour un patient',
        sub: 'Des mots simples, sans jargon',
      },
    ],
  },
  {
    id: 'juridique',
    label: 'Juridique',
    icon: 'law',
    anonymize: true,
    groups: [
      {
        label: 'Juridique',
        tasks: ['jur-contrat', 'jur-clauses', 'jur-loi', 'jur-courrier', 'jur-comparer'],
      },
    ],
    instruction:
      'Tu aides à lire et rédiger des documents juridiques, et tu réponds aux questions générales de droit (notions, procédures, droits et obligations) de façon factuelle et prudente, en précisant que les règles varient selon le pays. Quand un document est fourni, cite l’article ou la page sur lesquels tu t’appuies. Tu ne donnes pas de conseil juridique définitif sur un cas précis : rappelle alors de consulter un professionnel du droit. Si le texte contient des étiquettes comme [PERSONNE 1] (noms et identifiants masqués), garde-les telles quelles ; n’en ajoute jamais d’autres.',
    notice:
      'Aide à la lecture et à la rédaction, pas un conseil juridique. Les noms, numéros et adresses sont masqués avant l’envoi au modèle.',
    suggestions: [
      { task: 'jur-contrat', title: 'Analyser un contrat', sub: 'Obligations, durées, montants' },
      {
        task: 'jur-clauses',
        title: 'Repérer les clauses à risque',
        sub: 'Avec l’article concerné',
      },
      { task: 'jur-courrier', title: 'Courrier ou mise en demeure', sub: 'Précis, à compléter' },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: 'folder',
    anonymize: true,
    groups: [
      {
        label: 'Administration',
        tasks: ['courrier', 'adm-cr', 'adm-rapport', 'adm-suivi', 'adm-formulaire'],
      },
    ],
    instruction:
      'Tu aides à rédiger des documents administratifs clairs et exacts, et tu réponds aux questions générales sur les démarches et les services publics de façon factuelle, en précisant que les procédures varient selon le pays et changent avec le temps : invite à vérifier auprès du service concerné. Si le texte contient des étiquettes comme [PERSONNE 1] (noms et identifiants masqués), garde-les telles quelles ; n’en ajoute jamais d’autres.',
    notice: 'Les noms, numéros et adresses sont masqués avant l’envoi au modèle.',
    suggestions: [
      { task: 'courrier', title: 'Rédiger un courrier', sub: 'Objet, corps, formule de politesse' },
      { task: 'adm-cr', title: 'Compte rendu de réunion', sub: 'Décisions et actions' },
      { task: 'adm-rapport', title: 'Note de synthèse', sub: 'Constats, options, recommandation' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'card',
    anonymize: true,
    groups: [
      {
        label: 'Finance',
        tasks: [
          'fin-releve',
          'fin-budget',
          'fin-facture',
          'fin-rapprochement',
          'fin-rapport',
          'calcul',
        ],
      },
    ],
    instruction:
      'Tu aides à analyser des documents financiers, et tu réponds aux questions générales de finance, de comptabilité et de gestion (notions, calculs, fonctionnement des produits) de façon factuelle et prudente, en précisant que les règles fiscales varient selon le pays. Écris chaque calcul en entier (a + b = c), une opération par ligne, pour qu’il puisse être vérifié. Tu ne donnes pas de conseil fiscal ou d’investissement personnalisé : pour une décision précise, rappelle de consulter un professionnel. Si le texte contient des étiquettes comme [IBAN 1] (noms, comptes et identifiants masqués), garde-les telles quelles ; n’en ajoute jamais d’autres.',
    notice:
      'Aide à l’analyse, pas un conseil fiscal ou d’investissement. Localia refait les calculs des réponses ; noms, IBAN et numéros sont masqués avant l’envoi au modèle.',
    suggestions: [
      { task: 'fin-releve', title: 'Analyser un relevé', sub: 'Catégories, totaux, anomalies' },
      { task: 'fin-facture', title: 'Vérifier une facture', sub: 'Chaque calcul refait' },
      { task: 'fin-budget', title: 'Budget prévisionnel', sub: 'Hypothèses et calculs écrits' },
    ],
  },
  {
    id: 'entreprise',
    label: 'Entreprise et commerce',
    icon: 'shop',
    groups: [
      {
        label: 'Entreprise et commerce',
        tasks: ['ent-devis', 'ent-fiche', 'ent-client', 'ent-ventes', 'ent-plan', 'ent-reseaux'],
      },
    ],
    suggestions: [
      { task: 'ent-devis', title: 'Rédiger un devis', sub: 'Tableau chiffré, calculs vérifiés' },
      { task: 'ent-client', title: 'Répondre à un client', sub: 'Courtois et précis' },
      { task: 'ent-ventes', title: 'Analyser les ventes', sub: 'Évolutions et meilleurs produits' },
    ],
  },
  {
    id: 'ingenierie',
    label: 'Ingénierie',
    sub: 'Informatique, télécoms, mécanique…',
    icon: 'settings',
    groups: [
      {
        label: 'Ingénierie',
        tasks: ['code', 'ing-cdc', 'ing-doc', 'ing-calcul', 'ing-schema', 'ing-incident'],
      },
    ],
    suggestions: [
      { task: 'code', title: 'Écrire ou corriger du code', sub: 'Complet et expliqué' },
      {
        task: 'ing-calcul',
        title: 'Calculs de dimensionnement',
        sub: 'Formules et unités, calculs vérifiés',
      },
      { task: 'ing-schema', title: 'Lire un schéma ou une pièce', sub: 'Photo acceptée' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication et journalisme',
    icon: 'news',
    groups: [
      {
        label: 'Communication et journalisme',
        tasks: [
          'com-article',
          'com-faits',
          'com-interview',
          'com-questions',
          'ent-reseaux',
          'traduction',
        ],
      },
    ],
    suggestions: [
      {
        task: 'com-article',
        title: 'Article ou communiqué',
        sub: 'Faits sourcés, citations exactes',
      },
      {
        task: 'com-faits',
        title: 'Vérifier les faits',
        sub: 'Confirmé, contredit ou non vérifiable',
      },
      { task: 'com-interview', title: 'Résumer une interview', sub: 'Idées et citations clés' },
    ],
  },
  {
    // Sans métier : la question directe, l'écran le plus simple.
    id: 'general',
    label: 'Une question ?',
    simple: true,
    groups: [],
    suggestions: [
      {
        task: 'courrier',
        title: 'Écrire une lettre',
        prompt: 'Aide-moi à écrire une lettre pour ',
      },
      {
        task: 'synthese',
        title: 'Expliquer un document',
        prompt: 'Explique-moi simplement ce document.',
      },
      { task: 'photo', title: 'Que montre cette photo ?', prompt: 'Que montre cette photo ?' },
      { task: 'traduction', title: 'Traduire en anglais', prompt: 'Traduis en anglais : ' },
      {
        task: 'donnees',
        title: 'Analyser un tableau de données',
        prompt: 'Analyse ce tableau de données.',
      },
    ],
  },
];

const DEFAULT_METIER = 'enseignement';
const metierById = (id) => METIERS.find((m) => m.id === id) || null;
// Tâches proposées pour un métier, par groupes, puis le groupe commun.
function metierTaskGroups(id) {
  const metier = metierById(id);
  if (!metier) return [];
  const own = new Set(metier.groups.flatMap((g) => g.tasks));
  const common = COMMON_TASKS.filter((t) => !own.has(t));
  return [...metier.groups, ...(common.length ? [{ label: 'Pour tous', tasks: common }] : [])];
}

if (typeof module !== 'undefined')
  module.exports = { METIERS, COMMON_TASKS, DEFAULT_METIER, metierById, metierTaskGroups };
