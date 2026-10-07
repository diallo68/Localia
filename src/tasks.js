// Types de tâches de l'assistant de recherche et choix du modèle d'après le Benchmark.
// Chargé comme script dans l'interface, et par le processus principal et les tests (CommonJS).
const TASKS = [
  {
    id: 'extraction',
    effect:
      'le modèle répond seulement à partir du document joint, cite la page de chaque information et dit quand l’information manque.',
    example: 'Combien d’images contient le jeu de données, et à quelle page ?',
    label: 'Extraire des informations d’un document',
    categories: ['Extraction', 'Pièges à invention'],
    instruction:
      'Réponds uniquement à partir du document fourni. Cite la page de chaque information. Si le document ne contient pas l’information demandée, réponds « Le document ne le précise pas » sans rien supposer.',
  },
  {
    id: 'relecture',
    effect:
      'le modèle compare chiffres, tableaux, citations et références, et liste chaque incohérence avec ses pages.',
    example: 'Relis ce document et liste les incohérences entre le texte et les tableaux.',
    label: 'Relire un article et repérer les incohérences',
    categories: ['Incohérences'],
    instruction:
      'Compare les chiffres, les tableaux, les citations et les références entre eux et avec le texte. Liste chaque incohérence avec les pages concernées. N’affirme pas qu’un passage est cohérent sans l’avoir vérifié.',
  },
  {
    id: 'synthese',
    effect:
      'le modèle résume fidèlement, sans ajouter de chiffre ni d’information absents du texte.',
    example: 'Résume ce document en cinq points.',
    label: 'Résumer',
    categories: ['Synthèse'],
    instruction: 'Résume fidèlement, sans ajouter de chiffre ni d’information absents du texte.',
  },
  {
    id: 'calcul',
    effect:
      'le modèle écrit chaque opération en entier ; Localia refait les calculs de la réponse.',
    example: 'Vérifie le calcul : 1 802 / 38 745 × 100.',
    label: 'Calculer ou vérifier un calcul',
    categories: ['Calcul', 'Raisonnement'],
    instruction:
      'Écris chaque calcul en entier sous la forme « a × b = c », une opération par ligne, pour qu’il puisse être vérifié.',
    warning:
      'Aucun modèle n’est fiable en calcul : Localia refait chaque opération écrite dans la réponse.',
  },
  {
    id: 'redaction',
    effect:
      'le modèle écrit en français clair, avec la terminologie scientifique exacte, sans inventer de données.',
    example: 'Traduis ce paragraphe en anglais scientifique.',
    label: 'Rédiger ou traduire',
    categories: ['Rédaction'],
    instruction:
      'Écris en français clair et correct. Utilise la terminologie scientifique exacte et n’invente aucune donnée.',
  },
  {
    id: 'code',
    effect:
      'le modèle donne un code complet et exécutable, puis explique brièvement ce qu’il fait.',
    example: 'Écris une fonction Python qui lit un fichier CSV et affiche ses colonnes.',
    label: 'Écrire ou corriger du code',
    categories: ['Code'],
    instruction: 'Donne un code complet et exécutable, puis explique brièvement ce qu’il fait.',
    warning:
      'Exécutez le code avant de vous y fier : les tests écrits par les modèles sont souvent faux.',
  },
  {
    id: 'donnees',
    effect:
      'le modèle écrit un script Python (pandas) adapté aux fichiers joints : nettoyage, contrôles, calculs.',
    example: 'Écris le script de nettoyage de ce fichier de données.',
    label: 'Préparer et analyser des données (Python)',
    categories: ['Données'],
    instruction: [
      'Écris un script Python complet et exécutable (pandas ; matplotlib si un graphique est demandé), que l’utilisateur lancera lui-même sur son ordinateur.',
      'Lis les fichiers joints par leur nom et utilise exactement les noms de colonnes donnés. Pour chaque étape (lecture, types, dates, valeurs manquantes ou -999, doublons, valeurs aberrantes, tri, agrégation, export), explique en une ligne ce qu’elle fait et pourquoi.',
      'Statistiques « par mois » ou « par semaine » : par année et par mois (ou semaine), sauf si une moyenne sur plusieurs années (climatologie) est explicitement demandée.',
      'N’invente ni colonne ni valeur ; signale les choix qui dépendent de l’utilisateur (seuils, traitement des manquants) au lieu de les trancher en silence. Termine par les commandes pour exécuter le script et vérifier le résultat.',
    ].join('\n'),
    warning:
      'Exécutez le script et vérifiez le résultat avant de vous en servir : le modèle ne voit que le portrait de vos données, pas toutes les lignes.',
  },
  {
    id: 'fichiers',
    label: 'Organiser des fichiers (onglet Fichiers)',
    files: true, // proposé dans l'onglet Fichiers, pas dans les conversations
    categories: ['Actions sur fichiers'],
    instruction: [
      'Tu proposes un plan d’actions sur les fichiers du dossier décrit ; tu n’exécutes rien : l’utilisateur relit et valide chaque action.',
      'Réponds par une phrase de résumé, puis un seul bloc ```json de la forme :',
      '{"summary": "…", "actions": [',
      '  {"type": "create_folder", "path": "Articles/2023", "reason": "…"},',
      '  {"type": "move", "from": "article.pdf", "to": "Articles/2023/article.pdf", "reason": "…"},',
      '  {"type": "create_file", "path": "notes.md", "content": "…", "reason": "…"},',
      '  {"type": "trash", "path": "copie.tmp", "reason": "…"}',
      ']}',
      'Règles : les chemins partent de l’intérieur du dossier, exactement comme dans la liste, séparés par « / », sans jamais commencer par le nom du dossier lui-même (« 2021/a.pdf », pas « Articles/2021/a.pdf ») ; « move » sert aussi à renommer ; crée un dossier avant d’y déplacer des fichiers ; n’écrase jamais un fichier existant (si le nom de destination est déjà pris, choisis un autre nom) ; ne mets rien à la corbeille sans demande explicite ; seuls les fichiers .md, .txt et .csv peuvent être créés.',
      'Tu ne vois que les noms, tailles et types des fichiers, pas leur contenu : ne déduis pas le contenu d’un fichier de son nom sans le dire. Si la demande est ambiguë ou impossible, explique-le et renvoie une liste d’actions vide.',
    ].join('\n'),
    warning:
      'Le modèle ne fait que proposer : Localia vérifie chaque action et vous validez avant toute modification.',
  },
  {
    id: 'question',
    effect: 'aucune consigne particulière : le modèle répond librement.',
    example: 'Explique-moi la différence entre précision et rappel.',
    label: 'Question générale',
    categories: ['Honnêteté', 'Pièges à invention'],
    instruction:
      'Si tu ne connais pas la réponse ou si elle peut avoir changé depuis tes données d’entraînement, dis-le clairement au lieu de supposer.',
  },
  {
    id: 'traduction',
    label: 'Traduire',
    effect:
      'le modèle traduit fidèlement, sans résumer ni ajouter, et garde les termes techniques exacts.',
    example: 'Traduis ce texte en anglais.',
    categories: ['Rédaction'],
    instruction:
      'Traduis fidèlement, phrase par phrase, sans résumer, sans ajouter d’information. Garde les noms propres, les chiffres et les termes techniques exacts ; signale entre crochets un passage ambigu au lieu de le deviner.',
  },
  {
    id: 'courrier',
    label: 'Écrire un courrier',
    effect:
      'le modèle rédige un courrier complet (objet, formule d’appel, corps, formule de politesse) en laissant entre crochets ce qu’il ne connaît pas.',
    example: 'Écris un courrier pour demander un rendez-vous.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un courrier complet : objet, formule d’appel, corps clair en paragraphes courts, formule de politesse. N’invente ni nom, ni date, ni référence : laisse-les entre crochets, par exemple [DATE].',
  },
  {
    id: 'photo',
    label: 'Lire une photo',
    effect:
      'le modèle décrit ce qu’il voit sur la photo, recopie le texte lisible et dit ce qu’il ne peut pas distinguer.',
    example: 'Que montre cette photo ? Recopie le texte lisible.',
    categories: ['Extraction'],
    instruction:
      'Décris d’abord ce que tu vois sur la photo jointe, puis recopie le texte lisible tel quel. Dis clairement ce qui est flou ou illisible ; ne complète pas par une supposition. Toute interprétation est un premier avis, à confirmer par un spécialiste.',
  },
  {
    id: 'cours',
    label: 'Préparer un cours',
    effect:
      'le modèle propose un cours structuré : objectifs, prérequis, plan minuté, exemples, activités et évaluation.',
    example: 'Prépare un cours d’une heure sur la photosynthèse pour des élèves de seconde.',
    categories: ['Rédaction'],
    instruction:
      'Prépare un cours structuré : public et durée, objectifs d’apprentissage vérifiables, prérequis, plan minuté, explications avec exemples concrets, activités des élèves, et une courte évaluation finale. Appuie-toi sur les documents joints s’il y en a, et signale ce qui doit être vérifié dans le programme officiel.',
  },
  {
    id: 'qcm',
    label: 'Créer un QCM',
    effect:
      'le modèle écrit des questions à choix multiples avec une seule bonne réponse, des distracteurs plausibles et le corrigé expliqué.',
    example: 'Crée un QCM de 10 questions sur le chapitre joint.',
    categories: ['Rédaction'],
    instruction:
      'Écris un QCM : chaque question a quatre propositions, une seule correcte, et des distracteurs plausibles (erreurs fréquentes). Varie les niveaux (connaissance, compréhension, application). Termine par le corrigé, avec une phrase d’explication par question et la page ou la section du document qui la justifie.',
  },
  {
    id: 'examen',
    label: 'Préparer un examen ou un contrôle',
    effect:
      'le modèle propose un sujet avec durée, barème détaillé et corrigé, adapté au niveau indiqué.',
    example: 'Prépare un contrôle de 45 minutes sur les fractions, niveau 5e, avec barème.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un sujet d’examen ou de contrôle : niveau, durée, consignes, exercices progressifs, barème détaillé par question (total cohérent), puis un corrigé complet. Vérifie que la durée est réaliste pour le nombre de questions.',
  },
  {
    id: 'copie',
    label: 'Corriger une copie',
    effect:
      'le modèle corrige selon votre grille ou votre barème, note chaque critère et justifie, sans inventer ce que la copie ne contient pas.',
    example: 'Corrige cette copie avec le barème joint.',
    categories: ['Rédaction'],
    instruction:
      'Corrige la copie selon la grille ou le barème fourni ; s’il n’y en a pas, propose-en un et dis-le. Pour chaque critère : ce qui est réussi, ce qui manque, la note. Cite les passages de la copie. Si une partie est illisible (photo), dis-le au lieu de deviner. Termine par une appréciation courte et bienveillante.',
  },
  {
    id: 'article',
    label: 'Rédiger un article',
    effect:
      'le modèle rédige une section d’article scientifique claire, sans inventer de résultat ni de référence.',
    example: 'Rédige l’introduction de mon article à partir de mes notes.',
    categories: ['Rédaction'],
    instruction:
      'Rédige en style scientifique : phrases claires, terminologie exacte, structure IMRaD si l’article entier est demandé. N’invente aucun résultat, chiffre ni référence : signale entre crochets ce qui manque, par exemple [RÉFÉRENCE À AJOUTER].',
  },
  {
    id: 'these',
    label: 'Rédiger une thèse',
    effect:
      'le modèle aide à rédiger un chapitre de thèse en veillant à la cohérence avec les autres chapitres et aux références à vérifier.',
    example: 'Propose le plan détaillé du chapitre état de l’art de ma thèse.',
    categories: ['Rédaction'],
    instruction:
      'Aide à rédiger un chapitre de thèse : plan, transitions, cohérence avec la problématique et les autres chapitres. N’invente ni résultat ni référence ; indique ce qui doit être vérifié ou complété par le doctorant.',
  },
  {
    id: 'sante-cr',
    label: 'Compte rendu de consultation',
    effect:
      'le modèle met en forme un compte rendu à partir de vos notes, sans ajouter de diagnostic ni de traitement absents.',
    example: 'Mets en forme ce compte rendu à partir de mes notes.',
    categories: ['Rédaction'],
    instruction:
      'Mets en forme un compte rendu médical à partir des notes fournies : motif, antécédents, examen, conclusion, conduite à tenir. N’ajoute aucun diagnostic, résultat ni traitement absent des notes ; signale les informations manquantes.',
  },
  {
    id: 'sante-synthese',
    label: 'Synthèse d’un dossier',
    effect: 'le modèle résume le dossier joint de façon chronologique, en citant les pages.',
    example: 'Fais la synthèse chronologique de ce dossier.',
    categories: ['Synthèse'],
    instruction:
      'Résume le dossier joint de façon chronologique : événements, examens, résultats, traitements, avec la page de chaque information. Ne déduis rien qui ne soit écrit.',
  },
  {
    id: 'sante-courrier',
    label: 'Courrier à un confrère',
    effect: 'le modèle rédige un courrier médical clair à partir des éléments fournis.',
    example: 'Rédige un courrier d’adressage à un cardiologue.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un courrier médical à un confrère : motif, éléments cliniques utiles, question posée. Uniquement à partir des éléments fournis ; laisse entre crochets ce qui manque.',
  },
  {
    id: 'sante-patient',
    label: 'Explication pour un patient',
    effect:
      'le modèle explique simplement, sans jargon, et rappelle de demander l’avis du soignant.',
    example: 'Explique simplement à un patient ce qu’est l’hypertension.',
    categories: ['Rédaction'],
    instruction:
      'Explique en mots simples, phrases courtes, sans jargon (ou en l’expliquant). Ne donne ni diagnostic ni prescription personnalisés ; invite à poser les questions au soignant.',
  },
  {
    id: 'sante-resume',
    label: 'Résumer un protocole ou un article',
    effect: 'le modèle résume la méthode, les résultats et les limites, en citant les pages.',
    example: 'Résume ce protocole : objectif, méthode, résultats, limites.',
    categories: ['Synthèse'],
    instruction:
      'Résume : objectif, population, méthode, résultats principaux (avec les chiffres exacts du document), limites. Cite la page de chaque chiffre.',
  },
  {
    id: 'jur-contrat',
    label: 'Analyser un contrat',
    effect:
      'le modèle résume les obligations de chaque partie, durées, montants et conditions de sortie, en citant les articles.',
    example: 'Résume les obligations de chaque partie dans ce contrat.',
    categories: ['Extraction'],
    instruction:
      'Analyse le contrat joint : parties, objet, obligations de chacune, durée, montants, résiliation, responsabilités, litiges. Cite l’article ou la page de chaque point ; ne suppose rien qui n’y soit écrit. Ceci n’est pas un conseil juridique.',
  },
  {
    id: 'jur-clauses',
    label: 'Repérer les clauses à risque',
    effect:
      'le modèle liste les clauses déséquilibrées, ambiguës ou inhabituelles, avec l’article concerné.',
    example: 'Quelles clauses de ce contrat sont risquées pour moi ?',
    categories: ['Incohérences'],
    instruction:
      'Repère les clauses déséquilibrées, ambiguës, inhabituelles ou contradictoires ; pour chacune : article, citation exacte, risque, question à poser. Distingue un risque d’une irrégularité démontrée.',
  },
  {
    id: 'jur-loi',
    label: 'Résumer un texte de loi',
    effect: 'le modèle résume le texte en citant chaque article, sans extrapoler.',
    example: 'Résume ce texte de loi article par article.',
    categories: ['Synthèse'],
    instruction:
      'Résume le texte joint article par article : ce qu’il impose, à qui, à partir de quand, avec quelles exceptions. Cite chaque article ; n’extrapole pas à des cas non prévus.',
  },
  {
    id: 'jur-courrier',
    label: 'Courrier ou mise en demeure',
    effect:
      'le modèle rédige un courrier juridique précis, en laissant entre crochets les éléments à compléter.',
    example: 'Rédige une mise en demeure pour une facture impayée.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un courrier juridique : faits, fondement (articles cités seulement s’ils figurent dans les documents fournis), demande, délai. Laisse entre crochets ce qui manque. Ceci n’est pas un conseil juridique.',
  },
  {
    id: 'jur-comparer',
    label: 'Comparer deux versions',
    effect:
      'le modèle liste les différences entre deux versions d’un document, article par article.',
    example: 'Compare ces deux versions du contrat.',
    categories: ['Incohérences'],
    instruction:
      'Compare les deux versions fournies : pour chaque article modifié, ajouté ou supprimé, cite l’ancienne et la nouvelle formulation et explique la portée du changement.',
  },
  {
    id: 'adm-cr',
    label: 'Compte rendu de réunion',
    effect:
      'le modèle produit un compte rendu : participants, points abordés, décisions, actions avec responsables et échéances.',
    example: 'Rédige le compte rendu de cette réunion à partir de mes notes.',
    categories: ['Synthèse'],
    instruction:
      'Rédige un compte rendu : date, participants, points abordés, décisions, actions (qui, quoi, quand). Uniquement à partir des notes fournies ; signale ce qui manque.',
  },
  {
    id: 'adm-rapport',
    label: 'Rapport ou note de synthèse',
    effect: 'le modèle rédige une note structurée : contexte, constats, options, recommandation.',
    example: 'Rédige une note de synthèse sur ce dossier pour la direction.',
    categories: ['Synthèse'],
    instruction:
      'Rédige une note structurée : contexte, constats (avec la source de chaque fait), options possibles, recommandation, points à décider. Ton neutre et factuel.',
  },
  {
    id: 'adm-suivi',
    label: 'Tableau de suivi',
    effect:
      'le modèle propose un tableau (colonnes, statuts, échéances) à partir de vos informations.',
    example: 'Fais un tableau de suivi des dossiers à partir de cette liste.',
    categories: ['Données'],
    instruction:
      'Propose un tableau de suivi en Markdown (colonnes utiles, statut, responsable, échéance) à partir des informations fournies, sans inventer de ligne. Indique comment le reprendre dans un tableur.',
  },
  {
    id: 'adm-formulaire',
    label: 'Remplir un formulaire d’après un document',
    effect:
      'le modèle remplit chaque champ à partir du document joint et laisse vides ceux qu’il ne trouve pas.',
    example: 'Remplis ce formulaire à partir du document joint.',
    categories: ['Extraction'],
    instruction:
      'Pour chaque champ demandé, donne la valeur trouvée dans le document avec sa page, ou « non trouvé » ; ne devine aucune valeur.',
  },
  {
    id: 'fin-releve',
    label: 'Analyser un relevé ou un grand livre',
    effect:
      'le modèle classe les opérations, calcule les totaux en écrivant chaque opération, et signale les anomalies.',
    example: 'Classe les dépenses de ce relevé par catégorie et calcule les totaux.',
    categories: ['Calcul'],
    instruction:
      'Analyse le relevé ou le grand livre joint : classe les opérations, calcule les totaux en écrivant chaque calcul en entier (a + b = c), signale doublons, montants inhabituels et écarts. Ne devine aucune opération absente.',
  },
  {
    id: 'fin-budget',
    label: 'Budget prévisionnel',
    effect:
      'le modèle construit un budget poste par poste, avec hypothèses explicites et calculs écrits.',
    example: 'Prépare un budget prévisionnel sur 12 mois pour ce projet.',
    categories: ['Calcul'],
    instruction:
      'Construis un budget prévisionnel poste par poste ; écris chaque hypothèse et chaque calcul en entier ; vérifie que les totaux sont cohérents. Signale les hypothèses à confirmer. Ceci n’est pas un conseil financier.',
  },
  {
    id: 'fin-facture',
    label: 'Vérifier une facture ou un devis',
    effect:
      'le modèle refait les calculs (quantités, prix, remises, TVA, total) et signale chaque écart.',
    example: 'Vérifie les calculs de cette facture.',
    categories: ['Calcul'],
    instruction:
      'Refais chaque calcul de la facture ou du devis (quantité × prix, remises, taxes, total) en l’écrivant en entier, et signale chaque écart avec la ligne concernée.',
  },
  {
    id: 'fin-rapprochement',
    label: 'Rapprocher factures et paiements',
    effect:
      'le modèle met en correspondance factures et paiements et liste ce qui manque ou diffère.',
    example: 'Rapproche ces factures et ces paiements.',
    categories: ['Calcul'],
    instruction:
      'Rapproche les factures et les paiements fournis (montant, date, référence) ; liste les correspondances, les factures impayées, les paiements sans facture et les écarts de montant, avec les calculs écrits.',
  },
  {
    id: 'fin-rapport',
    label: 'Rapport financier',
    effect:
      'le modèle explique un bilan ou un compte de résultat en termes simples, avec les chiffres du document.',
    example: 'Explique simplement ce bilan et ses points faibles.',
    categories: ['Synthèse'],
    instruction:
      'Explique le document financier joint : grandes masses, évolutions, ratios utiles (calculs écrits), points d’attention. Chaque chiffre cité doit venir du document, avec sa page. Ceci n’est pas un conseil financier ou fiscal.',
  },
  {
    id: 'ent-devis',
    label: 'Devis ou offre commerciale',
    effect: 'le modèle rédige une offre claire avec un tableau chiffré dont il écrit les calculs.',
    example: 'Rédige un devis pour 3 jours de formation.',
    categories: ['Rédaction'],
    instruction:
      'Rédige une offre ou un devis : présentation, prestations, tableau chiffré (quantité × prix, total, taxes écrits en entier), conditions, validité. Laisse entre crochets ce qui n’est pas fourni.',
  },
  {
    id: 'ent-fiche',
    label: 'Fiche produit',
    effect: 'le modèle écrit une fiche produit claire et exacte, sans inventer de caractéristique.',
    example: 'Écris la fiche produit de cet article à partir de ses caractéristiques.',
    categories: ['Rédaction'],
    instruction:
      'Écris une fiche produit : titre, description, caractéristiques, usages, entretien. N’invente aucune caractéristique, certification ni chiffre absent des informations fournies.',
  },
  {
    id: 'ent-client',
    label: 'Répondre à un client',
    effect: 'le modèle propose une réponse courtoise et précise, qui reprend la demande du client.',
    example: 'Propose une réponse à ce message de client mécontent.',
    categories: ['Rédaction'],
    instruction:
      'Rédige une réponse courtoise, claire et précise : reformule la demande, réponds point par point, propose une solution ou une étape suivante. N’engage pas l’entreprise sur ce qui n’est pas indiqué.',
  },
  {
    id: 'ent-ventes',
    label: 'Analyser les ventes',
    effect:
      'le modèle analyse le tableau de ventes : évolutions, meilleurs produits, calculs écrits.',
    example: 'Analyse ce tableau de ventes : évolution et meilleurs produits.',
    categories: ['Données'],
    instruction:
      'Analyse le tableau de ventes joint : évolutions, meilleurs et moins bons produits, saisonnalité ; écris chaque calcul ou propose un script Python si le tableau est long. Ne devine aucune donnée absente.',
  },
  {
    id: 'ent-plan',
    label: 'Plan d’affaires',
    effect: 'le modèle structure un plan d’affaires et signale chaque hypothèse à vérifier.',
    example: 'Aide-moi à structurer le plan d’affaires de ma boutique.',
    categories: ['Rédaction'],
    instruction:
      'Structure un plan d’affaires : offre, clients, marché, concurrence, organisation, prévisions (calculs écrits, hypothèses explicites), risques. Signale ce qui doit être vérifié sur le terrain.',
  },
  {
    id: 'ent-reseaux',
    label: 'Publication pour les réseaux sociaux',
    effect: 'le modèle propose plusieurs publications courtes adaptées au réseau choisi.',
    example: 'Propose trois publications pour annoncer notre nouveau produit.',
    categories: ['Rédaction'],
    instruction:
      'Propose plusieurs versions courtes adaptées au réseau indiqué (ton, longueur, appel à l’action). N’invente ni promotion, ni prix, ni témoignage.',
  },
  {
    id: 'ing-cdc',
    label: 'Cahier des charges',
    effect:
      'le modèle structure un cahier des charges : besoins, contraintes, exigences vérifiables, critères d’acceptation.',
    example: 'Rédige le cahier des charges de cette application.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un cahier des charges : contexte, besoins, exigences fonctionnelles et non fonctionnelles numérotées et vérifiables, contraintes, critères d’acceptation, points ouverts.',
  },
  {
    id: 'ing-doc',
    label: 'Documentation technique',
    effect:
      'le modèle rédige une documentation claire (installation, utilisation, dépannage) fidèle au code ou au document fourni.',
    example: 'Rédige la documentation d’installation de ce logiciel.',
    categories: ['Rédaction'],
    instruction:
      'Rédige une documentation technique fidèle aux éléments fournis : prérequis, installation, utilisation, configuration, dépannage. N’invente ni commande, ni option, ni valeur.',
  },
  {
    id: 'ing-calcul',
    label: 'Calculs de dimensionnement',
    effect:
      'le modèle écrit chaque formule et chaque calcul avec ses unités ; Localia refait les opérations.',
    example: 'Dimensionne la section de câble pour 32 A sur 25 m.',
    categories: ['Calcul'],
    instruction:
      'Écris chaque formule, les hypothèses, puis chaque calcul en entier avec ses unités (a × b = c), une opération par ligne. Indique les normes ou coefficients supposés et ce qui doit être vérifié par un ingénieur.',
  },
  {
    id: 'ing-schema',
    label: 'Lire un schéma ou une pièce',
    effect:
      'le modèle décrit le schéma ou la photo de la pièce, relève les cotes lisibles et dit ce qu’il ne peut pas lire.',
    example: 'Décris ce schéma et relève les cotes lisibles.',
    categories: ['Extraction'],
    instruction:
      'Décris le schéma ou la pièce de la photo, relève les cotes, références et annotations lisibles, et dis clairement ce qui est illisible. Premier avis, à confirmer par un technicien.',
  },
  {
    id: 'ing-incident',
    label: 'Rapport d’incident ou de maintenance',
    effect:
      'le modèle structure un rapport : constat, chronologie, cause probable, actions, prévention.',
    example: 'Rédige le rapport de cette panne à partir de mes notes.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un rapport : équipement, constat, chronologie, cause probable (présentée comme hypothèse si non démontrée), actions menées, actions préventives.',
  },
  {
    id: 'com-article',
    label: 'Article ou communiqué',
    effect:
      'le modèle rédige un texte journalistique : titre, chapeau, faits sourcés, citations exactes.',
    example: 'Rédige un communiqué de presse à partir de ces informations.',
    categories: ['Rédaction'],
    instruction:
      'Rédige un texte journalistique : titre, chapeau, faits (qui, quoi, où, quand, pourquoi) avec leur source, citations exactes uniquement si elles sont fournies. N’invente ni chiffre, ni citation, ni témoin.',
  },
  {
    id: 'com-faits',
    label: 'Vérifier les faits',
    effect:
      'le modèle confronte chaque affirmation au document et dit si elle est confirmée, contredite ou non vérifiable.',
    example: 'Vérifie ces affirmations avec le document joint.',
    categories: ['Incohérences'],
    instruction:
      'Pour chaque affirmation : confirmée, contredite ou non vérifiable avec le document, avec la citation exacte et la page. Ne tranche pas sans source.',
  },
  {
    id: 'com-interview',
    label: 'Résumer une interview',
    effect: 'le modèle résume les idées principales et garde les citations exactes.',
    example: 'Résume cette interview en cinq idées, avec les citations clés.',
    categories: ['Synthèse'],
    instruction:
      'Résume l’interview : idées principales, citations exactes (mot pour mot) avec leur position dans le texte. Ne reformule pas une citation entre guillemets.',
  },
  {
    id: 'com-questions',
    label: 'Préparer une interview',
    effect: 'le modèle propose des questions ouvertes, ordonnées, avec des relances.',
    example: 'Prépare les questions d’une interview avec un agronome.',
    categories: ['Rédaction'],
    instruction:
      'Propose des questions ouvertes, ordonnées du général au précis, avec des relances possibles ; signale les sujets sensibles.',
  },
];
const taskById = (id) => TASKS.find((t) => t.id === id) || null;
const MIN_ANSWERS = 2;
const RELIABLE_ANSWERS = 10; // questions distinctes notées

