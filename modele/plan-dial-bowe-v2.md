# Plan de Dial-bowe-GN-224-2B v2 (à valider par l'auteur avant toute génération)

Rédigé le 11 novembre 2026 par Claude, à partir de `journal.md`, `rapport-final.md` et des essais faits dans Localia
du 9 au 11 novembre. **Rien n'est lancé** : ni génération de données, ni entraînement, ni dépense. Les chiffres
marqués [mesuré] viennent du journal ou des séries de Localia ; [supposé] signale une estimation.

## 1. Pourquoi une v2

### 1.1 Ce que la v1 a montré [mesuré]

| Mesure | Base Qwen3.5-2B | Dial-bowe v1 | Écart |
|---|---:|---:|---|
| Jeu secret (240 cas, documents français) | 0,772 | 0,766 | −0,006 [−0,057 ; +0,047] |
| FQuAD 2.0 (abstention juste) | 0,420 | 0,610 | **+0,190** |
| IFEval (consignes vérifiables) | 0,654 | 0,595 | **−0,059** |
| MGSM-fr (calcul) | 0,584 | 0,512 | **−0,072** |
| 133 questions métiers, notation à l'aveugle (/5) | 3,01 | 2,79 | −0,22 [−0,51 ; +0,08] |
| 40 questions communication, notation à l'aveugle (/5) | 3,17 | 2,95 | −0,23 [−0,68 ; +0,28] |

- La v1 sait dire « ce n'est pas dans le document », et ce gain se transfère à l'anglais.
- Elle ne fait pas mieux que sa base ailleurs, et recule en calcul, en consignes, en synthèse et en détection
  d'incohérences.

### 1.2 Défauts vus dans Localia (9-11 nov.) [mesuré]

1. **Refus des demandes globales** : « tu peux analyser mon article » → « je n'ai pas accès au fichier », même avec
   le texte entier fourni et un rappel. La même demande formulée « Analyse ce document : objectif, méthode… »
   fonctionne.
2. **Synthèse de document faible** : 1,33/5 en synthèse et 2,00/5 en calcul sur document, série communication.
3. **Réponses deux fois plus courtes que la base**, souvent trop pauvres pour un résumé ou une analyse.
4. **Calcul** : erreurs de multiplication (2,6 × 3 450 = 9 170), arrondis faux (179,4 sacs → 179 au lieu de 180 ;
   34,7 arrondi à 34), « combien de fois » calculé comme une différence.
5. **Dates et ordres de grandeur** sans document : COVID « détecté en mars 2020 », « des milliers de décès ».

### 1.3 Causes probables (liées à l'entraînement v1)

- **Données trop étroites** : 4 094 exemples tirés de fiches Service-Public seulement. Pas d'articles scientifiques,
  pas de rapports, peu d'anglais, presque pas de demandes portant sur tout le document.
- **Formats courts imposés** : réponses de 120 à 200 mots à l'entraînement, d'où des réponses trop brèves.
- **Beaucoup d'abstentions** : 11,5 % d'exemples d'abstention, sans contre-exemples de demandes vagues mais
  légitimes. Le modèle a appris à refuser au moindre doute.
- **Aucune donnée de rappel** des compétences générales : d'où l'oubli en calcul et en consignes (MGSM, IFEval).
- **Calculs vérifiés sur le résultat seulement** : 64 % des réponses « justes » de l'élève avaient un raisonnement
  faux (lot 6).

## 2. Objectif de la v2

Un assistant de 2 Md qui **rédige, résume, analyse, vérifie et cherche** dans les documents de l'utilisateur, en
français et en anglais, sur un ordinateur ordinaire. L'utilisateur vérifie à la fin, et Localia l'aide à le faire
(pages cliquables, calculs refaits, couverture du document, sources Internet).

Concrètement, la v2 doit :
1. **ne reculer nulle part face à sa base** : c'est la condition première, que la v1 n'a pas tenue ;
2. **répondre à toute demande sur un document fourni**, même vague (« tu peux regarder mon article ? ») ;
3. **faire de bons résumés et de bonnes analyses de documents entiers**, à la longueur demandée ;
4. **écrire chaque calcul en entier et arrondir correctement**, pour que la calculatrice de Localia puisse le
   refaire ;
