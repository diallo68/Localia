// Langue de l'interface (français ou anglais). Le texte de la page est écrit en français ; en
// anglais, chaque texte connu est remplacé à l'affichage (et remis en français au retour).
// Jamais traduits : les conversations, réponses, questions et noms de fichiers.

// Tâches : libellé, effet affiché et exemple de premier message.
const TASKS_EN = {
  extraction: [
    'Extract information from a document',
    'the model answers only from the attached document, cites the page of each piece of information and says when it is missing.',
    'How many images does the dataset contain, and on which page?',
  ],
  relecture: [
    'Review an article and spot inconsistencies',
    'the model compares figures, tables, quotations and references, and lists each inconsistency with its pages.',
    'Review this document and list the inconsistencies between the text and the tables.',
  ],
  synthese: [
    'Summarise',
    'the model summarises faithfully, without adding figures or information absent from the text.',
    'Summarise this document in five points.',
  ],
  calcul: [
    'Calculate or check a calculation',
    'the model writes out every operation; Localia redoes the calculations of the answer.',
    'Check the calculation: 1,802 / 38,745 × 100.',
  ],
  redaction: [
    'Write or translate',
    'the model writes clearly, with exact scientific terminology, without inventing data.',
    'Translate this paragraph into scientific English.',
  ],
  code: [
    'Write or fix code',
    'the model gives complete, runnable code, then briefly explains what it does.',
    'Write a Python function that reads a CSV file and prints its columns.',
  ],
  donnees: [
    'Prepare and analyse data (Python)',
    'the model writes a Python script (pandas) suited to the attached files: cleaning, checks, calculations.',
    'Write the cleaning script for this data file.',
  ],
  question: [
    'General question',
    'no particular instruction: the model answers freely.',
    'Explain the difference between precision and recall.',
  ],
  traduction: [
    'Translate',
    'the model translates faithfully, without summarising or adding, and keeps technical terms exact.',
    'Translate this text into French.',
  ],
  courrier: [
    'Write a letter',
    'the model writes a complete letter (subject, greeting, body, closing), leaving what it does not know in brackets.',
    'Write a letter asking for an appointment.',
  ],
  photo: [
    'Read a photo',
    'the model describes what it sees in the photo, copies the readable text and says what it cannot make out.',
    'What does this photo show? Copy the readable text.',
  ],
  cours: [
    'Prepare a lesson',
    'the model proposes a structured lesson: objectives, prerequisites, timed plan, examples, activities and assessment.',
    'Prepare a one-hour lesson on photosynthesis for 15-year-old pupils.',
  ],
  qcm: [
    'Create a multiple-choice quiz',
    'the model writes multiple-choice questions with a single correct answer, plausible distractors and an explained answer key.',
    'Create a 10-question quiz on the attached chapter.',
  ],
  examen: [
    'Prepare an exam or a test',
    'the model proposes a paper with duration, detailed marking scheme and answer key, suited to the level given.',
    'Prepare a 45-minute test on fractions, year 7, with a marking scheme.',
  ],
  copie: [
    'Mark a student paper',
    'the model marks against your rubric or scheme, scores each criterion and justifies it, without inventing what the paper does not contain.',
    'Mark this paper with the attached scheme.',
  ],
  article: [
    'Write an article',
    'the model writes a clear section of a scientific article, without inventing results or references.',
    'Write the introduction of my article from my notes.',
  ],
  these: [
    'Write a thesis',
    'the model helps write a thesis chapter, keeping it consistent with the other chapters and flagging references to check.',
    'Propose a detailed outline for the literature review chapter of my thesis.',
  ],
  'sante-cr': [
    'Consultation report',
    'the model formats a report from your notes, without adding any diagnosis or treatment that is not there.',
    'Format this report from my notes.',
  ],
  'sante-synthese': [
    'Summary of a medical file',
    'the model summarises the attached file chronologically, citing the pages.',
    'Write a chronological summary of this file.',
  ],
  'sante-courrier': [
    'Letter to a colleague',
    'the model writes a clear medical letter from the information provided.',
    'Write a referral letter to a cardiologist.',
  ],
  'sante-patient': [
    'Explanation for a patient',
    'the model explains simply, without jargon, and reminds the patient to ask their carer.',
    'Explain simply to a patient what high blood pressure is.',
  ],
  'sante-resume': [
    'Summarise a protocol or an article',
    'the model summarises method, results and limitations, citing the pages.',
    'Summarise this protocol: objective, method, results, limitations.',
  ],
  'jur-contrat': [
    'Analyse a contract',
    'the model summarises each party’s obligations, durations, amounts and exit conditions, citing the articles.',
    'Summarise each party’s obligations in this contract.',
  ],
  'jur-clauses': [
    'Spot risky clauses',
    'the model lists unbalanced, ambiguous or unusual clauses, with the article concerned.',
    'Which clauses of this contract are risky for me?',
  ],
  'jur-loi': [
    'Summarise a legal text',
    'the model summarises the text citing each article, without extrapolating.',
    'Summarise this law article by article.',
  ],
  'jur-courrier': [
    'Letter or formal notice',
    'the model writes a precise legal letter, leaving the details to complete in brackets.',
    'Write a formal notice for an unpaid invoice.',
  ],
  'jur-comparer': [
    'Compare two versions',
    'the model lists the differences between two versions of a document, article by article.',
    'Compare these two versions of the contract.',
  ],
  'adm-cr': [
    'Meeting minutes',
    'the model produces minutes: attendees, topics, decisions, actions with owners and deadlines.',
    'Write the minutes of this meeting from my notes.',
  ],
  'adm-rapport': [
    'Report or briefing note',
    'the model writes a structured note: context, findings, options, recommendation.',
    'Write a briefing note on this file for management.',
  ],
  'adm-suivi': [
    'Tracking table',
    'the model proposes a table (columns, statuses, deadlines) from your information.',
    'Make a tracking table of the files from this list.',
  ],
  'adm-formulaire': [
    'Fill in a form from a document',
    'the model fills in each field from the attached document and leaves blank those it cannot find.',
    'Fill in this form from the attached document.',
  ],
  'fin-releve': [
    'Analyse a statement or a ledger',
    'the model categorises the transactions, calculates the totals writing out each operation, and flags anomalies.',
    'Categorise the expenses in this statement and calculate the totals.',
  ],
  'fin-budget': [
    'Forecast budget',
    'the model builds a budget line by line, with explicit assumptions and written calculations.',
    'Prepare a 12-month forecast budget for this project.',
  ],
  'fin-facture': [
    'Check an invoice or a quote',
    'the model redoes the calculations (quantities, prices, discounts, VAT, total) and flags each discrepancy.',
    'Check the calculations on this invoice.',
  ],
  'fin-rapprochement': [
    'Reconcile invoices and payments',
    'the model matches invoices and payments and lists what is missing or differs.',
    'Reconcile these invoices and these payments.',
  ],
  'fin-rapport': [
    'Financial report',
    'the model explains a balance sheet or an income statement in simple terms, with the figures from the document.',
    'Explain this balance sheet simply and its weak points.',
  ],
  'ent-devis': [
    'Quote or commercial offer',
    'the model writes a clear offer with a priced table whose calculations it writes out.',
    'Write a quote for 3 days of training.',
  ],
  'ent-fiche': [
    'Product sheet',
    'the model writes a clear, accurate product sheet, without inventing any feature.',
    'Write the product sheet for this item from its features.',
  ],
  'ent-client': [
    'Reply to a customer',
    'the model proposes a courteous, precise reply that restates the customer’s request.',
    'Propose a reply to this message from an unhappy customer.',
  ],
  'ent-ventes': [
    'Analyse sales',
    'the model analyses the sales table: trends, best products, written calculations.',
    'Analyse this sales table: trend and best products.',
  ],
  'ent-plan': [
    'Business plan',
    'the model structures a business plan and flags every assumption to check.',
    'Help me structure the business plan for my shop.',
  ],
  'ent-reseaux': [
    'Social media post',
    'the model proposes several short posts suited to the chosen network.',
    'Propose three posts announcing our new product.',
  ],
  'ing-cdc': [
    'Requirements specification',
    'the model structures a specification: needs, constraints, verifiable requirements, acceptance criteria.',
    'Write the requirements specification for this application.',
  ],
  'ing-doc': [
    'Technical documentation',
    'the model writes clear documentation (installation, use, troubleshooting) faithful to the code or document provided.',
    'Write the installation documentation for this software.',
  ],
  'ing-calcul': [
    'Sizing calculations',
    'the model writes every formula and calculation with units; Localia redoes the operations.',
    'Size the cable cross-section for 32 A over 25 m.',
  ],
  'ing-schema': [
    'Read a drawing or a part',
    'the model describes the drawing or the photo of the part, notes the readable dimensions and says what it cannot read.',
    'Describe this drawing and note the readable dimensions.',
  ],
  'ing-incident': [
    'Incident or maintenance report',
    'the model structures a report: findings, timeline, probable cause, actions, prevention.',
    'Write the report on this failure from my notes.',
  ],
  'com-article': [
    'Article or press release',
    'the model writes a journalistic text: headline, standfirst, sourced facts, exact quotations.',
    'Write a press release from this information.',
  ],
  'com-faits': [
    'Fact-check',
    'the model checks each statement against the document and says whether it is confirmed, contradicted or unverifiable.',
    'Check these statements against the attached document.',
  ],
  'com-interview': [
    'Summarise an interview',
    'the model summarises the main ideas and keeps the exact quotations.',
    'Summarise this interview in five ideas, with the key quotations.',
  ],
  'com-questions': [
    'Prepare an interview',
    'the model proposes open questions, in order, with follow-ups.',
    'Prepare the questions for an interview with an agronomist.',
  ],
};

