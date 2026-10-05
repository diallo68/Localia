---
nom: 6. Valeurs aberrantes
appel: /donnees-aberrantes
description: Contrôles physiques et statistiques ; signaler avant de corriger.
famille: Données brutes
tache: donnees
---

Objectif : repérer les valeurs impossibles ou suspectes sans les effacer en silence.

- Bornes physiques par variable (ex. humidité 0–100 %, pluie ≥ 0, températures plausibles pour le lieu).
- Cohérences entre colonnes (ex. minimum ≤ moyenne ≤ maximum).
- Suspects statistiques : valeurs très éloignées (écart interquartile, z-score), sauts brusques d'un pas au suivant.
- Marque chaque cas dans une colonne `alerte` (règle, valeur) ; propose une décision (garder, NaN, corriger d'après
  une autre source) que l'utilisateur valide.
- Rends : le code, la liste des alertes triée par gravité, et les seuils utilisés.
