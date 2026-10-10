// Documents FICTIFS des séries par métier : contenu inventé pour choisir le modèle de chaque
// métier, avec des pièges placés volontairement (liste dans ../metiers/PROTOCOLE-METIERS.md).
// Personnes, organismes, numéros et adresses imaginaires.
const { MENTION } = require('./documents.cjs');

const enseignement = [
  {
    titre: 'Lycée fictif de Kindia — Sciences de la vie et de la Terre, classe de seconde',
    taille: 14,
  },
  {
    texte:
      'Chapitre 3 : La photosynthèse. Document de travail de l’enseignant, M. Ibrahima Kouyaté, année 2026-2027.',
  },
  { titre: '1. Ce que les élèves doivent retenir', taille: 12 },
  {
    texte:
      'La photosynthèse est réalisée par les cellules chlorophylliennes des feuilles, à la lumière. Elle consomme du dioxyde de carbone (CO2) et de l’eau, et produit du glucose et du dioxygène (O2). L’équation bilan est : 6 CO2 + 6 H2O → C6H12O6 + 6 O2. Le glucose est ensuite stocké sous forme d’amidon, que l’on met en évidence avec l’eau iodée (coloration bleu-noir).',
  },
  {
    texte:
      'Durée prévue du chapitre : 3 séances de 55 minutes, dont une séance de travaux pratiques.',
  },
  { titre: '2. Travaux pratiques : mise en évidence de l’amidon', taille: 12 },
  {
    texte:
      'Une feuille de géranium est en partie recouverte d’un cache opaque pendant 48 heures, puis décolorée à l’alcool chaud et plongée dans l’eau iodée. Seule la partie restée à la lumière devient bleu-noir. Matériel par groupe : une plante, un cache, de l’alcool, de l’eau iodée, une plaque chauffante. La classe compte 32 élèves répartis en groupes de 4.',
  },
  { saut: true },
  { titre: '3. Évaluation : contrôle de fin de chapitre (barème)', taille: 12 },
  {
    tableau: [
      ['Exercice', 'Contenu', 'Points'],
      ['1', 'Définitions (photosynthèse, chlorophylle)', '4'],
      ['2', 'Équation bilan à compléter', '5'],
      ['3', 'Interprétation de l’expérience du cache', '6'],
      ['4', 'Schéma légendé d’une feuille', '4'],
    ],
  },
  { texte: 'Le contrôle est noté sur 20 et dure 45 minutes.' },
  { titre: '4. Copie d’élève (exercice 3, à corriger)', taille: 12 },
  {
    texte:
      'Élève : Fatoumata Bah, seconde B. Réponse : « La partie cachée ne devient pas bleue parce qu’il n’y a pas d’amidon. Il n’y a pas d’amidon parce que la feuille n’a pas eu d’eau sous le cache. »',
  },
  {
    texte:
      'Grille de l’exercice 3 : observation correcte (2 points) ; lien amidon et coloration (2 points) ; cause : absence de lumière, donc pas de photosynthèse (2 points).',
  },
];

const sante = [
  { titre: 'Centre de santé fictif de Mamou — Compte rendu de consultation', taille: 14 },
  { texte: 'Médecin : Dr Aminata Sylla. Date de la consultation : 3 septembre 2026.' },
  {
    texte:
      'Patient : Mamadou DIALLO, né le 12/03/1985, dossier IPP 2026-4471. Téléphone : +224 622 45 67 89. Adresse : 14 rue des Manguiers, Mamou.',
  },
  { titre: 'Motif et antécédents', taille: 12 },
  {
    texte:
      'Consultation pour fatigue et maux de tête depuis deux semaines. Antécédents : hypertension artérielle connue depuis 2021, traitée par amlodipine 5 mg une fois par jour. Pas d’allergie connue. Ne fume pas.',
  },
  { titre: 'Examen', taille: 12 },
  {
    tableau: [
      ['Mesure', 'Valeur'],
      ['Tension artérielle', '158/96 mmHg'],
      ['Pouls', '82 battements par minute'],
      ['Température', '36,8 °C'],
      ['Poids', '84 kg'],
      ['Taille', '1,75 m'],
    ],
  },
  { saut: true },
  { titre: 'Conclusion et conduite à tenir', taille: 12 },
  {
    texte:
      'Hypertension insuffisamment contrôlée. Augmentation de l’amlodipine à 10 mg par jour. Bilan sanguin demandé (ionogramme, créatinine). Contrôle de la tension dans 4 semaines. Conseils : réduire le sel, activité physique régulière.',
  },
  {
    texte:
      'Le patient signale qu’il prend son traitement « deux fois par jour, matin et soir » depuis le mois dernier.',
  },
  { texte: 'Prochain rendez-vous : 1er octobre 2026.' },
];

