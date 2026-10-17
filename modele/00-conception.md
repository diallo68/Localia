# Défi 2 — Conception d'un modèle compact pour Localia

**Phase 1, conception (rien n'a été entraîné).** Rédigé le 17 octobre 2026 par Claude, avec une analyse indépendante de Codex (`codex/01-analyse-independante.md`). La critique croisée de Codex sur ce document **reste à faire** : Codex a atteint sa limite d'usage, et le prochain créneau ouvre le 22 octobre à 10 h 20. En attendant, voir l'auto-critique de `desaccords.md`.
**Statut : à valider par l'auteur avant toute suite.**

Convention : **[mesuré]** = mesuré ici sur la machine ; **[publié]** = chiffre d'un fournisseur ou d'un article ; **[calculé]** = calcul reproductible donné dans le texte ; **[supposé]** = estimation à vérifier.

---

## 0. En bref

1. **Périmètre proposé** : le *travail documentaire en français*. Il s'agit de répondre à partir d'un document fourni, de façon exacte, citée et brève, de rédiger sous contraintes, de signaler les incohérences et de s'abstenir quand l'information manque. C'est le cœur de Localia, et c'est là qu'un 2-4 Md peut réellement rivaliser avec un 20-40 Md, parce que les faits sont dans le document et pas dans les poids. Nous ne prétendrons rien sur la culture générale, les maths ou le code. Nous les mesurerons pour montrer où le modèle est inférieur.
2. **Base** : famille **Qwen3.5** (Apache 2.0). Raison décisive : exactement le même tokenizer que **Qwen3.6-35B-A3B** (Apache 2.0) [mesuré : empreintes SHA-256 identiques], ce qui ouvre la distillation sur logits et « sur politique », le levier le plus efficace en calcul.
   - **Candidat principal par défaut : Qwen3.5-2B**, le seul qui tienne 5 jetons/s à 8k dans les conditions réelles de la machine.
   - Le **4B** reste en lice **seulement si** l'élagage du vocabulaire et une quantification Q4_K le font passer au-dessus de 5 jetons/s à 8k, machine chargée. Le 4B est nettement meilleur au départ, et c'est la question n° 1 de la phase 2.
3. **Stratégie** : A + B combinées, dans cet ordre :
   - SFT sur des réponses de professeurs ouverts **filtrées par vérification mécanique** ;
   - distillation sur politique depuis Qwen3.6-35B-A3B ;
   - RL à récompense vérifiable (citations présentes dans le document, abstentions justifiées) ;
   - travail spécifique au CPU : élagage du vocabulaire, choix de la quantification.

   Rejetés : l'élagage structuré (coût et plafond de fichier) et le pré-entraînement de zéro (500 fois moins entraîné que les bases existantes).
4. **Contrainte découverte en mesurant** : la vitesse à 8k de contexte. En 3 passes alternées, dans l'état d'usage réel de la machine (charge de 16 à 25, 3 Go de swap) [mesuré] :
   - 4B IQ4_XS (seul Q4 du 4B sous 2,5 Go) : **4,1 à 4,35 jetons/s**, sous l'exigence. Machine plus calme, une série a donné 5,5 ;
   - 2B Q4_K_M : **7,2 à 9,3 jetons/s**.

   - 4B Q4_K_S (2,59 Go) : 4,4 à 4,6 jetons/s. Avec l'élagage du vocabulaire mesuré en principe (−48 % de jetons, ≤ 0,1 % d'allongement des textes ; matrice de vocabulaire = 33 % du fichier du 2B et 20 % du 4B), le calcul donne environ 2,33 Go et **4,9 à 5,1 jetons/s** pour le 4B : tout juste à la limite. Pour le 2B : 1,07 Go et environ +19 % de vitesse.

   Les vitesses varient d'environ 25 % selon la charge. L'exigence de 5 jetons/s sera donc vérifiée **dans des conditions réalistes** (logiciels habituels ouverts), pas seulement machine au repos.
