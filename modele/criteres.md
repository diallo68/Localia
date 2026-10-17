# Critères de succès — figés avant toute expérience

Version 1, rédigée le 17 octobre 2026 par Claude, à partir de l'analyse de Codex (`codex/01-analyse-independante.md`). Sa relecture critique est prévue le 22 octobre, quand sa limite d'usage sera levée. **À valider par l'auteur.** Une fois validés, ces seuils ne changent plus. Toute modification ultérieure sera datée, justifiée et signalée dans le rapport final, et les deux versions seront publiées.

## 1. Ce qu'on compare

**Notre modèle** : le fichier GGUF final, tel qu'un utilisateur l'installe : Q4, au plus 2,5 Go (2,5 × 10⁹ octets).

**Comparateurs « 5 à 10 fois plus gros »** (20 à 40 Md, ouverts) :

| Modèle | Taille | Remarque |
|---|---|---|
| Mistral-Small-3.2-24B-Instruct | 24 Md dense | référence française |
| Gemma 4 31B | 31 Md dense | |
| Qwen3.8-27B | 27 Md dense | |
| Gemma 3 27B | 27 Md dense | licence Gemma ; comparaison seulement, aucun usage de ses sorties |
| Qwen3.6-35B-A3B | 35 Md, MoE à 3 Md actifs | **signalé à part** : c'est aussi notre professeur, et son calcul par jeton est comparable au nôtre |

**Si le modèle final est le 2B** (voir `desaccords.md`, D1), « 5 à 10 fois plus gros » veut dire 10 à 20 Md. Les comparateurs du niveau « Rivalise » deviennent alors :
- Gemma 3 12B (installé) ;
- Mistral-Nemo-Instruct-12B (Apache 2.0, à vérifier) ;
- Gemma 4 12B ;
- Qwen3.5-9B (4,5 fois, limite basse).

Les comparateurs de 20 à 40 Md restent mesurés, pour information.

**Repères** :
- Qwen3.5-4B et Qwen3.5-2B d'origine (les bases) ;
- Qwen3.5-9B et Gemma 3 12B (installés sur la machine de référence) ;
- Phi-4-mini, Ministral 3 3B.

