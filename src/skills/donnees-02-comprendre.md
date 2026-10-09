---
nom: 2. Comprendre le fichier
appel: /donnees-comprendre
description: Lire l’en-tête, le format et écrire le dictionnaire des données.
exemple: /donnees-comprendre Écris le dictionnaire des données de ce fichier de station Davis.
famille: Données brutes
tache: donnees
---

Objectif : savoir ce que contient chaque colonne avant de toucher aux valeurs.

- Identifie : lignes d'en-tête à sauter, séparateur, décimale, encodage, fuseau horaire, valeur des manquants (-999, vide, NA…).
- Dictionnaire des données, en tableau : colonne, signification, unité, type attendu, plage plausible, source de l'information
  (en-tête du fichier, documentation, ou « à confirmer »).
- N'invente pas la signification d'une colonne : écris « à confirmer » et pose la question.
- Rends : le dictionnaire, et le code de lecture correct (`read_csv` avec les bons paramètres).
