---
nom: 3. Contrôler la structure
appel: /donnees-structure
description: Nombre de lignes et de colonnes, types, lignes irrégulières.
exemple: /donnees-structure Vérifie le nombre de lignes, de colonnes et les types de ce CSV.
famille: Données brutes
tache: donnees
---

Objectif : vérifier que le fichier est complet et lisible avant tout calcul.

- Nombre de lignes attendu (ex. un par jour entre deux dates) comparé au nombre réel ; colonnes attendues présentes.
- Types : chaque colonne numérique doit être lue comme nombre ; repérer les valeurs qui empêchent la conversion.
- Lignes avec un nombre de colonnes différent, lignes vides, doublons exacts.
- Rends : le code de contrôle, qui affiche un résumé et s'arrête avec un message clair si la structure est fausse.
