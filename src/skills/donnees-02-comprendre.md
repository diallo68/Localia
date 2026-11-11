---
nom: 2. Comprendre le fichier
appel: /donnees-comprendre
description: Lire l’en-tête, le format et écrire le dictionnaire des données.
exemple: /donnees-comprendre Écris le dictionnaire des données de ce fichier de station Davis.
famille: Données brutes
tache: donnees
nom_en: 2. Understand the file
description_en: Read the header and format, and write the data dictionary.
exemple_en: /donnees-comprendre Write the data dictionary for this Davis station file.
famille_en: Raw data
---

Objectif : savoir ce que contient chaque colonne avant de toucher aux valeurs.

- Identifie : lignes d'en-tête à sauter, séparateur, décimale, encodage, fuseau horaire, valeur des manquants (-999, vide, NA…).
- Dictionnaire des données, en tableau : colonne, signification, unité, type attendu, plage plausible, source de l'information
  (en-tête du fichier, documentation, ou « à confirmer »).
- N'invente pas la signification d'une colonne : écris « à confirmer » et pose la question.
- Rends : le dictionnaire, et le code de lecture correct (`read_csv` avec les bons paramètres).

--- en ---

Goal: know what each column contains before touching the values.

- Identify: header lines to skip, separator, decimal mark, encoding, time zone, missing-value code (-999, empty, NA…).
- Data dictionary, as a table: column, meaning, unit, expected type, plausible range, source of the information
  (file header, documentation, or “to be confirmed”).
- Do not invent the meaning of a column: write “to be confirmed” and ask.
- Return: the dictionary, and the correct reading code (`read_csv` with the right parameters).