5. **garder l'abstention juste** de la v1, sans refus à tort ;
6. **citer ses sources dans le format de Localia** : pages (« p. 3 ») et sources Internet ([1], [2]).

**Hors objectif** : la culture générale sans document. Un modèle de 2 Md ne retiendra pas les dates. La réponse est
le bouton Internet et les documents joints, pas l'entraînement.

## 3. Critères de succès, à figer avant toute génération

Mesurés une seule fois, à la fin, sur le modèle Q4_K_M élagué (vocfr48k), sans réflexion, température 0.

| Critère | Seuil | v1 (repère) |
|---|---|---|
| **Obligatoire** : IFEval (anglais) | ≥ base élaguée − 1 point | −5,9 |
| **Obligatoire** : MGSM-fr | ≥ base élaguée − 1 point | −7,2 |
| **Obligatoire** : MMMLU-fr, Belebele fr | ≥ base élaguée − 1,5 point | tenu |
| **Obligatoire** : refus à tort sur les demandes globales (jeu **G-test**, §4) | ≤ 5 % | à mesurer sur G (étape 0) |
| **Obligatoire** : vitesse et mémoire | identiques à la v1 (même architecture) | fichier 1,11 Go ; mémoire 1,77 à 2,39 Go |
| **But** : nouveau jeu secret S2 (§4) | v2 − base ≥ +5 points, borne basse de l'IC > 0 (bootstrap par document) | — |
| **But** : séries métiers et communication de Localia, notation à l'aveugle | v2 ≥ base (IC) | −0,22, −0,23 |
| **But** : préférence de l'auteur, 40 paires à l'aveugle v2 / base | v2 préférée dans plus de 50 % des paires (objectif) ; **démontré** seulement à partir de 27 victoires sur 40, égalités écartées (test binomial bilatéral à 5 %) | — |
| **À garder** : FQuAD 2.0 | ≥ base + 10 points | +19 |

Si un critère obligatoire n'est pas tenu, la v2 n'est pas publiée comme remplaçante de la v1. On le dit, avec les
mesures.

### 3 bis. Amendements du 11 novembre 2026 (relecture de Codex, `codex/03-relecture-plan-v2.md`)

Décidés avant toute réponse de modèle sur S2 et G-test. Les deux versions du plan restent dans l'historique git.

1. **« Base » veut dire la base élaguée** (Qwen3.5-2B vocfr48k, même vocabulaire que la v2). L'élagage seul coûte
   déjà environ 2,5 points d'IFEval par rapport à la base d'origine ; les deux sont mesurées et publiées.
2. **G est découpé** : G (90 cas, 30 documents) devient un jeu de **développement** ; un jeu **G-test** séparé
   (60 cas, 20 autres documents, 18 formulations qui ne sont pas dans G) porte le critère obligatoire et n'est ouvert
   qu'à l'évaluation finale, avec S2.
3. **Précision de S2 corrigée** [calculé par Codex, hypothèses de `criteres.md`] : avec 5 cas par document, l'IC d'un
   écart est d'environ **±8,5 points**, pas ±5. Le critère reste « +5 points avec borne basse > 0 », ce qui demande en
   pratique un gain de 8 à 9 points ; un gain plus petit sera présenté comme non démontré.
4. **Mémoire** : la v1 occupe 1,77 à 2,39 Go de mémoire selon le contexte ; 1,11 Go est la taille du fichier.
5. **Rappel** : 1 500 exemples sur 6 400 font 23,4 % des exemples, pas 25 %. La part en **jetons** sera mesurée et
   publiée ; les calculs et contraintes de format du rappel sont vérifiés par programme, pas seulement par le
   professeur.
6. **Un seul changement à la fois** après un échec (§7, étape 3) : d'abord le rappel à 40 %, puis, seulement si
   cela ne suffit pas, autre chose ; le seuil de déclenchement est aligné sur les critères (−1 point, pas −2).