const juridique = [
  { titre: 'Contrat de prestation de services (fictif)', taille: 14 },
  {
    texte:
      'Entre la société fictive Kankan Numérique SARL, représentée par M. Sékou CAMARA, ci-après « le prestataire », et l’association fictive Jeunesse de Labé, représentée par Mme Kadiatou SOW, ci-après « le client ».',
  },
  { titre: 'Article 1 — Objet', taille: 12 },
  {
    texte: 'Le prestataire réalise le site internet de l’association et en assure la maintenance.',
  },
  { titre: 'Article 2 — Durée', taille: 12 },
  {
    texte:
      'Le contrat est conclu pour 12 mois à compter du 1er février 2026. Il est renouvelable par tacite reconduction pour la même durée, sauf résiliation notifiée par lettre recommandée au moins 2 mois avant son échéance.',
  },
  { titre: 'Article 3 — Prix', taille: 12 },
  {
    texte:
      'Le prix de la réalisation est de 6 000 000 GNF, payable en deux fois : 40 % à la signature et le solde à la mise en ligne. La maintenance est facturée 250 000 GNF par mois.',
  },
  { titre: 'Article 4 — Paiement', taille: 12 },
  {
    texte:
      'Les factures sont payables à 30 jours. Tout retard entraîne des pénalités de 0,1 % du montant dû par jour de retard.',
  },
  { saut: true },
  { titre: 'Article 5 — Modification du prix', taille: 12 },
  { texte: 'Le prestataire peut modifier le prix de la maintenance à tout moment, sans préavis.' },
  { titre: 'Article 6 — Résiliation', taille: 12 },
  {
    texte:
      'Le client ne peut résilier le contrat en cours de période qu’en versant une indemnité égale à 6 mois de maintenance.',
  },
  { titre: 'Article 7 — Paiement des factures', taille: 12 },
  { texte: 'Toute facture est payable à réception.' },
  { titre: 'Article 8 — Responsabilité', taille: 12 },
  {
    texte:
      'La responsabilité du prestataire est limitée au montant payé par le client au cours des 12 derniers mois.',
  },
  { texte: 'Fait à Labé, le 20 janvier 2026, en deux exemplaires.' },
];

const administration = [
  { titre: 'Direction préfectorale fictive de Boké — Compte rendu de réunion', taille: 14 },
  {
    texte:
      'Réunion du 6 octobre 2026, de 9 h à 11 h. Présents : M. Alpha DIALLO (directeur), Mme Hawa KEÏTA (ressources humaines), M. Ousmane SOUMAH (finances), Mme Mariama CONDÉ (informatique). Absent excusé : M. Lansana TOURÉ (logistique).',
  },
  { titre: '1. Traitement des dossiers', taille: 12 },
  {
    texte:
      'En septembre, le service a reçu 240 demandes et en a traité 180 dans le délai de 15 jours ; les autres ont été traitées hors délai. Les causes évoquées sont l’absence de deux agents et une panne du logiciel de suivi pendant 5 jours.',
  },
  { titre: '2. Décisions', taille: 12 },
  {
    texte:
      'Le budget de formation de 12 000 000 GNF est validé. Le recrutement d’un agent temporaire pour 3 mois est validé. L’achat d’un nouveau logiciel est reporté à la prochaine réunion.',
  },
  { saut: true },
  { titre: '3. Actions', taille: 12 },
  {
    tableau: [
      ['Action', 'Responsable', 'Échéance'],
      ['Planning des formations', 'Mme KEÏTA', '20 octobre 2026'],
      ['Fiche de poste de l’agent temporaire', 'Mme KEÏTA', '15 octobre 2026'],
      ['Devis de trois logiciels de suivi', 'Mme CONDÉ', '31 octobre 2026'],
      ['Point sur le budget du trimestre', 'M. SOUMAH', '3 novembre 2026'],
    ],
  },
  {
    texte:
      'Prochaine réunion : 3 novembre 2026 à 9 h. Compte rendu rédigé par Mme KEÏTA, joignable au 621 33 44 55 ou à h.keita@prefecture-boke.example.',
  },
];