// Réponses notées d'un modèle pour une liste de catégories : précision, invention, temps médian.
// Une question posée plusieurs fois (répétitions, séries relancées) compte une seule fois :
// ses répétitions sont moyennées, pour que le nombre de questions reste honnête.
function taskMetrics(records, model, categories, valuesOf) {
  const byQuestion = new Map();
  const times = [];
  for (const record of records)
    for (const result of record.results) {
      if (result.model !== model || result.status !== 'done') continue;
      const question = record.questions[result.q];
      if (!categories.includes(question?.category)) continue;
      const v = valuesOf(result);
      if (!v || v.correct == null) continue;
      const key = question.prompt || question.label;
      if (!byQuestion.has(key)) byQuestion.set(key, []);
      byQuestion.get(key).push(v);
      if (result.stats?.totalMs) times.push(result.stats.totalMs / 1000);
    }
  if (!byQuestion.size) return null;
  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const perQuestion = [...byQuestion.values()].map((list) => ({
    correct: mean(list.map((v) => v.correct)),
    invention: mean(list.map((v) => v.invention).filter((x) => x != null)),
  }));
  const sorted = [...times].sort((a, b) => a - b);
  const median = !sorted.length
    ? null
    : sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    model,
    n: perQuestion.length,
    correct: mean(perQuestion.map((q) => q.correct)),
    invention: mean(perQuestion.map((q) => q.invention).filter((x) => x != null)),
    medianSeconds: median,
  };
}

