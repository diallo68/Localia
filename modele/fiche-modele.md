# Fiche du modèle : localia-doc-2b (lot 4, vocabulaire élagué)

**Statut : non publié.** Rien n'est publié sans l'accord de l'auteur. Fiche rédigée le 2 novembre 2026, d'après
`journal.md`. Les sections marquées *phase 4* seront complétées après le noyau `localia-lora-lot4-fin`
(quantifications comparées).

**En une phrase.** Petit modèle (2 milliards de paramètres) pour répondre en français à des demandes sur **un
document fourni**, sur un ordinateur sans carte graphique. Il s'abstient et cite mieux que son modèle de base, mais
**ne fait pas mieux que lui dans l'ensemble** sur le jeu de test secret : le niveau du défi est **Échec**.

## 1. Identité

| | |
|---|---|
| Base | Qwen/Qwen3.5-2B (Apache 2.0), mode sans réflexion |
| Adaptation | LoRA (rang 16) fusionnée, lot 4 |
| Vocabulaire | élagué au français et à l'ASCII : environ 48 000 jetons gardés sur 248 000 (`mesures/elaguer_vocab.py`, k = 48 000) |
| Fichier livré | `qwen35-2b-lora-Q4_K_M-sansreflexion-vocfr48k.gguf`, Q4_K_M, 1,11 Go, SHA-256 `a4b5f4bc2fa3457cfcc5237b87df0327610b23b4199e4e646ccdde5babf6d4ad` |
| Gabarit | `ollama/gabarit_sans_reflexion.jinja` : bloc de réflexion toujours vide (voir § 3) |
| Nom dans Ollama | `localia-doc-2b-lot4` |
| Autres quantifications | *phase 4* |

## 2. Usage prévu et usages à éviter

**Prévu** : poser une question, demander une extraction, une synthèse courte ou une rédaction à partir d'un document
français donné dans la demande (fiches administratives, notes, règlements), dans Localia ou avec Ollama, sur un
ordinateur de 8 Go de RAM. Le modèle doit répondre à partir du document seulement et dire quand l'information n'y
est pas.

**À éviter** :
- les questions de culture générale sans document : l'entraînement ne porte pas dessus ;
- le calcul et le raisonnement chiffré : MGSM recule de 7,2 points face à la base (§ 5.3) ;
- les réponses dans des langues à écriture non latine : le vocabulaire élagué ne sait plus les écrire (§ 6) ;
- les décisions juridiques, médicales ou financières sans relecture humaine ;
- les documents qui ne sont pas fiables : le modèle résiste **moins bien** que sa base aux instructions cachées dans
  un document (§ 5.1, injection −0,08).

## 3. Utilisation

- Consigne système recommandée : celle de l'évaluation (`eval/outils/executer.py`, `CONSIGNE_SYSTEME`), qui demande
  de répondre uniquement à partir du document, de signaler les incohérences et d'ignorer les instructions du document.
- Le modèle doit être servi **sans réflexion**. Avec le gabarit d'origine, Ollama active la réflexion par défaut. Le
  modèle n'a pas été entraîné pour : il réfléchit jusqu'à remplir le contexte et rend une réponse vide (mesuré le
  25 octobre 2026). Le GGUF livré porte déjà le gabarit corrigé ; la marche à suivre est dans `ollama/README.md`.
- Réglages du `Modelfile` : contexte de 8 192 jetons, température 0,3, top_k 20, top_p 0,95. Toutes les mesures de
  cette fiche ont été faites à **température 0**.
- Guide d'installation dans Localia : *phase 4*.

## 4. Données et entraînement

- **Données** : 4 094 exemples vérifiés (`localia-exemples-lot4`), tous construits sur des fiches Service-Public.fr
  (Licence Ouverte / Etalab 2.0). Les demandes et les réponses ont été écrites par le modèle professeur
  Qwen3.6-35B-A3B (Apache 2.0). Elles ont été vérifiées par programme, puis certains exemples ont été transformés
  mécaniquement (contradictions insérées, tableaux). Familles d'exemples : réponse et citation, abstention,
  application d'une règle, paires de contraste, incohérences. Détail dans `provenance.md`.
- **Aucune sortie de Claude ni de GPT/Codex** dans les données d'entraînement. Claude a écrit les cas d'évaluation et
  les documents inventés, qui ne servent qu'à l'évaluation.