7. **Essai de la DPO** avant la production complète : 100 paires, mesure de la mémoire, du débit et des réponses
   tronquées. Garde-fou de longueur **par paire** (rapport des longueurs ≤ 1,5), pas seulement en moyenne. Formule :
   log-vraisemblances divisées par le nombre de jetons de la réponse (DPO normalisée par la longueur).
8. **Séparation des données** : G, G-test et S2 n'alimentent ni le SFT, ni le rappel, ni les paires DPO ; leurs
   documents et formulations ne sont jamais transmis au professeur (`eval/exclusions-entrainement-v2.txt`).
9. **Préférence humaine** (décision de l'auteur, 11 nov.) : on garde les deux lectures, « préférée dans plus de
   50 % des paires » comme objectif, et « au moins 27 victoires sur 40, égalités écartées » pour dire « démontré ».
10. **Limites des notes automatiques** : une page juste ne prouve pas qu'elle étaye l'affirmation, et ne pas refuser ne
   prouve pas une bonne analyse. C'est pourquoi la préférence humaine est gardée.

## 4. Évaluation, préparée avant les données

C'est la leçon n° 1 de la v1 : le jeu de développement a trompé (+5,7 points annoncés, −0,6 en réalité). Tout est
donc écrit et figé **avant** de générer la moindre donnée.

| Jeu | Contenu | Rôle | Qui l'écrit |
|---|---|---|---|
| **G** : demandes globales (développement) | 30 documents (articles, rapports, fiches ; FR et EN) × 3 formulations vagues (« tu peux analyser mon article », « c'est quoi ce document ? », « can you look at this? ») = 90 cas | taux de refus (automatique), réglage | Claude, à partir de documents publics CC-BY |
| **G-test** : demandes globales (test) | 20 autres documents × 3 formulations absentes de G = 60 cas | critère obligatoire, ouvert **une seule fois** | Claude, rangé hors du dépôt |
| **S2** : nouveau jeu secret | 150 cas sur 30 documents nouveaux, FR 70 % / EN 30 % : résumé, analyse, extraction, calcul sur document, citation de pages, abstention, incohérence (avec fausses alertes), rédaction contrainte | résultat principal, ouvert **une seule fois** | Claude, rangé hors du dépôt, empreinte publiée |
| **Bancs publics** | IFEval, MGSM-fr, MMMLU-fr, Belebele fr et en, FQuAD 2.0, SQuAD 2.0 | contrôle de régression | existants (`eval/bancs/`) |
| **Séries de Localia** | 133 questions métiers et 40 communication | développement, notation à l'aveugle | existantes ; elles servent au réglage, donc **pas** de preuve finale |
| **Préférence humaine** | 40 paires v2 / base tirées de S2, ordre au hasard | contrôle humain | l'auteur |

- La préférence par paires remplace la note de 1 à 5 : celle-ci n'a pas fonctionné (κ = −0,04 entre l'auteur et le
  juge). Choisir la meilleure de deux réponses est plus simple et plus fiable.
- **Limite honnête** : avec 150 cas sur 30 documents, l'IC d'un écart fait environ ±8,5 points (§3 bis). Un gain de
  quelques points ne pourra pas être démontré.
- **Empreintes** (SHA-256 des cas, des documents et des pages lues par Localia ; `eval/outils-v2/assembler_v2.py`),
  figées le 11 nov. 2026 :
  - G : `2058e0ecfd3abb340bdad2738cb7d2f23a6486ad4ece02bc6fb67e8e07b9f9ee`
  - G-test : `f57b405818653688d77eb00b90257f02f60b5763ce5202b43c65f6637b493536`
  - S2 : `ab964604fbed0964b3dde68252fb73ec4b4d2ab01bbc13bcca036cebb3aac9e1`
- **Notation automatique** : `eval/outils-v2/noter_v2.py`, contrôlée avant tout modèle sur S2 : réponses attendues
  0,965 ; « toujours s'abstenir » 0,18 ; « toujours refuser » 0,01 ; « toujours signaler une incohérence » 0,02.

## 5. Données

### 5.1 Sources (toutes ouvertes, aucune sortie de modèle propriétaire)

- **Documents** :
  - fiches Service-Public (Licence Ouverte), déjà utilisées ;
  - articles HAL et arXiv sous licence **CC-BY seulement** (filtrés sur la licence) ;
  - rapports publics (INSEE, ministères, FAO, OMS) sous licence ouverte ;
  - Wikipédia FR et EN (CC-BY-SA) **[à vérifier]** : utiliser un texte CC-BY-SA comme document d'entrée pour générer
    des exemples est courant, mais l'obligation d'attribution doit être relue avant de publier les données.
  - Domaines alignés sur le profil de Localia : enseignement, recherche, agriculture, communication, ingénierie,
    santé (non clinique), droit, finance.
- **Professeur** : Qwen3.6-35B-A3B (Apache 2.0, même tokenizer), sur Kaggle, comme pour la v1.
- **Exclusions** : aucun document de G ou de S2 ; décontamination par 13-grammes comme en v1
  (`decontamination.md`).

### 5.2 Composition du lot SFT (environ 6 400 exemples) [supposé]

| Type | Exemples | Ce qu'il corrige | Vérification |
|---|---:|---|---|
| Demandes globales : résumé, analyse (objectif, méthode, résultats, limites), plan, relecture, sur document entier, avec **formulations vagues** | 1 500 | refus à tort, synthèse faible, réponses trop courtes | professeur juge ; longueur conforme à la demande |
| Extraction et citation au format de Localia (« [nom — Page N, extrait k] » → « p. N ») | 800 | sources cliquables | page citée retrouvée dans l'extrait (automatique) |
| Calcul sur document : nombres et réponses **générés par programme**, opérations écrites en entier, unités, arrondi au supérieur ou à l'inférieur selon le sens, « combien de fois » | 800 | MGSM, calculs faux, arrondis | chaque égalité refaite par `verify.js` de Localia, plus le résultat attendu, plus le raisonnement jugé par le professeur |
| Abstention à la limite **et** réponse partielle (« voici ce que dit le document ; il ne précise pas X ») | 500 (8 %, contre 11,5 %) | garder l'abstention sans refus à tort | professeur juge |
| Rédaction sous contrainte vérifiable (longueur, format, nombre de points, langue), FR et EN | 600 | IFEval | contraintes vérifiées par programme |
| Incohérences et injections, **avec autant de documents sans problème** | 400 | fausses alertes du lot 5 | position de l'incohérence connue (insérée par programme) |
| Pages Internet numérotées [1] [2] [3], sources concordantes ou contradictoires | 300 | interrupteur Internet de Localia | citations retrouvées dans les pages |
| **Rappel** : réponses de la **base elle-même** à des consignes générales (calcul, consignes, explication, code simple), gardées si le professeur les juge bonnes | 1 500 (25 %) | oubli (MGSM, IFEval) | professeur juge |

- **Longueurs** : réponses de 50 à 700 mots selon la demande, et non plus de 120 à 200 mots.
- **Langues** : 70 % français, 30 % anglais.
- **Rappel par les réponses de la base** : la base reste sur sa propre distribution là où elle est bonne. C'est la
  méthode la moins coûteuse contre l'oubli (pas de données externes à filtrer).

### 5.3 Paires de préférence pour l'étape DPO (environ 1 500 paires)

- **Réponses refusées** : produites par le modèle lui-même (après le SFT) et par la v1 :
  - refus des demandes globales ;
  - calcul faux ;
  - injection suivie ;
  - consigne de format non tenue ;
  - fausse alerte d'incohérence ;
  - résumé tronqué.
- **Réponses préférées** : celle du professeur, vérifiée comme au §5.2.
- **Garde-fou contre la longueur** : DPO normalisée par la longueur, et écart de longueur moyen entre réponse
  préférée et refusée gardé sous 20 %. Sans cela, l'entraînement apprend seulement à « répondre plus long ».

## 6. Entraînement

- **Départ de la base Qwen3.5-2B, pas de la v1.** La v1 porte le biais de refus et l'oubli ; mieux vaut repartir
  propre. Les exemples utiles de la v1 (abstentions) sont repris en partie dans le §5.2.
- **SFT** : même recette que la v1, qui est stable et reproductible :
  - LoRA de rang 16, alpha 32, taux d'apprentissage 1e-4, 1 époque, longueur maximale 8 192 jetons ;
  - perte calculée sur la réponse seulement ;
  - modèle sans réflexion.
- **DPO**, après le SFT :
  - LoRA, β = 0,1, taux d'apprentissage 5e-6, 1 époque ;
  - modèle de référence : le SFT v2 ;
  - garder la DPO **seulement** si elle améliore G et S-dev sans régression des bancs.
- **Après l'entraînement** :
  - fusion, élagage du vocabulaire (vocfr48k) et conversion en GGUF ;
  - Q4_K_M, Q5_K_M et Q8_0 ;
  - **la pleine précision est gardée** (leçon n° 7 de la v1).

## 7. Étapes, coûts et points d'arrêt

Coût prévu : **0 €** (Mac et Kaggle gratuit, 30 h de GPU T4 par semaine). Le crédit Google Cloud n'est pas utilisé.

| Étape | GPU Kaggle [supposé] | Quand | Arrêt ou décision si… |
|---|---|---|---|
| 0. Écrire et figer G et S2, puis mesurer la base et la v1 sur G et sur les bancs (déjà connus pour les bancs) | 1 h | 12-14 nov. | — |
| 0 bis. Relecture critique du plan par Codex | 0 h | 12-13 nov. | désaccord de fond : noté dans `desaccords.md`, décision de l'auteur |
| 1. Génération par le professeur (types du §5.2), puis vérification et décontamination | 10 h | à partir du sam. 14 nov., 2 h (remise à zéro du quota) | moins de 60 % d'exemples gardés pour un type : revoir sa consigne avant de continuer |
| 2. Réponses de rappel de la base, jugées | 2 h | 15-16 nov. | — |
| 3. SFT v2 | 5 h | 16-17 nov. | bancs en recul de plus de 1 point : passer le rappel à 40 % (un seul changement), un seul nouvel essai ; sinon arrêt et rapport |
| 4. Développement : G, séries de Localia à l'aveugle, dev et dev2 | 1 h | 17-18 nov. | refus sur G > 10 % : ajouter des demandes globales, un seul essai |
| 5. Essai DPO (100 paires : mémoire, débit, troncature), puis paires de préférence et DPO | 5 h | sam. 21 nov. (nouveau quota) | essai impossible sur T4 : séquences de 2 048 ou référence pré-calculée ; aucun gain sur G ni sur les séries : garder le SFT |
| 6. Évaluation finale **une fois** : S2, G-test, bancs, vitesse, base élaguée et v2 | 3 h | 22-23 nov. | — |
| 7. Préférence de l'auteur (40 paires), rapport, fiche du modèle | 0 h | 23-25 nov. | — |

Total : environ 27 h de GPU, soit deux semaines de quota Kaggle.

## 7 bis. Version 4B (pour les PC de 16 Go)

- **Base** : Qwen3.5-4B (Apache 2.0, environ 4,2 Md de paramètres, environ 2,5 Go en Q4_K_M une fois élaguée)
  [supposé pour la taille élaguée].
- **[mesuré]** En octobre, avant tout entraînement, elle avait 0,917 sur dev, contre 0,863 pour la base 2B. Sa
  vitesse était de 4,1 à 4,6 jetons/s à 8k, mais la machine était chargée. Le même fichier 2B est passé de 5 à
  17 jetons/s selon l'état du Mac : la vitesse du 4B est donc à remesurer, machine au repos et machine chargée.
- **Même données, même recette, mêmes critères** que la v2 2B ; base de comparaison = Qwen3.5-4B d'origine élaguée.
- **Coût** [supposé] : environ 14 h de GPU pour l'entraînement (mesuré pour une LoRA 4B à la conception) plus 4 h
  d'évaluation, soit une semaine de quota Kaggle de plus. Elle passe **après** la v2 2B : si la recette ne marche pas
  sur le 2B, on ne la dépense pas sur le 4B.
- **Dans Localia** : le conseil selon l'ordinateur (déjà en place) propose Dial-bowe 2B pour 8 Go de mémoire et
  Dial-bowe 4B pour 16 Go ou plus.

## 7 ter. Modules par domaine (après la v2)

- **Principe** : une seule base (Dial-bowe v2, 2B ou 4B), plus un petit fichier de corrections par domaine (LoRA,
  environ 20 à 40 Mo [supposé]) que Localia charge selon le domaine principal de **Mon profil**. Ollama
  (`ADAPTER` dans le Modelfile) et le moteur intégré (llama.cpp) savent charger une LoRA.
- **Données d'un module** : documents du domaine (HAL, arXiv, rapports publics, Wikipédia, Service-Public) et les
  mêmes tâches que la v2 (rédiger, résumer, analyser, vérifier, chercher), avec le vocabulaire et les cas du domaine.
  Professeur : Qwen3.6-35B-A3B ou un autre modèle **sous licence Apache ou MIT** ; pas de modèle sous licence Gemma
  (MedGemma…) ni Llama, dont les conditions s'étendraient au module.
- **Ordre** : commencer par un domaine que l'auteur peut juger lui-même (enseignement ou agriculture).
- **Règle de garde** : un module n'est publié que s'il bat la v2 seule sur la série de son métier dans Localia
  (notation à l'aveugle, IC) **et** ne recule pas sur les bancs publics. Sinon, la v2 seule reste conseillée pour ce
  domaine.
- **Coût** [supposé] : environ 2 h de génération et 2 h d'entraînement par module en 2B, avec environ 1 500 exemples.

## 8. Risques

- **Style du professeur** : un modèle de 2 Md imite la forme plus que le fond. On le contrôle par S2 et par la
  préférence de l'auteur, pas par les jeux de développement.
- **Corriger un défaut en crée un autre** (leçon n° 2) : chaque type de données a son contre-exemple (abstention et
  réponse partielle, incohérence et document sans problème).
- **Mémoire de la DPO sur T4** : 2 Md en LoRA avec modèle de référence et séquences de 4 096 jetons, c'est
  vraisemblablement juste dans 16 Go [supposé]. Plan B : séquences de 2 048, ou référence pré-calculée.
- **Licences** : à revérifier avant toute publication des données (Wikipédia, rapports publics).
- **Quota Claude** : les étapes 1 à 6 sont enchaînées par des scripts automatiques, comme les lots 4 à 6.

## 9. Ensuite (non compris dans ce plan)

- **Le projet Guinée** (droit guinéen, langues nationales) reste séparé (`inventaire-guinee.md`).

## 10. Décisions demandées à l'auteur

**Plan validé par l'auteur le 11 nov. 2026**, avec la version 4B (§7 bis) et les modules par domaine (§7 ter).

1. Repartir de la base Qwen3.5-2B, pas de la v1 (recommandé), ou partir de la v1 ? **Décidé : base.**
2. Proportion français 70 % / anglais 30 % : d'accord ? **Accepté (accord global du 11 nov.).**
3. Sources : HAL et arXiv en CC-BY, rapports publics, Wikipédia. **Décidé le 11 nov. : toutes acceptées, pour
   tous les domaines.**
4. Contrôle humain par 40 comparaisons de paires à l'aveugle (environ 1 h de lecture) : d'accord ? **Accepté.**
5. Seuils du §3 : à valider tels quels, ou à modifier **maintenant**, car ils ne changeront plus après.
   **Acceptés tels quels le 11 nov. 2026 : figés.**
6. Nom : « Dial-bowe-GN-224-2B v2 » sur le même dépôt Hugging Face, publié seulement avec ton accord, après les
   résultats.
