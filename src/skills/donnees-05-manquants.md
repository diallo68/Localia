---
nom: 5. Valeurs manquantes
appel: /donnees-manquants
description: Repérer, compter et traiter les manquants, avec des règles écrites.
exemple: /donnees-manquants 17 heures manquent dans la série : comment les traiter ?
famille: Données brutes
tache: donnees
nom_en: 5. Missing values
description_en: Find, count and handle missing values, with written rules.
exemple_en: /donnees-manquants 17 hours are missing in the series: how should I handle them?
famille_en: Raw data
---

Objectif : traiter les manquants de façon explicite et justifiable.

- Remplace les codes de manquants (-999, -9999, vides, NA) par NaN.
- Compte les manquants par variable et par période (année, mois) ; montre les plus longues séquences.
- Propose une règle par type de variable et laisse l'utilisateur décider :
  variables continues (température…) : interpolation seulement pour les trous courts (constante, ex. 3 pas) ;
  cumuls et événements (pluie, comptages) : pas d'interpolation, un manque n'est pas un zéro ;
  trous longs : exclusion de la période.
- Garde une colonne indiquant les valeurs comblées.
- Rends : le code, le tableau des manquants et les règles appliquées.

--- en ---

Goal: handle missing values explicitly and in a justifiable way.

- Replace missing-value codes (-999, -9999, empty, NA) with NaN.
- Count missing values per variable and per period (year, month); show the longest gaps.
- Propose a rule per type of variable and let the user decide:
  continuous variables (temperature…): interpolation only for short gaps (a constant, e.g. 3 steps);
  totals and events (rain, counts): no interpolation, a missing value is not a zero;
  long gaps: exclude the period.
- Keep a column flagging the filled values.
- Return: the code, the table of missing values and the rules applied.
