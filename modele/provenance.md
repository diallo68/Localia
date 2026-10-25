# Registre de provenance

Toute donnée, tout modèle ou tout benchmark utilisé est inscrit ici **avant** usage. Colonnes :
- **source** ;
- **licence** : telle que lue, avec la date de lecture ;
- **usage** : base / professeur / entraînement / évaluation seulement ;
- **statut** : envisagé / vérifié / utilisé / rejeté.

Règle absolue : aucune sortie de Claude, de GPT/Codex, ni d'aucun service interdisant l'entraînement de concurrents, dans les données d'entraînement, les paires de préférence ou les signaux de récompense.
Les jeux publics produits avec GPT, par exemple les jeux de type Alpaca traduits par GPT-3.5/4, sont exclus même s'ils sont publiés sous licence libre.

## Modèles

| Modèle | Licence lue | Usage prévu | Statut | Vérification |
|---|---|---|---|---|
| Qwen/Qwen3.5-4B | Apache-2.0 | base | envisagé | fiche HF et métadonnées GGUF, 17 oct. 2026 |
| Qwen/Qwen3.5-2B | Apache-2.0 | base (variante 8 Go) | **utilisé** : LoRA du pilote 2.5 (poids HF téléchargés sur Kaggle, 18 oct. 2026) | fiche HF, 17 oct. 2026 |
| Qwen/Qwen3.5-0.8B | Apache-2.0 | prototype de chaîne (phase 2) | envisagé | supposé identique à la famille, **à vérifier** |
| mistralai/Ministral-3-3B-Instruct-2512 | Apache-2.0 | base concurrente (concours) | envisagé | fiche HF, 17 oct. 2026 |
| Qwen/Qwen3.6-35B-A3B | Apache-2.0 | professeur (séquences, logits) | **utilisé** : demandes et réponses de l'étape 2.4 (GGUF ggml-org Q4_K_M, Kaggle) | fiche HF, 17 oct. 2026 ; aucune restriction sur l'usage des sorties lue |
| Qwen/Qwen3.8-27B | apache-2.0 selon les métadonnées du GGUF local (ISTA-DASLab) ; Codex dit avoir lu la fiche | professeur secondaire, comparaison | envisagé | **à vérifier dans le fichier LICENSE du dépôt officiel** |
| google/gemma-4-31B-it | Apache 2.0 selon la fiche, avec un lien vers les « Gemma 4 license terms » | professeur secondaire, juge, comparaison | envisagé | **lire les conditions liées avant tout usage de ses sorties** |
| mistralai/Mistral-Small-4 | Apache 2.0 (annonce officielle mistral.ai, 16 mars 2026) | professeur (si base Ministral), comparaison | envisagé | à vérifier sur la fiche HF |
| intfloat/multilingual-e5-small | MIT (fiche HF, 21 oct. 2026) | embeddings pour la recherche de passages par le sens (mesure seulement) | **utilisé** : poids HF téléchargés le 21 oct. 2026 avec l'accord de l'auteur (471 Mo, SHA-256 `1a55775f…8477`), calculs en PyTorch sur le Mac | fiche HF, 21 oct. 2026 |
| mistralai/Mistral-Small-3.2-24B-Instruct | Apache 2.0 (connu, **à revérifier**) | comparaison seulement | envisagé | — |

## Modèles produits (non publiés)

