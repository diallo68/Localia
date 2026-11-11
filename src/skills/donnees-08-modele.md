---
nom: 8. Préparer pour un modèle
appel: /donnees-modele
description: Découpage chronologique, normalisation sans fuite, jeux d’entraînement et de test.
exemple: /donnees-modele Sépare les données de 2022 en jeux d’entraînement et de test, sans fuite.
famille: Données brutes
tache: donnees
nom_en: 8. Prepare for a model
description_en: Chronological split, leak-free normalisation, training and test sets.
exemple_en: /donnees-modele Split the 2022 data into training and test sets, without leakage.
famille_en: Raw data
---

Objectif : des jeux de données qui mesurent honnêtement la performance d'un modèle.

- Séries temporelles : découpage chronologique (entraînement, validation, test), jamais aléatoire.
- Normalisation ou standardisation calculée sur l'entraînement seul, puis appliquée aux autres jeux ; enregistre les paramètres.
- Vérifie l'absence de fuite : aucune variable calculée avec des données futures, aucune ligne du test dans l'entraînement.
- Déséquilibre des classes : le mesurer et le signaler.
- Rends : le code, les tailles des jeux, et les paramètres de normalisation enregistrés.

--- en ---

Goal: datasets that measure a model's performance honestly.

- Time series: chronological split (training, validation, test), never random.
- Normalisation or standardisation computed on the training set only, then applied to the other sets; save the parameters.
- Check there is no leakage: no variable computed with future data, no test row in the training set.
- Class imbalance: measure it and report it.
- Return: the code, the sizes of the sets, and the saved normalisation parameters.