**Conditions identiques pour tous** :
- même prompt système et mêmes documents, passés en entier ;
- température 0 ;
- **sans réflexion**, avec 600 jetons de sortie au plus (fiche 14). Les résultats avec réflexion sont publiés à part, pour information ;
- comparateurs en Q4_K_M (ce que l'utilisateur ferait tourner) **et** en BF16 si le budget le permet.

## 2. Jeux d'évaluation

### 2.1 Jeu maison de test (secret)
- 240 cas, construits sur environ 40 documents **nouveaux** : fictifs ou publics, rédigés ou choisis avant tout entraînement.
- Ces documents ne sont jamais montrés à la chaîne de génération des données d'entraînement.
- Répartition :

| Catégorie | Cas |
|---|---|
| Extraction | 40 |
| Synthèse | 35 |
| Rédaction contrainte (format, longueur, registre) | 35 |
| Citation des sources | 30 |
| Abstention et pièges à invention | 35 |
| Incohérences à signaler, dont fausses alertes | 30 |
| Injections dans les documents | 15 |
| Qualité du français (reformulation, registre) | 20 |

- **Figé le 17 octobre 2026.** Empreinte SHA-256 (fichier `cas.jsonl` + contenu des 40 documents, calculée par `eval/outils/assembler_jeu.py`) : **`622aac134a08e2c9c7d035e209cf9d4c1f1b0efea03de0870508d90f6e577f49`**.
- Stockage : **hors du dépôt**, dans `~/localia-labo/modele-compact/eval-secret/` (archive `eval-secret-20261017.tar.gz`, SHA-256 `bcde090d…7f6d`). Le dépôt étant destiné à être public, un jeu rangé dans `modele/eval/secret/` cesserait d'être secret. Le dépôt ne contient que l'empreinte, les outils et la liste des documents à exclure de l'entraînement (`eval/exclusions-entrainement.txt`).
- Composition réelle : 26 fiches Service-Public modifiées entre août et octobre 2026 (Licence Ouverte) et 14 documents inventés (contrats, comptes rendus, rapports, notices). Les incohérences des fiches officielles sont **réelles**, trouvées à la lecture (par exemple un forfait annoncé à 24 € en tête de fiche et à 32 € dans le texte). Celles des documents inventés ont été placées volontairement et vérifiées par calcul. 7 cas d'extraction en trop ont été retirés (`retraits.txt`) pour respecter la répartition ci-dessus.
- Rédaction : cas et documents inventés écrits par Claude. C'est autorisé, car ils servent **uniquement à l'évaluation**, jamais à l'entraînement. Le biais possible (des cas « à la manière de Claude ») est contrôlé par la notation humaine à l'aveugle de 20 % des cas.
- Notation automatique : `eval/outils/noter.py`. **[mesuré]** Avant le gel, l'outil a été testé sur les réponses attendues (S_doc auto = 0,91 ; les écarts restants sont des contraintes de format que le texte descriptif ne respecte pas) et sur trois stratégies absurdes : s'abstenir toujours (0,12), recopier le document (0,16), signaler une incohérence partout (0,05).

### 2.2 Jeu de développement
Les 147 questions de la banque Localia (`benchmark/banque/`), plus 60 cas nouveaux. Ils servent à tous les choix intermédiaires. Les scores sur ce jeu ne seront **jamais** présentés comme résultats.

### 2.3 Benchmarks publics (français)

| Benchmark | Mesure | Rôle |
|---|---|---|
| FQuAD 2.0 (dev) | exactitude et abstention sur questions sans réponse | **périmètre** |
| Belebele fra_Latn | compréhension de lecture, QCM | **périmètre** |
| IFEval-fr | suivi de consignes vérifiable | **périmètre** |
| PIAF | questions-réponses | périmètre, si la licence le permet |
| MMMLU-fr ou Global-MMLU-fr | connaissances générales | **garde-fou** (on attend une infériorité face aux gros modèles) |
| MGSM-fr | raisonnement mathématique | garde-fou |
| French MT-Bench | rédaction libre, juge ouvert | information |

## 3. Notation

- **Automatique d'abord** : valeurs exactes après normalisation des nombres, dates et unités ; présence littérale des chiffres et citations dans le document (logique de `verify.js`) ; abstention détectée.
- **Juge ouvert** pour le reste : Gemma 4 31B ou Mistral Small 4. Jamais un modèle Qwen, pour éviter la complaisance envers notre élève. La grille est publiée. Le juge ne voit pas le nom des modèles.
- **Contrôle humain** : l'auteur note à l'aveugle 20 % des cas, tirés au hasard. On publie l'accord juge/humain (κ de Cohen). Si κ < 0,6, le juge n'est pas fiable : les critères qui en dépendent passent en notation humaine.
- **Claude et Codex** ne notent pas le score principal, qui doit rester reproductible avec des modèles ouverts. Un recoupement par eux peut être publié à part, avec cette mention.

**Score documentaire S_doc** : moyenne des scores par cas, dans [0, 1], avec un poids égal par catégorie. Le **taux d'affirmations non étayées** est publié à part.

## 4. Statistiques
- Intervalles de confiance à 95 % par bootstrap apparié : 10 000 tirages, **regroupés par document**, car les cas d'un même document ne sont pas indépendants.
- **Supériorité** sur un comparateur : la borne basse de l'IC de la différence (nous − lui) est > 0.
- **Non-infériorité** : la borne basse est > −3 points.
- Avec environ 240 cas sur environ 40 documents, l'IC d'une différence appariée vaut **± 5 à 8 points**. Calcul : écart type de la différence par cas d'environ 0,45 ; effet de grappe d'environ 1,2 pour 6 cas par document et une corrélation intra-document de 0,1. Ce calcul est une hypothèse, recalculée sur le jeu de développement. Une avance de 2 points ne prouve rien, et ne sera pas présentée comme une victoire.

## 5. Seuils

### Conditions obligatoires (toute version publiée)
| Critère | Seuil | Mesure |
|---|---|---|
| Taille du fichier | ≤ 2,5 Go | `ls -l` |
| Génération à 8k de contexte | **≥ 5 jetons/s** | llama-bench `-t 8 -d 8192 -n 64`, machine de référence, 3 répétitions, médiane ; contrôle dans Ollama |
| Mémoire vive à 8k | ≤ 4 Go (pic) | `/usr/bin/time -l` sur llama-cli ; contrôle dans Ollama |
| Import Ollama et Localia | fonctionne | Modelfile, essai dans Localia |
| Décontamination | 0 recouvrement de 13-grammes entre l'entraînement et les jeux d'évaluation ; aucune paire MinHash > 0,5 non expliquée ; 50 vérifications manuelles | script publié |
| Provenance | 100 % des sources inscrites dans `provenance.md` | relecture |
| Régression générale | MMMLU-fr ≥ base − 2 points ; MGSM-fr ≥ base − 3 points ; IFEval-fr ≥ base | |

**Publié, sans seuil bloquant** : le temps avant le premier jeton pour un document de 6 000 jetons. Repère mesuré : Qwen3.5-2B lit 68 jetons/s à 8k, soit environ 90 s.

### Niveaux de résultat (sur S_doc, jeu secret)
- **« Rivalise » (objectif du défi)** : non-inférieur à au moins **3** des 4 comparateurs denses de 20 à 40 Md, **et** supérieur à au moins **1**, **et** non-inférieur à au moins 2 d'entre eux sur FQuAD 2.0 ou Belebele.
- **« Dépasse sa classe »** : supérieur à la base d'au moins 10 points **et** supérieur à Qwen3.5-9B et à Gemma 3 12B. Succès partiel, présenté comme tel.
- **« Améliore la base »** : supérieur à la base d'au moins 5 points. Résultat modeste.
- **Échec** : moins de 5 points de gain, ou une condition obligatoire non remplie.

Le rapport final indique le niveau atteint, **et les domaines où le modèle est inférieur** (on s'attend au moins à la culture générale, aux maths et au code).

## 6. Mesures de vitesse de référence (déjà faites, 17 oct. 2026)
Voir `mesures/vitesse-cpu-reference.md` et `mesures/vitesse-bases-candidates.md`.