| Fichier | Base | Données | Recette | Empreinte SHA-256 (début) |
|---|---|---|---|---|
| qwen35-2b-lora-Q4_K_M.gguf (1,27 Go) | Qwen/Qwen3.5-2B | 262 exemples vérifiés de l'étape 2.4 : fiches Service-Public (Licence Ouverte), demandes et réponses de Qwen3.6-35B-A3B ; aucune sortie de Claude ni de GPT | `donnees/lora_2b_kaggle.py`, version 4 du noyau Kaggle `mohadial/localia-lora-2b-2-5`, 18 oct. 2026 | 38ae809f950a02a7 |
| qwen35-2b-base-Q4_K_M.gguf (1,31 Go) | Qwen/Qwen3.5-2B, sans entraînement | — | même conversion et même quantification (témoin) | d4975891c2398750 |
| qwen35-2b-lora-Q4_K_M.gguf, lot 2 (1,31 Go, couche MTP comprise) | Qwen/Qwen3.5-2B | 1 950 exemples vérifiés des lots 2.4, 2a et 2b (`donnees/assembler_exemples.py`) : fiches Service-Public (Licence Ouverte), demandes et réponses de Qwen3.6-35B-A3B ; aucune sortie de Claude ni de GPT | `donnees/lora_2b_lot2_kaggle.py`, noyau Kaggle `mohadial/localia-lora-2b-lot2`, 19 oct. 2026 | 3cf06e0f1c4877b4 |
| qwen35-2b-lora-Q4_K_M.gguf, lot 3 (1,31 Go, couche MTP comprise) | Qwen/Qwen3.5-2B | 3 633 exemples vérifiés des lots 2.4, 2a, 2b, 3a et 3b : fiches Service-Public (Licence Ouverte), demandes et réponses de Qwen3.6-35B-A3B ; aucune sortie de Claude ni de GPT | `donnees/lora_2b_lot3_kaggle.py` (pas 1 à 440), puis `donnees/lora_2b_lot3_fin_kaggle.py` (pas 441 à 455, reprise), noyaux `mohadial/localia-lora-2b-lot3` et `localia-lora-2b-lot3-fin`, 19 au 24 oct. 2026 | 33853424ec3985b2 |
| qwen35-2b-lora-Q4_K_M.gguf, lot 4 (1,31 Go, couche MTP comprise) | Qwen/Qwen3.5-2B | 4 094 exemples vérifiés des lots 2.4 à 4b (`localia-exemples-lot4`) : fiches Service-Public (Licence Ouverte), demandes et réponses de Qwen3.6-35B-A3B ; aucune sortie de Claude ni de GPT | `donnees/lora_2b_echelle_kaggle.py` (correction de la fuite, tous les exemples), noyau Kaggle `mohadial/localia-lora-2b-lot4`, 25 oct. 2026 | 465a0ee1ae6d4e4e |

## Données d'entraînement (envisagées, rien n'est téléchargé)