5. **Budget recommandé** : scénario 2, **environ 250 €** de GPU loué, après un pilote à 0 € en phase 2. Le scénario 0 € ne permet honnêtement que d'« améliorer la base ».
6. **Ce que je ne sais pas** : la qualité réelle du français écrit par Qwen3.5 ; l'écart de départ entre un 4B et un 24-31B sur nos tâches (il décide de tout, et se mesure à 0 €) ; la compatibilité de l'entraînement avec les couches DeltaNet.

---

## 1. Diagnostic de la machine [mesuré, 17 oct. 2026]

| Élément | Valeur |
|---|---|
| Processeur | Intel Core i9-9880H, 8 cœurs / 16 fils, AVX2 + FMA + F16C, **pas d'AVX-512** |
| Mémoire | 16 Go DDR4-2666 double canal, débit théorique 42,7 Go/s [calculé] ; **environ 25 Go/s effectifs** [déduit des mesures : 2,48 Go × 10,1 jetons/s pour Phi-4-mini] |
| Mémoire libre | environ 0,6 Go libres + 5,6 Go inactifs au moment du diagnostic (vm_stat) ; charge moyenne 2,1 |
| Disque | **15 Go libres** après téléchargement des 3 bases candidates (5,9 Go). C'est la contrainte la plus serrée pour la phase 2 |
| Logiciels | macOS 15.8.1 ; Ollama 0.40.5 ; llama.cpp build 11146 (llama-bench, llama-perplexity, llama-quantize, llama-server) ; Python 3.13 (Anaconda), **sans PyTorch** ; Codex CLI 0.155.1 |
| Laboratoire existant | `~/localia-labo` (76 Go) : élagage d'experts déjà réalisé (`prune-gguf.py`), mesures MGSM-fr, perplexité, vitesse, essais de décodage spéculatif |

### Vitesse sur CPU seul (llama-bench, 8 fils, 2 répétitions) [mesuré]

