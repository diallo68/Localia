---
nom: 3. Contrôler la structure
appel: /donnees-structure
description: Nombre de lignes et de colonnes, types, lignes irrégulières.
exemple: /donnees-structure Vérifie le nombre de lignes, de colonnes et les types de ce CSV.
famille: Données brutes
tache: donnees
nom_en: 3. Check the structure
description_en: Number of rows and columns, types, irregular rows.
exemple_en: /donnees-structure Check the number of rows, columns and the types of this CSV.
famille_en: Raw data
---

Objectif : vérifier que le fichier est complet et lisible avant tout calcul.

- Nombre de lignes attendu (ex. un par jour entre deux dates) comparé au nombre réel ; colonnes attendues présentes.
- Types : chaque colonne numérique doit être lue comme nombre ; repérer les valeurs qui empêchent la conversion.
- Lignes avec un nombre de colonnes différent, lignes vides, doublons exacts.
- Rends : le code de contrôle, qui affiche un résumé et s'arrête avec un message clair si la structure est fausse.

--- en ---

Goal: check that the file is complete and readable before any calculation.

- Expected number of rows (e.g. one per day between two dates) compared with the actual number; expected columns present.
- Types: each numeric column must be read as a number; find the values that prevent conversion.
- Rows with a different number of columns, empty rows, exact duplicates.
- Return: the checking code, which prints a summary and stops with a clear message if the structure is wrong.