const finance = [
  {
    titre: 'Association fictive Santé pour tous (Conakry) — Relevé et factures, octobre 2026',
    taille: 14,
  },
  {
    texte:
      'Compte courant no 0045-8821-77, IBAN GN12 3456 7890 1234 5678 9012 34. Titulaire : association Santé pour tous. Trésorière : Mme Néné BARRY.',
  },
  { titre: 'Relevé des opérations (en GNF)', taille: 12 },
  {
    tableau: [
      ['Date', 'Libellé', 'Débit', 'Crédit'],
      ['01/10', 'Solde initial', '', '4 500 000'],
      ['02/10', 'Loyer du local', '1 200 000', ''],
      ['05/10', 'Subvention mairie', '', '3 000 000'],
      ['08/10', 'Fournisseur Pharma Plus', '850 000', ''],
      ['09/10', 'Fournisseur Pharma Plus', '850 000', ''],
      ['15/10', 'Salaires', '2 400 000', ''],
      ['22/10', 'Électricité', '310 000', ''],
      ['31/10', 'Solde final', '2 000 000', ''],
    ],
  },
  { saut: true },
  { titre: 'Facture no F-2026-118 (Pharma Plus)', taille: 12 },
  {
    tableau: [
      ['Article', 'Quantité', 'Prix unitaire', 'Montant'],
      ['Gants (boîte)', '20', '25 000', '500 000'],
      ['Désinfectant (litre)', '10', '30 000', '300 000'],
      ['Pansements (lot)', '5', '15 000', '75 000'],
      ['Remise 5 %', '', '', '−43 750'],
      ['Total à payer', '', '', '850 000'],
    ],
  },
  { texte: 'Budget annuel prévu : 30 000 000 GNF de dépenses, dont 40 % de salaires.' },
];

const entreprise = [
  {
    titre: 'Boutique fictive Tissus de Labé — Rapport de ventes, premier semestre 2026',
    taille: 14,
  },
  {
    texte:
      'Gérante : Mme Aïssatou DIALLO. Le rapport présente les ventes mensuelles et les meilleurs produits.',
  },
  { titre: 'Ventes mensuelles (en GNF)', taille: 12 },
  {
    tableau: [
      ['Mois', 'Chiffre d’affaires', 'Nombre de clients'],
      ['Janvier', '18 000 000', '240'],
      ['Février', '15 000 000', '210'],
      ['Mars', '21 000 000', '280'],
      ['Avril', '24 000 000', '300'],
      ['Mai', '27 000 000', '330'],
      ['Juin', '30 000 000', '350'],
    ],
  },
  {
    texte:
      'Le chiffre d’affaires du semestre atteint 140 000 000 GNF. La hausse entre janvier et juin est de 50 %.',
  },
  { saut: true },
  { titre: 'Meilleurs produits', taille: 12 },
  {
    tableau: [
      ['Produit', 'Prix de vente', 'Coût d’achat', 'Unités vendues'],
      ['Pagne wax 6 yards', '150 000', '110 000', '420'],
      ['Bazin brodé', '250 000', '190 000', '160'],
      ['Foulard teint (indigo)', '40 000', '22 000', '900'],
    ],
  },
  {
    texte:
      'Objectif pour le second semestre : ouvrir une page de vente en ligne et proposer la livraison à Conakry.',
  },
];

