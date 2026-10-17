# 14 — Viser le régime « sans réflexion » (idée de Claude)

**Statut** : contrainte de conception retenue.

## Constat (calculé et mesuré)
- À 7-10 jetons/s (mesures de vitesse), un raisonnement de 1 000 jetons coûte 100 à 140 secondes avant la réponse : inutilisable dans Localia.
- Les scores publiés des petits Qwen3.5 sont surtout obtenus **avec réflexion** (sorties jusqu'à 32 768 jetons). Sans réflexion, ils chutent : pour le 2B, IFEval passe de 78,6 à 61,2 et MMLU-Pro de 66,5 à 55,3 (fiche officielle).

## Hypothèse
Notre avantage mesurable se situe dans le régime réellement utilisable : **budget de réponse limité (≤ 400 jetons, sans réflexion)**. Dans ce régime, distiller des réponses directes et justes d'un professeur qui, lui, a réfléchi (on ne garde que la réponse finale vérifiée) peut faire gagner plus qu'ailleurs.

## Conséquence pour l'évaluation
Tous les modèles, y compris les gros, sont comparés **à budget de jetons égal** (sans réflexion, ou réflexion plafonnée), et on publie aussi les résultats avec réflexion pour être complet. Comparer notre 4B sans réflexion à un 24B sans réflexion est équitable. Comparer à un 24B avec réflexion sera montré séparément.

## Avocat du diable
Choisir le régime où l'on gagne peut ressembler à un choix de terrain favorable. Parade : c'est le régime imposé par la machine cible (5 jetons/s minimum), et on le justifie par le temps de réponse mesuré.

## Décision
Retenu comme règle de l'évaluation et objectif de l'entraînement.