| Source | Licence annoncée | Usage | Statut |
|---|---|---|---|
| Fiches pratiques Service-Public.fr (data.gouv.fr ; AgentPublic/service-public sur HF) | Licence Ouverte / Etalab 2.0 (fiche data.gouv et étiquette HF etalab-2.0) | documents source pour le SFT documentaire | envisagé |
| Lot 4 : 172 fiches Service-Public (datasets privés Kaggle `localia-donnees-lot4a` et `lot4b`, 24 oct. 2026), avec transformations mécaniques | Licence Ouverte / Etalab 2.0 | exemples « appliquer une règle » et paires de contraste, écrits par Qwen3.6-35B-A3B (Apache 2.0) sur Kaggle, `donnees/professeur_lot4_kaggle.py` ; fiches d'évaluation exclues (vérifié) | **utilisé** : 461 exemples vérifiés (application 250, contraste 119, abstention 92), assemblés avec le lot 3 dans `localia-exemples-lot4` (4 094 exemples) |
| Lot 5 : 162 fiches à tableaux (5a) et 234 fiches avec une contradiction insérée mécaniquement (5b), Service-Public (datasets privés Kaggle `localia-donnees-lot5a` et `lot5b`, 25 oct. 2026) | Licence Ouverte / Etalab 2.0 | exemples « tableau », incohérence éloignée et fausse alerte, écrits par Qwen3.6-35B-A3B (Apache 2.0) sur Kaggle, `donnees/professeur_lot5_kaggle.py` ; fiches d'évaluation exclues (vérifié) | en cours (professeur lancé le 25 oct.) |
| Fiches « vosdroits » Particuliers, archive `vosdroits-latest.zip` (lecomarquage.service-public.fr, version du 17/10/2026, SHA-256 `978f5d91…ac38`) | Licence Ouverte / Etalab 2.0 | **évaluation** : 26 fiches dans le jeu secret, 10 dans le jeu de développement. Ces 36 fiches sont **exclues de tout entraînement** (`eval/exclusions-entrainement.txt` et liste du jeu de développement) | utilisé (évaluation) |
| Même archive vosdroits, **autres fiches** (18 oct. 2026) | Licence Ouverte / Etalab 2.0 (réutilisation libre, y compris commerciale, avec mention de la source) | **documents source pour l'entraînement** (étape 2.4). `donnees/preparer_sources.py` : 1 489 fiches gardées sur 3 004 ; écartées : les 36 fiches d'évaluation, 44 fiches dont plus de 5 % des 13-grammes figurent dans un document ou un cas d'évaluation, 1 435 trop courtes ou trop longues. Détail fiche par fiche dans `decontamination.json` (hors dépôt) | utilisé (échantillon 2.4) |
| Documents inventés du jeu secret (14) et cas d'évaluation (240), écrits par Claude | sans objet (créés pour le projet) | **évaluation uniquement**, jamais d'entraînement | utilisé (évaluation) |
| Légifrance / LEGI (DILA) | Licence Ouverte | documents source | envisagé, à vérifier |
| Wikipédia français | CC BY-SA 4.0 | documents source | envisagé ; étudier le partage à l'identique pour les données dérivées |
| FineWeb-2 (fra_Latn) | ODC-By 1.0 (+ conditions Common Crawl ; étiquette HF lue le 17 oct. 2026) | documents variés, mélange général | **utilisé pour une mesure seulement** : fichier test/000_00000.parquet (67 Mo), statistiques du tokenizer, aucun entraînement |
| angeluriot/french_instruct | MIT selon la fiche | **à auditer** : part générée par quel modèle ? | envisagé, exclu par défaut |

## Benchmarks (évaluation seulement, jamais en entraînement)

| Benchmark | Licence | Remarque |
|---|---|---|
| FQuAD 1.1 / 2.0 | CC BY-NC-SA 3.0 | usage d'évaluation non commercial ; 2.0 contient des questions sans réponse |
| PIAF (AgentPublic/piaf) | MIT (étiquette HF, 17 oct. 2026) | questions-réponses françaises |
| Belebele (fra_Latn) | CC BY-SA 4.0 | compréhension de lecture, QCM |
| IFEval-fr (le-leadboard) | non indiquée sur HF : **à clarifier avant usage** | suivi de consignes vérifiable |
| MGSM (fr) | CC BY-SA 4.0 | déjà utilisé dans la banque Localia |
| Global-MMLU (CohereLabs) / MMMLU (openai) | Apache-2.0 / MIT (étiquettes HF, 17 oct. 2026) | connaissances générales, garde-fou de régression |
| French MT-Bench (bofenghuang) | Apache-2.0 (étiquette HF) | rédaction, avec juge ouvert |
| Banque Localia (147 questions, documents fictifs) | interne | jeu de **développement** |
| RGPD, règlement (UE) 2016/679, pages de la CNIL (20 oct. 2026), assemblé par `recherche/assembler_rgpd.py` | texte officiel de l'UE, réutilisation libre avec mention de la source | jeu `eval-long/rgpd` (hors dépôt) : 24 questions écrites par le professeur local `qwen36-fr-192` (Apache 2.0) avec preuve recopiée et vérifiée ; évaluation de la recherche de passages seulement |
| Thèse de doctorat fournie par l'auteur (114 pages) | document **privé** de l'auteur | jeu `eval-long/these` (hors dépôt, sur le Mac seulement) : 24 questions écrites par `qwen36-fr-192` ; évaluation seulement, **jamais d'entraînement sans l'accord de l'auteur**, jamais publié |
| Jeu maison secret (à écrire) | interne | jeu de **test**, figé avant tout entraînement |
