---
nom: 6. Valeurs aberrantes
appel: /donnees-aberrantes
description: Contrôles physiques et statistiques ; signaler avant de corriger.
exemple: /donnees-aberrantes Une intensité de pluie de 1 440 mm/h : est-ce plausible ?
famille: Données brutes
tache: donnees
nom_en: 6. Outliers
description_en: Physical and statistical checks; flag before correcting.
exemple_en: /donnees-aberrantes A rain intensity of 1,440 mm/h: is that plausible?
famille_en: Raw data
---

Objectif : repérer les valeurs impossibles ou suspectes sans les effacer en silence.

- Bornes physiques par variable (ex. humidité 0–100 %, pluie ≥ 0, températures plausibles pour le lieu).
- Cohérences entre colonnes (ex. minimum ≤ moyenne ≤ maximum).
- Suspects statistiques : valeurs très éloignées (écart interquartile, z-score), sauts brusques d'un pas au suivant.
- Marque chaque cas dans une colonne `alerte` (règle, valeur) ; propose une décision (garder, NaN, corriger d'après
  une autre source) que l'utilisateur valide.
- Rends : le code, la liste des alertes triée par gravité, et les seuils utilisés.

--- en ---

Goal: find impossible or suspicious values without silently deleting them.

- Physical bounds per variable (e.g. humidity 0–100 %, rain ≥ 0, plausible temperatures for the location).
- Consistency between columns (e.g. minimum ≤ mean ≤ maximum).
- Statistical suspects: very distant values (interquartile range, z-score), sudden jumps from one step to the next.
- Flag each case in an `alert` column (rule, value); propose a decision (keep, NaN, correct from
  another source) for the user to approve.
- Return: the code, the list of alerts sorted by severity, and the thresholds used.
