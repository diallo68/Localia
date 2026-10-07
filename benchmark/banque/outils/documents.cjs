// Documents FICTIFS de la banque de questions : contenu inventé pour le banc d'essai, avec des
// incohérences placées volontairement (liste dans ../PROTOCOLE.md). Lieux réels, organismes,
// personnes et références imaginaires.
const MENTION = 'Document fictif créé pour le banc d’essai Localia';

const rapport = [
  {
    titre: 'Rapport de campagne 2025 : suivi du mildiou de la pomme de terre à Dalaba (Guinée)',
    taille: 15,
  },
  {
    texte:
      'Station expérimentale fictive de Dalaba (SEFD) — équipe : A. Barry, F. Camara, M. Sow. Rapport interne no 2025-07, version du 14 octobre 2025.',
  },
  { titre: 'Résumé', taille: 12 },
  {
    texte:
      'Entre le 2 juin et le 29 septembre 2025, l’équipe a suivi 4 parcelles de pomme de terre à Dalaba pour mesurer l’apparition et la progression du mildiou (Phytophthora infestans) selon la variété et la protection fongicide. L’incidence moyenne finale atteint 38 % des plants. Les parcelles protégées ont produit en moyenne 19,8 t/ha contre 11,1 t/ha pour les parcelles non protégées. La saison a été très humide, avec 50 jours favorables à la maladie.',
  },
  { titre: '1. Contexte', taille: 12 },
  {
    texte:
      'Le plateau du Fouta Djalon est la principale zone de production de pomme de terre de Guinée. Les producteurs signalent des pertes importantes pendant la saison des pluies, de juin à octobre. Ce rapport décrit la campagne de suivi de 2025, première année d’un programme prévu sur trois ans.',
  },
  { saut: true },
  { titre: '2. Matériel et méthodes', taille: 12 },
  {
    texte:
      'Cinq parcelles de 400 m² (P1 à P5) ont été plantées le 2 juin 2025 sur le site de la station, à 1 180 m d’altitude. Deux variétés ont été utilisées : Spunta (P1, P2, P5) et Pamina (P3, P4). Les parcelles P1 et P3 ont reçu une protection fongicide complète tous les 10 jours ; P5 a reçu une protection réduite (tous les 20 jours) ; P2 et P4 n’ont pas été traitées.',
  },
  {
    texte:
      'Les observations ont eu lieu chaque semaine, du 2 juin au 29 septembre, soit 18 passages. À chaque passage, 100 plants par parcelle ont été examinés ; un plant est compté malade dès qu’une lésion est visible. L’incidence est le pourcentage de plants malades.',
  },
  {
    texte:
      'Une station météorologique installée au centre du site mesure la température et l’humidité relative à 2 m (capteur SHT31) toutes les 30 minutes, ainsi que la pluie (pluviomètre à auget). Un jour est dit favorable au mildiou lorsque l’humidité relative dépasse 90 % pendant au moins 10 heures et que la température moyenne reste comprise entre 10 et 25 °C.',
  },
  { saut: true },
  { titre: '3. Résultats', taille: 12 },
  { titre: '3.1 Conditions météorologiques', taille: 11 },
  {
    texte:
      'Le tableau 1 résume les conditions mensuelles. Le cumul de pluie de la saison atteint 1 487 mm. Août a été le mois le plus humide et le plus favorable à la maladie.',
  },
  {
    texte: 'Tableau 1. Conditions météorologiques mensuelles à la station (juin à septembre 2025).',
  },
  {
    tableau: [
      ['Mois', 'T moyenne (°C)', 'HR moyenne (%)', 'Pluie (mm)', 'Jours favorables'],
      ['Juin', '22,4', '84', '241', '6'],
      ['Juillet', '21,1', '91', '389', '14'],
      ['Août', '20,8', '93', '455', '19'],
      ['Septembre', '21,6', '88', '302', '11'],
    ],
  },
  {
    texte:
      'Au total, 50 jours favorables ont été enregistrés, dont plus des deux tiers en juillet et en août.',
  },
  { saut: true },
  { titre: '3.2 Maladie et rendement', taille: 11 },
  {
    texte:
      'Le tableau 2 donne, pour chaque parcelle, la date du premier symptôme, l’incidence finale (passage du 29 septembre) et le rendement en tubercules.',
  },
  { texte: 'Tableau 2. Mildiou et rendement par parcelle.' },
  {
    tableau: [
      [
        'Parcelle',
        'Variété',
        'Protection',
        'Premier symptôme',
        'Incidence finale',
        'Rendement (t/ha)',
      ],
      ['P1', 'Spunta', 'complète', '29 juillet', '22 %', '18,4'],
      ['P2', 'Spunta', 'aucune', '8 juillet', '61 %', '9,7'],
      ['P3', 'Pamina', 'complète', '5 août', '15 %', '21,2'],
      ['P4', 'Pamina', 'aucune', '15 juillet', '47 %', '12,5'],
      ['P5', 'Spunta', 'réduite', '15 juillet', '60 %', '14,0'],
    ],
  },
  {
    texte:
      'Les parcelles traitées ont un rendement moyen de 19,8 t/ha. La variété Pamina résiste mieux que Spunta : à protection égale, son incidence finale est plus faible et son rendement plus élevé.',
  },
  { saut: true },
  { titre: '4. Discussion et recommandations', taille: 12 },
  {
    texte:
      'Le premier symptôme est apparu sur P2, 36 jours après la plantation, au début de la période la plus humide. La protection réduite de P5 n’a pas suffi : son incidence finale est presque celle d’une parcelle non traitée. La parcelle P1 a produit 18,4 kg/ha, ce qui confirme l’intérêt d’une protection régulière.',
  },
  {
    texte:
      'Recommandations pour 2026 : (1) commencer la protection dès la plantation pendant la saison des pluies ; (2) préférer la variété Pamina ; (3) utiliser l’indicateur de jours favorables pour décider des traitements, avec une alerte dès 3 jours favorables consécutifs ; (4) ajouter une seconde station météorologique pour vérifier les mesures de pluie.',
  },
  {
    texte:
      'Limites : une seule saison, un seul site, et des parcelles non répétées ; les différences entre variétés et protections doivent être confirmées les années suivantes.',
  },
];

