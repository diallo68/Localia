# 02 — Choix du modèle de base

**Statut** : préférence argumentée ; tranché par un « concours de bases » mesuré en phase 2.

## Hypothèse
Qwen3.5-4B, quantifié en IQ4_XS (2,48 Go), est la meilleure base pour le modèle principal (machines de 16 Go).
Qwen3.5-2B (Q4_K_M, 1,28 Go) sert pour la variante 8 Go. Les deux suivent la même chaîne d'entraînement.

## Arguments (mesuré / publié / calculé)
| Base | Licence | Fichier Q4 | Argument pour | Argument contre |
|---|---|---|---|---|
| Qwen3.5-4B | Apache 2.0 (fiche HF) | IQ4_XS 2,48 Go, Q4_K_M 2,74 Go (publié) | Meilleurs scores publiés de la classe ; **même tokenizer que Qwen3.6-35B-A3B** (empreinte SHA-256 de tokenizer.json identique, mesuré le 17 oct.) : distillation sur logits possible ; architecture hybride DeltaNet (cache KV seulement 1 couche sur 4) | Q4_K_M dépasse 2,5 Go ; il faut IQ4_XS ou élaguer le vocabulaire (fiche 08) |
| Qwen3.5-2B | Apache 2.0 | Q4_K_M 1,28 Go | Rapide, très peu de mémoire ; même tokenizer | Faible sans réflexion (IFEval 61,2) |
| Ministral 3 3B | Apache 2.0 | Q4_K_M 2,15 Go | Origine française, MATH 0,83 (publié) | À 8k de contexte : 2,1 jetons/s avec flash attention, 4,2 sans [mesuré], comme le 4B Qwen dans la même série. Tokenizer différent : professeur Mistral Small 4 (119 Md, MoE) coûteux à servir ; vision en plus (0,4 Md) inutile ici |
| Gemma 4 E2B / E4B | Apache 2.0 | 3,11 / 4,98 Go | Bons scores | **Hors plafond de fichier** à cause des embeddings par couche |
| SmolLM3-3B | Apache 2.0, données ouvertes | Q4_K_M 1,92 Go | Transparence totale des données | Scores publiés inférieurs à Qwen3.5-4B ; non téléchargé (disque) |

## Avocat du diable
- Qwen3.5 est entraîné surtout pour le chinois et l'anglais. Son français idiomatique (registre, accords, anglicismes) n'est pas mesuré publiquement. Ministral pourrait mieux écrire.
- La couche DeltaNet est récente. Le LoRA et la conversion en GGUF d'un dérivé n'ont pas été testés sur notre build : risque d'incompatibilité.
- Le 2B se met à boucler en mode réflexion (signalé sur la fiche officielle).

## Expérience de falsification (phase 2, 0 €)
Sur 60 cas de développement (passés en CPU, Q4, sans réflexion), comparer les trois bases téléchargées : exactitude, abstention et qualité du français (notation à l'aveugle).
Si Ministral dépasse Qwen3.5-4B de plus de 5 points sur le français écrit sans perdre en exactitude, on reconsidère le choix, en acceptant le coût d'un professeur Mistral.

## Résultat mesuré
Vitesses [mesuré, 8 fils] :
| Base | À vide | À 8k |
|---|---|---|
| 2B Q4_K_M | 17,2 j/s | 11,1 j/s |
| 4B IQ4_XS | 6,1 j/s | 5,5 j/s |
| Ministral 3B Q4_K_M | 9,7 j/s | 2,1 j/s (fa par défaut) ; 4,2 (fa=0) |

Détail : voir `../mesures/vitesse-bases-candidates.md`. Qualité : — (phase 2).

## Décision
Préférence : Qwen3.5-4B. Le choix final se fera sur la mesure.