// Métiers : nom, sous-titre, groupes et avertissement.
const METIERS_EN = {
  enseignement: { label: 'Teaching / Research', groups: ['Teacher', 'Researcher'] },
  sante: {
    label: 'Health',
    notice:
      'Writing aid, not medical advice. Names, dates of birth, numbers and addresses are masked before being sent to the model.',
  },
  juridique: {
    label: 'Legal',
    notice:
      'Reading and writing aid, not legal advice. Names, numbers and addresses are masked before being sent to the model.',
  },
  administration: {
    label: 'Administration',
    notice: 'Names, numbers and addresses are masked before being sent to the model.',
  },
  finance: {
    label: 'Finance',
    notice:
      'Analysis aid, not tax or investment advice. Localia redoes the calculations of the answers; names, IBANs and numbers are masked before being sent to the model.',
  },
  entreprise: { label: 'Business and trade' },
  ingenierie: { label: 'Engineering', sub: 'IT, telecoms, mechanics…' },
  communication: { label: 'Communication and journalism' },
  general: { label: 'A question?' },
};

// Textes fixes de l'interface (texte exact → anglais).
const EN = {
  // Colonne, en-tête, barre
  'L’IA, chez vous.': 'AI, at home.',
  'Nouvelle conversation': 'New conversation',
  'ESPACE DE TRAVAIL': 'WORKSPACE',
  RESSOURCES: 'RESOURCES',
  SYSTÈME: 'SYSTEM',
  Conversations: 'Conversations',
  Benchmark: 'Benchmark',
  'Bibliothèque de modèles': 'Model library',
  Bibliographie: 'Bibliography',
  Fichiers: 'Files',
  Compétences: 'Skills',
  'Performances de votre PC': 'Your computer’s performance',
  'Réglages des modèles': 'Model settings',
  Projets: 'Projects',
  'Historique local': 'Local history',
  'Historique des conversations': 'Conversation history',
  'Sur votre Mac': 'On your Mac',
  'Sur votre ordinateur': 'On your computer',
  'Vos conversations restent ici.': 'Your conversations stay here.',
  'Guide de démarrage': 'Getting started',
  'VOTRE ASSISTANT PERSONNEL': 'YOUR PERSONAL ASSISTANT',
  Métier: 'Profession',
  Métiers: 'Professions',
  'Changer de métier': 'Change profession',
  Projet: 'Project',
  Tâche: 'Task',
  Compétence: 'Skill',
  'Modèle actif': 'Active model',
  'Exécution locale': 'Local execution',
  Aucun: 'None',
  Aucune: 'None',
  Libre: 'Free',
  'Aucun modèle installé': 'No model installed',
  'Aucun modèle disponible': 'No model available',
  'Vérification…': 'Checking…',
  Activée: 'On',
  'Moteur intégré': 'Built-in engine',
  'Aucun modèle': 'No model',
  'Ollama arrêté': 'Ollama stopped',
  'Moteur des réponses': 'Answer engine',
  Actualiser: 'Refresh',
  'Actualiser la connexion': 'Refresh the connection',
  'Démarrer Ollama': 'Start Ollama',
  'Réglages du modèle': 'Model settings',
  'Réglages de ce modèle': 'Settings for this model',
  Renommer: 'Rename',
  'Supprimer la conversation': 'Delete conversation',
  'Nouveau titre': 'New title',
  Enregistrer: 'Save',
  Annuler: 'Cancel',
  Retirer: 'Remove',
  'Retirer le PDF de cette conversation': 'Remove the PDF from this conversation',
  'Moteur intégré de Localia': 'Localia built-in engine',
  'Autre métier': 'Other profession',
  'Pour tous': 'For everyone',
  'POUR TOUS LES MÉTIERS': 'FOR ALL PROFESSIONS',
  // Accueil et zone de saisie
  'Que voulez-vous faire aujourd’hui ?': 'What would you like to do today?',
  'Réglages de la réponse': 'Response settings',
  'Modèle conseillé': 'Recommended model',
  'Le plus juste des modèles notés sur ce métier.':
    'The most accurate of the models graded for this profession.',
  'Invente souvent. Plus sûr :': 'Often makes things up. Safer:',
  Correctes: 'Correct',
  Inventions: 'Made up',
  'Par réponse': 'Per answer',
  'Pas installé sur cet ordinateur': 'Not installed on this computer',
  'Utiliser ce modèle': 'Use this model',
  correctes: 'correct',
  inventions: 'made up',
  'par réponse': 'per answer',
  'Mémoire utilisée': 'Memory in use',
  'Rédigez, analysez un document ou posez une question : tout se passe sur cet ordinateur.':
    'Write, analyse a document or ask a question: everything stays on this computer.',
  'Ajouter un document': 'Add a document',
  'Une question ?': 'A question?',
  'Demandez à Localia. Vous pouvez joindre un document ou une photo.':
    'Ask Localia. You can attach a document or a photo.',
  'Posez votre question…': 'Ask your question…',
  'Posez votre question, ou collez l’adresse d’une page web…':
    'Ask your question, or paste the address of a web page…',
  'Votre message': 'Your message',
  'Votre question': 'Your question',
  Envoyer: 'Send',
  Arrêter: 'Stop',
  'Joindre un fichier': 'Attach a file',
  'Joindre une photo': 'Attach a photo',
  'Joindre un fichier : PDF, consignes (.txt, .md), code (.py, .R, .sql…) ou données (.csv, .tsv, .json). Pour une page web, collez son adresse dans le message.':
    'Attach a file: PDF, instructions (.txt, .md), code (.py, .R, .sql…) or data (.csv, .tsv, .json). For a web page, paste its address in the message.',
  'Joindre une photo (JPEG, PNG, WebP), ou la coller dans le message. Lue par les modèles qui savent lire les images.':
    'Attach a photo (JPEG, PNG, WebP), or paste it into the message. Read by models that can read images.',
  'Entrée pour envoyer · Maj + Entrée pour revenir à la ligne · une adresse https://… collée est lue comme page web':
    'Enter to send · Shift + Enter for a new line · a pasted https://… address is read as a web page',
  'Les réponses de l’IA peuvent contenir des erreurs. Vérifiez les informations importantes.':
    'AI answers may contain errors. Check important information.',
  Vous: 'You',
  '＋ Mémoire du projet': '＋ Project memory',
  'Préparation de la réponse…': 'Preparing the answer…',
  // Choix du métier
  'PREMIER LANCEMENT · ÉTAPE 1 SUR 2': 'FIRST LAUNCH · STEP 1 OF 2',
  'CHANGER DE MÉTIER': 'CHANGE PROFESSION',
  'Quel est votre métier ?': 'What is your profession?',
  'Localia adapte ses tâches, ses compétences et les modèles conseillés à votre travail. Vous pourrez en changer à tout moment.':
    'Localia adapts its tasks, skills and recommended models to your work. You can change it at any time.',
  'Vos documents et vos photos ne quittent jamais cet ordinateur.':
    'Your documents and photos never leave this computer.',
  'Choisi :': 'Chosen:',
  Continuer: 'Continue',
  'ou, sans choisir de métier': 'or, without choosing a profession',
  Anonymisation: 'Anonymisation',
  'Calculs vérifiés': 'Checked calculations',
  'Bibliographie et Zotero': 'Bibliography and Zotero',
  Langue: 'Language',
  // Suggestions de l'accueil
  ENSEIGNANT: 'TEACHER',
  CHERCHEUR: 'RESEARCHER',
  'Préparer un cours': 'Prepare a lesson',
  'Plan, objectifs, exemples, activités': 'Outline, objectives, examples, activities',
  'Créer un QCM': 'Create a quiz',
  'Questions et corrigé, à partir d’un chapitre': 'Questions and answer key, from a chapter',
  'Préparer un examen ou un contrôle': 'Prepare an exam or a test',
  'Sujet, barème et corrigé': 'Paper, marking scheme and answer key',
  'Corriger une copie': 'Mark a student paper',
  'Avec votre grille, photo de la copie acceptée': 'With your rubric; a photo of the paper is fine',
  'Relire un article': 'Review an article',
  'Incohérences, chiffres et références': 'Inconsistencies, figures and references',
  'Rédiger un article': 'Write an article',
  'Plan, introduction, méthodes, discussion': 'Outline, introduction, methods, discussion',
  'Rédiger une thèse': 'Write a thesis',
  'Chapitres, état de l’art, cohérence': 'Chapters, literature review, consistency',
  'Compte rendu de consultation': 'Consultation report',
  'À partir de vos notes': 'From your notes',
  'Synthèse d’un dossier': 'Summary of a file',
  'Chronologie, avec les pages': 'Timeline, with the pages',
  'Explication pour un patient': 'Explanation for a patient',
  'Des mots simples, sans jargon': 'Simple words, no jargon',
  'Analyser un contrat': 'Analyse a contract',
  'Obligations, durées, montants': 'Obligations, durations, amounts',
  'Repérer les clauses à risque': 'Spot risky clauses',
  'Avec l’article concerné': 'With the article concerned',
  'Courrier ou mise en demeure': 'Letter or formal notice',
  'Précis, à compléter': 'Precise, to complete',
  'Rédiger un courrier': 'Write a letter',
  'Objet, corps, formule de politesse': 'Subject, body, closing',
  'Compte rendu de réunion': 'Meeting minutes',
  'Décisions et actions': 'Decisions and actions',
  'Note de synthèse': 'Briefing note',
  'Constats, options, recommandation': 'Findings, options, recommendation',
  'Analyser un relevé': 'Analyse a statement',
  'Catégories, totaux, anomalies': 'Categories, totals, anomalies',
  'Vérifier une facture': 'Check an invoice',
  'Chaque calcul refait': 'Every calculation redone',
  'Budget prévisionnel': 'Forecast budget',
  'Hypothèses et calculs écrits': 'Written assumptions and calculations',
  'Rédiger un devis': 'Write a quote',
  'Tableau chiffré, calculs vérifiés': 'Priced table, checked calculations',
  'Répondre à un client': 'Reply to a customer',
  'Courtois et précis': 'Courteous and precise',
  'Analyser les ventes': 'Analyse sales',
  'Évolutions et meilleurs produits': 'Trends and best products',
  'Écrire ou corriger du code': 'Write or fix code',
  'Complet et expliqué': 'Complete and explained',
  'Calculs de dimensionnement': 'Sizing calculations',
  'Formules et unités, calculs vérifiés': 'Formulas and units, checked calculations',
  'Lire un schéma ou une pièce': 'Read a drawing or a part',
  'Photo acceptée': 'Photo accepted',
  'Article ou communiqué': 'Article or press release',
  'Faits sourcés, citations exactes': 'Sourced facts, exact quotations',
  'Vérifier les faits': 'Fact-check',
  'Confirmé, contredit ou non vérifiable': 'Confirmed, contradicted or unverifiable',
  'Résumer une interview': 'Summarise an interview',
  'Idées et citations clés': 'Key ideas and quotations',
  'Écrire une lettre': 'Write a letter',
  'Expliquer un document': 'Explain a document',
  'Que montre cette photo ?': 'What does this photo show?',
  'Traduire en anglais': 'Translate into French',
  'Analyser un tableau de données': 'Analyse a data table',
  // Autres pages (Bibliothèque, Benchmark, Projets, Bibliographie, Fichiers, Performances,
  // Guide, Compétences, Réglages)
  'CHOISISSEZ VOTRE INTELLIGENCE': 'CHOOSE YOUR INTELLIGENCE',
  'Une IA à votre mesure.': 'An AI that fits you.',
  'Téléchargez un modèle, puis utilisez-le hors ligne.': 'Download a model, then use it offline.',
  'Commencez par un petit modèle.': 'Start with a small model.',
  'Moteur intégré : télécharger depuis Hugging Face': 'Built-in engine: download from Hugging Face',
  'Ces modèles fonctionnent sans Ollama. Le téléchargement reprend là où il s’est arrêté si la connexion coupe, et le fichier est vérifié (empreinte SHA-256) avant d’être utilisé. Chaque modèle a sa licence : lisez-la avant un usage commercial.':
    'These models work without Ollama. The download resumes where it stopped if the connection drops, and the file is checked (SHA-256 fingerprint) before use. Each model has its own licence: read it before any commercial use.',
  'Mettre en pause': 'Pause',
  'Autre fichier GGUF de Hugging Face (adresse du fichier)':
    'Another GGUF file from Hugging Face (file address)',
  Télécharger: 'Download',
  'Avec Ollama (facultatif)': 'With Ollama (optional)',
  'Si Ollama est installé, Localia utilise aussi ses modèles. Téléchargement par Ollama :':
    'If Ollama is installed, Localia also uses its models. Download through Ollama:',
  'POUR COMMENCER': 'TO GET STARTED',
  'Léger et multilingue : un bon début sur un ordinateur de 8 Go.':
    'Light and multilingual: a good start on an 8 GB computer.',
  'Télécharger un autre modèle du catalogue Ollama':
    'Download another model from the Ollama catalogue',
  'Indiquez le nom exact et sa version. La licence dépend du modèle choisi.':
    'Give the exact name and its version. The licence depends on the model chosen.',
  'Installés sur ce Mac': 'Installed on this Mac',
  'Installés sur cet ordinateur': 'Installed on this computer',
  'Internet est nécessaire pour télécharger les modèles. Les modèles cloud sont exclus.':
    'Internet is needed to download models. Cloud models are excluded.',
  'BENCHMARK · ÉTAPE 1': 'BENCHMARK · STEP 1',
  'Lancer une série.': 'Run a series.',
  'Même tâche, plusieurs modèles : chaque modèle choisi traite toutes les questions à la suite, avec ses réglages, puis il est déchargé pour libérer la mémoire. Son temps de chargement est mesuré à part. Les résultats se notent et s’analysent à l’étape 2.':
    'Same task, several models: each chosen model handles all the questions in turn, with its settings, then is unloaded to free memory. Its loading time is measured separately. Results are graded and analysed in step 2.',
  'Tâche à confier aux modèles': 'Task for the models',
  'Plusieurs questions : séparez-les par une ligne': 'Several questions: separate them with a line',
  '. Facultatif :': '. Optional:',
  'en première ligne d’une question, et': 'as the first line of a question, and',
  'pour la réponse attendue (jamais envoyée aux modèles).':
    'for the expected answer (never sent to the models).',
  'Importer des questions (.txt, .md)': 'Import questions (.txt, .md)',
  'Aucun document joint (facultatif).': 'No document attached (optional).',
  'Modèles à comparer': 'Models to compare',
  Répétitions: 'Repetitions',
  Départ: 'Start',
  'Lancer la série': 'Run the series',
  'Annuler le départ programmé': 'Cancel the scheduled start',
  'Séries enregistrées': 'Saved series',
  'BENCHMARK · ÉTAPE 2': 'BENCHMARK · STEP 2',
  'Résultats et notation.': 'Results and grading.',
  'Toutes les séries lancées à l’étape 1, réunies : précision, taux d’invention, notes, durées et vitesses, avec écart-type sur les répétitions. Notez les réponses à l’aveugle, importez les notes d’autres correcteurs, puis exportez données, graphiques et conditions de l’expérience.':
    'All the series run in step 1, together: accuracy, invention rate, grades, durations and speeds, with standard deviation over repetitions. Grade the answers blind, import other graders’ grades, then export data, charts and experimental conditions.',
  'Notes de': 'Grades by',
  Correcteur: 'Grader',
  'Noter à l’aveugle': 'Grade blind',
  'Importer des notes (CSV)': 'Import grades (CSV)',
  'Exporter :': 'Export:',
  'Données (CSV)': 'Data (CSV)',
  'Données (JSON)': 'Data (JSON)',
  'Conditions (Markdown)': 'Conditions (Markdown)',
  'Fiche de notation (CSV)': 'Grading sheet (CSV)',
  'Séries incluses': 'Series included',
  'Afficher la réponse attendue': 'Show the expected answer',
  Verdict: 'Verdict',
  Correct: 'Correct',
  Partiel: 'Partial',
  Faux: 'Wrong',
  'Hors sujet': 'Off topic',
  'Contient une invention (fait faux présenté comme vrai)':
    'Contains an invention (a false fact presented as true)',
  'Note (facultative)': 'Grade (optional)',
  Commentaire: 'Comment',
  'Enregistrer et suivante': 'Save and next',
  Passer: 'Skip',
  Terminer: 'Finish',
  'MÉMOIRE DE VOS TRAVAUX': 'MEMORY OF YOUR WORK',
  'Projets.': 'Projects.',
  'Chaque projet garde vos notes : sources, décisions, définitions, résultats. Dans une conversation liée à un projet, ces notes sont envoyées au modèle comme contexte. Seul ce que vous écrivez ou ajoutez vous-même entre dans la mémoire.':
    'Each project keeps your notes: sources, decisions, definitions, results. In a conversation linked to a project, these notes are sent to the model as context. Only what you write or add yourself goes into the memory.',
  'Nom du nouveau projet': 'Name of the new project',
  'Créer le projet': 'Create the project',
  'Nom du projet': 'Project name',
  'Supprimer le projet': 'Delete the project',
  'Description (envoyée avec la mémoire)': 'Description (sent with the memory)',
  Notes: 'Notes',
  'Titre de la note': 'Note title',
  'Texte de la note': 'Note text',
  'Ajouter la note': 'Add the note',
  'Annuler la modification': 'Cancel the change',
  'SOURCES FIABLES': 'RELIABLE SOURCES',
  'Bibliographie.': 'Bibliography.',
  'Vérifiez que les citations d’un article renvoient à la bonne référence, que les références existent vraiment, et trouvez des articles.':
    'Check that an article’s citations point to the right reference, that the references really exist, and find articles.',
  'Autoriser la recherche en ligne (Crossref, OpenAlex)':
    'Allow online search (Crossref, OpenAlex)',
  'Désactivée par défaut. Une fois activée, seul le texte de votre recherche ou de la référence à vérifier est envoyé à api.crossref.org et api.openalex.org ; jamais vos documents, notes ni conversations.':
    'Off by default. Once on, only the text of your search or of the reference to check is sent to api.crossref.org and api.openalex.org; never your documents, notes or conversations.',
  'Citations d’un PDF (sur votre Mac)': 'Citations in a PDF (on your Mac)',
  'Citations d’un PDF (sur votre ordinateur)': 'Citations in a PDF (on your computer)',
  'Chaque citation « Auteur [n] » ou « Auteur et al. [n] » du texte est comparée à la référence [n] de la bibliographie du document.':
    'Each citation “Author [n]” or “Author et al. [n]” in the text is compared with reference [n] of the document’s bibliography.',
  'Choisir un PDF': 'Choose a PDF',
  'Existence des références (en ligne)': 'Do the references exist? (online)',
  'Une référence par ligne, ou celles du PDF ci-dessus. Chacune est comparée à Crossref : titre, premier auteur, année et DOI.':
    'One reference per line, or those of the PDF above. Each is compared with Crossref: title, first author, year and DOI.',
  'Références à vérifier': 'References to check',
  'Vérifier sur Crossref (en ligne)': 'Check on Crossref (online)',
  'Comparer à ma bibliothèque Zotero': 'Compare with my Zotero library',
  'Veille bibliographique': 'Literature watch',
  'Localia cherche les nouveaux articles de vos sujets sur OpenAlex, chaque jour ou chaque semaine, tant qu’elle est ouverte et que la recherche en ligne est autorisée. Seul le texte du sujet est envoyé.':
    'Localia looks for new articles on your topics on OpenAlex, every day or every week, while it is open and online search is allowed. Only the topic text is sent.',
  'Sujet à suivre': 'Topic to follow',
  Fréquence: 'Frequency',
  'Chaque semaine': 'Every week',
  'Chaque jour': 'Every day',
  'Suivre ce sujet': 'Follow this topic',
  '⚠ La recherche en ligne est désactivée : la veille est en attente. Cochez « Autoriser la recherche en ligne » en haut de cet onglet.':
    '⚠ Online search is off: the watch is on hold. Tick “Allow online search” at the top of this tab.',
  'Ma bibliothèque Zotero (sur votre Mac)': 'My Zotero library (on your Mac)',
  'Ma bibliothèque Zotero (sur votre ordinateur)': 'My Zotero library (on your computer)',
  'Recherche dans Zotero': 'Search in Zotero',
  'Chercher dans Zotero': 'Search Zotero',
  'Rechercher des articles (en ligne)': 'Search for articles (online)',
  Recherche: 'Search',
  Rechercher: 'Search',
  'Ajouter au projet': 'Add to project',
  'ACTIONS AVEC VOTRE ACCORD': 'ACTIONS WITH YOUR CONSENT',
  'Fichiers.': 'Files.',
  'Décrivez ce que vous voulez faire dans un dossier (classer, renommer, créer des dossiers ou une note). Le modèle propose un plan, Localia vérifie chaque action, et rien n’est modifié avant que vous ne validiez.':
    'Describe what you want to do in a folder (sort, rename, create folders or a note). The model proposes a plan, Localia checks each action, and nothing is changed before you approve.',
  'Seulement dans les dossiers que vous autorisez ci-dessous.':
    'Only in the folders you allow below.',
  'Le modèle ne voit que les noms, types et tailles des fichiers, jamais leur contenu.':
    'The model only sees file names, types and sizes, never their content.',
  'Aucun fichier n’est écrasé ni supprimé définitivement : ce qui est retiré va à la Corbeille.':
    'No file is overwritten or permanently deleted: what is removed goes to the Bin.',
  'Chaque opération est inscrite au journal et peut être annulée.':
    'Each operation is logged and can be undone.',
  'Dossiers autorisés': 'Allowed folders',
  'Autoriser un dossier…': 'Allow a folder…',
  'Que voulez-vous faire ?': 'What do you want to do?',
  Dossier: 'Folder',
  Modèle: 'Model',
  Demande: 'Request',
  'Proposer un plan': 'Propose a plan',
  'Plan proposé': 'Proposed plan',
  Appliquer: 'Apply',
  Abandonner: 'Discard',
  Journal: 'Log',
  'CHOISIR LE BON MODÈLE': 'CHOOSING THE RIGHT MODEL',
  'Performances de votre ordinateur.': 'Your computer’s performance.',
  'Performances de votre ordinateur': 'Your computer’s performance',
  'Localia analyse le processeur, la mémoire et la carte graphique, puis indique quels modèles tiennent dans la mémoire et à quelle vitesse ils répondent.':
    'Localia analyses the processor, memory and graphics card, then shows which models fit in memory and how fast they answer.',
  'Analyser à nouveau': 'Analyse again',
  'Vos modèles': 'Your models',
  'Le verdict est une estimation à partir de la taille du modèle et de la mémoire. La vitesse vient de vos séries du Benchmark (usage réel, avec documents), ou d’un test rapide (« Mesurer » : une courte réponse, puis le modèle est déchargé). Le test rapide donne la meilleure vitesse ; avec un long document ou une longue réponse, elle baisse.':
    'The verdict is an estimate from the model size and memory. The speed comes from your Benchmark series (real use, with documents), or from a quick test (“Measure”: a short answer, then the model is unloaded). The quick test gives the best speed; with a long document or a long answer, it drops.',
  'Modèles conseillés à télécharger': 'Recommended models to download',
  BIENVENUE: 'WELCOME',
  'Guide de démarrage.': 'Getting started.',
  'Localia fait tourner des modèles d’IA sur votre ordinateur, sans Internet une fois le modèle téléchargé. Deux étapes suffisent, sans rien installer d’autre.':
    'Localia runs AI models on your computer, without Internet once the model is downloaded. Two steps are enough, with nothing else to install.',
  '1. Télécharger un modèle': '1. Download a model',
  'Un seul téléchargement depuis Hugging Face (Internet nécessaire, reprise possible si la connexion coupe) ; ensuite le modèle fonctionne hors ligne, avec le moteur intégré de Localia.':
    'A single download from Hugging Face (Internet needed, resumes if the connection drops); then the model works offline, with Localia’s built-in engine.',
  '2. Poser une première question': '2. Ask a first question',
  'Vous utilisez déjà Ollama ? (facultatif)': 'Already using Ollama? (optional)',
  'Localia sait aussi utiliser les modèles d’Ollama ; ceux au format standard peuvent même passer au moteur intégré sans nouveau téléchargement (Bibliothèque de modèles).':
    'Localia can also use Ollama’s models; those in the standard format can even move to the built-in engine without a new download (Model library).',
  'Et ensuite': 'And then',
  'Le trombone sous la zone de message (ou un fichier glissé dans la fenêtre) : un PDF, des consignes (.md, .txt) ou des données (.csv) à joindre à la conversation. Pour une page web, collez son adresse dans le message.':
    'The paperclip under the message box (or a file dragged into the window): a PDF, instructions (.md, .txt) or data (.csv) to attach to the conversation. For a web page, paste its address in the message.',
  'Compétences : tapez': 'Skills: type',
  'au début d’un message, par exemple': 'at the start of a message, for example',
  ou: 'or',
  'Benchmark : comparez vos modèles sur vos propres questions ; Localia conseille ensuite le meilleur modèle pour chaque tâche.':
    'Benchmark: compare your models on your own questions; Localia then recommends the best model for each task.',
  'Vos données restent sur cet ordinateur ; elles peuvent être chiffrées (Réglages).':
    'Your data stays on this computer; it can be encrypted (Settings).',
  'Ne plus afficher ce guide au démarrage': 'Don’t show this guide at startup',
  Fermer: 'Close',
  'RECETTES RÉUTILISABLES': 'REUSABLE RECIPES',
  'Compétences.': 'Skills.',
  'Une compétence donne au modèle des consignes précises pour un type de travail. Un parcours enchaîne plusieurs compétences, étape par étape.':
    'A skill gives the model precise instructions for a type of work. A path chains several skills, step by step.',
  'Pour appeler une compétence': 'To call a skill',
  ', commencez votre message par son appel, par exemple':
    ', start your message with its call, for example',
  ', ou choisissez-la dans le menu': ', or choose it in the menu',
  'd’une conversation. Tapez': 'of a conversation. Type',
  'pour voir les suggestions,': 'to see suggestions,',
  'pour revenir ici.': 'to come back here.',
  'Chaque compétence est un fichier Markdown du dossier':
    'Each skill is a Markdown file in the folder',
  ': modifiez-la dans votre éditeur, ajoutez-en, partagez-les. Le fichier LISEZ-MOI.txt du dossier explique le format.':
    ': edit it in your editor, add more, share them. The folder’s LISEZ-MOI.txt file explains the format.',
  'Nouvelle compétence': 'New skill',
  'Ouvrir le dossier': 'Open the folder',
  Recharger: 'Reload',
  'OPTIMISER VOS MODÈLES': 'TUNE YOUR MODELS',
  'Réglages par modèle.': 'Settings per model.',
  'Ces réglages s’appliquent aux conversations et aux comparaisons. Un champ vide garde la valeur prévue par le modèle, affichée en grisé.':
    'These settings apply to conversations and comparisons. An empty field keeps the model’s own value, shown in grey.',
  Température: 'Temperature',
  'Plus bas : réponses plus précises et régulières. Plus haut : plus variées et créatives.':
    'Lower: more precise and consistent answers. Higher: more varied and creative.',
  'Contexte (tokens)': 'Context (tokens)',
  'Mémoire de travail : historique, document et réponse. Plus grand : plus de mémoire vive utilisée et plus lent.':
    'Working memory: history, document and answer. Larger: more RAM used and slower.',
  'Longueur maximale de réponse (tokens)': 'Maximum answer length (tokens)',
  'Vide : pas de limite fixée par Localia.': 'Empty: no limit set by Localia.',
  'Ne garde que les mots les plus probables dont la probabilité cumulée atteint cette valeur.':
    'Keeps only the most likely words whose cumulative probability reaches this value.',
  'Nombre de mots candidats examinés à chaque étape.':
    'Number of candidate words considered at each step.',
  'Pénalité de répétition': 'Repetition penalty',
  'Au-dessus de 1 : décourage les répétitions.': 'Above 1: discourages repetition.',
  'Graine (seed)': 'Seed',
  'Avec la même graine, la même demande produit le même texte : utile pour comparer.':
    'With the same seed, the same request produces the same text: useful for comparing.',
  'Threads processeur': 'Processor threads',
  'Vide : choix automatique d’Ollama. Sa documentation recommande le nombre de cœurs physiques.':
    'Empty: chosen automatically by Ollama. Its documentation recommends the number of physical cores.',
  'Maintien en mémoire': 'Keep in memory',
  'Par défaut (5 minutes)': 'Default (5 minutes)',
  'Décharger après chaque réponse': 'Unload after each answer',
  '1 heure': '1 hour',
  'Plus long : réponses suivantes plus rapides, mémoire vive occupée.':
    'Longer: faster next answers, RAM stays used.',
  Réflexion: 'Thinking',
  'Par défaut du modèle': 'Model default',
  Désactivée: 'Off',
  'Désactivée : réponses plus rapides, souvent moins raisonnées.':
    'Off: faster answers, often less reasoned.',
  'Consigne permanente': 'Standing instruction',
  'Envoyée au modèle avant chaque conversation.': 'Sent to the model before each conversation.',
  'Revenir aux valeurs du modèle': 'Back to the model’s values',
  'Métiers Santé, Juridique, Administration et Finance : avant l’envoi au modèle, Localia remplace les noms précédés d’une civilité ou écrits « Prénom NOM », les e-mails, téléphones, IBAN, numéros de carte, de sécurité sociale, de dossier ou de pièce, les adresses et les dates de naissance par des étiquettes comme [PERSONNE 1] ; la réponse affichée remet les vraies valeurs. Le repérage ne voit pas tout : ajoutez ici les mots à toujours masquer (noms sans civilité, lieux, sociétés…), un par ligne.':
    'Health, Legal, Administration and Finance professions: before sending to the model, Localia replaces names preceded by a title or written “First LAST”, e-mails, phone numbers, IBANs, card, social security, file or ID numbers, addresses and dates of birth with labels such as [PERSONNE 1]; the answer shown restores the real values. Detection does not catch everything: add here the words to always mask (names without a title, places, companies…), one per line.',
  'Mots toujours masqués': 'Words always masked',
  'Enregistrer la liste': 'Save the list',
  Anonymisation: 'Anonymisation',
  'Données sur ce Mac': 'Data on this Mac',
  'Données sur cet ordinateur': 'Data on this computer',
  'Conversations, comparaisons, projets, textes extraits des PDF, réglages et journal des actions sont enregistrés dans le dossier de Localia. Chiffrés, ils sont illisibles sans la clé, gardée dans le trousseau de macOS : copie du dossier, sauvegarde, autre compte de l’ordinateur.':
    'Conversations, comparisons, projects, text extracted from PDFs, settings and the action log are stored in Localia’s folder. When encrypted, they are unreadable without the key, kept in the macOS keychain: copy of the folder, backup, another account on the computer.',
  'Exporter la clé de secours': 'Export the recovery key',
  'Importer la clé de secours': 'Import the recovery key',
  'Sans le trousseau ni la clé de secours, des données chiffrées sont perdues : exportez la clé de secours et gardez-la hors de ce Mac. Le chiffrement ne protège pas contre un logiciel malveillant qui tourne sur votre session, ni les copies faites avant l’activation (sauvegardes Time Machine) ; FileVault chiffre tout le disque.':
    'Without the keychain or the recovery key, encrypted data is lost: export the recovery key and keep it off this Mac. Encryption does not protect against malware running in your session, nor copies made before it was turned on (Time Machine backups); FileVault encrypts the whole disk.',
  'Accès depuis vos autres appareils': 'Access from your other devices',
  'Utilisez Localia depuis votre téléphone ou un autre ordinateur : les modèles tournent toujours sur ce Mac, et les conversations y restent. Désactivé par défaut.':
    'Use Localia from your phone or another computer: the models still run on this Mac, and the conversations stay there. Off by default.',
  'Autoriser l’accès depuis mes autres appareils': 'Allow access from my other devices',
  'Changer la clé (déconnecte tous les appareils)': 'Change the key (disconnects all devices)',
  'Même Wi-Fi': 'Same Wi-Fi',
  ': scannez le QR code « réseau local » avec l’appareil photo du téléphone. Utilisez un Wi-Fi de confiance (maison, bureau) : sur ce réseau, les échanges ne sont pas chiffrés.':
    ': scan the “local network” QR code with the phone’s camera. Use a trusted Wi-Fi (home, office): on this network, the exchanges are not encrypted.',
  'Depuis l’extérieur': 'From outside',
  ': installez Tailscale (gratuit, tailscale.com) sur ce Mac et sur l’autre appareil, avec le même compte ; une adresse « Tailscale » apparaît alors ici, avec son QR code. Les échanges sont chiffrés, et ce Mac n’est pas ouvert à Internet.':
    ': install Tailscale (free, tailscale.com) on this Mac and on the other device, with the same account; a “Tailscale” address then appears here, with its QR code. The exchanges are encrypted, and this Mac is not opened to the Internet.',
  'Ce Mac doit rester allumé, avec Localia ouverte. Au premier lancement, macOS peut demander d’autoriser les connexions entrantes : acceptez.':
    'This Mac must stay on, with Localia open. On first launch, macOS may ask to allow incoming connections: accept.',
  'Ex. Lis ce document et décris son contenu en cinq points.':
    'E.g. Read this document and describe its content in five points.',
  'Nombre d’exécutions de la série, pour mesurer la variabilité':
    'Number of runs of the series, to measure variability',
  'Vide : départ immédiat. Une heure : la série démarre à cette heure (le lendemain si elle est passée).':
    'Empty: start now. A time: the series starts at that time (the next day if it has passed).',
  'Nom du nouveau projet, par exemple Thèse': 'Name of the new project, for example Thesis',
  'Titre (facultatif)': 'Title (optional)',
  'Une information à retenir : source, décision, définition, résultat…':
    'Something to remember: source, decision, definition, result…',
  'Une référence par ligne': 'One reference per line',
  'Titre, auteur ou année (ex. mildiou, Mahlein, 2016)':
    'Title, author or year (e.g. late blight, Mahlein, 2016)',
  'Ex. Classe les PDF dans un dossier par année d’après leur nom, sans toucher aux autres fichiers.':
    'E.g. Sort the PDFs into folders by year based on their names, without touching the other files.',
  'Ex. Réponds toujours en français, de façon concise.':
    'E.g. Always answer in English, concisely.',
  'Ex. qwen2.5:1.5b': 'E.g. qwen2.5:1.5b',
  'Ex. late blight forecasting machine learning': 'E.g. late blight forecasting machine learning',
  'Ex. late blight deep learning forecasting': 'E.g. late blight deep learning forecasting',
  // Messages proposés par les suggestions de « Une question ? »
  'Aide-moi à écrire une lettre pour ': 'Help me write a letter to ',
  'Explique-moi simplement ce document.': 'Explain this document to me simply.',
  'Traduis en anglais : ': 'Translate into French: ',
  'Analyse ce tableau de données.': 'Analyse this data table.',
  'Pas encore assez de réponses notées dans votre Benchmark pour conseiller un modèle pour cette tâche.':
    'Not enough graded answers in your Benchmark yet to recommend a model for this task.',
  // Benchmark (étapes)
  'Étapes du Benchmark': 'Benchmark steps',
  'Lancer une série': 'Run a series',
  'Résultats et notation': 'Results and grading',
};
// Libellés des tâches et des métiers ajoutés au dictionnaire.
if (typeof TASKS !== 'undefined')
  for (const task of TASKS) if (TASKS_EN[task.id]) EN[task.label] = TASKS_EN[task.id][0];