const article = [
  {
    titre:
      'Prévision du risque de mildiou à partir de données météorologiques journalières : comparaison de trois modèles',
    taille: 14,
  },
  {
    texte:
      'K. Diakité, R. Sow et L. Bah — Institut fictif d’agronomie numérique de Labé. Article de démonstration.',
  },
  { titre: 'Résumé', taille: 12 },
  {
    texte:
      'Nous comparons trois modèles de prévision du risque de mildiou à J+3 à partir de données météorologiques journalières de Dalaba (Guinée) couvrant la période 2013 à 2023 : une régression logistique, une forêt aléatoire et un réseau LSTM. Le LSTM obtient la meilleure précision, mais la forêt aléatoire offre le meilleur compromis entre performance et simplicité. Les modèles pourraient alimenter un service d’alerte par SMS pour les producteurs.',
  },
  { titre: '1. Introduction', taille: 12 },
  {
    texte:
      'Le mildiou de la pomme de terre provoque des pertes importantes dans les zones humides d’altitude [1]. Les premiers systèmes d’alerte reposaient sur des règles fixées à partir de la température et de l’humidité, comme celles proposées par Camara [2] ou par Diallo et Baldé [3]. Plus récemment, des méthodes d’apprentissage automatique ont été appliquées à des données météorologiques [4, 5] et à des images de feuilles [6]. Traoré [7] a montré l’intérêt des réseaux récurrents pour des séries météorologiques courtes. En Guinée, aucune comparaison de ces approches n’a encore été publiée.',
  },
  { saut: true },
  { titre: '2. Données et méthodes', taille: 12 },
  {
    texte:
      'Les données journalières (température moyenne, minimale et maximale, humidité relative, précipitations) proviennent d’une station de Dalaba et couvrent du 1er janvier 2014 au 31 décembre 2023, soit 3 652 jours. Un jour est dit « à risque » si au moins un nouveau foyer de mildiou a été observé dans les trois jours suivants dans le réseau de parcelles de suivi ; 18 % des jours sont à risque.',
  },
  {
    texte:
      'Les modèles ont été entraînés sur 2014 à 2020 (2 557 jours) et évalués sur 2021 à 2023 (1 095 jours). Les variables d’entrée sont les valeurs des 7 derniers jours. Le LSTM comporte une couche de 64 unités ; la forêt aléatoire compte 300 arbres. Les performances sont mesurées par la précision, le rappel et le score F1 sur la classe « à risque ». La figure 1 montre la série d’humidité relative et la figure 2 la répartition mensuelle des jours à risque.',
  },
  { saut: true },
  { titre: '3. Résultats', taille: 12 },
  { texte: 'Tableau 1. Performances sur la période de test (2021–2023), classe « à risque ».' },
  {
    tableau: [
      ['Modèle', 'Précision', 'Rappel', 'F1'],
      ['Régression logistique', '0,71', '0,64', '0,67'],
      ['Forêt aléatoire', '0,78', '0,70', '0,74'],
      ['LSTM', '0,82', '0,69', '0,75'],
    ],
  },
  {
    texte:
      'Le LSTM obtient le meilleur F1 (0,79) et la meilleure précision. La forêt aléatoire a le meilleur rappel. Les erreurs du LSTM se concentrent en début de saison des pluies (voir figure 4). L’entraînement du LSTM dure 14 minutes contre 40 secondes pour la forêt aléatoire, sur le même ordinateur portable.',
  },
  { saut: true },
  { titre: '4. Discussion', taille: 12 },
  {
    texte:
      'L’écart de F1 entre le LSTM et la forêt aléatoire est faible au regard de la différence de complexité et de temps d’entraînement. Pour un service d’alerte, un rappel élevé importe davantage, car une alerte manquée coûte plus cher qu’une fausse alerte. Comme le soulignent Bah et Kouyaté [7], la qualité des observations de terrain limite la performance de tous les modèles.',
  },
  {
    texte:
      'Limites : un seul site, une seule source de données météorologiques, et une définition du « jour à risque » qui dépend de l’effort d’observation sur le terrain.',
  },
  { titre: '5. Conclusion', taille: 12 },
  {
    texte:
      'Les trois modèles prévoient le risque de mildiou avec une performance utile ; la forêt aléatoire est recommandée pour un premier service d’alerte, plus simple à maintenir.',
  },
  { saut: true },
  { titre: 'Références', taille: 12 },
  {
    texte:
      '[1] A. Keïta, « Le mildiou en Afrique de l’Ouest », Revue fictive d’agronomie, vol. 3, pp. 1–12, 2015.',
  },
  {
    texte:
      '[2] S. Camara, « Règles d’alerte pour le mildiou en altitude », Bulletin fictif de phytopathologie, vol. 8, pp. 44–51, 2009.',
  },
  {
    texte:
      '[3] M. Diallo et T. Baldé, « Un indice climatique du mildiou », Cahiers fictifs du Fouta, vol. 2, pp. 17–25, 2012.',
  },
  {
    texte:
      '[4] F. Sylla et al., « Apprentissage automatique et maladies des cultures », Journal fictif des données agricoles, vol. 5, pp. 101–118, 2019.',
  },
  {
    texte:
      '[5] H. Condé, « Forêts aléatoires pour la prévision des épidémies », Actes fictifs du colloque de Conakry, pp. 33–40, 2020.',
  },
  {
    texte:
      '[6] N. Barry, « Reconnaissance d’images de feuilles malades », Revue fictive de vision numérique, vol. 1, pp. 9–20, 2021.',
  },
  {
    texte:
      '[7] L. Bah et D. Kouyaté, « Qualité des observations de terrain », Notes fictives de l’IFAN, vol. 4, pp. 60–66, 2022.',
  },
];