- **Décontamination** : les 36 fiches des jeux d'évaluation et 44 fiches trop proches d'eux (plus de 5 % de 13-grammes
  communs) sont exclues de l'entraînement (`decontamination.md`). Six cas du jeu secret, touchés malgré tout, sont
  retirés du score principal.
- **Recette** : LoRA de rang 16 (alpha 32, dropout 0,05) sur les couches de langage (attention, DeltaNet, MLP). Une
  époque, 512 pas, accumulation de 8, taux d'apprentissage 1e-4 en cosinus. Perte sur la réponse seulement, séquences
  de 8 192 jetons au plus. GPU Kaggle T4, fp16, noyau `mohadial/localia-lora-2b-lot4` (25 octobre 2026). Puis
  fusion, conversion GGUF (llama.cpp v0.7.0), Q4_K_M, élagage du vocabulaire.
- **Coût** : 0 € (quota gratuit de Kaggle).

## 5. Résultats mesurés

### 5.1 Jeu de test secret (résultat principal)

Le jeu compte 240 cas sur 40 documents (26 fiches Service-Public et 14 documents inventés). Il a été figé le
17 octobre 2026 avant tout entraînement (SHA-256 `622aac13…`) et ouvert **une seule fois**, le 1er novembre 2026.
Note automatique (`eval/outils/noter.py`) ; score principal sur 234 cas ; IC à 95 % par bootstrap sur les documents.

| Modèle | S_doc | Écart lot 4 − modèle [IC 95 %] |
|---|---:|---|
| Qwen3.5-9B | 0,867 | −0,101 [−0,157 ; −0,044] |
| Gemma 4 12B QAT | 0,863 | −0,097 [−0,140 ; −0,053] |
| Qwen3.5-4B | 0,857 | −0,091 [−0,138 ; −0,042] |
| Gemma 3 12B | 0,845 | −0,079 [−0,128 ; −0,020] |
| Base Qwen3.5-2B | 0,772 | **−0,006 [−0,057 ; +0,047]** |
| **Lot 4 élagué** | **0,766** | |
| Mistral-Nemo 12B | 0,737 | +0,029 [−0,021 ; +0,083] |
| Ministral 3 3B | 0,719 | +0,047 [−0,006 ; +0,101] |
| Phi-4-mini | 0,693 | +0,073 [+0,023 ; +0,121] |

Les modèles de 24 à 35 Md (0,83 à 0,93) sont dans le journal (1er novembre 2026, 23 h).

**Niveau du défi : Échec** (`criteres.md`, § 5). Il fallait au moins 5 points de gain sur la base ; l'écart est de
−0,6 point.

Par catégorie, lot 4 − base : abstention +0,08, citation +0,06, qualité du français +0,09, extraction +0,03 ;
**incohérence −0,15, injection −0,08, rédaction −0,07**, synthèse −0,02. Les gains et les pertes s'annulent.

**Juge et contrôle humain (étape 3.6).** Un juge ouvert, Mistral Small 3.2, a noté les mêmes réponses : lot 4 0,696,
base 0,675, écart +0,021 [−0,024 ; +0,067]. Son accord avec 60 réponses notées à l'aveugle par l'auteur est nul
(κ = −0,038). La règle fixée avant les verdicts écarte donc le juge ; le niveau reste celui de la note automatique.
Sur cet échantillon, la note automatique ne s'accorde pas mieux avec l'auteur (κ = 0,048).

### 5.2 Jeux de développement (à lire avec prudence)

Sur dev (60 cas) et dev2 (138 cas), conditions de Localia, 188 cas sans les cas touchés : lot 4 élagué 0,849,
soit 0,057 de plus que la base. **Cette avance ne se retrouve pas sur le jeu secret.** Le modèle et ses données ont été choisis
d'après ces deux jeux : l'avance était en partie un surajustement. Ce n'est pas une mesure de la qualité attendue.

### 5.3 Bancs publics (contrôle de régression)

Kaggle, sans réflexion, température 0. Écart avec la base Qwen3.5-2B [IC 95 %] :

