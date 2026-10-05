---
nom: 5. Valeurs manquantes
appel: /donnees-manquants
description: Repérer, compter et traiter les manquants, avec des règles écrites.
famille: Données brutes
tache: donnees
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