const ingenierie = [
  { titre: 'Opérateur fictif TéléGuinée — Rapport d’incident, site relais de Pita', taille: 14 },
  {
    texte:
      'Rapport rédigé par l’ingénieur Thierno BAH, le 18 septembre 2026. Référence d’incident : INC-2026-0917.',
  },
  { titre: '1. Constat', taille: 12 },
  {
    texte:
      'Le 17 septembre 2026, le site relais de Pita a cessé d’émettre de 14 h 10 à 17 h 40. L’alarme « batteries faibles » est apparue à 13 h 55, après une coupure du réseau électrique commencée à 9 h 30.',
  },
  { titre: '2. Installation électrique du site', taille: 12 },
  {
    tableau: [
      ['Élément', 'Caractéristique'],
      ['Consommation des équipements', '1 200 W en continu'],
      ['Batteries', '8 batteries de 12 V, 200 Ah, montées en série par 4 (2 branches de 48 V)'],
      ['Panneaux solaires', '6 panneaux de 400 W'],
      ['Groupe électrogène', 'absent depuis mars 2026 (en réparation)'],
    ],
  },
  { saut: true },
  { titre: '3. Analyse', taille: 12 },
  {
    texte:
      'Énergie stockée théorique : 2 branches × 48 V × 200 Ah = 19 200 Wh. Avec une profondeur de décharge limitée à 50 %, l’énergie utilisable est de 9 600 Wh, soit environ 8 heures d’autonomie à 1 200 W. La coupure ayant duré plus de 4 heures avant l’arrêt, les batteries auraient dû tenir ; leur état (âge : 5 ans) est mis en cause.',
  },
  { titre: '4. Actions', taille: 12 },
  {
    texte:
      'Remplacement des batteries prévu en octobre ; remise en service du groupe électrogène ; ajout d’une alarme de niveau à 60 %.',
  },
];

const communication = [
  { titre: 'Agence fictive Infos Guinée — Dépêche et interview', taille: 14 },
  { titre: 'Dépêche du 2 octobre 2026', taille: 12 },
  {
    texte:
      'Labé — La nouvelle bibliothèque municipale de Labé a ouvert ses portes le 1er octobre 2026. Elle compte 3 000 livres et 12 ordinateurs, et l’entrée est gratuite. Le projet a coûté 900 millions de GNF, financés à 60 % par la commune et à 40 % par une fondation privée. Le maire, M. Elhadj Boubacar BALDÉ, a annoncé l’ouverture d’une seconde bibliothèque à Mali en 2027.',
  },
  { titre: 'Interview de la directrice', taille: 12 },
  {
    texte:
      'Question : Combien de lecteurs attendez-vous ? Réponse de Mme Djénabou SOW, directrice : « Nous espérons accueillir 200 lecteurs par jour. Les élèves seront prioritaires l’après-midi, de 14 h à 18 h. Nous manquons encore de livres en langues nationales, c’est notre premier défi. »',
  },
  { saut: true },
  { titre: 'Chiffres communiqués par la mairie', taille: 12 },
  {
    tableau: [
      ['Élément', 'Valeur'],
      ['Livres', '3 000'],
      ['Ordinateurs', '12'],
      ['Coût total', '900 000 000 GNF'],
      ['Part de la commune', '60 %'],
      ['Inscrits la première semaine', '450'],
    ],
  },
  {
    texte: 'Une publication de la mairie sur les réseaux sociaux annonce « plus de 5 000 livres ».',
  },
];

// Recherche : article soumis. Pièges : effectif 412 (résumé) / 389 (méthode) ; F1 du modèle A
// faux (0,78 au lieu de 0,75) ; modèle B retenu alors que C a le meilleur F1 ; conclusion causale
// tirée d'une étude d'observation ; code et données non disponibles.
const recherche = [
  { titre: 'Revue fictive de phytopathologie ouest-africaine — Article soumis', taille: 14 },
  {
    titre:
      'Prévision précoce du mildiou de la pomme de terre au Fouta-Djalon par apprentissage automatique',
    taille: 12,
  },
  {
    texte:
      'Mariama SOW et Ousmane BARRY, Université fictive de Labé. Manuscrit reçu le 2 septembre 2026.',
  },
  { titre: 'Résumé', taille: 12 },
  {
    texte:
      'Nous comparons trois modèles de prévision du mildiou sur 412 parcelles suivies en 2024 et 2025 à Timbi-Madina et à Dalaba. Le modèle B obtient le meilleur score F1 (0,81) et permet une alerte 5 jours avant l’apparition des symptômes.',
  },
  { titre: '1. Données et méthode', taille: 12 },
  {
    texte:
      '389 parcelles ont été suivies de juin à septembre, en 2024 et en 2025. Variables : température horaire, humidité relative, pluie et heures d’humectation estimées à partir de l’humidité. Les données sont découpées dans l’ordre du temps : 2024 pour l’entraînement, 2025 pour le test. Un jour est dit « positif » si des symptômes apparaissent dans les 7 jours suivants.',
  },
  { saut: true },
  { titre: '2. Résultats', taille: 12 },
  {
    tableau: [
      ['Modèle', 'Précision', 'Rappel', 'F1'],
      ['A : régression logistique', '0,80', '0,70', '0,78'],
      ['B : forêt aléatoire', '0,83', '0,79', '0,81'],
      ['C : réseau de neurones LSTM', '0,86', '0,82', '0,84'],
    ],
  },
  {
    texte:
      'Le modèle B est retenu comme le plus performant. En moyenne, l’alerte précède les premiers symptômes de 5 jours (écart-type : 2 jours).',
  },
  { titre: '3. Conclusion', taille: 12 },
  {
    texte:
      'Une humidité relative supérieure à 90 % pendant plus de 10 heures est la cause principale des épidémies observées. Les services agricoles peuvent s’appuyer sur le modèle B pour déclencher les traitements.',
  },
];

