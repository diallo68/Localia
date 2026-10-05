---
nom: 8. Préparer pour un modèle
appel: /donnees-modele
description: Découpage chronologique, normalisation sans fuite, jeux d’entraînement et de test.
famille: Données brutes
tache: donnees
---

Objectif : des jeux de données qui mesurent honnêtement la performance d'un modèle.

- Séries temporelles : découpage chronologique (entraînement, validation, test), jamais aléatoire.
- Normalisation ou standardisation calculée sur l'entraînement seul, puis appliquée aux autres jeux ; enregistre les paramètres.
- Vérifie l'absence de fuite : aucune variable calculée avec des données futures, aucune ligne du test dans l'entraînement.
- Déséquilibre des classes : le mesurer et le signaler.
- Rends : le code, les tailles des jeux, et les paramètres de normalisation enregistrés.
