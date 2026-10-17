# 12 — Pré-entraînement d'un petit modèle de zéro (≤ 1 Md)

**Statut** : rejeté.

## Calcul
- Codex : 1 Md sur 20 Md de jetons = 6 × 1e9 × 2e10 = 1,2e20 FLOP, soit environ 330 H100-h et 1 000 à 1 300 €.
- Pour comparaison, SmolLM3-3B a vu 11,2 billions de jetons, et Qwen3.5 des dizaines de billions.

Un modèle maison de 1 Md entraîné sur 20 Md de jetons serait environ 500 fois moins entraîné que les bases ouvertes disponibles. CroissantLLM (1,3 Md, 3 billions de jetons, arXiv:2402.00786), bien plus entraîné, reste derrière les petits modèles actuels.

## Seul intérêt
Contrôle total des données, pour une revendication de provenance « 100 % propre ». Cela ne sert pas l'objectif de performance.

## Décision
Rejeté.