const note = [
  {
    titre:
      'Note technique : chaîne de traitement des données météorologiques de la station de Dalaba',
    taille: 14,
  },
  { texte: 'Station expérimentale fictive de Dalaba (SEFD) — note no NT-03, mars 2025.' },
  { titre: '1. Objet', taille: 12 },
  {
    texte:
      'Cette note décrit comment les mesures de la station sont collectées, contrôlées et mises à disposition des équipes. Elle s’adresse aux techniciens et aux chercheurs qui utilisent les fichiers produits.',
  },
  { titre: '2. Capteurs', taille: 12 },
  {
    texte:
      'Température et humidité relative : capteur SHT31 sous abri ventilé, à 2 m du sol ; précision annoncée ±0,3 °C et ±2 % d’humidité relative. Pluie : pluviomètre à auget de 0,2 mm par basculement. Vent : anémomètre à coupelles à 2 m. Les mesures sont enregistrées toutes les 30 minutes par un enregistreur alimenté par un panneau solaire de 20 W et une batterie de 12 V.',
  },
  { titre: '3. Collecte', taille: 12 },
  {
    texte:
      'Les données sont transmises chaque nuit à 2 h par le réseau mobile vers un serveur de la station. En cas d’échec, l’enregistreur garde jusqu’à 60 jours de mesures. Un technicien vérifie chaque lundi l’état des capteurs et nettoie le pluviomètre.',
  },
  { saut: true },
  { titre: '4. Contrôles de qualité', taille: 12 },
  {
    texte:
      'Quatre contrôles automatiques sont appliqués : (1) bornes physiques (température entre 0 et 45 °C, humidité entre 0 et 100 %, pluie entre 0 et 80 mm par demi-heure) ; (2) variation maximale de 5 °C entre deux mesures successives de température ; (3) valeur constante pendant plus de 6 heures, signe d’un capteur bloqué ; (4) cohérence entre pluie et humidité (pluie sans hausse d’humidité signalée). Les valeurs rejetées sont remplacées par une valeur manquante et listées dans un journal ; elles ne sont jamais corrigées automatiquement.',
  },
  { titre: '5. Fichiers produits', taille: 12 },
  {
    texte:
      'Deux fichiers CSV sont produits chaque jour : les mesures à 30 minutes (colonnes date_heure, temperature, humidite, pluie, vent) et les valeurs journalières (moyenne, minimum et maximum de température et d’humidité, cumul de pluie, nombre d’heures d’humidité supérieure à 90 %). Une journée n’est calculée que si au moins 40 des 48 mesures sont valides ; sinon ses valeurs sont manquantes.',
  },
  { titre: '6. Limites connues', taille: 12 },
  {
    texte:
      'Le pluviomètre sous-estime les pluies très intenses (au-delà de 50 mm par heure). Le capteur d’humidité dérive avec le temps : il doit être comparé chaque année à un capteur de référence et remplacé tous les deux ans.',
  },
];

module.exports = {
  MENTION,
  documents: [
    { fichier: 'doc-A-rapport-campagne-dalaba-2025.pdf', blocs: rapport },
    { fichier: 'doc-B-article-prevision-mildiou.pdf', blocs: article },
    { fichier: 'doc-C-note-technique-donnees-meteo.pdf', blocs: note },
  ],
};
