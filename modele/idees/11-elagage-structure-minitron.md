# 11 — Élagage structuré + distillation de récupération (Minitron)

**Statut** : rejeté pour la version 1 (justification ci-dessous) ; gardé pour la feuille de route.

## Hypothèse
Élaguer Qwen3.5-9B ou 4B en largeur ou en profondeur (Minitron, arXiv:2407.14679 ; Llama-3.1-Minitron 4B, arXiv:2408.11796), puis récupérer par distillation, donnerait un modèle de 3 Md meilleur qu'un 4B d'origine.

## Pourquoi rejeté pour la version 1
- Minitron récupère avec environ 94 Md de jetons de distillation : 6 × 3e9 × 9,4e10 ≈ 1,7e21 FLOP, soit environ 1 400 H100-h. Au-delà même du scénario à 3 000 €.
- Même avec 10 fois moins de jetons (≈ 140 H100-h, 400 à 600 €), on espère au mieux retrouver Qwen3.5-4B, qui existe déjà et qu'Alibaba a entraîné bien plus longtemps.
- Le laboratoire local a déjà élagué les experts du 35B (benchmark publié) : utile pour un MoE, pas pour un dense.

## Ce qui ferait changer d'avis
Une base de 9 Md bien meilleure en français que le 4B (par exemple +10 points sur notre jeu documentaire), qu'un élagage léger à 5 Md garderait sous 2,5 Go : impossible, puisque 5 Md en Q4 font environ 3 Go. Le plafond de fichier tranche.

## Décision
Rejeté (taille et coût).