if (typeof METIERS !== 'undefined')
  for (const metier of METIERS) {
    const en = METIERS_EN[metier.id];
    if (!en) continue;
    EN[metier.label] = en.label;
    if (metier.sub && en.sub) EN[metier.sub] = en.sub;
    metier.groups.forEach((g, i) => {
      if (en.groups?.[i]) EN[g.label] = en.groups[i];
      if (en.groups?.[i]) EN[g.label.toUpperCase()] = en.groups[i].toUpperCase();
    });
    if (metier.groups.length === 1 && !en.groups) EN[metier.groups[0].label] = en.label;
    if (metier.notice && en.notice) EN[metier.notice] = en.notice;
  }

// Textes avec une partie variable.
const EN_PATTERNS = [
  [/^(\d+) questions détectées : (.*)$/, '$1 questions detected: $2'],
  [/^Choisi : (.*)$/, 'Chosen: $1'],
  [/^Aujourd’hui, (.*)$/, 'Today, $1'],
  [/^Hier, (.*)$/, 'Yesterday, $1'],
  [/^● Ollama connecté$/, '● Ollama connected'],
  [/^● Moteur intégré \(Ollama arrêté\)$/, '● Built-in engine (Ollama stopped)'],
  [/^○ Ollama arrêté$/, '○ Ollama stopped'],
  [/^○ Aucun modèle installé$/, '○ No model installed'],
  [/^Modèle : (.*)$/, 'Model: $1'],
  [/^Localia : (.*)$/, 'Localia: $1'],
  // Ligne d'informations d'un modèle (Réglages).
  [
    /^Famille /,
    (text) =>
      text
        .replace(/^Famille /, 'Family ')
        .replace(/ paramètres/, ' parameters')
        .replace(/quantification /, 'quantisation ')
        .replace(/contexte maximal /, 'maximum context ')
        .replace(/capacités : /, 'capabilities: '),
  ],
];

