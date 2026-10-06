# Release notes

*Notes de version en français plus bas.*

## 0.5.0 — 2026-10-05

- **Automatic checks, without any model**, under every answer (chat and comparison): calculations written in the answer are recomputed (e.g. “41.4 × 1000 × 0.30 = 12.42” flagged, exact 12,420); impossible page or excerpt references; quotations not found word for word in the document; numbers absent from the document. On the author's own series, every flagged answer had also been judged erroneous by the graders, with no false alarm.
- **Research assistant, task menu**: choosing a task (extract from a document, review an article, summarize, calculate, write or translate, code, general question) selects the model recommended by your Benchmark (most accurate, then least inventive, then fastest; repeated questions counted once), explains why, and adds a task instruction. A decision table “Which model for which task?” is added to the Benchmark.
- **Project memory**: projects hold your notes (sources, decisions, definitions, results); in a conversation linked to a project, the notes are sent to the model as context (all of them up to 6,000 characters, otherwise those closest to the question), and Localia shows which notes were sent. Only what you write, or an answer you explicitly add, enters the memory.
- **Bibliography tab**: author citations in an article (“Barbedo [24] reviewed…”) are checked offline against the numbered reference list (on the author's published article: 35 references, 12 author citations, one real mismatch found, no false alarm). Optional and **off by default**: checking that references exist (Crossref) and searching for articles (OpenAlex), with “copy reference” and “add to project”. Only the reference text or the query is sent, only to these two services; on the same article, 24 of 35 references were matched, 9 flagged for a manual check, 2 not found (preprints).
- **Files tab, actions with your consent**: describe what you want done in a folder (sort, rename, create folders or a note); the model proposes a plan, Localia checks every action against the real folder, and nothing changes until you tick and apply the actions. Safeguards: only folders you authorize through the system dialog (never the whole home folder, system or settings folders); the model sees file names, types and sizes, never their contents; nothing is overwritten or permanently deleted (removed items go to the Trash); every operation is logged and can be undone. A benchmark series (`serie-actions.txt`, 10 questions) measures how reliable each model is at this task, with automatic detection of impossible actions.
- **Optional encryption of your data** (Model settings → Data on this Mac): conversations, comparisons, projects, extracted PDF text, settings and the action log are encrypted with AES-256-GCM; the random key is protected by the macOS Keychain, with an exportable recovery key. Existing files are converted in place and remain readable during the conversion; if the key is unavailable, nothing is loaded or overwritten until the recovery key is imported. The FileVault status is shown.
- **Zotero, read-only and local** (Bibliography tab): search your Zotero library, compare an article's references with it, open an item in Zotero, or start a conversation on an item's PDF. Uses Zotero's local API (127.0.0.1); nothing leaves the Mac. Reference matching now requires a matching author or year when titles only partly overlap, and whole-word author names (“Li” no longer matches “Liu”).
- **Literature watch** (Bibliography tab): follow topics daily or weekly; while Localia is open and online search is allowed, new articles are fetched from OpenAlex (recent articles, by relevance, without duplicates), announced by a notification and a count on the tab, and can be added to Zotero, to a project, or marked as seen.
- **Scheduled benchmark series**: choose a start time in Comparison; the Mac is kept awake while waiting and during every series (no more `caffeinate`).
- **Apple Silicon and Windows**: Ollama is found in its usual places on each system (or `OLLAMA_PATH`); system information, disk-encryption status, forbidden folders and messages adapt to the system; Mac builds are signed ad hoc (required on Apple Silicon); Windows installer and .zip. Tests and builds run on macOS Apple Silicon, macOS Intel and Windows in the GitHub workflow.
- **Getting-started guide**, opened at first launch while no model is installed (and from the sidebar): installs or starts Ollama, recommends a model for the computer's memory (Gemma 3 1B/4B/12B, Qwen 3 8B, sizes checked against the Ollama catalogue) with a free-disk check, downloads it, and proposes a first question. The model library's starter card follows the same recommendation. One “＋ Add” button attaches a PDF, instructions, code or data.
- **Skills** (new tab): reusable instructions written as Markdown files in `Documents/Localia/Compétences` (edit, add, share). A skill is chosen in the Task menu or called at the start of a message (`/data-missing …`, suggestions while typing, `/competences` for the list); it can be linked to a task type (base instruction and benchmark-recommended model), attach reference files, or chain other skills as a step-by-step path. 42 starter skills in French: raw data (9 steps), NASA POWER weather data, designing a thesis or article project, linking thesis and articles, writing an article (9 steps, IEEE review, reply to reviewers), writing a thesis (7 steps), developing an application (9 steps).
- **Text, code and data files in conversations** (“＋ File”): instructions (.txt, .md), code (.py, .R, .sql…) and data tables (.csv, .tsv). A table is never sent in full: the model receives a profile (columns, types, missing and -999 values, min/max, date range, duplicates, first and last rows, NASA POWER header and the exact date conversion), so the code it writes uses the real column names. New task “Prepare and analyse data (Python)”. Search results: duplicates removed, document type shown, “Add to Zotero”.
- **Prompt-injection detection** when a PDF is imported (sentences addressed to an AI, e.g. “ignore all previous instructions”).
- Benchmark: table of automatic alerts per model; alert counts in the raw data export.
- Long documents: no more 5-minute timeout while Ollama reads the document; clearer connection error messages.
- Comparison: answers show each grader's verdict, invention flag, score and comment; grader comparison charts in the Benchmark.

## 0.4.0 — 2026-10-05

- **Benchmark tab** for publishable results: accuracy, “correct or partial” rate, invention rate, mean score, times and speeds as mean ± standard deviation across repetitions; accuracy per question category (heat map); stability across repetitions; inter-rater agreement (Cohen's kappa).
- **Blind grading** (random order, model name hidden) and **import of grades** from other graders (CSV); grading sheet export.
- **Exports**: raw data (CSV, JSON), standalone SVG charts, experiment conditions (Markdown).
- **Experiment conditions recorded with every series**: Localia and Ollama versions, CPU, cores, memory, macOS version, and for each model its digest, family, size and quantization; exact messages sent to the models.
- **Repetitions** (1–5) per series; **pause and resume**: only missing answers are run again, resumes are recorded.
- Question categories (`Category:` / `Catégorie :`) and English keywords (`Expected:`).

## 0.3.0 — 2026-10-04

- Answers rendered as Markdown, with model HTML displayed as text and images disabled.
- **Per-model settings**; the context size declared in each model's Modelfile is now respected (it was previously overridden with 4096 tokens).
- **Comparison tab**: one question or a series of questions (file import, `---` separator, expected answers never sent), sequential execution, overview charts, CSV export.
- Last chosen model remembered; conversations can be renamed and deleted (with their extracted PDF text).
- Safer main process: concurrent requests rejected, distinct error for unknown operations.

## 0.2.0

- Local chat with Ollama models, streamed answers, persistent history.
- PDF questions: local text extraction, excerpt selection for long documents.

---

# Notes de version

## 0.5.0 — 5 octobre 2026

- **Vérifications automatiques, sans modèle**, sous chaque réponse (conversation et comparaison) : calculs écrits dans la réponse refaits (par exemple « 41,4 × 1000 × 0,30 = 12,42 » signalé, résultat exact 12 420) ; références de pages ou d'extraits impossibles ; citations introuvables mot pour mot dans le document ; nombres absents du document. Sur les séries de l'auteur, chaque réponse signalée avait aussi été jugée erronée par les correcteurs, sans fausse alerte.
- **Assistant de recherche, menu Tâche** : choisir une tâche (extraire d'un document, relire un article, résumer, calculer, rédiger ou traduire, coder, question générale) sélectionne le modèle conseillé par votre Benchmark (le plus précis, puis le moins inventif, puis le plus rapide ; une question répétée compte une fois), explique ce choix et ajoute une consigne adaptée. Tableau de décision « Quel modèle pour quelle tâche ? » dans le Benchmark.
- **Mémoire par projet** : chaque projet garde vos notes (sources, décisions, définitions, résultats) ; dans une conversation liée à un projet, elles sont envoyées au modèle comme contexte (toutes jusqu'à 6 000 caractères, sinon les plus proches de la question), et Localia indique lesquelles. Seul ce que vous écrivez, ou une réponse que vous ajoutez vous-même, entre dans la mémoire.
- **Onglet Bibliographie** : les citations d'auteurs d'un article (« Barbedo [24] reviewed… ») sont comparées hors ligne à la liste de références numérotées (sur l'article publié de l'auteur : 35 références, 12 citations d'auteurs, une erreur réelle trouvée, aucune fausse alerte). En option, **désactivées par défaut** : vérification de l'existence des références (Crossref) et recherche d'articles (OpenAlex), avec « Copier la référence » et « Ajouter au projet ». Seuls le texte de la référence ou la recherche sont envoyés, et uniquement à ces deux services ; sur le même article, 24 références sur 35 retrouvées, 9 à vérifier à la main, 2 introuvables (prépublications).
- **Onglet Fichiers, actions avec votre accord** : décrivez ce que vous voulez faire dans un dossier (classer, renommer, créer des dossiers ou une note) ; le modèle propose un plan, Localia vérifie chaque action sur le dossier réel, et rien n'est modifié avant que vous ne cochiez et appliquiez les actions. Garde-fous : uniquement les dossiers autorisés par la fenêtre du système (jamais le dossier personnel entier, ni les dossiers système ou de réglages) ; le modèle voit les noms, types et tailles des fichiers, jamais leur contenu ; rien n'est écrasé ni supprimé définitivement (ce qui est retiré va à la Corbeille) ; chaque opération est inscrite au journal et peut être annulée. Une série du Benchmark (`serie-actions.txt`, 10 questions) mesure la fiabilité de chaque modèle pour cette tâche, avec détection automatique des actions impossibles.
- **Chiffrement facultatif de vos données** (Réglages des modèles → Données sur ce Mac) : conversations, comparaisons, projets, textes extraits des PDF, réglages et journal des actions chiffrés en AES-256-GCM ; la clé aléatoire est protégée par le trousseau de macOS, avec une clé de secours exportable. Les fichiers existants sont convertis sur place et restent lisibles pendant la conversion ; si la clé est indisponible, rien n'est chargé ni écrasé tant que la clé de secours n'est pas importée. L'état de FileVault est affiché.
- **Zotero, en lecture seule et en local** (onglet Bibliographie) : recherche dans votre bibliothèque Zotero, comparaison des références d'un article avec elle, ouverture d'un élément dans Zotero, conversation sur le PDF d'un élément. Passe par l'API locale de Zotero (127.0.0.1) : rien ne sort du Mac. La comparaison des références exige désormais l'auteur ou l'année quand les titres ne se recoupent qu'en partie, et le nom d'auteur entier (« Li » ne correspond plus à « Liu »).
- **Veille bibliographique** (onglet Bibliographie) : sujets suivis chaque jour ou chaque semaine ; tant que Localia est ouverte et la recherche en ligne autorisée, les nouveaux articles sont cherchés sur OpenAlex (articles récents, par pertinence, sans doublon), signalés par une notification et un compteur sur l'onglet, et peuvent être ajoutés à Zotero, à un projet, ou marqués comme vus.
- **Séries du Benchmark programmées** : une heure de départ dans Comparaison ; le Mac reste éveillé pendant l'attente et pendant toute série (plus besoin de `caffeinate`).
- **Apple Silicon et Windows** : Ollama est cherché à ses emplacements habituels sur chaque système (ou `OLLAMA_PATH`) ; informations système, état du chiffrement du disque, dossiers interdits et messages s'adaptent au système ; versions Mac signées ad hoc (obligatoire sur Apple Silicon) ; installateur et .zip pour Windows. Tests et constructions sur macOS Apple Silicon, macOS Intel et Windows dans le workflow GitHub.
- **Guide de démarrage**, ouvert au premier lancement tant qu'aucun modèle n'est installé (et depuis la colonne de gauche) : installe ou démarre Ollama, conseille un modèle selon la mémoire de l'ordinateur (Gemma 3 1B/4B/12B, Qwen 3 8B, tailles vérifiées dans le catalogue d'Ollama) en vérifiant la place libre, le télécharge et propose une première question. La carte « Pour commencer » de la Bibliothèque suit le même conseil. Un seul bouton « ＋ Ajouter » joint un PDF, des consignes, du code ou des données.
- **Compétences** (nouvel onglet) : consignes réutilisables écrites en fichiers Markdown dans `Documents/Localia/Compétences` (à modifier, compléter, partager). Une compétence se choisit dans le menu Tâche ou s'appelle en début de message (`/donnees-manquants …`, suggestions pendant la saisie, `/competences` pour la liste) ; elle peut être liée à un type de tâche (consigne de base et modèle conseillé par le Benchmark), joindre des fichiers de référence, ou enchaîner d'autres compétences en parcours. 42 compétences de départ : données brutes (9 étapes), météo NASA POWER, concevoir un projet de thèse ou d'article, relier thèse et articles, rédiger un article (9 étapes, relecture IEEE, réponse aux relecteurs), rédiger une thèse (7 étapes), développer une application (9 étapes).
- **Fichiers texte, code et données dans les conversations** (« ＋ Fichier ») : consignes (.txt, .md), code (.py, .R, .sql…) et tableaux de données (.csv, .tsv). Un tableau n'est jamais envoyé en entier : le modèle reçoit son portrait (colonnes, types, valeurs manquantes et -999, minimum et maximum, période, doublons, premières et dernières lignes, en-tête NASA POWER et conversion exacte des dates), pour écrire du code avec les vrais noms de colonnes. Nouvelle tâche « Préparer et analyser des données (Python) ». Recherche d'articles : doublons écartés, type de document affiché, « Ajouter à Zotero ».
- **Détection des consignes piégées** à l'import d'un PDF (phrases adressées à une IA, par exemple « ignore all previous instructions »).
- Benchmark : tableau des alertes automatiques par modèle ; comptes d'alertes dans l'export des données brutes.
- Documents longs : plus de coupure au bout de 5 minutes pendant qu'Ollama lit le document ; messages d'erreur de connexion plus précis.
- Comparaison : chaque réponse affiche le verdict, l'invention, la note et le commentaire de chaque correcteur ; graphiques de comparaison des correcteurs dans le Benchmark.

## 0.4.0 — 5 octobre 2026

- **Onglet Benchmark** pour des résultats publiables : précision, part « correct ou partiel », taux d'invention, note moyenne, temps et vitesses en moyenne ± écart-type sur les répétitions ; précision par catégorie de question (carte de chaleur) ; stabilité entre répétitions ; accord entre correcteurs (kappa de Cohen).
- **Notation à l'aveugle** (ordre aléatoire, nom du modèle masqué) et **import des notes** d'autres correcteurs (CSV) ; export d'une fiche de notation.
- **Exports** : données brutes (CSV, JSON), graphiques SVG autonomes, conditions de l'expérience (Markdown).
- **Conditions de l'expérience enregistrées avec chaque série** : versions de Localia et d'Ollama, processeur, cœurs, mémoire, version de macOS, et pour chaque modèle son empreinte, sa famille, sa taille et sa quantification ; messages exacts envoyés aux modèles.
- **Répétitions** (1 à 5) par série ; **pause et reprise** : seules les réponses manquantes sont relancées, les reprises sont enregistrées.
- Catégories de questions (`Catégorie :` / `Category:`) et mots-clés anglais (`Expected:`).

## 0.3.0 — 4 octobre 2026

- Réponses mises en forme (Markdown), HTML du modèle affiché comme texte, images désactivées.
- **Réglages par modèle** ; le contexte prévu par le Modelfile de chaque modèle est désormais respecté (il était auparavant remplacé par 4096 tokens).
- **Onglet Comparaison** : une question ou une série (import de fichier, séparateur `---`, réponses attendues jamais envoyées), exécution à la suite, graphiques de synthèse, export CSV.
- Dernier modèle choisi mémorisé ; conversations renommables et supprimables (avec le texte extrait de leur PDF).
- Processus principal plus sûr : requêtes simultanées refusées, erreur distincte pour une opération inconnue.

## 0.2.0

- Conversations locales avec les modèles Ollama, réponses progressives, historique conservé.
- Questions sur un PDF : extraction locale du texte, sélection d'extraits pour les documents longs.
