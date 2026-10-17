# 09 — Récupération des pertes dues à la quantification Q4 (idée de Codex, recadrée)

**Statut** : phase 4 ; à tester si l'écart BF16/Q4 dépasse 2 points.

## Hypothèse
La quantification en 4 bits fait perdre une partie de ce que le post-entraînement a gagné. Deux leviers peuvent récupérer une part de cette perte, à taille de fichier égale :
- un court entraînement conscient de la quantification (QAT, ou distillation BF16 → Q4 simulé) ;
- une matrice d'importance (imatrix) calibrée sur nos données documentaires françaises.

## Références
- Gemma 3 publie des versions QAT, avec une perte annoncée bien plus faible qu'en quantification après coup.
- Pour llama.cpp, l'imatrix est l'outil standard. Le laboratoire local en possède une (`~/localia-labo/sources/imatrix_unsloth.gguf`).

## Avocat du diable
Sur un 4B en Q4_K_M ou IQ4_XS, la perte est souvent inférieure à 1 point sur les tâches simples : le levier ne vaudrait pas son coût. À mesurer avant d'agir.

## Expérience de falsification
Mesurer l'écart BF16/Q4 sur 200 cas, plus la perplexité sur un corpus français tenu à part. Si l'écart est inférieur à 1,5 point, on ne fait que l'imatrix maison.

## Décision
Différé en phase 4.