// Codage : ticket et revue de code. Pièges : int() tronque les kilos « entamés » (12,3 kg doit
// coûter 7 400 GNF) ; le test 3 valide ce défaut ; le test 4 est faux (500 000 GNF ne « dépasse »
// pas 500 000) et la correction proposée (>=) contredit la spécification ; version de Python absente.
const codage = [
  { titre: 'Projet fictif BoutiqueLabé — Ticket LOC-142 : frais de livraison', taille: 14 },
  { texte: 'Ticket ouvert par Fatoumata CISSÉ le 30 septembre 2026, développeur : Alpha DIALLO.' },
  { titre: '1. Spécification', taille: 12 },
  {
    texte:
      'Frais de livraison : 5 000 GNF par commande jusqu’à 10 kg. Au-delà, 800 GNF par kilogramme supplémentaire entamé. La livraison est gratuite si le montant de la commande dépasse 500 000 GNF.',
  },
  { titre: '2. Code proposé (Python)', taille: 12 },
  {
    code: [
      'def frais_livraison(poids_kg, montant):',
      '    if montant > 500000:',
      '        return 0',
      '    if poids_kg <= 10:',
      '        return 5000',
      '    supplement = int(poids_kg - 10) * 800',
      '    return 5000 + supplement',
    ].join('\n'),
  },
  { saut: true },
  { titre: '3. Tests', taille: 12 },
  {
    tableau: [
      ['Test', 'Poids', 'Montant (GNF)', 'Attendu', 'Obtenu', 'Résultat'],
      ['1', '8 kg', '100 000', '5 000', '5 000', 'réussi'],
      ['2', '12 kg', '200 000', '6 600', '6 600', 'réussi'],
      ['3', '12,3 kg', '200 000', '6 600', '6 600', 'réussi'],
      ['4', '15 kg', '500 000', '0', '9 000', 'échec'],
    ],
  },
  { titre: '4. Commentaire du développeur', taille: 12 },
  {
    texte:
      'Tous les tests passent sauf le test 4. Je propose de remplacer « montant > 500000 » par « montant >= 500000 » pour le corriger, puis de fusionner aujourd’hui.',
  },
];

