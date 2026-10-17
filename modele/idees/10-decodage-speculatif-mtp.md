# 10 — Décodage spéculatif et tête MTP sur CPU

**Statut** : à mesurer ; une mesure locale antérieure est **négative**.

## Hypothèse
Qwen3.5 contient une tête MTP (mtp_num_hidden_layers = 1 dans config.json). Servir de brouillon avec cette tête pourrait augmenter le débit sur CPU sans changer la qualité.

## Mesure existante (mesurée, laboratoire Localia, octobre 2026)
Qwen3.8-27B IQ2_S sur cette machine :
- génération de base : 0,85 jeton/s ;
- MTP à 3 jetons : 0,44 jeton/s (acceptation de 52 %, longueur moyenne 2,55) ;
- brouillon DFlash : 0,42 jeton/s.

Le spéculatif a **divisé la vitesse par deux**. Explication probable, non prouvée : le 27B déborde de la mémoire libre, ce qui provoque du swap, et la vérification d'un lot coûte presque autant que plusieurs jetons sur CPU. Sur un 4B qui tient en RAM, le résultat peut être différent.

## Calcul
Sur CPU, la génération est limitée par la bande passante, environ 25 Go/s mesurés (fiche 02). Vérifier k jetons d'un coup coûte une seule lecture des poids, donc le spéculatif peut aider en principe. Le gain théorique vaut (1 + nombre moyen de jetons acceptés) / (1 + coût relatif du brouillon), soit environ 1,5 à 2 fois avec 52 % d'acceptation. Le calcul DeltaNet récurrent est cependant séquentiel, et sa vérification n'est pas gratuite.

## Expérience de falsification (0 €)
Sur Qwen3.5-4B Q4 avec llama-server, à 0 et 8k de contexte, comparer MTP activé et désactivé. On n'adopte pas en dessous de +15 %.

## Décision
Mesure en phase 2. N'entre pas dans les critères de succès : c'est un bonus éventuel.