const isEnglish = () => typeof settings !== 'undefined' && settings.lang === 'en';
// Traduction d'un texte (espaces autour gardés) ; texte inconnu : inchangé.
function tr(text) {
  if (!isEnglish() || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  // Texte écrit sur plusieurs lignes dans la page : espaces ramenés à un seul pour la recherche.
  const key = trimmed.replace(/\s+/g, ' ');
  let out = EN[key];
  if (out === undefined)
    for (const [pattern, replacement] of EN_PATTERNS)
      if (pattern.test(key)) {
        out =
          typeof replacement === 'function' ? replacement(key) : key.replace(pattern, replacement);
        break;
      }
  return out === undefined ? text : text.replace(trimmed, out);
}
// Tâche dans la langue de l'interface : 0 libellé, 1 effet, 2 exemple.
function taskText(task, index) {
  if (!task) return '';
  const fr = [task.label, task.effect, task.example][index];
  return isEnglish() ? TASKS_EN[task.id]?.[index] || fr : fr;
}

// Parties de la page jamais traduites : contenu des conversations et des documents.
const NEVER_TRANSLATED =
  '.message, .markdown, #history .history-title, textarea, pre, code, .task, .expected, .thinking, #compare-prompt';
const ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
// Pour chaque texte : l'original français et ce qui est affiché. Un texte affiché différent de
// ce que Localia y avait mis a été changé par la page : c'est la nouvelle source française.
const originals = new WeakMap(); // nœud de texte → { fr, shown }
const originalAttributes = new WeakMap(); // élément → { attribut: { fr, shown } }

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest(NEVER_TRANSLATED)) return;
    const known = originals.get(node);
    const fr = known && node.nodeValue === known.shown ? known.fr : node.nodeValue;
    const shown = isEnglish() ? tr(fr) : fr;
    originals.set(node, { fr, shown });
    if (node.nodeValue !== shown) node.nodeValue = shown;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  // Zone de saisie : son texte n'est jamais traduit, mais son exemple (placeholder) l'est.
  const field = node.matches('textarea');
  if (field ? node.parentElement?.closest(NEVER_TRANSLATED) : node.closest(NEVER_TRANSLATED))
    return;
  const saved = originalAttributes.get(node) || {};
  for (const name of ATTRIBUTES) {
    if (!node.hasAttribute(name)) continue;
    const current = node.getAttribute(name);
    const known = saved[name];
    const fr = known && current === known.shown ? known.fr : current;
    const shown = isEnglish() ? tr(fr) : fr;
    saved[name] = { fr, shown };
    if (current !== shown) node.setAttribute(name, shown);
  }
  originalAttributes.set(node, saved);
  if (!field) for (const child of node.childNodes) translateNode(child);
}

let translating = false;
function applyLanguage() {
  document.documentElement.lang = isEnglish() ? 'en' : 'fr';
  translating = true;
  translateNode(document.body);
  translating = false;
  if (typeof applyMetier === 'function' && typeof models !== 'undefined') applyMetier();
}
// Textes ajoutés ou changés par la page : traduits au passage.
new MutationObserver((mutations) => {
  if (translating || !isEnglish()) return;
  translating = true;
  for (const m of mutations) {
    if (m.type === 'characterData') translateNode(m.target);
    else if (m.type === 'attributes') translateNode(m.target);
    else for (const node of m.addedNodes) translateNode(node);
  }
  translating = false;
}).observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ATTRIBUTES,
});