// Télécommunications : étude de liaison hertzienne. Pièges : affaiblissement en espace libre de
// 131 dB au lieu d'environ 141 dB, donc niveau reçu et marge faux ; 99,99 % de disponibilité
// converti en 5 min par an au lieu de 52,6 min ; hauteur des pylônes absente.
const telecom = [
  { titre: 'Opérateur fictif TéléGuinée — Étude de liaison hertzienne Labé–Pita', taille: 14 },
  {
    texte:
      'Étude rédigée par l’ingénieure Kadiatou BALDÉ, le 25 septembre 2026. Référence : LH-2026-031.',
  },
  { titre: '1. Paramètres de la liaison', taille: 12 },
  {
    tableau: [
      ['Paramètre', 'Valeur'],
      ['Fréquence', '7 GHz'],
      ['Distance', '38 km'],
      ['Puissance d’émission', '30 dBm'],
      ['Gain de l’antenne d’émission', '34 dBi'],
      ['Gain de l’antenne de réception', '34 dBi'],
      ['Pertes des câbles et connecteurs', '2 dB de chaque côté'],
      ['Seuil de réception (155 Mbit/s)', '-75 dBm'],
    ],
  },
  { saut: true },
  { titre: '2. Bilan de liaison', taille: 12 },
  {
    texte:
      'Affaiblissement en espace libre (formule : 92,45 + 20 log10(d en km) + 20 log10(f en GHz)) : 131 dB. Niveau reçu : 30 + 34 + 34 - 4 - 131 = -37 dBm. Marge par rapport au seuil : 38 dB, largement suffisante.',
  },
  { titre: '3. Disponibilité', taille: 12 },
  {
    texte:
      'L’objectif de disponibilité est de 99,99 %, soit environ 5 minutes d’indisponibilité par an. La liaison doit entrer en service en janvier 2027.',
  },
];

const cybersecurite = [
  {
    titre: 'Banque rurale fictive du Fouta — Rapport d’audit de sécurité informatique',
    taille: 14,
  },
  {
    texte:
      'Audit réalisé par le cabinet fictif SécuNimba (auditeur : Thierno SOUMAH) du 22 au 26 septembre 2026. Référence : AUD-2026-014. Périmètre : siège de Labé et agence de Pita.',
  },
  { titre: 'Résumé', taille: 12 },
  {
    texte:
      'L’audit a relevé 4 vulnérabilités, dont 3 critiques. Le niveau de gravité suit l’échelle CVSS 3.1 : Faible de 0,1 à 3,9 ; Moyen de 4,0 à 6,9 ; Élevé de 7,0 à 8,9 ; Critique de 9,0 à 10.',
  },
  { titre: '1. Vulnérabilités relevées', taille: 12 },
  {
    tableau: [
      ['N°', 'Description', 'CVSS', 'Niveau'],
      ['V1', 'Serveur web Apache 2.4.49 exposé (CVE-2021-41773)', '7,5', 'Élevé'],
      ['V2', 'Mots de passe stockés en MD5 sans sel', '6,5', 'Faible'],
      [
        'V3',
        'Bureau à distance (RDP, port 3389) ouvert sur Internet, sans double authentification',
        '9,8',
        'Critique',
      ],
      ['V4', 'Certificat TLS du site expiré', '5,3', 'Moyen'],
    ],
  },
  { saut: true },
  { titre: '2. Politique de mots de passe', taille: 12 },
  {
    texte:
      'Les mots de passe des employés comptent 8 caractères, uniquement des chiffres, soit 1 milliard de combinaisons possibles. Une seule carte graphique teste environ 10 milliards de mots de passe MD5 par seconde : il faudrait donc plusieurs années pour tous les essayer, ce qui reste acceptable.',
  },
  { titre: '3. Plan d’action proposé', taille: 12 },
  {
    texte:
      'Corriger V3 dans les 30 jours, puis V1, V2 et V4 avant la fin de l’année 2026. Un nouvel audit est prévu en mars 2027.',
  },
];

const documentsMetiers = [
  { fichier: 'doc-enseignement-cours-photosynthese.pdf', blocs: enseignement },
  { fichier: 'doc-sante-compte-rendu.pdf', blocs: sante },
  { fichier: 'doc-juridique-contrat.pdf', blocs: juridique },
  { fichier: 'doc-administration-compte-rendu.pdf', blocs: administration },
  { fichier: 'doc-finance-releve-factures.pdf', blocs: finance },
  { fichier: 'doc-entreprise-ventes.pdf', blocs: entreprise },
  { fichier: 'doc-ingenierie-incident.pdf', blocs: ingenierie },
  { fichier: 'doc-communication-depeche.pdf', blocs: communication },
  { fichier: 'doc-recherche-article.pdf', blocs: recherche },
  { fichier: 'doc-codage-ticket.pdf', blocs: codage },
  { fichier: 'doc-telecom-liaison.pdf', blocs: telecom },
  { fichier: 'doc-cybersecurite-audit.pdf', blocs: cybersecurite },
];

module.exports = { MENTION, documentsMetiers };