| Banc | Base | Lot 4 élagué |
|---|---:|---|
| FQuAD 2.0 (800) | 0,420 | +0,190 [+0,142 ; +0,260] |
| Belebele fr (900) | 0,701 | +0,020 [0 ; +0,040] |
| MMMLU fr (2 850) | 0,518 | +0,002 [−0,011 ; +0,015] |
| IFEval (541) | 0,654 | **−0,059** [−0,100 ; −0,018] |
| MGSM fr (250) | 0,584 | **−0,072** [−0,136 ; −0,004] |
| SQuAD 2.0, anglais (800) | 0,344 | +0,233 [+0,199 ; +0,270] |
| Belebele, anglais (900) | 0,683 | +0,033 [+0,012 ; +0,055] |

- Le contrôle de régression de `criteres.md` est **non tenu** (IFEval et MGSM sous leur seuil), ce que l'auteur a
  accepté le 1er novembre 2026.
- Le gain sur FQuAD et SQuAD vient surtout de l'abstention juste sur les questions sans réponse (FQuAD 0,22 → 0,62).
- Environ 2,5 des 5,9 points perdus sur IFEval viennent de l'élagage : les consignes « réponds en kannada, persan… »
  ne peuvent plus être suivies.

### 5.4 Vitesse et mémoire (processeur seul)

Mac Intel, llama-bench, 8 fils, 64 jetons générés après 8 192 jetons de contexte :

- génération de 4,9 à 5,4 jetons/s, y compris quand le Mac bride son processeur à 50 % ;
- pic de mémoire de 1,77 Go (2,02 Go sans élagage) ;
- l'élagage rend la génération de 13 à 28 % plus rapide à bridage égal.

Sources : `mesures/vitesse-lot4-vocfr48k.md`. Les autres quantifications seront mesurées en *phase 4*.

### 5.5 Contexte long

À 64 000 jetons (environ 100 pages), S_doc reste à 0,851 sur 20 cas (mesuré le 18 octobre avec la base
Qwen3.5-2B élaguée, avant entraînement ; non remesuré avec le lot 4),
mais la première lecture prend **2 h 37** sur le Mac. Au-delà d'environ 30 pages, Localia doit plutôt rechercher les
passages utiles (`recherche/`, 3 000 jetons par défaut).

## 6. Limites et risques connus

- **Pas meilleur que la base dans l'ensemble** sur des documents et des questions qu'il n'a jamais vus (§ 5.1).
- **Incohérences** : il en signale moins que la base (−0,15).
- **Injection** : il suit plus souvent qu'elle une instruction cachée dans le document (−0,08). Ne pas lui confier de
  documents non fiables sans contrôle.
- **Rédaction** : il respecte moins bien les contraintes de format et de longueur (−0,07 ; IFEval −5,9).
- **Calcul** : MGSM −7,2 points.
- **Langues** : le vocabulaire élagué garde le français, l'anglais et l'ASCII. Les écritures non latines sont mal ou
  pas produites. La lecture de l'anglais n'en souffre pas (§ 5.3).
- **Domaine étroit** : l'entraînement ne porte que sur des fiches administratives françaises. Le comportement sur
  d'autres genres de documents n'a été mesuré que par les documents inventés du jeu secret.
- **Évaluation** : les cas ont été écrits par Claude, et la note automatique est imparfaite. Ni elle ni le juge ne
  reproduisent bien le jugement de l'auteur (§ 5.1).
- **Reproductibilité** : l'adaptateur final et la version pleine précision du lot 4 n'ont pas été conservés. Seul
  le Q4_K_M existe. La phase 4 refait les 32 derniers pas : le résultat sera voisin, pas identique au bit près.

## 7. Licence et mentions

- Poids : dérivés de Qwen/Qwen3.5-2B (Apache 2.0). Licence prévue : **Apache 2.0**, à confirmer par l'auteur avant
  toute publication.
- Données : informations issues des fiches Service-Public.fr (Direction de l'information légale et administrative),
  sous Licence Ouverte / Etalab 2.0, qui demande de mentionner la source. Les textes générés viennent de
  Qwen3.6-35B-A3B (Apache 2.0, aucune restriction lue sur l'usage de ses sorties).
- Les jeux d'évaluation ne sont pas publiés avec le modèle. Le jeu secret reste hors du dépôt.

## 8. Pour reproduire

Les étapes, les scripts et les noyaux Kaggle sont décrits dans `journal.md`, et les données dans `provenance.md`.
Les critères ont été fixés avant les mesures (`criteres.md`, amendements datés). Les écarts entre Claude et Codex
sont consignés dans `desaccords.md`.
