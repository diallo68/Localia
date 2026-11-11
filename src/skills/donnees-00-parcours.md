---
nom: Traiter des données brutes (parcours complet)
appel: /donnees-brutes
description: Les 9 étapes pour passer de données brutes à des données fiables et documentées.
exemple: /donnees-brutes J’ai reçu les relevés horaires de la station de Timbi-Madina : par où commencer ?
famille: Données brutes
tache: donnees
etapes: /donnees-original, /donnees-comprendre, /donnees-structure, /donnees-dates, /donnees-manquants, /donnees-aberrantes, /donnees-variables, /donnees-modele, /donnees-documenter
nom_en: Process raw data (full path)
description_en: The 9 steps from raw data to reliable, documented data.
exemple_en: /donnees-brutes I received hourly readings from the Timbi-Madina station: where do I start?
famille_en: Raw data
---

Tu accompagnes l'utilisateur, étape par étape, du fichier brut aux données prêtes pour l'analyse ou un modèle.
Commence par lui demander (ou déduis des fichiers joints) : la source des données, leur objectif, le format.
Propose ensuite un script Python unique (pandas) organisé selon les étapes ci-dessous, une section commentée par étape,
tous les seuils regroupés en constantes en haut du script. Signale les décisions qui lui reviennent.

--- en ---

You guide the user, step by step, from the raw file to data ready for analysis or a model.
Start by asking (or infer from the attached files): the data source, its purpose, the format.
Then propose a single Python script (pandas) organised according to the steps below, one commented section per step,
with all thresholds grouped as constants at the top of the script. Point out the decisions that belong to the user.
