# Élagage personnalisé des experts : un gros modèle sur un petit PC

Expérience du 16 octobre 2026. Question : peut-on faire tourner un modèle de plus de 12 milliards de
paramètres sur un PC ordinaire, et à quel prix pour la qualité ?

## Machine

Mac Intel i9-9880H (8 cœurs, AVX2), 16 Go de mémoire, processeur seul (node-llama-cpp 3.22.1,
llama.cpp intégré). D'autres applications ouvertes, comme chez un utilisateur ordinaire.

## Modèles denses ou à experts

| Modèle | Fichier | Vitesse | Premier mot | Mémoire |
|---|---|---|---|---|
| Qwen3.8-27B (dense) IQ2_S | 9,26 Go | 0,83 jeton/s | 53 s | 9,7 Go, swap en hausse |
| Qwen3.6-35B-A3B (MoE) UD-IQ2_XXS | 10,76 Go | 5,6 à 7,2 jetons/s | 10 s | 10 Go |
| Qwen3 4B (repère) | | 8,9 jetons/s | | |

Un modèle dense lit tous ses poids à chaque mot : sur un processeur, il est inutilisable au-delà
d'une dizaine de milliards de paramètres. Un modèle à experts n'en active qu'une petite partie
(8 experts sur 256 par couche, ~3 milliards de paramètres) : il va presque aussi vite qu'un 4B.
Sa limite est la mémoire : les experts font 84 % du fichier.

## Idée : retirer les experts dont l'utilisateur ne se sert pas

Le routeur d'un modèle à experts choisit, pour chaque mot, quelques experts. Sur des textes proches
de l'usage réel, une partie des experts n'est presque jamais choisie. On les mesure puis on les
retire (approche publiée sous le nom de REAP) :

1. statistiques sur 56 426 jetons de français (77 textes : compétences, documentation, séries
   métiers, rédaction, synthèse) ; score d'un expert = poids de routage × norme de sa sortie ;
2. dans chaque couche, on garde les K experts les mieux notés ; les poids gardés sont recopiés
   sans être décompressés, la quantification d'origine reste intacte.

Sur ces textes, garder 192 experts sur 256 couvre 97,6 % des routages (pire couche 89,5 %) ;
en garder 128 en couvre 90,2 % (pire couche 72,9 %).

## Résultats

Évaluation sur des textes absents de la calibration (les 15 PDF de la banque du Benchmark).

| Version | Fichier | Perplexité | Calcul (MGSM-fr) | Vitesse | Premier mot | Mémoire max |
|---|---|---|---|---|---|---|
| Original (256 experts) | 10,76 Go | 3,92 ± 0,13 | 13/15 | 5,6 jetons/s | 10,8 s | 10 Go |
| 192 experts (−25 %) | 8,47 Go | 3,97 (+1,1 %) | 13/15 | 6,5 jetons/s | 4,5 s | 9,0 Go |
| 128 experts (−50 %) | 6,18 Go | 4,26 (+8,6 %) | 13/15 | 6,7 jetons/s | 4,3 s | 6,7 Go |

Les mêmes problèmes (M05, M09) échouent pour les trois versions. Données brutes : `docs/mesures/elagage/`.
Outils : `scripts/labo/`.

## Lecture

- À −25 %, la perte est dans la marge d'erreur : 2 Go de gagnés presque sans contrepartie mesurée.
- À −50 %, la perte devient nette mais le modèle reste juste en calcul et tient en 6,7 Go : un
  modèle de 35 milliards de paramètres devient envisageable sur un PC de 8 Go.
- Dans la réponse témoin, l'original nomme le pathogène du mildiou (*Phytophthora infestans*),
  pas les versions élaguées : les connaissances pointues partent avant l'aisance de la langue.

## Limites

- 15 problèmes de calcul ne permettent pas de départager des versions proches.
- Les écarts de premier mot dépendent en partie du cache disque.
- Seul le français a servi à la calibration : les autres langues sont probablement dégradées.
- Le corpus de calibration et celui d'évaluation sont tous deux issus de Localia : proximité de style.

## Suite

La version à 192 experts a passé les 139 questions du Benchmark, notées par Claude et Codex :
[BENCHMARK-35B.md](BENCHMARK-35B.md).