| Modèle | Fichier | Lecture du contexte (pp512) | Génération à vide (tg64) | Génération à 8k de contexte |
|---|---|---|---|---|
| Qwen3.5-2B Q4_K_M | 1,28 Go | 126 j/s | **17,2 j/s** | 11,1 j/s au calme ; **7,2 à 9,3 j/s** en charge (lecture du contexte : 68 j/s) |
| Qwen3.5-4B IQ4_XS | 2,48 Go | 27 j/s | **6,1 j/s** | 5,5 j/s au calme ; **4,1 à 4,35 j/s** en charge (3 passes, fa=0) |
| Qwen3.5-4B Q4_K_S | 2,59 Go (au-dessus du plafond) | — | — | **4,4 à 4,6 j/s** en charge (lecture : 28 à 30 j/s, 1,7 fois plus rapide qu'IQ4_XS) |
| Ministral 3 3B Q4_K_M | 2,15 Go | 75 j/s | 9,7 j/s | **2,1 j/s** (lecture : 21 j/s) |
| Phi-4-mini Q4_K_M (3,8 Md) | 2,49 Go | 38 à 63 j/s | 6,4 à 10,1 j/s (deux séries) | **2,2 j/s** (lecture : 21 j/s) |
| Gemma 4 E4B Q4_K_M | 4,98 Go | 21 j/s | 6,8 j/s | — |
| Qwen3.5-9B Q4_K_M | 5,68 Go | 16 j/s | **3,7 j/s** | — |

Ce qu'on en tire :
- **À 8k de contexte, avec les réglages par défaut**, les modèles à attention classique s'effondrent : Ministral 3 3B et Phi-4-mini passent sous 2,2 jetons/s, alors que les Qwen3.5 hybrides tiennent (11,1 jetons/s pour le 2B, 5,5 pour le 4B). **Correction après une seconde série** (`mesures/vitesse-flash-attention.md`) : en **désactivant la flash attention** (`-fa 0`), Ministral remonte à 4,2 jetons/s, au niveau du 4B mesuré dans la même série (4,2). Sur ce CPU, la flash attention ralentit la génération à contexte long (Ministral : 2,0 avec, 4,2 sans). La conclusion « l'hybride est indispensable » est donc **retirée** : elle ne tient que pour le 2B (11 jetons/s) contre les 3-4 Md à attention complète.
- **Variabilité** : Phi-4-mini a donné 10,1 puis 6,4 jetons/s à vide à une heure d'écart (charge de la machine, chaleur). Toute mesure de vitesse finale sera répétée 3 fois et rapportée en médiane, machine au repos.
- Qwen3.5-9B ne tient **pas** l'exigence de 5 jetons/s, même à vide. Le « gros modèle » de la gamme est déjà inutilisable sur cette machine : un 2-4 Md excellent a donc une vraie raison d'être.
- Les quantifications IQ (IQ4_XS) sont lentes sur ce CPU AVX2, et surtout en lecture du contexte (4,7 fois plus lente que le 2B en Q4_K). Il faut privilégier les K-quants (Q4_K_S / Q4_K_M).
- Le contexte de 8k coûte environ 35 % de vitesse au 2B, malgré une architecture hybride où seule 1 couche sur 4 garde un cache KV. Sur CPU, le calcul de l'attention pèse autant que la mémoire.
- Une mesure ancienne [mesuré, laboratoire] montre que le décodage spéculatif par MTP a **divisé par deux** la vitesse du 27B sur cette machine (fiche 10). Ne rien promettre de ce côté.

---

## 2. État de l'art critique : pourquoi un petit modèle récent égale un ancien gros

Les vrais leviers, classés par poids réel :

1. **Le volume et la qualité des données de pré-entraînement.** C'est l'essentiel, et c'est hors de notre portée.
   - Chinchilla (arXiv:2203.15556) fixait l'optimum à environ 20 jetons par paramètre.
   - Les petits modèles actuels sont « sur-entraînés » délibérément pour l'inférence (Sardana et al., arXiv:2401.00448). SmolLM3-3B a vu **11,2 billions** de jetons [publié], soit environ 3 700 par paramètre. Qwen3 en annonce 36 billions pour toute la famille (arXiv:2505.09388).
   - Le filtrage par qualité, de type FineWeb-Edu ou Phi (« Textbooks are all you need », arXiv:2306.11644), donne beaucoup sur les benchmarks de raisonnement scolaire.
2. **La distillation depuis un grand modèle.**
   - Gemma 2 (arXiv:2408.00118) distille les logits dès le pré-entraînement.
   - Llama 3.2 1B/3B et Minitron (arXiv:2407.14679) élaguent puis distillent.
   - DeepSeek-R1 (arXiv:2501.12948) montre que distiller un grand raisonneur dans un petit modèle bat le RL appliqué directement au petit.
   - Qwen3 utilise une distillation « forte vers faible » pour ses petits modèles.
   - La distillation sur politique (GKD, arXiv:2306.13649 ; Thinking Machines, oct. 2025) atteint un score donné avec environ un ordre de grandeur de calcul en moins que le SFT [publié, chiffre des auteurs].
3. **Le post-entraînement par RL à récompense vérifiable** (Tülu 3, arXiv:2411.15124 ; DeepSeekMath/GRPO, arXiv:2402.03300). Très efficace là où une récompense se calcule (maths, code, format). Peu d'effet sur les connaissances.
4. **Le calcul au moment de répondre (réflexion).** C'est **le piège marketing principal**. Beaucoup de comparaisons « le petit bat le gros » laissent le petit réfléchir pendant 32 000 à 80 000 jetons [publié, fiche Qwen3.5-2B]. Sur notre machine, à 6-11 jetons/s, 1 000 jetons de réflexion coûtent 1,5 à 3 minutes [calculé]. Sans réflexion, Qwen3.5-2B tombe de 78,6 à 61,2 sur IFEval [publié]. **Nous comparerons tous les modèles à budget de jetons égal** (fiche 14).
5. **L'architecture** : GQA, attention linéaire hybride (Gated DeltaNet, arXiv:2412.06464), MoE, embeddings par couche (Gemma 3n/4). Elle réduit la mémoire et le calcul, **elle n'ajoute pas de connaissances**.
6. **La contamination.** Une partie des progrès sur les benchmarks publics vient de recouvrements avec les données d'entraînement. GSM1k (arXiv:2405.00332) a mesuré des chutes allant jusqu'à environ 13 points pour certains modèles sur des problèmes neufs équivalents. D'où notre jeu maison secret.

**Plafond infranchissable** : la capacité de stockage des connaissances. Elle vaut environ 2 bits par paramètre (Allen-Zhu et Li, « Physics of Language Models 3.3 », arXiv:2404.05405) [publié], soit de l'ordre de 8 Gbit pour un 4B contre 50 à 60 pour un 27-31B [calculé]. Aucun post-entraînement ne comble cet écart sur la culture générale. **C'est pourquoi le périmètre doit placer les faits dans le contexte.**

---

## 3. Périmètre

Détail et avocat du diable : fiche `idees/01-perimetre-documentaire.md`.

| Domaine | Ambition | Justification |
|---|---|---|
| **Travail documentaire en français** (extraction, synthèse, rédaction contrainte, citations, abstention, incohérences, résistance aux injections) | **Rivaliser** avec les 20-40 Md | Faits dans le contexte ; récompenses vérifiables ; c'est l'usage principal de Localia |
| Qualité du français écrit | Égaler les 9-12 Md | Mesurable (juge et humain) ; gagnable par les données |
| Suivi de consignes (IFEval-fr) | Dépasser la base | Gagnable par SFT et RL |
| Culture générale, maths, code, usage d'outils | **Aucune prétention** ; garde-fou de non-régression | Plafond de capacité (section 2) |

Codex est arrivé indépendamment à la même conclusion (« la fidélité documentaire, pas le français entier »). Divergences : voir `desaccords.md`.

---

## 4. Stratégies évaluées

| | Stratégie | Gain espéré sur S_doc [supposé] | Coût [calculé] | Verdict |
|---|---|---|---|---|
| A | SFT + préférences + RL vérifiable | +5 à +15 (SFT), +2 à +5 (RL) | 30 à 150 € | **Retenu**. Socle : fiches 04, 05 |
| B | Distillation (séquences puis logits sur politique) | +3 à +10 au-delà du SFT | 30 à 80 € | **Retenu, levier n° 1** grâce au tokenizer commun : fiche 03 |
| C | Élagage structuré + récupération | Retrouver le 4B, au mieux | 400 à 4 000 € | **Rejeté v1** : fiche 11 |
| D | Fusion, adaptateurs | 0 à +3 | ≈ 0 € | Différé ; garde-fou contre l'oubli : fiche 13 |
| E | Pré-entraînement de zéro | Négatif | ≥ 1 000 € | **Rejeté** : fiche 12 |
| F | Architecture et CPU : vocabulaire élagué, quantification, MTP | 0 en qualité ; +10 à 20 % de vitesse ; taille | 0 € | **Retenu** (fiche 08), MTP à mesurer (fiche 10), quantification soignée (fiche 09) |
| G | Idées originales | voir ci-dessous | faible | Retenues : fiches 06, 07, 08, 14 |

**Idées originales (G) retenues** :
- **08 — Élagage du vocabulaire** (Claude) : 248 320 → environ 80 000 jetons. Le 4B passe sous 2,5 Go en Q4_K, avec 10 à 20 % de vitesse en plus, sans entraînement. Testable à 0 € dès la phase 2.
- **14 — Régime « sans réflexion »** (Claude) : entraîner et évaluer dans le seul régime utilisable à 5-10 jetons/s. On garde les réponses finales vérifiées d'un professeur qui, lui, a réfléchi.
- **05 + co-conception avec Localia** (Claude) : la récompense du RL et le filtre des données sont **le même vérificateur** que celui des sources dans Localia. Le modèle apprend exactement ce que le produit contrôle.
- **06 — Documents contrefactuels** (Codex) : apprendre à suivre le document plutôt que sa mémoire. Données gratuites et vérifiables.
- **07 — Preuves avant la réponse** (Codex, amendée) : repères courts plutôt qu'extraits, pour ne pas payer 20 s de génération par réponse.
- **09 — Récupération des pertes Q4** (Codex) : différée, seulement si l'écart BF16/Q4 dépasse 1,5 point.

**Enchaînement prévu** (scénario 2) :
1. SFT d'amorçage sur environ 40 000 exemples vérifiés ;
2. distillation sur politique depuis Qwen3.6-35B-A3B ;
3. RL vérifiable court ;
4. interpolation avec la base si l'oubli est mesuré ;
5. élagage du vocabulaire et quantification ;
6. évaluation finale.

---

## 5. Choix de la base

Détail : fiche `idees/02-choix-base.md`.
- **Candidat principal par défaut : Qwen3.5-2B.**
  - Pour : 1,28 Go ; 7 à 11 jetons/s à 8k [mesuré] ; tokenizer identique au professeur.
  - Contre : faible sans réflexion au départ (IFEval 61,2, MMMLU 56,9) [publié]. C'est aussi lui qui a le plus à gagner du post-entraînement.
  - Comparateurs « 5 à 10 fois plus gros » : 10 à 20 Md.
- **Candidat conditionnel : Qwen3.5-4B.**
  - Pour : nettement meilleur au départ.
  - Contre : en IQ4_XS, 4,1 à 4,35 jetons/s à 8k en charge [mesuré], sous l'exigence ; 2,74 Go en Q4_K_M, au-dessus du plafond.
  - Il revient si l'élagage du vocabulaire (fiche 08) et un Q4_K le font passer au-dessus de 5 jetons/s, sous 2,5 Go.
- **Concurrent : Ministral 3 3B** (Apache 2.0, 2,15 Go, origine française). À 8k de contexte : 2,1 jetons/s avec flash attention, 4,2 sans [mesuré], soit le niveau du 4B Qwen : même problème de vitesse. Son tokenizer différent impose un professeur Mistral : Mistral Small 4, 119 Md MoE, plus cher à servir. Retenu seulement s'il écrit nettement mieux en français (+5 points) au concours de bases.
- **Écartés** : Gemma 4 E2B/E4B (3,1 et 5,0 Go, hors plafond à cause des embeddings par couche) ; SmolLM3-3B (scores inférieurs ; intéressant seulement pour la transparence des données).

---

## 6. Budget de calcul

**Hypothèses de prix [publié, oct. 2026]** :
- H100 80 Go : 1,99 à 2,69 $/h (RunPod Community), 3,99 $/h (RunPod Secure, Lambda), médiane Vast.ai d'environ 2,72 $/h ;
- A100 80 Go : environ 1,8 $/h ; L40S : environ 1,1 $/h.

Planification à **3 €/H100-h** (hypothèse prudente : 1 $ ≈ 1 €, plus le stockage). Débit utile supposé : 350 TFLOP/s en BF16 (environ 35 % du pic).

Formule : FLOP d'entraînement ≈ 6 × paramètres × jetons. Les durées réelles seront remplacées par celles du pilote.

| Étape (élève 4B) | Volume | H100-h [calculé, ×2 de marge] | € |
|---|---|---|---|
| Génération par le professeur (35B-A3B, vLLM) | 40 000 exemples, environ 100 M jetons lus et 16 M produits | 4 à 10 | 12 à 30 |
| SFT complet | 2 passes sur environ 100 M jetons lus | 4 à 8 | 12 à 24 |
| Distillation sur politique | environ 50 M jetons échantillonnés | 10 à 20 | 30 à 60 |
| RL vérifiable (GRPO) | 2 000 consignes × 8 × 500 jetons, plusieurs itérations | 15 à 40 | 45 à 120 |
| Évaluation des comparateurs de 20 à 40 Md | 5 modèles × environ 1 500 cas | 5 à 10 | 15 à 30 |
| Variante 2B (mêmes étapes, environ 2 fois moins chère) | — | 10 à 20 | 30 à 60 |

### Trois scénarios

| | **0 €** | **~250 € (recommandé)** | **~1 500 €** |
|---|---|---|---|
| Calcul | Mac + GPU gratuit (Kaggle : environ 30 h/semaine de T4/P100 [supposé, conditions à vérifier]) | environ 80 H100-h | environ 450 H100-h |
| Données | quelques milliers d'exemples générés localement par le 35B élagué (environ 3 à 5 jetons/s : plusieurs jours) | 40 000 exemples vérifiés, professeur en pleine précision | 150 000 exemples ; continuation du pré-entraînement en français (2 à 5 Md de jetons de documents, environ 60 à 120 H100-h) |
| Entraînement | LoRA sur 2B (Kaggle), sans distillation sur logits | SFT + distillation sur politique + RL court, 4B et 2B | toutes les étapes, 3 graines, ablations de chaque idée, branche Ministral si justifiée, QAT |
| Évaluation | bases et repères locaux seulement ; pas de 20-40 Md (ils ne tiennent pas en RAM) | complète (comparateurs sur GPU) | complète + double notation humaine élargie |
| Résultat réaliste [supposé] | « Améliore la base » (+5 points) sur le 2B, avec une forte incertitude | « Dépasse sa classe » probable ; « Rivalise » possible contre une partie des comparateurs (je l'estime à 30-50 %, **estimation subjective**) | Meilleure chance de « Rivalise » (50-65 %, subjectif) ; aucune garantie |

Répartition proposée pour 250 € :

| Poste | € |
|---|---|
| Génération | 30 |
| SFT | 25 |
| Distillation sur politique | 50 |
| RL | 50 |
| Variante 2B | 30 |
| Évaluation des comparateurs | 25 |
| Réserve (erreurs, reprises) | 40 |

Arrêt anticipé possible après chaque étape (critères en section 8).

---

## 7. Protocole d'évaluation (figé)

Tout est dans **`criteres.md`**. En résumé :
- jeu maison **secret** de 240 cas sur environ 40 documents neufs, écrit et haché (SHA-256) avant tout entraînement ;
- la banque Localia (147 questions) sert seulement au développement ;
- benchmarks publics français : FQuAD 2.0, Belebele, IFEval-fr pour le périmètre ; MMMLU-fr et MGSM-fr comme garde-fous ;
- 5 comparateurs de 20 à 40 Md, dans les mêmes conditions (sans réflexion, même budget de jetons) ;
- notation automatique d'abord, puis juge ouvert non-Qwen, puis contrôle humain à l'aveugle (κ publié) ;
- bootstrap apparié regroupé par document, marge de non-infériorité de 3 points ;
- conditions obligatoires : ≤ 2,5 Go, **≥ 5 jetons/s à 8k**, ≤ 4 Go de RAM, import Ollama et Localia, décontamination, provenance ;
- niveaux de résultat annoncés d'avance : « Rivalise », « Dépasse sa classe », « Améliore la base », « Échec ».

**Décontamination** :
- séparation par document entre entraînement et évaluation ;
- recouvrement de 13-grammes ;
- MinHash ;
- voisins sémantiques ;
- 50 vérifications manuelles.

Limite assumée : on ne peut pas certifier l'absence des benchmarks dans le pré-entraînement opaque de Qwen. Le jeu secret neuf est la parade.

---

## 8. Plan de la phase 2 (après validation) et points d'arrêt

| Étape | Coût | Arrêt si… |
|---|---|---|
| 2.1 Écrire le jeu secret (240 cas) et les 60 cas de développement neufs ; figer le hachage | 0 € | — |
| 2.2 **Mesure décisive** : bases (2B, 4B, Ministral) et repères locaux (Qwen3.5-9B, Gemma 3 12B) sur le jeu de développement, notation automatique + humaine. Les 20-40 Md ne tiennent pas dans 16 Go : on les mesure seulement si l'auteur choisit une API gratuite ou peu chère qui les sert (usage d'évaluation seulement, autorisé) | 0 € (API : quelques €) | écart entre la base 4B et le repère 12 Md > 20 points → on révise l'ambition à « Dépasse sa classe » et on le dit |
| 2.2 bis Vitesse : 4B en Q4_K_S et Q4_K_M ; 6, 8, 12 et 16 fils ; 4k et 8k | 0 € | — |
| 2.3 Élagage du vocabulaire du 2B, puis du 4B : perplexité et vitesse | 0 € | gain de vitesse < 5 % ou perplexité dégradée de plus de 1 % → abandon de la fiche 08 |
| 2.4 Chaîne de données sur un échantillon : collecte, nettoyage, déduplication, décontamination, génération locale, vérificateurs, mesure de qualité | 0 € | taux de rejet des vérificateurs > 70 % → revoir les consignes du professeur |
| 2.5 Mini-entraînement de bout en bout : LoRA sur Qwen3.5-0.8B ou 2B (CPU ou Kaggle), conversion en GGUF, import dans Ollama, essai dans Localia | 0 € | échec de la conversion DeltaNet → changer de base (Ministral) |
| 2.6 Courbes d'échelle (500, 1 000, 2 000 exemples) et extrapolation avec marges | 0 € | aucune pente mesurable → ne pas dépenser |
| 2.7 Plan chiffré de la phase 3, soumis à l'auteur | — | — |

**Autorisations qui seront demandées en phase 2** (non utilisées à ce jour) :
- installer PyTorch pour CPU (environ 0,3 à 0,8 Go) et quelques paquets Python (transformers, peft, datasets), dans un environnement séparé ;
- télécharger Qwen3.5-0.8B (environ 1,6 Go en BF16) et des échantillons de données de moins de 1 Go ;
- utiliser un compte Kaggle ou Colab gratuit si l'auteur en a un.

---

## 9. Risques principaux et inconnues

| Risque | Probabilité [supposé] | Parade |
|---|---|---|
| Le 4B ne tient pas 5 jetons/s à 8k | moyenne à forte | élagage du vocabulaire, Q4_K_S, réglage du nombre de fils ; sinon le 2B devient le modèle principal |
| L'écart de départ avec les 20-40 Md est trop grand | moyenne | mesure à 0 € avant toute dépense (étape 2.2) |
| L'outillage d'entraînement DeltaNet (LoRA, distillation, GGUF) bute | moyenne | essai de bout en bout sur 0,8B à 0 € (étape 2.5) ; repli sur Ministral |
| Les vérificateurs littéraux rendent le style plat | moyenne | critère de qualité rédactionnelle, 20 % de données générales |
| Juge ouvert peu fiable en français | moyenne | κ publié ; notation humaine si κ < 0,6 |
| Disque (15 Go libres) | forte | entraînement et conversions sur la machine louée ; seuls les GGUF reviennent sur le Mac |
| Licences des professeurs (Gemma 4 « terms », Qwen3.8) | faible à moyenne | Qwen3.6-35B-A3B seul professeur tant que les autres ne sont pas vérifiés |

**Je ne sais pas** :
- si Qwen3.5 écrit un français idiomatique ;
- si la distillation sur politique fonctionne aussi bien hors des maths ;
- si notre juge ouvert distingue des réponses de qualité proche ;
- si le gain de l'élagage du vocabulaire se matérialise sur ce CPU ;
- quel sera le coût réel des reprises.

---

## 10. Désaccords et suite

- Désaccords Claude/Codex : `desaccords.md`.
- Journal : `journal.md`.
- Toutes les fiches, y compris les idées rejetées : `idees/`.
