# 03 — Distillation « sur politique » depuis Qwen3.6-35B-A3B (même tokenizer)

**Statut** : levier central proposé (Claude) ; à soumettre à la critique de Codex.

## Hypothèse
L'élève génère ses propres réponses. Le professeur (Qwen3.6-35B-A3B, Apache 2.0) note chaque jeton par sa log-probabilité (KL inverse par jeton).
Sur le périmètre documentaire, cette méthode rapproche l'élève du professeur pour 10 à 30 fois moins de calcul qu'un SFT seul, à score égal.

## Mécanisme
- Le SFT sur les réponses du professeur entraîne l'élève sur des états qu'il ne visitera pas lui-même (biais d'exposition).
- La distillation sur politique corrige l'élève là où il se trompe vraiment. Elle donne un signal dense, contrairement au RL, qui ne fournit qu'une récompense par réponse.
- Condition nécessaire : un vocabulaire commun. Les tokenizer.json de Qwen3.5-2B, Qwen3.5-4B et Qwen3.6-35B-A3B ont la même empreinte SHA-256 (mesuré le 17 oct. 2026). Celui de Qwen3.8-27B diffère, alors que la taille du vocabulaire (248 320) est la même : écart probablement limité aux jetons spéciaux ou au gabarit, **à vérifier**.

## Références
- Agarwal et al., 2023, « On-Policy Distillation of Language Models » (GKD), arXiv:2306.13649.
- Gu et al., 2023, MiniLLM (KL inverse), arXiv:2306.08543.
- Lu et al. (Thinking Machines), billet « On-Policy Distillation », oct. 2025 : Qwen3-8B-Base passe de 60 à 70 % sur AIME'24 en environ 150 pas ; estimation de 9 à 30 fois moins de calcul que le SFT (chiffre des auteurs, cité de seconde main).
- Rapport Qwen3, arXiv:2505.09388 : distillation « forte vers faible » utilisée pour les petits modèles de la famille.

## Ordre de grandeur (calculé)
Pour 200 pas × 64 consignes × 4 échantillons × 1 000 jetons, soit 51 M jetons :
- échantillonnage de l'élève 4B : environ 1,5 à 3 H100-h ;
- notation par le professeur (pré-remplissage seul, 3 Md actifs) : moins d'une heure ;
- mise à jour de l'élève : 6 × N × D = 6 × 4e9 × 5,1e7 ≈ 1,2e18 FLOP, soit environ 1 h à 350 TFLOP/s utiles.

Total : 5 à 10 H100-h, et 10 à 20 avec les reprises, soit environ 30 à 80 €.

## Avocat du diable
- **Écart de capacité** : un professeur trop fort peut mal enseigner à un petit élève (Li et al., 2025, arXiv:2502.12143). Le 35B-A3B n'a que 3 Md actifs, ce qui réduit cet écart. Mais il ne sera alors pas « 10 fois plus gros » en calcul : le battre n'aurait pas de sens, l'imiter si.
- Le professeur n'est pas parfait sur les documents français. Une KL pure copie aussi ses erreurs. Il faut combiner avec des récompenses vérifiables (fiche 05).
- L'outillage pour une architecture DeltaNet en entraînement (TRL GKD, ou un code maison) n'est pas validé.

## Expérience de falsification
Pilote de 2 à 3 H100-h sur le 2B. Comparer à budget de calcul égal :
- SFT seul sur les réponses filtrées du professeur ;
- SFT court, puis distillation sur politique.

Si la seconde voie ne bat pas la première d'au moins 3 points sur le jeu de développement documentaire, on abandonne le levier.

## Résultat mesuré
—

## Décision
Retenu comme levier n° 1 des scénarios payants, après le SFT d'amorçage.