// Conseil par tâche : le modèle installé le plus précis (puis le moins inventif, puis le plus rapide),
// et le plus rapide parmi ceux qui perdent au plus 15 points de précision sans inventer davantage.
function recommendModels(records, installed, valuesOf) {
  return TASKS.map((task) => {
    const candidates = installed
      .map((model) => taskMetrics(records, model, task.categories, valuesOf))
      .filter((m) => m && m.n >= MIN_ANSWERS);
    if (!candidates.length) return { task, best: null, fast: null, candidates: [] };
    const ranked = [...candidates].sort(
      (a, b) =>
        b.correct - a.correct ||
        (a.invention ?? 1) - (b.invention ?? 1) ||
        (a.medianSeconds ?? Infinity) - (b.medianSeconds ?? Infinity),
    );
    const best = ranked[0];
    const fast = ranked
      .filter(
        (m) =>
          m !== best &&
          m.correct >= best.correct - 0.15 &&
          (m.invention ?? 1) <= (best.invention ?? 0) + 0.15 &&
          m.medianSeconds != null,
      )
      .sort((a, b) => a.medianSeconds - b.medianSeconds)
      .find((m) => best.medianSeconds == null || m.medianSeconds < best.medianSeconds * 0.75);
    return {
      task,
      best,
      fast: fast || null,
      candidates: ranked,
      reliable: best.n >= RELIABLE_ANSWERS,
    };
  });
}

if (typeof module !== 'undefined')
  module.exports = { TASKS, taskById, taskMetrics, recommendModels, MIN_ANSWERS, RELIABLE_ANSWERS };
