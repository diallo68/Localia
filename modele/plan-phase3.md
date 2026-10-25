# Étape 2.7 : plan chiffré de la phase 3 (soumis à l'auteur et validé le 25 octobre 2026)

## 1. Où en est-on [mesuré]

| | dev (60) | dev2 (138) | 198 cas, sans les cas touchés (188) |
|---|---|---|---|
| Base Qwen3.5-2B | 0,863 | 0,712 | 0,784 |
| Lot 4 (4 094 exemples) | 0,895 | 0,797 | 0,840 |
| Gemma 3 27B | 0,842 | 0,800 | — |
| Mistral Small 3.2 24B | 0,910 | 0,843 | — |
| Gemma 4 31B | 0,927 | 0,913 | — |
| Qwen3.8 27B | 0,957 | 0,943 | — |

Nos modèles sont notés sur le Mac (processeur), les comparateurs sur GPU (Kaggle), avec le même `executer.py` (sans réflexion, température 0) et le même noteur.

- Lot 4 − base : +0,057 par cas [−0,002 ; +0,115] sans les cas touchés. C'est à la limite du niveau « Améliore la base » (+5 points), sans être encore significatif.
- L'écart avec les comparateurs tient surtout à l'**extraction quand il faut appliquer une règle ou lire un tableau** (0,71 contre 0,96 à 0,98 sur dev2) et, sauf pour Qwen3.8, à l'**incohérence**.
- Conditions obligatoires : GGUF de 1,31 Go (≤ 2,5 Go), import dans Ollama et Localia fait (étape 2.5), décontamination faite. **Vitesse à revérifier** sur le modèle final : environ 5 jetons/s sur le processeur seul à 8k, juste au seuil.
- Lot 5 (4 766 exemples, tableaux et contradictions éloignées) en cours d'entraînement ; résultat le 25 octobre au soir.

## 2. Budget

- **Dépense prévue : 0 €.** Tout se fait sur le Mac et sur Kaggle (gratuit, **30 h de GPU par semaine**, au plus 2 sessions à la fois, remise à zéro le samedi vers 2 h).
- Le crédit Google Cloud (264 €) reste intact. **[supposé, à vérifier]** Un compte en essai gratuit ne peut pas utiliser de GPU ; il faudrait passer en compte payant, ce que l'auteur a exclu. Je ne le propose donc pas. Si l'auteur change d'avis, le scénario « ~250 € » de `00-conception.md` (distillation sur politique, RL, 4B) reste la seule façon réaliste de viser « Rivalise ».

## 3. Étapes, coûts et points d'arrêt

| Étape | GPU Kaggle [calculé] | Quand | Arrêt ou décision si… |
|---|---|---|---|
| 3.1 Noter le lot 5 (dev, dev2, Mac, avec et sans les consignes de Localia) | 0 h | 25-26 oct. | extraction de dev2 < 0,75 : les données « tableau » n'aident pas ; on garde le lot 4 |
| 3.2 **Lot 6 : réponses de l'élève vérifiées** (le 2B répond 8 fois à chaque question d'application, de tableau ou d'incohérence ; on garde les réponses justes selon le calcul ou les deux valeurs, puis nouvel entraînement court sur ces réponses). C'est une forme peu coûteuse d'apprentissage par renforcement, sans professeur | 3 h (génération) + 4 h (entraînement) | semaine du 31 oct. | gain < 2 points par cas sur 188 cas : arrêt des itérations |
| 3.3 Vitesse et mémoire du modèle retenu (llama-bench, 8k, processeur seul ; pic de RAM) | 0 h | après 3.1 ou 3.2 | < 5 jetons/s : essayer le GGUF élagué (vocabulaire de 48k) ou Q4_0 |
| 3.4 Benchmarks publics (FQuAD 2.0, Belebele fr, IFEval-fr ; MMMLU-fr et MGSM-fr comme garde-fous), base et modèle retenu | 3 h | semaine du 31 oct. | régression au-delà des marges de `criteres.md` : le dire, et comparer avec le lot précédent |
| 3.5 **Évaluation finale, une seule fois** : jeu secret (234 cas principaux, 240 publiés) pour la base, le modèle retenu et les 4 comparateurs | 3 h | après 3.2 | — |
| 3.6 Juge ouvert non-Qwen (Mistral Small 3.2, Apache 2.0) sur les réponses du jeu secret, puis **contrôle humain à l'aveugle** par l'auteur sur un échantillon (60 cas, κ publié) | 2 h | après 3.5 | κ < 0,6 : le juge n'est pas fiable, on publie la note humaine et automatique seulement |

Total : environ 15 h de GPU, soit la moitié d'une semaine de Kaggle.

## 4. Recette d'entraînement (fixée, reproductible)

- Base Qwen/Qwen3.5-2B (Apache 2.0). LoRA de rang 16, alpha 32, dropout 0,05, sur les projections d'attention et de MLP ; taux d'apprentissage 1e-4, 1 époque, accumulation de 8, longueur maximale 8 192 jetons, longueurs arrondies au palier de 256 (correction de la fuite de mémoire). Perte sur la réponse seulement, sans réflexion.
- Fusion, couche MTP recopiée de la base, conversion en GGUF (llama.cpp 0.7.0), Q4_K_M, gabarit sans réflexion pour Ollama.
- Données : fiches Service-Public (Licence Ouverte), demandes et réponses de Qwen3.6-35B-A3B (Apache 2.0) vérifiées mécaniquement ; aucune sortie de Claude ni de GPT ; fiches des jeux d'évaluation exclues et décontamination publiée.
- Plan B en cas de divergence (perte qui remonte, ou score plus bas que le lot précédent) : revenir au point de reprise précédent, diviser le taux d'apprentissage par 2 ; si cela ne suffit pas, garder le lot précédent.

## 5. Phase 4 ensuite (sans GPU, environ 1 à 2 jours)

- **[supposé]** Variante 16 Go : la base Qwen3.5-4B atteignait déjà 0,917 sur dev, mais génère à 4,1-4,6 jetons/s à 8k (sous le seuil de 5). Une LoRA 4B avec les mêmes données (environ 14 h de Kaggle) n'est proposée que si le quota le permet après l'évaluation finale.
- Quantifications comparées (Q4_K_M, Q4_0, Q5_K_M, Q8_0) : taille, vitesse et score sur dev2.
- GGUF en plusieurs tailles, Modelfile, model card honnête, guide d'installation dans Localia ; profils 8, 16 et 32 Go de RAM.
- Rapport final chiffré avec intervalles de confiance, feuille de route, document de désaccords (critique de Codex demandée avant le rapport).
- **Rien n'est publié sans l'accord de l'auteur.**

## 6. Résultat attendu [supposé]

- Avec 0 € : « Améliore la base » probable (+5 à +8 points par cas) ; « Dépasse sa classe » (+10 points et au-dessus de Gemma 3 12B) possible si le lot 5 ou le lot 6 corrigent l'extraction ; « Rivalise » peu probable (moins de 15 %, estimation subjective), car il faudrait rattraper 10 à 17 points sur Mistral Small, Gemma 4 et Qwen3.8.
