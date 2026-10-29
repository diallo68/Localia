# Journal d'expériences

Une entrée par action significative. Une entrée contient : la date, qui l'a faite, ce qui a été fait, le résultat **mesuré** et le fichier de résultat.

## 2026-10-17 — Phase 1 (conception)

- **Claude** : diagnostic de la machine.
  - Matériel : i9-9880H, AVX2 sans AVX-512, 16 Go.
  - Logiciels : Ollama 0.40.5, llama.cpp build 11146, Python 3.13 sans PyTorch.
  - Disque : 22 Go libres au départ, 15 Go après les téléchargements.
- **Claude** : vitesse des modèles installés.
  - Phi-4-mini Q4_K_M : 10,1 jetons/s.
  - Gemma 4 E4B : 6,8 jetons/s.
  - Qwen3.5-9B : 3,7 jetons/s.
  - Fichier : `mesures/vitesse-cpu-reference.md`.
- **Claude** : téléchargement de 3 bases candidates (chacune < 3 Go, 5,9 Go au total) dans `~/localia-labo/modele-compact/bases/` :
  - Qwen3.5-2B Q4_K_M ;
  - Qwen3.5-4B IQ4_XS ;
  - Ministral 3 3B Q4_K_M.
- **Claude** : vitesse des bases à 0 et 8k de contexte. Fichier : `mesures/vitesse-bases-candidates.md`.
- **Claude** : empreintes SHA-256 de tokenizer.json.
  - Qwen3.5-2B, Qwen3.5-4B et Qwen3.6-35B-A3B : identiques (5f9e4d49…).
  - Qwen3.8-27B : différente (0997f410…), alors que le vocabulaire a la même taille (248 320).
- **Codex** : analyse indépendante. Fichier : `codex/01-analyse-independante.md`.
- **Claude** : fiches d'idées 01 à 14, `criteres.md`, `provenance.md`, `00-conception.md`.
- **Codex** : critique croisée **échouée**, limite d'usage atteinte (prochain créneau : 22 oct. 2026, 10 h 20). Brief prêt : `codex/brief-02-critique.md`.
- **Claude** : auto-critique, corrections dans `desaccords.md`, `criteres.md` et `00-conception.md`.
- **Claude** : vitesse à 8k avec et sans flash attention (`mesures/vitesse-flash-attention.md`). Sur ce CPU, la flash attention ralentit la génération à contexte long (Ministral : 2,0 avec, 4,2 sans). Correction de la conclusion « l'hybride est indispensable ».
- **Claude** : constat d'une forte variabilité. Charge de 16 à 25 et 3 Go de swap, liés à d'autres logiciels ouverts. Mesure alternée en 3 passes (`mesures/vitesse-alternee-2b-4b.md`) : 4B IQ4_XS de 4,1 à 4,35 jetons/s à 8k, sous l'exigence ; 2B de 7,2 à 9,3.
- **Claude** : couverture du vocabulaire (fiche 08, `mesures/couverture-vocabulaire*.md`). Un ensemble « français fréquent + ASCII » retire 48 % du vocabulaire, avec ≤ 0,1 % d'allongement des textes tenus à part. Matrice de vocabulaire en Q6_K : 33 % du fichier du 2B, 20 % du 4B.
- **Claude** : téléchargement du 4B Q4_K_S (2,59 Go). À 8k : 4,4 à 4,6 jetons/s ; lecture du contexte 1,7 fois plus rapide qu'en IQ4_XS (`mesures/vitesse-4b-q4ks.md`). Disque : 14 Go libres.

## 17 oct. 2026, 17 h 30 : décision de budget de l'auteur

- Enveloppe : **264 € de crédit d'essai Google Cloud, plafond absolu**. L'auteur ne paiera rien au-delà.
- Conséquence : rester en **essai gratuit** tant que possible, car l'essai s'arrête de lui-même quand le crédit est épuisé, sans facturation. Passer au compte payant (nécessaire pour les GPU) seulement si c'est indispensable, avec l'accord de l'auteur et une coupure automatique de la facturation vers 200 €.
- Gemini est exclu de l'entraînement. Seuls des modèles ouverts dont la licence l'autorise seront utilisés.

## 17 oct. 2026, 17 h 40 : phase 2 validée, installation de PyTorch

- L'auteur valide la conception et `criteres.md`, autorise l'installation de PyTorch et dispose d'un compte Kaggle.
- **[mesuré]** Sur Mac Intel (x86_64), pip ne propose pas de PyTorch plus récent que la 2.2.2, alors que transformers 5.20.1 (qui contient `qwen3_5`) exige au moins la 2.6. Un premier environnement pip a été créé puis supprimé.
- **Solution retenue** : PyTorch 2.14.1 de conda-forge (avec MKL), installé dans `~/localia-labo/modele-compact/env-entrainement`, hors dépôt (1,8 Go au total, au-dessus des 0,3 à 0,8 Go prévus). S'y ajoutent transformers 5.20.1, peft 0.21.2 et datasets.
- **[mesuré]** Produit matriciel fp32 2048² : 263 GFLOP/s sur 8 fils.
- **[calculé]** Un passage LoRA complet sur 1 M de jetons avec un 0,8B demanderait au mieux 5 h. Le CPU ne servira qu'aux essais minuscules et à la conversion ; les entraînements se feront sur Kaggle.

## 17 oct. 2026, 18 h 30 : étape 2.1, jeux d'évaluation

- **Jeu secret figé** : 240 cas sur 40 documents, répartis selon `criteres.md`.
  - Empreinte SHA-256 `622aac13…7f49`.
  - Rangé **hors du dépôt**. Dans le dépôt, il aurait cessé d'être secret dès la publication ; la règle de `criteres.md` est corrigée en conséquence.
  - Documents : 26 fiches Service-Public modifiées entre août et octobre 2026, et 14 documents inventés.
  - **Constat** : les fiches officielles contiennent de vraies incohérences, par exemple un forfait à 24 € en tête de fiche et à 32 € dans le texte, ou une présomption de 12 mois et de 24 mois pour le même type de bien. Ce sont de bons tests, car elles n'ont pas été fabriquées.
- **Jeu de développement** : 60 cas sur 10 autres fiches, dans `eval/dev/`. Deux fiches ont été remplacées parce qu'elles recoupaient le jeu secret : la loi de 1948 et les tableaux de retraite. Il reste un recoupement thématique faible, la fiche F14044 reprenant le tableau des trimestres de F21552.
- **Notation automatique** (`eval/outils/noter.py`) **[mesuré]** :
  - testée avant le gel sur les réponses attendues : 0,91 ;
  - et sur trois stratégies absurdes : 0,05 à 0,16 ;
  - **5 défauts corrigés grâce à ces tests**, notamment une réponse correcte qui cite l'instruction piégée pour la rejeter, et des formulations d'abstention non reconnues ;
  - limite connue : une réponse qui suit une injection en la mentionnant peut échapper au filtre, d'où le juge et le contrôle humain.
- Archive du jeu secret : `~/localia-labo/modele-compact/eval-secret-20261017.tar.gz`. À sauvegarder par l'auteur hors de cette machine.
- Copie de l'archive du jeu secret sur la clé USB de l'auteur (17 oct. 2026, 19 h 08) : empreinte identique à l'original (`bcde090d…7f6d`), vérifiée.

## 17 oct. 2026, 21 h : étape 2.2, bases sur le jeu de développement (notation automatique seulement)

- **[mesuré]** S_doc automatique : **Qwen3.5-2B 0,82 ; Qwen3.5-4B (Q4_K_S) 0,92**. Écart moyen par cas de +0,11, IC95 % [0,05 ; 0,19], bootstrap regroupé par document. Le 4B est meilleur en abstention, extraction, rédaction et qualité du français ; le 2B fait légèrement mieux en citation et en incohérences.
- **[mesuré]** Vitesse en conditions réelles (applications ouvertes, swap de 4 Go, contextes de 1,7 à 6,5 k jetons) : le 2B génère à 5,5 jetons/s en médiane (1,9 à 6,0), le 4B à **2,4 jetons/s**, très loin de l'exigence de 5.
- Lecture : la règle de la conception (4B s'il fait au moins 5 points de mieux **et** tient 5 jetons/s) donne le 2B, car le 4B échoue nettement sur la vitesse. La qualité du 4B montre toutefois ce que l'entraînement du 2B doit rattraper.
- Ministral 3B en cours. Les comparateurs de 24 à 31 Md attendent un GPU sur Kaggle (file d'attente).

### 17 octobre 2026, 22 h 50 : Ministral 3B sur le jeu de développement (2.2, fin)

Mesuré (60/60 cas, aucune erreur, mêmes conditions que les Qwen, notation automatique seule) :

| Base | S_doc auto | Génération médiane (j/s) | Mots médians |
|---|---|---|---|
| Qwen3.5-2B Q4_K_M | 0,822 | 5,5 | 79 |
| Ministral 3B Q4_K_M | 0,791 | 2,3 | 95 |
| Qwen3.5-4B Q4_K_S | 0,917 | 2,4 | 70 |

- Écart 2B − Ministral : +0,031, IC95 % [−0,056 ; 0,126] (bootstrap regroupé par document) : non significatif.
- Ministral : bon en extraction (0,97) et citation (0,94), faible en abstention (0,70), incohérences (0,70) et qualité du français (0,75).
- Vitesse de lecture de Ministral non interprétable : le cache de llama-server réutilise le document d'un cas à l'autre et le débit est calculé sur quelques jetons (premier cas : 14,5 j/s). À remesurer à froid en 2.2 bis.
- Décision (règle de criteres.md) : Qwen3.5-2B reste la base retenue ; Ministral n'est ni plus juste ni plus rapide.

### 17 octobre 2026, 23 h 40 : comparateurs de 24 à 31 Md sur le jeu de développement (Kaggle, 2 × T4)

Kaggle, notebook `mohadial/localia-comparateurs-dev` v5 (privé). llama.cpp v0.7.0 compilé avec CUDA. La v4 échouait : CMake ne trouvait pas `CUDA::cuda_driver` ; corrigé en passant `/usr/local/nvidia/lib64/libcuda.so`. Mêmes conditions que sur le Mac : `executer.py`, sans réflexion, température 0, 600 jetons. Environ 1 h de GPU au total (supposé, d'après les durées affichées : compilation, puis 7,5 + 11,5 + 14,5 + 12 min d'évaluation).

Mesuré (60/60 cas pour chacun, aucune erreur, aucune trace de réflexion dans les réponses, notation automatique seule). Écart = S_doc du 2B − S_doc du modèle ; IC95 % par bootstrap regroupé par document (5 000 tirages).

| Modèle | S_doc | abst. | cit. | extr. | incoh. | fr | réd. | synth. | Écart 2B − modèle |
|---|---|---|---|---|---|---|---|---|---|
| Qwen3.5-2B (base retenue) | 0,822 | 0,70 | 0,94 | 0,83 | 0,90 | 0,86 | 0,68 | 0,85 | — |
| Ministral 3B | 0,791 | 0,70 | 0,94 | 0,97 | 0,70 | 0,75 | 0,75 | 0,72 | +0,031 [−0,056 ; 0,126] |
| Qwen3.5-4B Q4_K_S | 0,917 | 1,00 | 0,88 | 1,00 | 0,80 | 1,00 | 0,90 | 0,85 | −0,095 [−0,169 ; −0,018] |
| Mistral Small 3.2 24B Q4_K_M | 0,910 | 1,00 | 1,00 | 1,00 | 0,75 | 0,86 | 0,81 | 0,95 | −0,088 [−0,175 ; 0,001] |
| Gemma 3 27B Q4_K_M | 0,842 | 0,90 | 0,81 | 1,00 | 0,60 | 0,93 | 0,75 | 0,90 | −0,019 [−0,078 ; 0,056] |
| Qwen3.8 27B Q4_K_M | **0,957** | 1,00 | 0,88 | 1,00 | 0,95 | 1,00 | 0,88 | 1,00 | −0,135 [−0,196 ; −0,079] |
| Gemma 4 31B QAT Q4_0 | 0,927 | 0,90 | 1,00 | 0,92 | 0,80 | 1,00 | 0,88 | 1,00 | −0,105 [−0,191 ; 0,014] |

- L'écart 4B − 2B est de 0,095 en S_doc (poids égal par catégorie). Le 0,11 noté plus haut était l'écart moyen par cas : les deux chiffres sont justes, mais c'est le S_doc qui fait foi.
- Contrôle à la main des échecs en incohérence (D020, D032) : la notation est juste. Gemma 3 et Mistral voient une contradiction entre « moins de 26 ans » et « jusqu'à 25 ans », qui disent la même chose ; Gemma 3 répond « oui, c'est une incohérence » puis conclut à la cohérence.
- Les comparateurs répondent court (40 à 53 mots médians, contre 79 pour le 2B).
- Lecture (calculé) : le 2B de base égale déjà Gemma 3 27B, mais reste à 9 à 14 points de Mistral Small, Gemma 4 et Qwen3.8. Le jeu de développement compte 60 cas : les intervalles sont larges et le jeu secret (240 cas) tranchera.
- Cible de l'entraînement : S_doc ≥ 0,93 environ sur le jeu de développement, soit le niveau de Gemma 4 31B, puis la confirmation sur le jeu secret. Points à travailler : abstention (0,70), rédaction (0,68) et extraction (0,83).

### 18 octobre 2026, 11 h 50 : vitesses du 2B selon le nombre de fils (2.2 bis)

Détail dans `mesures/vitesse-2b-fils.md`.
- **[mesuré]** Le processeur est bridé par la chaleur pendant les mesures : `CPU_Speed_Limit` entre 43 et 64 (100 = pleine vitesse). Charge de 2 à 18 ; mémoire libre à 72 %.
- **[mesuré]** Génération à 8 k de contexte (tg64 @ d8192) : 3,2 jetons/s à 4 fils ; 4,5 à 6 fils ; 5,15 à 8 fils ; 4,5 à 12 fils. Hier, avec un processeur moins bridé, on obtenait 7,2 à 9,3 à 8 fils. 8 fils reste le meilleur réglage.
- **[mesuré]** Le serveur n'est pas freiné par l'échantillonnage sur le vocabulaire de 248 k : 4,65 à 4,87 jetons/s avec la chaîne par défaut, contre 4,74 à 4,90 avec top_k = 1. L'écart avec llama-bench vient de l'état de la machine, pas du serveur.
- **[calculé]** Sur ce Mac, le 2B de base tourne autour de 5 jetons/s quand il est bridé, et de 7 à 9 sinon : la marge est mince. Le GGUF à vocabulaire élagué (2.3) devient prioritaire. La matrice de sortie fait 33 % du fichier ; elle est lue à chaque jeton.
- **[supposé]** L'exigence de 5 jetons/s devrait être vérifiée sur une machine de référence moins sujette au bridage thermique, ou avec le bridage relevé et consigné à chaque mesure. Décision à soumettre à l'auteur au moment du plan chiffré (2.7).

### 18 octobre 2026, 12 h 30 : vocabulaire élagué du 2B (2.3, vitesse)

Outil : `mesures/elaguer_vocab.py`. Sélection comme `couverture_vocab_ascii.py`, avec K = 48 000 : jetons fréquents de la moitié « apprentissage » de FineWeb-2 fr, octets de base, jetons ASCII, fermeture BPE et tous les jetons spéciaux. Les lignes de `token_embd` (Q6_K, partagée avec la sortie) sont recopiées octet pour octet.
- **[mesuré]** 248 320 → 131 203 jetons ; 247 587 → 130 889 fusions ; `token_embd` 417 → 220 Mo ; fichier 1,281 → 1,078 Go (calcul de la conception : 1,07).
- **[mesuré]** Tokenisation identique en nombre de jetons sur une fiche Service-Public (1 610), un texte de calibration (157) et du code Python (1 762). Les caractères hors liste (grec, par exemple) retombent proprement sur les octets.
- **[mesuré]** Vitesse en alternance, 3 passes, 8 fils, à 8 k de contexte (`mesures/vitesse-2b-vocab-elague.md`), processeur bridé à 50-52 sauf au premier passage (100) :
  - génération : complet 5,10 / 5,18 / 5,31, contre élagué 5,72 / 5,34 / 5,92 ;
  - lecture : inchangée, 22,7 à 25,6 jetons/s des deux côtés.
- **[calculé]** Gain de génération moyen de +9 % (5,20 → 5,66) ; +3 % à +12 % selon le passage. La conception prévoyait environ +19 %. Le seuil d'abandon (< 5 %) n'est pas atteint : on garde la fiche 08. Le gain de vitesse est plus faible que prévu, car le bridage thermique limite le calcul plus que la lecture mémoire.
- Reste à vérifier la qualité : le jeu de développement est lancé sur le GGUF élagué.

### 18 octobre 2026, 13 h 40 : vocabulaire élagué du 2B (2.3, qualité)

- **[mesuré]** Jeu de développement sur le GGUF élagué, mêmes conditions : S_doc auto **0,815**, contre 0,822 pour le complet. Un seul cas change de note : D006, synthèse, 0,5 → 0 (la réponse ne cite plus « 14 jours »). 53 réponses sur 60 sont identiques mot pour mot. Génération médiane 6,3 jetons/s, lecture 43 jetons/s, processeur bridé à 43 à la fin.
- **[mesuré]** Le 2B complet, relancé sur D001 à D006, ne redonne pas ses réponses de la veille pour D003 à D006, et retombe exactement sur celles de l'élagué. Les écarts complet/élagué sont donc du bruit numérique de llama.cpp entre exécutions (température 0, mais calcul non déterministe), pas un effet de l'élagage.
- Conclusion : l'élagage du vocabulaire est retenu (fiche 08). Gain de génération d'environ +9 %, fichier de 1,08 Go, aucune perte de qualité mesurable.
- Conséquence pour la méthode : à température 0, une même exécution peut varier. Les comparaisons entre modèles devront s'appuyer sur l'intervalle de confiance, et non sur des cas isolés.

### 18 octobre 2026 : contexte long (16k, 32k), à la demande de l'auteur

- Nouvel outil : `eval/outils/assembler_long.py`. Les cas d'extraction et de citation du jeu de développement sont posés sur un seul document long : les fiches du jeu de développement, plus des fiches Service-Public de remplissage, hors jeu secret et hors sujets trop proches (F14043, F34110, F21760, F2951 écartées).
  - long16k : 16 331 jetons, 20 fiches, 10 cas ;
  - long32k : 32 835 jetons, 22 fiches, 20 cas.
- **[mesuré]** long16k, 2B élagué : S_doc 0,85 sur 10 cas, soit autant que les mêmes cas en contexte court (0,85). Extraction 1,00, citation 0,70. Un échec en long (L018 : le modèle trouve la bonne fiche, mais déclare l'information absente) ; un échec du contexte court réussi en long (L031).
  - Première lecture des 16 475 jetons : 834 s, soit environ 20 jetons/s. Cas suivants : 55 à 111 s, le cache de llama-server réutilise le document, y compris pour ce modèle hybride.
  - Génération à 16k : 4,5 à 4,8 jetons/s. Le processeur est passé de 100 à 52 pendant la mesure.
- Incident : `executer.py` abandonnait au bout de 1 800 s par requête, ce qui est trop court pour la première lecture à 32k. Option `--delai` ajoutée ; le 32k a été relancé.
- À la demande de l'auteur (100 pages) : long64k, 64 488 jetons, 47 fiches, 20 cas, lancé à la suite du 32k (`chaine-long64.sh`, -c 69632). Première lecture attendue de 2 à 3 h [supposé, extrapolé du 16k].

### 18 octobre 2026, 14 h 35 : étape 2.4, sources

- `donnees/preparer_sources.py` : fiches F*.xml de l'archive vosdroits (3 004), converties avec `sp_xml_vers_texte.py`.
- **[mesuré]** 1 489 fiches gardées (600 à 6 000 jetons). Écartées :
  - 36 fiches des jeux d'évaluation ;
  - 1 391 fiches trop courtes et 44 trop longues ;
  - 44 fiches dont plus de 5 % des 13-grammes de mots figurent dans un document ou un cas d'évaluation (secret et développement). Recouvrement maximal : F10793, 80 %. La reprise de passages d'une fiche à l'autre est fréquente sur Service-Public : il fallait ce filtre en plus de la liste d'exclusion.
- Provenance mise à jour : les autres fiches de l'archive servent de sources d'entraînement (Licence Ouverte). Sortie hors dépôt : `~/localia-labo/modele-compact/donnees-entrainement/`.
- Reste à faire pour la décontamination complète (criteres.md) : MinHash, voisins sémantiques et 50 vérifications manuelles, avant l'entraînement réel (phase 3). Pour l'échantillon de 2.4, le filtre par 13-grammes suffit.

### 18 octobre 2026, 14 h 40 : étape 2.4, chaîne de génération (échantillon)

Règle de provenance appliquée à la conception : **aucun texte rédigé par Claude n'entre dans les exemples**. Les demandes, les consignes système, les instructions cachées et les réponses sont rédigées par le professeur Qwen3.6-35B-A3B (Apache 2.0). Mon code ne fait que des opérations mécaniques et choisit des paramètres :
- retrait d'un paragraphe dont les nombres sont uniques (abstention) ;
- modification d'un nombre suivi d'une unité présent au moins deux fois (incohérence) ;
- tirage d'une contrainte de format ;
- position d'insertion de l'instruction cachée.

Les consignes données au professeur sont de moi : elles orientent sa rédaction, mais n'entrent pas dans les exemples. **Point à soumettre à l'auteur** : le gabarit « Document : … Demande : … » des exemples est une mise en forme mécanique de 4 mots ; à remplacer par le format réel de Localia si l'auteur le préfère.

- `donnees/fabriquer_taches.py` : 60 fiches tirées au hasard (graine 1), 8 tâches par fiche (extraction, citation, synthèse, rédaction, abstention, incohérence, fausse alerte, injection), soit 480 tâches. Les 8 premières fiches sont aussi générées avec réflexion du professeur (64 tâches de plus), pour comparer les taux de rejet.
- Kaggle : jeu de données privé `mohadial/localia-donnees-2-4` et notebook privé `mohadial/localia-professeur-2-4` (Q4_K_M de ggml-org, 20,4 Go, téléchargé sur Kaggle et non sur le Mac, 4 requêtes en parallèle). Les binaires llama.cpp sont conservés en sortie, pour éviter de recompiler la prochaine fois.
- `donnees/verifier.py` : contrôles mécaniques par type (détail en tête du fichier) ; produit `exemples.jsonl`, `rejets.jsonl` et `rapport.md`. Seuil d'arrêt de la conception : rejet > 70 % → revoir les consignes du professeur.

### 18 octobre 2026, 16 h 50 : étape 2.4, résultats de l'échantillon

- **[mesuré]** Professeur sur Kaggle : phase A, 60/60 fiches en 437 s ; phase B, 544 tâches en 3 234 s, à 4 requêtes en parallèle (environ 6 s par tâche). Environ 1 h 20 de GPU avec la compilation.
- **Défaut découvert** : la phase A est en mode JSON. 20 consignes système sur 60 demandaient « le format JSON », et une partie des réponses de la phase B est sortie en JSON. Les 184 tâches concernées ont été reprises avec des consignes système sans JSON : 998 s, sans recompiler grâce au jeu de données privé `localia-llama-bin-cuda`. Les consignes de la phase A interdisent désormais de parler de JSON.
- **Défaut découvert** : 29 demandes d'abstention mentionnent le « paragraphe P », l'étiquette donnée au professeur. Elles sont rejetées et la consigne a été corrigée pour la prochaine génération.
- **[mesuré]** Vérification (`mesures/verification-2.4.md`) : **322 gardés sur 544, soit 41 % de rejet**, sous le seuil d'arrêt de 70 %. Par type, en mode direct :
  - rejet bas : extraction 3 %, injection 17 %, rédaction 17 %, synthèse 17 % ;
  - rejet moyen : fausse alerte 33 % ;
  - rejet fort : abstention 75 %, incohérence 80 %, citation 92 %.
- Analyse des rejets forts :
  - citation : le professeur recopie bien la phrase exacte, mais sans guillemets (54 cas). Ces réponses sont gardées à part, non utilisées ; la prochaine consigne exigera les guillemets.
  - incohérence : la modification mécanique (« 18 → 19 ans », « 6 000 → 6 001 € ») porte souvent sur deux occurrences qui ne désignent pas la même règle. Le professeur a alors raison de ne rien signaler. Il faut revoir la méthode : faire produire la contradiction par le professeur, avec un contrôle mécanique du différentiel.
  - réflexion du professeur (8 fiches) : rejet plus faible en citation (12 % contre 92 %) et en incohérence (62 % contre 80 %), pas mieux ailleurs. Elle coûte 1 200 à 5 800 jetons de plus par tâche.
- Relecture manuelle de 11 exemples gardés : justes. Défaut relevé : des réponses aux injections donnent la bonne réponse sans signaler l'instruction cachée (acceptable).
- Jeu d'entraînement du pilote : 289 après dédoublonnage (version avec réflexion préférée), puis **262** après plafonnement des fausses alertes à 15, pour ne pas apprendre au modèle à tout déclarer cohérent.

### 18 octobre 2026, 16 h 55 : étape 2.5 lancée, et incident sur la mesure à 32k

- Kaggle : `mohadial/localia-lora-2b-2-5`. LoRA r = 16 sur les couches de langage (attention, DeltaNet, MLP), 2 époques, taux d'apprentissage 1e-4, perte sur la réponse seulement. Puis fusion, conversion GGUF et Q4_K_M ; base témoin convertie de la même façon ; jeu de développement sur GPU pour les deux.
- Incident sur le Mac : en arrêtant la première chaîne de mesure à 32k (vers 14 h 27), le serveur llama n'a pas été tué. Il gardait le port 8081, le nouveau serveur n'a pas démarré, et le script a envoyé sa requête à l'ancien, qui l'a annulée. Environ 1 h 50 perdues. Les scripts libèrent désormais le port et vérifient que leur serveur tourne. Le 32k a été relancé à 16 h 16.

### 18 octobre 2026, 17 h 45 : contexte long, 32k

- **[mesuré]** long32k (32 977 jetons, 22 fiches, 20 cas), 2B élagué : S_doc **0,851**, contre 0,875 pour les mêmes cas en contexte court. Deux cas sont partiellement perdus : L001, fiche en 1re position, et L025, fiche en 19e position. Aucune chute nette.
- **[mesuré]** Première lecture : 2 939 s (49 min), soit 11,2 jetons/s. Questions suivantes : 60 à 110 s. Génération à 32k : 3,5 jetons/s en médiane, sous l'exigence de 5 (qui ne vise que 8k). Processeur entre 100 et 54.
- **[calculé]** Modèle t(n) = a·n + b·n² ajusté sur 16k et 32k (a ≈ 12 s par millier de jetons, b ≈ 2,3 s par million de jetons²) : environ 2 h 55 pour 64k (100 pages) et 11 h 30 pour 130k (200 pages). La mesure à 64k est lancée, elle validera ou non l'extrapolation.

### 18 octobre, 20 h 50 — pilote 2.5 : échec au démarrage, relancé

- Version 2 : environ 3 h de file d'attente Kaggle, puis échec après 85 s (mesuré, journal du noyau) : `ImportError: Found an incompatible version of torchao. Found version 0.10.0, but only versions above 0.16.0 are supported`, levé par peft lors de `get_peft_model`. Les 262 exemples étaient lus et gabarités sans rejet.
- Correction : désinstallation de torchao (inutilisé) après l'installation de transformers et peft. Version 3 poussée à 20 h 50.
- Contexte long 64k, en cours : première lecture de 9 423 s (2 h 37, mesuré ; 2 h 55 extrapolé), génération de 2,2 à 2,5 jetons/s, environ 3 min par question suivante, CPU_Speed_Limit entre 43 et 54.
- Version 3 (20 h 52) : machine obtenue tout de suite, échec à 108 s par manque de mémoire GPU (mesuré : 12,04 Gio alloués par PyTorch au moment de la perte). Cause (calculé) : logits sur toute la séquence, 8 192 × 248 320 en fp32 ≈ 8 Go. Correction : `logits_to_keep` limité à la réponse, perte calculée à la main sur ces positions, `expandable_segments`. Version 4 poussée à 20 h 55.

### 18 octobre 2026, 21 h 40 : contexte long, 64k (environ 100 pages)

- **[mesuré]** long64k (64 488 jetons, 47 fiches, les 20 mêmes questions qu'à 32k), 2B élagué : S_doc **0,851** (extraction 0,764, citation 0,938), identique au 32k, contre 0,875 en contexte court. Sur 20 cas, l'écart n'est pas significatif.
- **[mesuré]** Les cas changent d'un contexte à l'autre (l'inférence n'est pas déterministe) :
  - gagnés à 64k : L025 et L031 ;
  - perdus à 64k : L044 (fiche en 18e position sur 47) et L049 (7e, partiel) ;
  - perdus partout : L007 et L030.
  - Les fiches fautives sont réparties de la 6e à la 44e position : pas d'effet de position visible.
- **[mesuré]** Première lecture : 9 423 s (2 h 37), soit 6,8 jetons/s. Questions suivantes : 181 s en médiane. Génération : 2,4 jetons/s en médiane (2,0 à 2,5). Mémoire du serveur : 3,55 Go. Processeur entre 43 et 54.
- **[calculé]** Le modèle t(n) = a·n + b·n², réajusté sur 32k et 64k (a ≈ 29 s par millier de jetons, b ≈ 1,8 s par million de jetons²), donne environ 9 h 30 de lecture pour 130k (200 pages), à bridage comparable. L'extrapolation sur 16k et 32k donnait 11 h 30.
- Conclusion : la qualité tient jusqu'à 100 pages. L'attente (2 h 37 avant la première réponse) et la génération à 2,4 jetons/s rendent toutefois le document entier en contexte peu utilisable au-delà d'environ 30 pages. Pour 100 à 200 pages, la recherche de passages reste la voie recommandée.

### 19 octobre 2026, 0 h 15 : pilote 2.5 terminé (de bout en bout)

- Version 4 : 23 h 49, statut COMPLETE. LoRA r = 16, 262 exemples, 2 époques, 66 pas, 3 393 s sur une T4. Mémoire de pointe : 10,6 Go (mesuré).
- **[mesuré]** Perte moyenne par pas : 0,45 sur l'époque 1, puis 0,31 sur l'époque 2. Pas de divergence.
- **[mesuré]** Jeu de développement (60 cas, sur GPU Kaggle, mêmes conditions pour les deux) :
  - base convertie par la même chaîne : S_doc 0,854 ;
  - LoRA : **0,807**.
  - Écart : −0,047 ; IC à 95 % par bootstrap regroupé par document (10 documents) : [−0,124 ; +0,031]. **Pas d'effet significatif.**
  - Gains : 3 cas (D007 et D031 en extraction, qui passe de 0,83 à 1,00 ; D034 en synthèse).
  - Pertes : 5 cas.
    - D010 et D026 : fausse abstention (« Le document ne contient pas… ») sur des demandes de liste ou de tableau.
    - D016 : encadré dépassant 60 mots.
    - D028 et D041 : corrections de langue (qualite_fr), absentes des données d'entraînement. D041 délire sur l'accord.
  - Réponses plus courtes : 54 mots médians, contre 77,5.
- Lecture : le pilote valide la chaîne (données, LoRA, fusion, GGUF, évaluation), pas un gain. 262 exemples sans tâche de correction de langue et sans demande de tableau ou de liste sur une information présente ne suffisent pas. Des fausses abstentions apparaissent alors que la proportion d'abstention dans les données reste modeste (15 sur 262). À surveiller : il faudra des contre-exemples (informations présentes, réparties dans le document), plus des tâches qualite_fr.
- Incident : le GGUF LoRA ne se charge pas sur le Mac (llama.cpp 0.5.0) : `tensor 'blk.24.attn_norm.weight' not found`. `save_pretrained` n'écrit pas la couche MTP (`mtp.*`), alors que la configuration l'annonce. llama.cpp v0.7.0, sur Kaggle, la tolérait. Correction : `mesures/completer_mtp.py` recopie les 15 tenseurs blk.24.* de la base (couche non touchée par la LoRA) → `qwen35-2b-lora-mtp-Q4_K_M.gguf`, 1,312 Go. Pour la prochaine fois : recopier `mtp.*` depuis la base au moment de la fusion.
- **[mesuré]** Mac, processeur bridé à 43, donc non représentatif : LoRA complété 4,19 jetons/s en génération, base 3,85. Même architecture : aucune différence de vitesse attendue (supposé).
- Quota Kaggle de cette série (estimé) : environ 1 h 05 de GPU.

### 19 octobre 2026, 0 h 10 : lot 2 des données préparé (rien de lancé)

Corrections tirées du rapport 2.4 et du pilote 2.5 :
- **Citations** : désormais générées avec réflexion. En 2.4, sans réflexion : 54 rejets sur 60 pour « citation exacte sans guillemets » ; avec réflexion : 1 sur 8 (mesuré).
- **Incohérences** : la contradiction est proposée par le professeur. En phase A, il donne la phrase exacte, la même phrase modifiée et l'extrait de l'autre passage contredit. Contrôle mécanique avant l'usage : phrase présente une seule fois, autre passage présent et distinct. Le vérificateur exige ensuite qu'un mot changé et un mot de la version d'origine (ou de l'autre passage) figurent dans la réponse. Sans contradiction valable, la fiche n'a pas de tâche d'incohérence.
- **Nouvelle tâche qualite_fr** (`fabriquer_taches.py`) : une faute mécanique est introduite à une seule occurrence :
  - soit un « s » du pluriel retiré après un déterminant pluriel ;
  - soit un mot de 4 lettres ou plus retiré ;
  - le passage fautif est unique dans le document modifié.

  Le professeur rédige une demande qui cite ce passage. Le vérificateur exige la forme corrigée. Sur 300 fiches (graine 2) : 160 accords, 140 mots manquants. Exemples : « payer des droit fiscaux » → « des droits fiscaux » ; « l'établissement qui le recrutement » → « qui organise le recrutement ».
- **Contre les fausses abstentions du pilote** :
  - la synthèse reçoit en phase A 2 à 4 éléments attendus, contrôlés dans la réponse ;
  - en extraction et en synthèse, rejet si la **première phrase** est une abstention. Une précision en fin de réponse (« le document ne précise pas le coût ») reste admise : la première version, qui cherchait dans toute la réponse, rejetait à tort une bonne réponse.
- Non-régression : sur les 544 réponses de 2.4, le nouveau vérificateur donne le même rapport (322 gardées).
- Volume prévu : 300 fiches × 9 tâches = 2 700 tâches. **[calculé]** D'après les durées de 2.4 (phase A : 437 s pour 60 fiches ; phase B : 3 234 s pour 544 tâches), il faut environ 5 à 6 h de GPU, à découper en deux sessions de 150 fiches. Lancement soumis à l'accord de l'auteur.
- 0 h 25 : accord de l'auteur (« ok »). 300 fiches (graine 2, sans les 60 de 2.4), découpées en deux datasets Kaggle privés `localia-donnees-lot2a` et `lot2b` de 150 fiches. Phase A : `max_tokens` porté à 2 500 (plus de clés). Le noyau `localia-professeur-lot2a` est lancé ; `lot2b` le sera après contrôle du premier.

### 19 octobre 2026, 2 h 00 : perplexité du vocabulaire élagué (2.3) et repère Gemma 3 12B (2.2)

- **[mesuré]** Perplexité, 2048 jetons de contexte, 33 blocs. Texte : 84 textes FineWeb-2 fr (292 ko), tirés de la moitié qui n'a **pas** servi à choisir le vocabulaire.
  - Base Q4_K_M : 67 843 jetons, PPL 27,94 ± 0,50.
  - Élagué à 48k : 67 849 jetons, PPL 27,77 ± 0,50.
- **[calculé]** Log-vraisemblance totale (jetons × ln PPL, la tokenisation étant presque identique : +0,009 % de jetons) : −0,18 % pour l'élagué. Le seuil de 2.3 (perte de 1 % au plus) est respecté. La légère baisse s'explique ainsi (supposé) : le softmax renormalisé sur 48k jetons redistribue la masse des jetons retirés. Ce n'est pas un gain de modèle. L'élagage reste retenu.
- **[mesuré]** Jeu de développement, Gemma 3 12B (Ollama, `gemma3-12b-8k`) : S_doc **0,812**. Le 2B d'origine fait 0,822 et l'élagué 0,815 sur le Mac.
  - Points forts : abstention 1,00, synthèse 0,92.
  - Point faible : incohérence 0,40.
  - Réponses courtes : 44,5 mots médians. Durée médiane par cas : 48 s.
- Repère 5 à 10 fois plus gros : Gemma 3 12B (6×) ne dépasse pas le 2B sur ce jeu. Gemma 3 27B (0,842), Mistral Small (0,910) et Qwen3.8 27B (0,957) restent les cibles. Il n'y a pas de Qwen3.5-9B officiel en local (seulement une version « abliterated » sur Ollama).

### 19 octobre 2026, 7 h 30 : lot 2a reçu et vérifié, lot 2b lancé

- **[mesuré]** Noyau `localia-professeur-lot2a` : COMPLETE à 7 h 11. Phase A : 150/150 fiches en 1 419 s ; phase B : 1 269 tâches en 6 877 s ; total d'environ 2 h 22 de GPU.
  - Contradictions valables : 83 sur 150 (recopie exacte contrôlée).
  - Demandes de correction citant le passage fautif : 136 sur 150.
- **[mesuré]** Vérification : **902 gardés sur 1 269 (29 % de rejet**, contre 40 % en 2.4 avec le même vérificateur) :
  - citation, avec réflexion : 13 % de rejet (92 % en 2.4 sans réflexion) ;
  - incohérence : 37 gardés sur 83, contre 12 sur 60 en 2.4 ;
  - qualite_fr : 97 gardés sur 136 ;
  - abstention : 98 sur 150 ;
  - fausse alerte : 81 sur 150 ;
  - synthèse : 88 sur 150 (format non respecté : 27 ; éléments manquants : 19).
- Relecture des rejets :
  - qualite_fr : rejets justes. Le professeur se trompe de correction, par exemple « les conditions **à** obtenir » au lieu de « pour obtenir ».
  - Abstention : environ 14 vraies abstentions étaient rejetées à tort (« n'est pas présente dans le document », « il n'est pas fait mention »). Marqueurs ajoutés dans `verifier.py` seulement ; `noter.py` reste inchangé pour garder les scores comparables. 14 repêchées, relues. Sur 2.4 : 326 gardés au lieu de 322.
  - Incohérence : en phase A, le professeur rédigeait des demandes de vérification **ciblées sur un thème** sans rapport avec la contradiction insérée, et la réponse « cohérent » était alors juste. La consigne exige désormais une relecture de tout le document. La correction ne vaut que pour le lot 2b. Dans le lot 2a, ces cas restent rejetés.
- Lot 2b (150 fiches) lancé à 7 h 30 avec cette consigne.

### 19 octobre 2026, 9 h 45 : lot 2b vérifié, assemblage et entraînement du lot 2 lancé

- **[mesuré]** Lot 2b : phase A 150/150 en 1 463 s ; phase B 1 262 tâches en 7 477 s (environ 2 h 32 de GPU en tout). Vérification : **870 gardés sur 1 262 (31 %)**.
  - La demande de relecture « de tout le document » a supprimé la plupart des vérifications hors sujet : 13 rejets « ne cite pas les deux versions », contre 23 en 2a.
  - Mais les réponses s'allongent : incohérences et fausses alertes ont 47 rejets « tronquée » et 34 « trop longue ». Prochain lot : `max_tokens` plus haut et demande de concision dans la consigne du professeur.
- **[mesuré]** Assemblage (`donnees/assembler_exemples.py`), avec le vérificateur actuel rejoué sur 2.4 : **1 950 exemples** (2 064 avant le plafond des fausses alertes).
  - Répartition : extraction 338, injection 286, rédaction 284, citation 270, synthèse 226, abstention 199, qualite_fr 181, incohérence 83, fausse alerte 83.
  - Longueur médiane : 2 251 jetons, maximum 6 476, total 4,9 M.
- Entraînement : noyau `mohadial/localia-lora-2b-lot2` (dataset privé `localia-exemples-lot2`). Même recette que le pilote, mais **1 époque** et 244 pas. **[calculé]** D'après le pilote (6,5 s par exemple), environ 3 h 30 d'entraînement, plus la conversion et le jeu de développement. La couche MTP est désormais recopiée à la fusion.

### 19 octobre 2026, 17 h 30 : LoRA du lot 2 notée

- **[mesuré]** Le noyau est resté environ 3 h 30 dans la file d'attente des GPU de Kaggle, puis COMPLETE à 17 h 07. Entraînement : 244 pas en 11 053 s (3 h 04), perte finale autour de 0,35 à 0,45 (0,39 au départ, sans baisse nette au fil de l'époque).
- **[mesuré]** Jeu de développement (60 cas, `noter.py`) : **LoRA 0,862 contre base 0,854**. Écart par cas +0,011, IC 95 % [−0,058 ; +0,104] (bootstrap regroupé par document, 10 000 tirages) : **pas significatif**. Le pilote donnait −0,047.
  - Gains : abstention 0,80 → 1,00 (les fausses abstentions du pilote ont disparu ; D033, D039), citation 0,81 → 0,88, synthèse D034.
  - Pertes : rédaction 0,78 → 0,66. Trois cas (D005, D016, D029) **dépassent la limite de mots** (60 à 80 mots demandés). Synthèse D038 : vaccins inventés (« fièvre jaune », « rotavirus ») au lieu des méningocoques.
- Cause probable des dépassements : **[mesuré]** les formats de rédaction tirés par `fabriquer_taches.py` sont 120 mots, 200 mots ou 5 phrases. Les données ne contiennent donc aucune limite courte, alors que le jeu de développement en demande de 60 à 80 mots. Les 70 exemples à limite de mots la respectent tous (compteur de `noter.py`). Un premier décompte, avec un compteur maison qui coupait aux apostrophes, en signalait 9 à tort.
  - Prochain lot : formats de rédaction plus courts et plus variés (50, 80 ou 120 mots ; 3 ou 5 phrases).
- Lecture : la recette ne dégrade plus la base et corrige les abstentions. Le gain global reste dans le bruit sur 60 cas.

### 19 octobre 2026, 17 h 36 : lot 3 lancé

- Accord de l'auteur (« ok tu peux »).
- 300 nouvelles fiches (graine 3). `fabriquer_taches.py --exclure` écarte les 360 fiches des lots 2.4, 2a et 2b. **[mesuré]** Aucun recouvrement avec ces lots ni avec les 36 fiches des jeux d'évaluation.
- Formats de rédaction raccourcis : **[mesuré]** 50 mots (53 fiches), 80 mots (59), 120 mots (71), 3 phrases (57), 5 phrases (60).
- Professeur (`professeur_kaggle.py`) :
  - la demande de vérification, rédigée en phase A, réclame une réponse brève ;
  - `max_tokens` passe à 1 500 pour les incohérences et les fausses alertes (47 réponses tronquées au lot 2b).
  - Aucune phrase de Claude n'entre dans les exemples : les consignes de brièveté sont rédigées par le professeur.
- Datasets privés `localia-donnees-lot3a` et `lot3b` (150 fiches chacun). Les deux noyaux `localia-professeur-lot3a` et `lot3b` sont lancés en même temps. **[calculé]** D'après le lot 2, environ 2 h 30 de GPU chacun, sans compter l'attente.

### 19 octobre 2026, 19 h 55 : lot 3 vérifié, entraînement sur 3 633 exemples lancé

- **[mesuré]** Les deux noyaux professeur ont fini à 19 h 53, sans attente notable.
  - 3a : phase A 1 389 s, phase B 1 279 tâches en 6 242 s.
  - 3b : phase A 1 467 s, phase B 1 276 tâches en 6 476 s.
- **[mesuré]** Vérification : **3a 901 gardés sur 1 279 (30 %)**, **3b 942 sur 1 276 (26 %)**.
  - Rédaction : 123 réponses gardées pour une limite courte (50 ou 80 mots, ou 3 phrases), contre aucune au lot 2. La limite de 50 mots est la plus souvent ratée par le professeur (24 rejets pour 29 gardés).
  - Les réponses de fausse alerte ne sont presque plus tronquées : 5 « trop longue » en 3a.
  - Incohérence : il reste 49 rejets « ne cite pas les deux versions » en 3a. Relus sur échantillon, ils sont justes : le professeur répond « document cohérent » sans voir la contradiction insérée (« 3 cas » → « 10 cas », « 1 mois » → « 6 mois »).
- **[mesuré]** Assemblage des lots 2.4, 2a, 2b, 3a et 3b : **3 633 exemples**.
  - Répartition : extraction 618, injection 540, citation 516, rédaction 501, synthèse 397, abstention 377, qualite_fr 372, incohérence 156, fausse alerte 156.
- Entraînement : noyau `mohadial/localia-lora-2b-lot3` (dataset privé `localia-exemples-lot3`), même recette, 1 époque. La base n'est plus convertie ni notée : son score est connu (0,854). **[calculé]** D'après le lot 2 (5,7 s par exemple), environ 5 h 45 d'entraînement, plus 30 à 45 minutes pour la conversion et le jeu de développement.

### 20 octobre 2026, 1 h 45 : entraînement du lot 3 tué, relancé avec points de reprise

- **[mesuré]** La version 1 du noyau `localia-lora-2b-lot3` est en ERROR à 1 h 42. Elle a été tuée (« Killed ») au pas 440 sur 455, après 18 767 s d'entraînement. Perte autour de 0,2 à 0,5. La mémoire du GPU est restée stable (11,1 Go).
  - **[supposé]** Le noyau a manqué de mémoire vive (le système a tué le processus ; une erreur de mémoire GPU aurait levé une exception Python). Le lot 2 (244 pas) n'avait pas atteint ce seuil.
  - Le script n'enregistrait aucun point de reprise : les 5 h 13 de calcul sont perdues.
- Corrections (`donnees/lora_2b_lot3_kaggle.py`) :
  - un point de reprise tous les 40 pas (`reprise.pt` : LoRA, optimiseur, planificateur, position dans les données), rechargé automatiquement s'il est fourni en entrée ;
  - la mémoire vive du processus est écrite à chaque pas ;
  - `gc.collect()` et `torch.cuda.empty_cache()` tous les 10 pas.
- Version 2 lancée à 1 h 43, depuis le début.
  - **[calculé]** Environ 6 h 30, donc fin vers 8 h 15.
  - **[supposé]** Le quota hebdomadaire de GPU de Kaggle (30 h) est peut-être proche : environ 21 h utilisées cette semaine d'après ce journal. Si la session est coupée, elle reprendra au dernier point de reprise.

### 20 octobre 2026, 7 h 36 : fuite de mémoire vive confirmée, fin de l'entraînement depuis le point de reprise

- **[mesuré]** La version 2 a été tuée au même endroit (« Killed » après le pas 442, ERROR à 7 h 35). La mémoire vive du processus monte régulièrement : 2,8 Go au pas 1, 30,9 Go au pas 430, 31,4 Go au pas 442. Cela fait environ 65 Mo par pas, soit 8 Mo par exemple. La mémoire du GPU reste à 11,1 Go.
  - **[supposé]** Cause : un cache qui grossit à chaque nouvelle longueur de séquence (noyaux compilés ou plans de calcul indexés par la forme des tenseurs ; les exemples ont presque tous une longueur différente). Le `gc.collect()` n'y change rien. Piste pour les prochains entraînements : arrondir les longueurs à un multiple de 256 jetons (remplissage après la fin, sans effet sur la perte d'un modèle causal) et vérifier que la mémoire se stabilise.
- Le point de reprise du pas 440 (`reprise.pt`) a été enregistré. Le noyau `mohadial/localia-lora-2b-lot3-fin` le reçoit en entrée (sortie de `localia-lora-2b-lot3`) et termine les 15 derniers pas, puis fait la fusion, le GGUF et le jeu de développement.

### 20 octobre 2026, 12 h 45 : quota GPU de Kaggle épuisé, LoRA du pas 440 évaluée sur le Mac

- **[mesuré]** La session `localia-lora-2b-lot3-fin` (version 1) n'a pas trouvé le point de reprise. La sortie d'un noyau terminé en ERROR, fournie en `kernel_sources`, n'a pas été montée, ou pas à un chemin trouvé. Elle est repartie de zéro (pas 416 à 4 h 50 de calcul, RAM 30,4 Go) et sera tuée au même endroit. Le journal a été lu par l'auteur sur le site, qui m'a transmis les lignes.
- Le point de reprise de la version 2 (`reprise.pt`, 188 Mo, pas 440, exemple 3 520) a été téléchargé et contrôlé, puis publié dans le dataset privé `localia-reprise-lot3`. La session de fin s'arrête désormais tout de suite si le point de reprise manque (`donnees/lora_2b_lot3_fin_kaggle.py`).
- **[mesuré]** Relance refusée : « Maximum weekly GPU quota of 30.00 hours reached ».
- Solution sans GPU :
  - **[mesuré]** au pas 440, le taux d'apprentissage vaut 2,7e-7, soit 0,3 % du maximum ; **[calculé]** les 15 pas manquants ne changeraient presque pas les poids ;
  - les poids LoRA du point de reprise sont convertis en adaptateur GGUF (`convert_lora_to_gguf.py` de llama.cpp 0.5, 300 tenseurs, 31 Mo, f16), sans télécharger les poids de la base (configuration et tokenizer seulement) ;
  - évaluation sur le Mac : llama-server 0.5 avec `--lora` sur le GGUF de base converti sur Kaggle (`bases/pilote-2.5/qwen35-2b-base-Q4_K_M.gguf`), puis la même base sans adaptateur, mêmes réglages. La comparaison se fait entre ces deux passages sur le Mac, pas avec les notes obtenues sur GPU.
  - **[supposé]** L'adaptateur appliqué à une base Q4 n'est pas identique à une fusion en f16 suivie d'une quantification ; l'écart devrait être faible.
- **[mesuré]** 13 h 09 : la session `localia-lora-2b-lot3-fin` (version 1, repartie de zéro) est tuée au pas 441 (RAM 31,4 Go). Le quota affiché par Kaggle est de 33 h 47 sur 30 h. Kaggle ne coupe pas une session en cours, il refuse seulement les nouvelles.
- La date de remise à zéro n'est publiée nulle part (ni dans les paramètres, ni dans l'info-bulle). Une tentative de relance de la session de fin (version 2 : dataset `localia-reprise-lot3`, arrêt immédiat sans point de reprise) est faite toutes les 3 h ; elle démarrera dès le retour du quota.

### 20 octobre 2026, 14 h 30 : LoRA du lot 3 (pas 440) notée sur le Mac, abstentions à tort

- **[mesuré]** Jeu de développement (60 cas), llama-server 0.5 sur le Mac, `-c 8192`, mêmes réglages pour les deux passages :

  | Catégorie | Base (Mac) | Lot 3, pas 440 (Mac) | Lot 2 (GPU, pour mémoire) |
  |---|---|---|---|
  | abstention | 0,80 | 1,00 | 1,00 |
  | citation | 0,875 | 0,81 | 0,875 |
  | extraction | 1,00 | 0,81 | 0,81 |
  | incohérence | 1,00 | 0,95 | 1,00 |
  | qualité du français | 0,86 | 1,00 | 1,00 |
  | rédaction | 0,71 | 0,78 | 0,66 |
  | synthèse | 0,80 | 0,95 | 0,70 |
  | **S_doc** | **0,863** | **0,900** | **0,862** |

- **[calculé]** Écart lot 3 − base, bootstrap par document (5 000 tirages) : +0,037, IC 95 % [−0,061 ; +0,146]. Il n'est pas significatif sur 60 cas, mais c'est le meilleur écart obtenu jusqu'ici (lot 2 : +0,009). La base sur le Mac (0,863) est proche de la base sur GPU (0,854) : les deux conditions sont comparables, sans être identiques.
- **[mesuré]** Gains : les rédactions courtes respectent maintenant la limite (D005, D035), les synthèses ne contiennent plus de faits inventés (D006, D038 : 1,0 contre 0,0 au lot 2), les abstentions attendues sont toutes reconnues.
- **[mesuré]** Défaut nouveau : **abstentions à tort**. D018, D025 et D031 obtiennent 0, alors que la base les réussit : le modèle répond « le document ne le précise pas » quand la réponse demande d'**appliquer** une règle du document (réduction de 20 % sur 5 000 €, âge de départ pour une date de naissance donnée, phrase d'un encadré « À noter »).
  - **[supposé]** Cause : 377 exemples d'abstention (10 %) et presque aucun exemple qui demande un calcul ou une déduction à partir d'une règle. Le modèle a appris à refuser dès que la réponse n'est pas écrite telle quelle.
  - Piste pour le lot 4 : des exemples « appliquer une règle » (calcul, barème, date), écrits par le professeur et vérifiés par le calcul, et des abstentions plus proches de la limite (l'information est presque là, mais pas tout à fait).
- Correction de la fuite de mémoire préparée dans `donnees/lora_2b_echelle_kaggle.py` (étape 2.6) : longueurs arrondies au multiple de 256 jetons, option `ESSAI_PAS` pour un court essai qui vérifie que la RAM reste stable, option `N_EXEMPLES` pour les courbes d'échelle. **Non testée** : il faut le GPU, le quota n'est pas revenu.
- **[mesuré]** 15 h 24 : l'auteur a trouvé l'information dans le menu du compte Kaggle (« Your Kaggle Quota ») : « Used: 34h:1m … Reset in 82h:37m ». **[calculé]** Remise à zéro le samedi 24 octobre vers 2 h 01, heure de Paris. La relance toutes les 3 h est remplacée par une relance à 2 h 05, puis toutes les 15 min, à condition que le Mac reste allumé.

### 20 octobre 2026, 18 h 10 : recherche de passages, 200 pages

- Nouveau : `recherche/passages.py` (Python pur, sans dépendance). Il découpe le document en passages d'environ 120 mots qui gardent le chemin de leurs titres, les classe par BM25 après normalisation du français, puis sélectionne les meilleurs dans un budget de jetons et les remet dans l'ordre du document.
- Nouveau jeu `long128k` (assembler_long.py, `--jetons 130000`) : 130 839 jetons, environ 200 pages, 70 fiches, les 20 mêmes cas d'extraction et de citation qu'à 32k et 64k. Fiches cibles en positions 9 à 64.
- **[mesuré]** Rappel, sans modèle : bonne fiche retrouvée 20 fois sur 20 dès 1 000 jetons d'extraits ; éléments de réponse présents 19 fois sur 20 à partir de 2 000 jetons. Le seul manque (L031) est un résultat à calculer (4 000 €) ; la règle et un exemple chiffré sont bien retrouvés. Même rappel sur long64k. Index construit en 0,5 s, recherche en 2 ms par question.
- **[mesuré]** De bout en bout, 2B élagué (`Qwen3.5-2B-Q4_K_M-vocfr48k`), extraits de 3 000 jetons, `-c 8192` : S_doc **0,899** (extraction 0,861, citation 0,938), contre **0,851** en lecture complète à 64k et 0,875 pour les mêmes cas en contexte court. Gagnés par rapport au 64k : L044 et L049. Perdu en partie : L050 (2 éléments sur 3). Toujours ratés : L007 et L030.
- **[mesuré]** Temps par question : 80 s en médiane (de 54 à 136 s), génération de 4,6 à 6,4 jetons/s. En lecture complète à 64k, il fallait 2 h 37 avant la première réponse, puis 2,4 jetons/s.
- **[supposé]** Les 20 questions reprennent souvent les mots du document, ce qui favorise BM25. Sur des questions reformulées (synonymes, paraphrases), le rappel serait plus bas. Piste : une recherche par le sens, avec un petit modèle d'embeddings sous licence libre (téléchargement à faire accepter par l'auteur), combinée à BM25.
- Conclusion : pour les documents longs, la recherche de passages remplace la lecture complète. Le score est au moins aussi bon, et la réponse arrive en environ 1 min 20 au lieu de plusieurs heures.

### 20 octobre 2026, 19 h 30 : recherche de passages, questions reformulées et expansion de requête

- Jeu `long128k-reformule` : les 20 questions de long128k reformulées par le professeur local (`qwen36-fr-192`, dérivé de Qwen3.6-35B-A3B, Apache 2.0 ; données de test seulement), « comme un usager qui ne connaît pas le vocabulaire administratif ». Relu à la main : 8 reformulations écartées (L025 identique ; L012, L019, L031, L036, L037, L048, L050 changent le sens, par exemple « école primaire » devenue « collège »). Il reste 12 questions valides.
- **[mesuré]** BM25 seul sur les 12 reformulées : 9 sur 12 avec 1 000 ou 2 000 jetons d'extraits, 11 sur 12 avec 3 000. Raté type : L013, où « mal jeté mes poubelles » ne retrouve pas « mauvais dépôt de déchets ».
- Expansion de requête : le 2B donne 10 à 15 mots-clés du vocabulaire probable du document, en environ 9 s par question.
  - **[mesuré]** Seule, elle aide les reformulées (11 sur 12 à 1 000 jetons) mais gêne les questions d'origine (18 sur 19 au lieu de 19 sur 19 : les mots-clés noient la question).
  - **[mesuré]** Fusion par rang réciproque des deux recherches (question seule, et question plus mots-clés), avec 3 000 jetons : **19 sur 19** sur les questions d'origine et **12 sur 12** sur les reformulées (L031 exclu des deux décomptes : son résultat est à calculer).
- `recherche/passages.py` : option `--expansion URL` (fusion des deux recherches). Sans l'option, le comportement est inchangé (vérifié : mêmes rappels).
- **[supposé]** 12 questions, c'est peu. Les reformulations d'un seul modèle ne couvrent pas toutes les façons de demander. Il faudra un jeu plus grand, sur d'autres longs documents que des fiches juxtaposées (un vrai rapport, un contrat).

### 21 octobre 2026, 4 h : recherche de passages sur deux vrais longs documents (thèse, RGPD)

- Deux jeux nouveaux, hors dépôt, écrits par le professeur local `qwen36-fr-192` : il lit une section, pose une question littérale et une question reformulée, recopie la preuve, et le script vérifie que la preuve et les éléments attendus figurent mot pour mot dans le document. 30 questions par document, 24 gardées pour chacun.
  - `eval-long/these` : thèse de doctorat fournie par l'auteur, 114 pages, environ 60k jetons, convertie par `recherche/pdf_vers_md.py`. Document **privé** : il reste sur le Mac, n'est pas publié et ne sert pas à l'entraînement.
  - `eval-long/rgpd` : RGPD (99 articles, 173 considérants, environ 112k jetons), assemblé depuis les pages de la CNIL par `recherche/assembler_rgpd.py`, car EUR-Lex refuse les téléchargements automatiques.
  - **[jugement à la relecture]** Trois questions de la thèse sont mal posées (T004 « ce type de réseau », T028 « le prochain chapitre », T030 trop vague). Les éléments attendus sont des tournures exactes du document, donc la note automatique pénalise les réponses justes mais reformulées : elle est probablement **sous-estimée** sur ces deux jeux.
  - Variantes ajoutées aux éléments chiffrés (« 98.06% », « 98,06 % ») dans les jeux, sans toucher au noteur, pour que les notes passées restent comparables. Effet sur la thèse à 3 000 jetons : 0,632 → 0,688.
- **[mesuré]** Rappel sans modèle (`recherche/rappel.py`) :

| Jeu | 3 000 jetons | 5 000 jetons |
|---|---|---|
| Thèse, littérales | 9/10 | 9/10 |
| Thèse, reformulées | 9/14 | 12/14 |
| RGPD, littérales | 13/13 | 13/13 |
| RGPD, reformulées | 9/11 | 9/11 |

- **[mesuré]** Expansion de requête sur la thèse : 10/14 reformulées à 3 000 jetons (au lieu de 9/14), aucun gain à 5 000. Une consigne d'expansion plus générale (« rapport, thèse, texte juridique ») n'apporte rien sur la thèse et perd L013 sur long128k-reformule (11/12 au lieu de 12/12) : **abandonnée**, la consigne d'origine reste.
- **[mesuré]** De bout en bout, 2B élagué `vocfr48k`, `-c 10240`, sans expansion :

| Jeu | Budget | S_doc | Littérales | Reformulées | Temps médian par question |
|---|---|---|---|---|---|
| Thèse | 3 000 | 0,688 | 0,833 | 0,583 | 72 s |
| Thèse | 5 000 | 0,736 | 0,900 | 0,619 | 151 s * |
| RGPD | 3 000 | 0,854 | 0,974 | 0,712 | 83 s |
| RGPD | 5 000 | 0,722 | 0,936 | 0,470 | 129 s * |

  \* processeur bridé à 50-54 % par la chaleur pendant ces deux séries : temps surestimés.
- Lecture des réponses :
  - abstentions à tort alors que le passage est dans les extraits (T012, T022, R006) : même défaut que la LoRA du lot 3, visé par le lot 4 ;
  - à 5 000 jetons sur le RGPD, les considérants et les articles voisins se répètent et le modèle répond à côté ou de façon incomplète (R012 : 1 → 0, R022 : 1 → 0,5). Plus d'extraits n'est pas toujours mieux.
- Conclusion : on garde **3 000 jetons** par défaut. Sur 24 questions par jeu, les écarts de ±0,05 ne sont pas significatifs. Les deux points faibles sont les questions reformulées (recherche par mots-clés) et les abstentions à tort (modèle). Pour la recherche par le sens (modèle d'embeddings d'environ 100 Mo), il faut l'accord de l'auteur avant le téléchargement.

### 21 octobre 2026, 9 h : la recherche actuelle de Localia sur les mêmes longs documents

- Mesure sans modèle et sans toucher à l'application : les fonctions de Localia (`src/documents.cjs` pour un document joint à une conversation, `src/project-docs.cjs` pour les documents d'un projet) sont appelées en lecture seule sur les quatre jeux longs, avec un budget de 10 800 caractères (environ 3 000 jetons, comme `recherche/passages.py`). La thèse est lue page par page avec pdftotext ; les autres documents sont découpés par `splitSections`, comme un fichier texte ajouté à un projet.
- **[mesuré]** Éléments de réponse présents dans les extraits (L031 exclu) :

| Jeu | Conversation (`mots`) | Projet `mots` (par défaut) | Projet `bm25` | `passages.py` |
|---|---|---|---|---|
| Thèse (24) | 17 | 16 | 18 | 18 |
| RGPD (24) | 19 | 18 | 18 | **22** |
| long128k (19) | 16 | 16 | 19 | 19 |
| long128k reformulé (12) | 9 | 9 | 11 | 11 |
| **Total (79)** | **61** | **59** | **66** | **70** |

- Lecture : sur des documents longs, la méthode par défaut de Localia (`mots`) rate 20 cas sur 79, contre 9 pour `passages.py`. Le passage à BM25 explique une partie du gain (59 → 66). Le découpage par sections avec le chemin des titres apporte le reste, surtout sur le RGPD (titres d'articles et de considérants). La mesure du 15 octobre (`docs/MESURE-RECHERCHE.md`, 23 questions sur des documents courts) ne départageait pas les méthodes ; celle-ci, sur des documents de 60 000 à 130 000 jetons, les départage.

### 21 octobre 2026, 10 h 40 : recherche par le sens (embeddings) combinée aux mots-clés

- Modèle : `intfloat/multilingual-e5-small` (MIT, 118 M de paramètres), téléchargé avec l'accord de l'auteur. La conversion en GGUF par llama.cpp ne convient pas : le convertisseur traite ce modèle BERT à tokenizer XLM-R comme un XLM-R et décalerait ses positions. Calcul en PyTorch pour la mesure.
- Passages de `recherche/passages.py`, préfixés « passage: » avec leur chemin de titres ; questions préfixées « query: ». Classement par cosinus, fusion avec BM25 par rang réciproque (k = 60).
- **[mesuré]** Éléments de réponse présents dans les extraits (79 cas : thèse 24, RGPD 24, long128k 19, long128k reformulé 12) :

| Budget | BM25 | Sens seul | Fusion |
|---|---|---|---|
| 3 000 jetons | 70 | 69 | **72** |
| 5 000 jetons | 73 | 72 | **75** |

  La fusion rattrape L013 (« poubelles ») et T004 ; T006 et T013 restent ratés par toutes les méthodes.
- **[mesuré]** Coût sur le CPU du Mac (8 fils) : indexation de 0,07 à 0,15 s par passage, soit 30 s pour la thèse (210 passages), 67 s pour le RGPD (457) et 87 s pour long128k (1 026). La recherche elle-même est instantanée.
- Conclusion : le gain (+2 cas sur 79) est réel mais petit, pour un modèle de plus à embarquer dans Localia et une indexation d'une à deux minutes par long document. Priorité au plan Localia (BM25 par défaut, découpage par sections) ; la recherche par le sens reste une option à proposer ensuite.

### 21 octobre 2026, 13 h : recherche de passages intégrée à Localia (branche locale `recherche-sections`)

- Plan accepté par l'auteur. Trois commits sur une branche locale, **non poussée** (5e86e76, 2b0d554, 54025c4) :
  1. BM25 par défaut pour un document de conversation et pour un projet (`src/documents.cjs`, `src/project-docs.cjs`) ; les demandes de résumé gardent le comptage de mots.
  2. Au-delà du budget, passages par sections (`splitPassages` dans `src/retrieval.js`) : environ 120 mots, jamais à cheval sur deux pages ni sur deux titres, chemin des titres envoyé sur une ligne « Titres : » ; titres Markdown, chapitres, articles, numéros 1.2.3 ; en-têtes et pieds répétés, sommaires écartés ; mots coupés en fin de ligne recollés. Seuls les passages qui contiennent des mots de la question sont retenus quand il y en a.
  3. `docs/MESURE-RECHERCHE.md` complété.
- **[mesuré]** 79 questions, 10 800 caractères, thèse lue par pdf.js : conversation 66 → **68**, projet 64 → **68** (étape 1 seule : 66 et 64 ; méthode d'origine : 59 pour un projet). Essais écartés : titres comptés une seule fois (thèse 16 → 15).
- **[mesuré]** Documents courts du 15 octobre, `bm25` : 19 → 20/23 (3 000 caractères), 21 → 22/23 (6 000) ; aucun recul.
- **[mesuré]** Tests : `npm test` 218/218, `test:pdf`, `test:workspace` et `test:features` (Electron) passent ; mise en forme Prettier vérifiée.
- Pas encore mesuré : la qualité des réponses de bout en bout avec ces extraits dans l'application.

### 24 octobre 2026, 21 h 20 : session de fin du lot 3 terminée sur Kaggle

- Quota de Kaggle remis à zéro (signalé par l'auteur). La tâche de relance automatique avait été arrêtée par Claude Code, faute de mémoire sur le Mac ; la session `localia-lora-2b-lot3-fin` (version 2) a été lancée à la main.
- **[mesuré]** Reprise au pas 440 trouvée : pas 441 à 455 en 617 s, perte finale 0,15 à 0,50 selon les pas. RAM 2,8 → 4,3 Go sur 15 pas (environ 100 Mo par pas, même fuite qu'avant, sans conséquence sur 15 pas). Puis fusion, GGUF f16 (3,9 Go, sur Kaggle) et Q4_K_M, et réponses au jeu de développement sur GPU.
- **[mesuré]** Jeu de développement (60 cas, `noter.py`), sur GPU : **S_doc 0,884** (abstention 0,90, citation 0,875, extraction 0,81, incohérence 1,00, qualité du français 1,00, rédaction 0,69, synthèse 0,92). Pour mémoire : base sur GPU 0,854, lot 2 sur GPU 0,862, LoRA du pas 440 sur le Mac 0,900.
- **[mesuré]** Par rapport au pas 440 sur le Mac, 11 cas changent : 5 montent (D018 0 → 0,5, D031 0 → 1, D029, D032, D051), 6 baissent (D007 et D015 1 → 0, D026, D035, D040, D047).
  - **[supposé]** Ces écarts viennent surtout des conditions (adaptateur sur une base Q4 et CPU du Mac contre fusion f16 puis Q4 sur GPU), pas des 15 derniers pas, dont le taux d'apprentissage est presque nul. Les deux mesures restent dans l'intervalle de confiance l'une de l'autre.
- Le GGUF final n'est pas encore rapatrié sur le Mac (environ 1,2 Go **[supposé]**).

### 24 octobre 2026, 21 h 47 : correction de la fuite de mémoire vive vérifiée

- Session `localia-lora-2b-essai-fuite` : 60 pas du lot 3, longueurs arrondies au multiple de 256 jetons (`ESSAI_PAS`).
- **[mesuré]** RAM du processus : 2,7 Go au pas 1, 3,0 Go au pas 10, puis **3,1 Go stable du pas 20 au pas 60**. Sans la correction, elle montait d'environ 65 Mo par pas (30,9 Go au pas 430). Mémoire du GPU : 11,0 Go, comme avant. Environ 44 s par pas (2 625 s pour 60 pas).
- **[calculé]** Sans correction, la RAM aurait atteint environ 6,7 Go au pas 60. La cause supposée (un cache par forme de tenseur) est donc confirmée en pratique, et les entraînements de l'étape 2.6 (courbes d'échelle) peuvent dépasser 440 pas.
- Professeur du lot 4 lancé : `localia-professeur-lot4a` à 21 h 17, `localia-professeur-lot4b` à 21 h 47 (Kaggle limite à 2 sessions GPU simultanées). Datasets privés `localia-donnees-lot4a` et `lot4b` (86 fiches Service-Public chacun, Licence Ouverte Etalab 2.0).

### 24 octobre 2026, 22 h 45 : lot 3 final noté sur le Mac

- **[mesuré]** GGUF final du lot 3 (fusion f16 puis Q4_K_M sur Kaggle, 1,31 Go), llama-server sur le Mac, `-c 8192`, mêmes réglages que la base : **S_doc 0,856**, contre 0,863 pour la base sur le Mac et 0,900 pour l'adaptateur du pas 440. Écart avec la base −0,014, IC 95 % [−0,150 ; +0,117] (bootstrap par document, 5 000 tirages) : aucun gain mesurable.
- **[mesuré]** Les 11 cas qui changent par rapport au pas 440 sont les mêmes sur le Mac et sur GPU (plus D028). L'écart vient donc du modèle (fusion f16 contre adaptateur sur base Q4, ou les 15 derniers pas), pas de la machine.
- Relecture des baisses :
  - D015 : bonne abstention, mais la réponse cite « une fois par semaine » comme exemple de ce qui manque, et `noter.py` la compte comme interdite. Défaut du noteur, laissé tel quel pour garder les scores comparables.
  - D028 : le pas 440 avait réussi par hasard (il recopiait la phrase en ajoutant « plein » tout en disant qu'il ne manquait rien). Les deux versions ratent la tâche.
  - D007 : les deux versions commencent par « il n'est pas possible de répondre » ; la version finale donne ensuite un taux faux (6,30 % au lieu de 6,45 %).
- **[supposé]** Entre 0,856 et 0,900, l'écart vient surtout du bruit sur 60 cas, où chaque cas pèse 1,7 point. Le défaut de fond reste le même : le modèle commence trop souvent par refuser (« il n'est pas possible de répondre ») avant de répondre quand même. C'est la cible du lot 4.

### 25 octobre 2026, 0 h : lot 4 généré, vérifié et assemblé

- **[mesuré]** Professeur (Qwen3.6-35B-A3B, Kaggle) : 4a fini à 23 h 19 (phase B, 462 tâches en 6 175 s), 4b vers 23 h 40 (473 tâches). Environ 2 h par session, au lieu des 3 h 30 calculées.
- **[mesuré]** Vérification (`verifier.py`) : 4a, 217 gardés sur 462 ; 4b, 244 sur 473.

  | Type | 4a | 4b | Raisons de rejet principales |
  |---|---|---|---|
  | application (avec réflexion) | 119 / 290 | 131 / 301 | oui ou non différent entre phases A et B (137), simple lecture du document sans règle à appliquer (118) |
  | contraste | 54 / 86 | 65 / 86 | ne donne pas l'information du paragraphe (39) |
  | abstention | 44 / 86 | 48 / 86 | pas d'abstention (52), donne un nombre retiré (18) |

- Relecture d'un échantillon : les cas « application » appliquent bien une règle recopiée du document (abandon de famille après deux mois sans paiement ; limite de 2 % du forfait pour une formation hors temps de travail, 210 h × 2 % = 4,2 h). Certaines réponses ont un style de présentation chargé (titres, émoticône).
- Correction de `assembler_exemples.py` : il ne gardait qu'un exemple par (fiche, type). Une fiche du lot 4 porte jusqu'à 3 ou 4 cas « application » différents ; 109 sur 250 étaient écartés. Le type `application` garde désormais un exemple par demande. Les autres types sont inchangés (vérifié : mêmes effectifs).
- **[mesuré]** Assemblage des lots 2.4 à 4b : **4 094 exemples**, dont application 250, contraste 119, abstention 469 (11,5 %). Aucune des 167 fiches du lot 4 n'est dans le lot 3 ni parmi les 36 fiches d'évaluation.
- Dataset privé `localia-exemples-lot4`, noyau `mohadial/localia-lora-2b-lot4` : même recette, avec la correction de la fuite, sur les 4 094 exemples. Il partira dès qu'une place GPU se libère (courbes d'échelle 500 et 1 000 en cours). **[calculé]** 512 pas à environ 44 s, soit 6 h 15, plus 45 min pour la fusion et le jeu de développement.

### 25 octobre 2026, 1 h 30 : courbe d'échelle (étape 2.6)

- Noyaux `localia-lora-2b-echelle-500` et `-1000` : même recette que le lot 3, avec la correction de la fuite, sur les N premiers exemples d'un tirage fixe (graine 7) parmi les 3 633 du lot 3. **[mesuré]** RAM stable à 3,1 Go ; 63 pas en 2 648 s et 125 pas en 5 055 s (environ 41 s par pas).
- **[mesuré]** Jeu de développement (60 cas) sur GPU, même procédure pour tous :

  | Exemples | S_doc | abst. | cit. | extr. | incoh. | fr | réd. | synth. |
  |---|---|---|---|---|---|---|---|---|
  | 0 (base) | 0,854 | | | | | | | |
  | 500 | 0,803 | 0,90 | 0,875 | 0,81 | 1,00 | 0,76 | 0,625 | 0,65 |
  | 1 000 | 0,856 | 0,80 | 0,875 | 0,89 | 0,95 | 0,95 | 0,71 | 0,82 |
  | 1 950 (lot 2, autres données) | 0,862 | | | | | | | |
  | 3 633 (lot 3) | 0,884 | 0,90 | 0,875 | 0,81 | 1,00 | 1,00 | 0,69 | 0,92 |

- **[supposé]** Lecture : avec peu d'exemples, le modèle perd d'abord en synthèse et en rédaction (il prend le style des exemples avant d'en apprendre le fond). La courbe monte ensuite lentement, d'environ 0,03 entre 1 000 et 3 633 exemples, sans plateau visible. Ces écarts restent dans le bruit du jeu de 60 cas (environ ±0,13). Le lot 2 n'est pas tiré du même ensemble : il sert de repère, pas de point de la courbe.
- Conséquence : plus d'exemples ne nuit pas, mais ne suffit pas à lui seul. Le gain attendu du lot 4 vient de la nature des exemples (appliquer une règle) plutôt que de leur nombre. Pour trancher, il faut un jeu de développement plus grand.

### 25 octobre 2026, 3 h : jeu de développement élargi (dev2, 138 cas)

- Raison : avec 60 cas, chaque cas pèse 1,7 point et l'intervalle de confiance d'un écart est d'environ ±0,13. Les écarts entre lots (0,03 à 0,04) ne sont pas mesurables.
- Accord de l'auteur pour l'agrandir. Changement de méthode par rapport à ma proposition : les cas sont écrits à la main, comme ceux de `dev/`, et non par le professeur. Le modèle est entraîné sur des questions du professeur ; un jeu écrit par lui serait trop proche de l'entraînement et gonflerait les scores. Évaluation seulement : aucun de ces textes ne sert à l'entraînement.
- 23 fiches Service-Public jamais utilisées (ni dans les lots 2.4 à 4, ni dans les jeux d'évaluation, recouvrement avec les jeux secret et de développement de 0 % pour 20 fiches et de 0,1 à 0,9 % pour 3, selon `decontamination.json`), sujets éloignés de ceux du jeu secret. Ajoutées à `eval/exclusions-entrainement.txt` (préfixe `dev:`, lu par `preparer_sources.py`).
- 138 cas, 6 par fiche : extraction 56 (dont une bonne part où il faut appliquer une règle : calcul, date limite, seuil), abstention 22, citation 21, qualité du français 12, synthèse 9, fausses alertes 7, rédaction 6, incohérence 5. Deux fiches modifiées pour une contradiction contrôlée (F348, F12484) ; les autres fautes et incohérences visées sont dans les fiches d'origine. Les fautes d'accent seules sont évitées, car `noter.py` retire les accents.
- **[mesuré]** Contrôles de notation : réponses de référence 0,88 (les réponses de référence ne sont pas mises en puces, d'où les synthèses à 0,5) ; « le document ne précise pas » partout 0,14 ; « il y a une incohérence » partout 0,03. Empreinte SHA-256 `283adbd5…`.
- Première mesure lancée sur le Mac : base, puis lot 3 final.

### 25 octobre 2026, 4 h 50 : base et lot 3 final sur dev2 (Mac)

- **[mesuré]** dev2 (138 cas), llama-server sur le Mac, `-c 8192`, mêmes réglages que `dev/` :

  | Catégorie | Base | Lot 3 final |
  |---|---|---|
  | abstention | 0,77 | 0,91 |
  | citation | 0,90 | 0,88 |
  | extraction | 0,75 | 0,75 |
  | incohérence (avec fausses alertes) | 0,65 | 0,71 |
  | qualité du français | 0,42 | 0,67 |
  | rédaction | 0,58 | 0,50 |
  | synthèse | 0,91 | 0,94 |
  | **S_doc** | **0,712** | **0,766** |

- **[calculé]** Écart lot 3 − base : +0,054 sur S_doc (moyenne des catégories) ; +0,044 en moyenne par cas, IC 95 % [−0,025 ; +0,115] (bootstrap par fiche, 5 000 tirages). Pas encore significatif, mais l'intervalle est deux fois plus étroit qu'avec `dev/` seul. 21 cas gagnés, 16 perdus.
- **[calculé]** `dev/` et `dev2` réunis (198 cas, sur le Mac) : base 0,757, lot 3 final 0,793.
- dev2 est plus difficile que `dev/` (base 0,71 contre 0,86) : plus de cas où il faut appliquer une règle, et des fautes de français plus discrètes.
- Relecture des 6 extractions perdues par le lot 3 : le défaut connu se confirme. V013 (vol de 2 800 km) et V025 (complément d'impôt à calculer) commencent par « il n'est pas possible de répondre » alors que la règle est dans le document ; V021 applique la règle mais se trompe d'année (2026 au lieu de 2027) ; V031 lit la mauvaise colonne d'un tableau dont l'en-tête est décalé dans la fiche.
- **[mesuré]** Génération médiane du lot 3 sur dev2 : 5,1 jetons/s. Durée : 52 min pour la base, 1 h 43 pour le lot 3 (réponses plus longues).

### 25 octobre 2026, 5 h 50 : lot 4 entraîné sur Kaggle

- **[mesuré]** `localia-lora-2b-lot4` : 4 094 exemples, 512 pas en 21 163 s (5 h 53, 41 s par pas), sans interruption. RAM stable à 3,2 Go jusqu'au bout : la correction de la fuite tient sur un entraînement complet. GGUF Q4_K_M de 1,31 Go rapatrié sur le Mac (SHA-256 `465a0ee1…`).
- **[mesuré]** Jeu de développement (`dev/`, 60 cas) sur GPU : **S_doc 0,855** (lot 3 : 0,884 ; base : 0,854). Par catégorie : extraction **0,97** (lot 3 : 0,81), incohérence 0,95, synthèse 0,90, citation 0,875, qualité du français 0,81, abstention 0,80 (lot 3 : 0,90), rédaction 0,68.
- Cas qui changent par rapport au lot 3 (GPU) : les abstentions à tort visées sont corrigées, D007 (taux de 6,45 % sur 18 ans) et D025 passent de 0 à 1. Perdus : D046, D028, D035.
  - D046 : la réponse « L'information demandée n'est pas dans le document fourni. » est une bonne abstention, mais `noter.py` ne reconnaît pas cette tournure. Défaut du noteur, laissé tel quel pour garder les scores comparables (sans lui, l'abstention serait à 0,90).
  - D035 : la lettre parle d'un « titre de séjour » au lieu d'une pièce d'identité, et ne nomme pas le destinataire.
  - D028 : le modèle croit qu'il manque « de » au lieu de « plein ».
- Notation sur le Mac (`dev2` puis `dev`) en cours.

### 25 octobre 2026, 8 h 15 : lot 4 sur 198 cas (Mac), noteur corrigé pour une tournure d'abstention

- Correction de `noter.py` : la tournure « L'information (demandée) n'est pas dans le document (fourni). », propre au lot 4, n'était pas reconnue comme une abstention. Ajout de « n'est pas dans le document » et « ne se trouve pas dans le document » aux marqueurs. **[mesuré]** Toutes les réponses déjà produites (`dev/` et `dev2`, base, lots 2.5 à 4, comparateurs) ont été renotées avec l'ancien et le nouveau noteur : seules celles du lot 4 changent (dev2 0,758 → 0,797 ; dev Mac 0,867 → 0,895 ; dev GPU 0,855 → 0,883). Les autres scores du journal restent valables.
- **[mesuré]** Sur le Mac, noteur corrigé :

  | | dev (60) | dev2 (138) | moyenne par cas (198) |
  |---|---|---|---|
  | Base | 0,863 | 0,712 | 0,778 |
  | Lot 3 final | 0,856 | 0,766 | 0,805 |
  | **Lot 4** | **0,895** | **0,797** | **0,823** |

- **[calculé]** Écarts par cas sur 198 cas (bootstrap par fiche, 5 000 tirages) : lot 4 − base +0,045, IC 95 % [−0,019 ; +0,105] ; lot 4 − lot 3 +0,019 [−0,038 ; +0,071] ; lot 3 − base +0,027 [−0,038 ; +0,090]. Le lot 4 est le meilleur modèle à ce jour, mais aucun écart n'est encore significatif.
- dev2, par catégorie, lot 4 : abstention 0,95, synthèse 0,96, citation 0,88, rédaction 0,75 (lot 3 : 0,50), qualité du français 0,75, **extraction 0,71**, **incohérence 0,56**.
- Relecture des reculs du lot 4 sur dev2 : le modèle ne refuse plus de répondre, mais il se trompe dans l'application des règles.
  - Mauvaise ligne de tableau : V037 (taux de 6 % : 4 833,20 €, montant du taux de 9 %), V049 (barème de l'usufruit : tranche de moins de 61 ans pour un usufruitier de 67 ans), V061 (1 400 € au lieu de 950 €).
  - Calcul ou condition faux : V038 (taux de 60 % ramené à 30 % au lieu de 40 %), V133 (« 5 000 € est inférieur ou égal à 1 000 € »).
  - Incohérences insérées non vues : V041 et V071, où le modèle répond « le document est cohérent » en ne lisant qu'un des deux passages.
- **[supposé]** Le lot 4 a appris à appliquer une règle plutôt qu'à refuser, mais pas à vérifier qu'il a choisi la bonne ligne ou la bonne condition. Pistes pour un lot 5 : des cas « application » sur des tableaux à plusieurs lignes et des seuils, vérifiés par le calcul ; davantage d'incohérences insérées loin l'une de l'autre dans le document.

### 25 octobre 2026, 9 h 30 : lot 5 préparé (tableaux et contradictions éloignées)

- Cible : les défauts du lot 4 mesurés sur dev2 (mauvaise ligne de tableau, calcul faux, contradiction éloignée non vue).
- `donnees/fabriquer_lot5.py` (opérations mécaniques seulement) :
  - **5a, tableau** : 162 fiches avec au moins un tableau Markdown de 3 lignes chiffrées ou plus. Une fiche déjà utilisée dans un lot précédent peut servir, car le type de tâche est nouveau.
  - **5b, contradiction éloignée** : 234 fiches. Un nombre suivi d'une unité est changé à une occurrence, située à au moins 25 % de la longueur du document d'une autre occurrence de la même valeur. Les grands montants sont doublés plutôt qu'augmentés de 1.
  - Relecture d'un échantillon de 5b : une bonne part des paires ne se contredisent pas vraiment (« 12 mois » d'ancienneté et « 12 mois » de validité). Deux filtres sont donc ajoutés : les deux phrases doivent partager au moins 30 % de leurs mots, puis le professeur dit en phase A si elles énoncent la même règle (sinon la fiche est écartée).
  - Les fiches de tous les jeux d'évaluation, dev2 compris, sont écartées (vérifié : 0 sur 396).
- `donnees/professeur_lot5_kaggle.py` : même professeur (Qwen3.6-35B-A3B). Trois types de tâches :
  - **tableau** : 4 situations par fiche, proches d'une limite entre deux lignes ; ligne recopiée, résultat et calcul en phase A ; réponse avec réflexion en phase B ;
  - **incohérence** : demande de vérification rédigée par le professeur. En phase B, il reçoit une information réservée (les deux passages et les deux valeurs), qui n'entre pas dans l'exemple : seuls la consigne système, le document, la demande et la réponse sont gardés ;
  - **fausse alerte** : la même demande sur le document intact.
- `verifier.py` : le type tableau reprend les contrôles d'application ; une réponse d'incohérence qui trahit l'information réservée (« information réservée », « indice »…) est rejetée. Essai à blanc avec des réponses factices : tableau gardé, incohérence gardée, réponse qui cite l'information réservée rejetée.
- Datasets privés `localia-donnees-lot5a` et `lot5b` ; noyaux `localia-professeur-lot5a` et `lot5b` en file d'attente (une place GPU est prise par les comparateurs sur dev2).

### 25 octobre 2026, 10 h 50 : étape 2.5 terminée, modèle du lot 4 dans Ollama et dans Localia

- Import dans Ollama 0.40.5 (`localia-doc-2b-lot4`). **[mesuré]** Appelé directement par l'API d'Ollama : 12 à 20 s par réponse sur trois cas de dev2, 17 jetons/s en génération et 125 en lecture. Ollama utilise ici la carte graphique du Mac (Radeon Pro 560X, Metal **[supposé]**, d'après la vitesse : llama-server sur le seul processeur donne environ 5 jetons/s) ; l'exigence du défi reste mesurée sur le processeur seul.
- **Défaut trouvé** : le premier essai dans Localia a généré pendant 9 min 40 sans rien afficher. **[mesuré]** Ollama lit le gabarit Jinja du GGUF et active la réflexion par défaut (« thinking, default true ») ; le modèle, entraîné sans réflexion, réfléchit jusqu'à remplir le contexte de 8 192 jetons. Localia n'envoie `think` que si l'utilisateur l'a réglé. Un `TEMPLATE` dans le Modelfile est ignoré, et `PARAMETER think` n'existe pas.
- Correction : nouveau GGUF `-sansreflexion` dont le gabarit émet toujours le bloc `<think>` vide (`ollama/gabarit_sans_reflexion.jinja`, poids inchangés). **[mesuré]** Réponse directe, que `think` soit absent ou vrai. Marche à suivre dans `ollama/README.md`.
- **[mesuré]** Essai réel dans Localia (application lancée par Playwright, aucune simulation) : fiche F35898 de dev2 en PDF, question V025. Pièce lue (2 pages), réponse en 60 s, vérifications automatiques de Localia passées. Mais la réponse est une abstention à tort : « il est impossible de répondre », alors que 2 700 − 12 × 200 = 300 €, prélevés en septembre.
  - **[supposé]** La consigne système de Localia (« Tu aides à vérifier un document… Distingue les faits du texte, tes déductions et les informations non vérifiables ») pousse le modèle vers la prudence. Le refus n'est pourtant pas propre à Localia : avec la consigne d'`executer.py`, le même modèle refusait déjà V025 dans llama-server sur le Mac ; seul l'essai direct dans Ollama, avec une consigne courte, a répondu, et faux (2 500 €).
  - Conséquence : il faut aussi mesurer le modèle avec les vraies consignes de Localia. Ces consignes ne peuvent pas entrer dans les données d'entraînement (elles ont été écrites avec Claude) ; les consignes système des lots restent rédigées par le professeur, en couvrant aussi les situations de Localia (vérification, citation des pages).

### 25 octobre 2026, 11 h : comparateurs de 24 à 31 Md sur dev2 (Kaggle)

- Noyau `localia-comparateurs-dev2` (même script que pour `dev/`, dataset privé `localia-eval-dev2`, `executer.py` du dépôt, sans réflexion, température 0). Réponses utilisées pour l'évaluation seulement.
- **[mesuré]** dev2 (138 cas), noteur corrigé ; comparateurs sur GPU (Kaggle), nos modèles sur le Mac :

  | Modèle | S_doc | par cas | extraction | incohérence | abstention | rédaction |
  |---|---|---|---|---|---|---|
  | Base 2B | 0,712 | 0,742 | 0,75 | 0,65 | 0,77 | 0,58 |
  | Lot 4 (2B) | 0,796 | 0,786 | **0,71** | 0,56 | 0,95 | 0,75 |
  | Gemma 3 27B | 0,800 | 0,871 | 0,97 | 0,48 | 0,86 | 0,75 |
  | Mistral Small 3.2 24B | 0,843 | 0,897 | 0,97 | 0,56 | 0,91 | 0,83 |
  | Gemma 4 31B | 0,913 | 0,938 | 0,98 | 0,67 | 0,91 | 0,92 |
  | Qwen3.8 27B | 0,943 | 0,955 | 0,96 | 0,92 | 1,00 | 0,88 |

- **[calculé]** Écart par cas, lot 4 moins comparateur (bootstrap par fiche) : Gemma 3 27B −0,086 [−0,189 ; +0,013] ; Mistral Small −0,111 [−0,191 ; −0,040] ; Gemma 4 −0,153 [−0,245 ; −0,066] ; Qwen3.8 −0,169 [−0,252 ; −0,098].
- Lecture :
  - Le lot 4 égale Gemma 3 27B sur S_doc (moyenne des catégories), mais pas par cas, car les extractions (56 cas sur 138) pèsent lourd par cas.
  - L'écart avec les plus gros tient surtout à **l'extraction** : 0,71 contre 0,96 à 0,98, soit les cas où il faut appliquer une règle ou lire un tableau. C'est la cible du lot 5.
  - Sur l'incohérence, seul Qwen3.8 fait bien (0,92) ; les autres sont entre 0,48 et 0,67, comme le lot 4.
  - Les niveaux annoncés dans `criteres.md` ne sont pas atteints contre Mistral Small, Gemma 4 et Qwen3.8 (écarts significatifs au-delà de la marge de 3 points).

### 25 octobre 2026, 11 h 30 : place disque libérée (accord de l'auteur)

- Disque du Mac plein à 99 % (2,4 Go libres). Avec l'accord de l'auteur, suppression de fichiers du défi en double ou abandonnés, tous récupérables : ancien GGUF du lot 4 (mêmes poids que la version au gabarit sans réflexion), GGUF du lot 2, deux LoRA du pilote 2.5, Qwen3.5-4B IQ4_XS et Q4_K_S, Ministral 3B. Empreintes relevées avant suppression dans `~/localia-labo/modele-compact/supprimes-20261025.txt`. Modèles Ollama de l'auteur non touchés.
- **[mesuré]** 16 Go libres après suppression.

### 25 octobre 2026, 13 h 30 : lot 5 généré, vérifié, assemblé ; entraînement lancé

- **[mesuré]** Professeur : 5a, 162 fiches, phase B 603 tâches en 11 918 s ; 5b, 234 fiches, dont 188 retenues par le professeur comme portant sur la même règle (46 écartées), phase B 376 tâches en 6 140 s.
- **[mesuré]** Vérification :
  - 5b : incohérence éloignée 175 / 188 gardées (7 % de rejet), fausse alerte 123 / 188 (24 fausses alertes, 19 trop longues).
  - 5a : 163 / 603 au premier passage, dont 256 rejets « simple lecture du document ». Relus : ce sont de bons exemples (salaire d'exactement 4 005 € en tranche 1, conducteur de 77 ans dans la ligne « plus de 76 ans »), car choisir la bonne ligne est la compétence visée. Le contrôle est adapté pour le type tableau : une lecture directe est acceptée si le résultat figure dans la ligne recopiée. **374 / 603** gardées.
  - Relecture d'un échantillon gardé : contradictions réelles, citées avec les deux passages, sans trace de l'information réservée ; fausses alertes qui concluent à la cohérence en citant les passages ; tableaux qui nomment la ligne utilisée.
- Assemblage : le type `tableau` garde un exemple par demande ; les incohérences et fausses alertes de 5b prennent les types `incoherence_loin` et `fausse_alerte_loin`, pour ne pas remplacer celles des lots précédents sur les mêmes fiches. **4 766 exemples** sur 939 fiches, aucune fiche d'évaluation.
- Noyau `mohadial/localia-lora-2b-lot5` lancé (dataset privé `localia-exemples-lot5`), même recette que le lot 4. **[calculé]** 596 pas à environ 41 s, soit 6 h 50, plus la fusion et le jeu de développement. **[supposé]** Le quota hebdomadaire de Kaggle sera presque épuisé à la fin (environ 22 h utilisées depuis samedi).

### 25 octobre 2026, 14 h 30 : décontamination complète (lot 5)

- `donnees/decontaminer.py` et `decontamination.md` : 13-grammes, Jaccard exact sur 5-grammes, voisins sémantiques e5-small, repérage des réponses attendues tombant dans un passage partagé, 50 vérifications manuelles.
- **[mesuré]** Aucune paire de documents au-dessus de 0,5. Aucun 13-gramme commun non banal entre les cas du jeu secret et l'entraînement.
- Erreur trouvée : deux fiches de dev2 (F348, F35755) sont proches de fiches d'entraînement (F14840 : Jaccard 0,41). Cas touchés : 3 dans dev, 7 dans dev2, 6 dans le secret. Vérification manuelle : 2 fuites réelles (V037, V093), 2 risques d'interférence (S038, S009), le reste sans rapport.
- **[mesuré]** Sans les cas touchés de dev et dev2 (188 cas) : base 0,784, lot 3 0,816, lot 4 0,840 ; lot 4 − base +0,057 [−0,002 ; +0,115]. Les conclusions tiennent.
- `criteres.md` amendé avant l'ouverture du jeu secret : score principal sans les cas touchés, score complet publié à côté.

### 25 octobre 2026, 15 h : plan 2.7 soumis à l'auteur

- `plan-phase3.md` : 0 € de dépense (Mac et Kaggle) ; étapes 3.1 à 3.6 (note du lot 5, lot 6 par réponses de l'élève vérifiées, vitesse et mémoire, benchmarks publics, évaluation finale sur le jeu secret, juge ouvert et contrôle humain), environ 15 h de GPU ; points d'arrêt ; recette fixée ; phase 4 ensuite. **Validé par l'auteur (« ok »).**

### 25 octobre 2026, 15 h 40 : étape 3.1 préparée, mesure avec les messages exacts de Localia

- `eval/outils/messages_localia.cjs` : pour chaque cas, la fiche est convertie en PDF (cupsfilter), lue par `extractPdf` de Localia, puis `documentMessages` (src/chat.cjs) choisit les extraits et ajoute la consigne système de Localia, exactement comme dans une conversation avec un PDF joint (budget de 8 192 jetons). Évaluation seulement : ces consignes ont été écrites avec Claude et n'entrent jamais dans l'entraînement.
  - Deux artefacts de la conversion en PDF, propres à cupsfilter : plusieurs espaces entre les mots (ramenés à un seul) et des mots coupés en fin de ligne sans trait d'union (laissés tels quels ; ils peuvent gêner les citations exactes).
  - **[mesuré]** dev2 : 30 cas sur 138 où Localia ne transmet que des extraits (document trop long pour le budget).
- `executer.py` : option `--messages` pour envoyer des messages précalculés ; sans elle, rien ne change.
- Lancé sur le Mac : base puis lot 4 (GGUF au gabarit sans réflexion), dev2 puis dev. Le lot 5 suivra.

### 25 octobre 2026, 19 h 30 : base et lot 4 dans les conditions de Localia

- **[mesuré]** Messages exacts de Localia (PDF, extraits, consigne système), llama-server sur le Mac :

  | | dev | dev2 | 188 cas (sans les cas touchés) | extraction | abstention |
  |---|---|---|---|---|---|
  | Base, Localia | 0,785 | 0,766 | 0,793 | 0,78 | 0,84 |
  | Lot 4, Localia | 0,900 | 0,795 | **0,851** | 0,77 | 0,97 |
  | Base, `executer.py` | 0,863 | 0,712 | 0,784 | 0,79 | 0,78 |
  | Lot 4, `executer.py` | 0,895 | 0,796 | 0,840 | 0,76 | 0,97 |

- Lecture : l'avance du lot 4 sur la base est la même dans les deux conditions (+0,058 et +0,056 par cas). Le refus vu dans l'essai de Localia (V025) n'est pas général : 5 réponses sur 138 de dev2 commencent par un refus, abstentions attendues comprises. La consigne de Localia ne pénalise pas le modèle.

### 25 octobre 2026, 20 h 30 : lot 5 entraîné

- **[mesuré]** `localia-lora-2b-lot5` : 596 pas en 25 222 s (7 h), RAM stable à 3,3 Go. GGUF rapatrié, gabarit sans réflexion appliqué (empreintes dans `provenance.md`).
- **[mesuré]** dev (60 cas), GPU : **S_doc 0,874** (lot 4 : 0,883 avec le noteur corrigé). Abstention 1,00, incohérence 1,00, extraction 0,92, synthèse 0,90, citation 0,875, qualité du français 0,81, rédaction 0,61 (lot 4 : 0,68).
- Notation sur le Mac (dev2 et dev, avec `executer.py` puis avec les messages de Localia) en cours.

### 26 octobre 2026, 1 h : lot 5 sur 198 cas (Mac), non retenu

- **[mesuré]** 188 cas sans les cas touchés : `executer.py` — base 0,784, lot 4 0,840, lot 5 0,839 ; conditions de Localia — base 0,793, lot 4 0,851, lot 5 0,790.
- **[calculé]** Lot 5 − lot 4 : −0,002 [−0,043 ; +0,041] avec `executer.py` ; **−0,061 [−0,116 ; 0,000]** dans les conditions de Localia.
- dev2, `executer.py` : le lot 5 corrige ce qu'il visait — incohérence 0,80 (lot 4 : 0,15), extraction 0,79 (lot 4 : 0,71) — mais recule ailleurs : fausses alertes 0,79 (0,86), qualité du français 0,67 (0,75), rédaction 0,67 (0,75), synthèse 0,87 (0,96).
- Dans les conditions de Localia, les fausses alertes tombent à **0,43** (lot 4 : 1,00) : à une demande de vérification sur un passage cohérent, le lot 5 répond « oui, il y a une contradiction » (V033, V053). Il ne signale en revanche aucune incohérence spontanée hors des demandes de vérification (0 réponse sur 126).
  - **[supposé]** Déséquilibre des données (175 incohérences éloignées contre 123 fausses alertes) et consigne de Localia (« Tu aides à vérifier un document ») qui oriente vers la recherche d'erreurs.
- Décision (plan, étape 3.1) : **le lot 4 reste le modèle retenu.** Les données du lot 5 seront reprises au lot 6, rééquilibrées.
- **[calculé]** Quota Kaggle de la semaine presque épuisé (environ 28 h sur 30) ; prochain entraînement après la remise à zéro du samedi 31 octobre vers 2 h.

### 26 octobre 2026, 11 h : étape 3.3, vitesse et mémoire du lot 4 (processeur seul)

- `mesures/vitesse-lot4.md` et `mesures/vitesse-lot4-vocfr48k.md` : llama-bench, `-ngl 0`, 8 fils, `-fa 0`, 64 jetons générés après 8 192 jetons de contexte, 3 passes alternées. Charge de la machine entre 11 et 15 (autres logiciels ouverts) ; le Mac bride le processeur à 50-54 % dès la 2e mesure.
- **[mesuré]** Génération à 8k :
  - base : 5,55 (processeur à 100 %), 4,53 et 4,16 jetons/s (bridé) ;
  - lot 4 : 5,80 (100 %), puis 5,18, 4,66, 4,72, 4,24 et 3,87 jetons/s (bridé à 50-54 %) ;
  - **lot 4 élagué (vocfr48k, 1,11 Go)** : 5,22 (100 %, mesure de tête), 5,35 et 4,94 jetons/s (bridé à 50-52 %).
- **[calculé]** À bridage égal, l'élagage apporte de 13 à 28 % de vitesse ; le modèle élagué reste autour de 5 jetons/s même bridé, le modèle complet tombe à 3,9-4,7.
- **[mesuré]** Pic de mémoire : 2,02 Go (lot 4), 1,77 Go (élagué), pour une limite de 4 Go.
- Reste à faire : la qualité du lot 4 élagué sur dev et dev2 (à la phase 2.3, l'élagage coûtait 0,007 sur dev). S'il ne perd pas de qualité, c'est la version à livrer.

### 26 octobre 2026, 13 h : qualité du lot 4 élagué (étape 3.3), c'est la version à livrer

- **[mesuré]** Messages exacts de Localia, llama-server sur le Mac, dev2 puis dev : lot 4 élagué (`…-sansreflexion-vocfr48k.gguf`) dev2 **0,795** (lot 4 : 0,795), dev **0,893** (0,900) ; 188 cas sans les cas touchés **0,849** (0,851).
- **[calculé]** Élagué − complet : −0,002 [−0,005 ; 0,000] (bootstrap apparié, 10 000 tirages). 20 réponses sur 198 diffèrent d'au moins un jeton, une seule change de note : D059 (qualité du français, 1,00 → 0,67, l'accord « activités » n'est plus rétabli).
- Décision : **le lot 4 élagué est la version à livrer** (même qualité, de 13 à 28 % plus rapide à bridage égal, 1,77 Go de RAM). L'élève du lot 6 reste le lot 4 complet, celui dont on entraîne les poids.

### 26 octobre 2026, 13 h : lot 6 lancé (étape 3.2), réponses de l'élève

- `donnees/generer_lot6.py` : 300 questions vérifiées, moitié application (lots 4a, 4b), moitié tableau (lot 5a) ; sans ce partage, le tableau (374 questions gardées contre 250) dominerait. 4 réponses par question, température 0,8, lot 4 dans Ollama. Sortie : `resultats/lot6/eleve_phase_b.jsonl`, à contrôler ensuite par `verifier.py`.

### 29 octobre 2026, 21 h 30 : lot 6, réponses de l'élève vérifiées et relues

- **[mesuré]** Génération : 1 200 réponses (300 questions × 4) en 32 164 s (8 h 56), toutes terminées. `verifier.py`, par lot d'origine : application 4a 168/292, 4b 207/308, tableau 5a 439/600, soit **814 justes (68 %)**. Par question : 33 sans aucune réponse juste, 35 avec 1, 35 avec 2, 79 avec 3, 118 avec 4. Rejets principaux : résultat absent de la réponse, oui ou non en désaccord avec le calcul vérifié.
- Défaut trouvé à la relecture : des réponses justes mais fautives passent `verifier.py`, qui ne contrôle pas la langue (« le requalification », « valid en tant que CDD », « vous avez été né »). Sur 3 réponses tirées au hasard, 2 avaient des fautes. S'entraîner sur ses propres fautes renforcerait celles de l'élève ; le lot 5 reculait déjà en qualité du français.
- `donnees/juger_francais.py` : Qwen3 8B (Apache 2.0, Ollama, température 0) répond FAUTE ou PROPRE ; il trie seulement et n'écrit aucun texte d'entraînement. Essai : 4 fautes signalées sur 12 réponses de l'élève et 2 sur 8 du professeur, dont une vraie (« étape parème »). Mistral Small 3.2 n'est pas sur le Mac (14 Go, au-delà de la limite de téléchargement).
- `donnees/assembler_lot6.py` : lot 5, incohérences éloignées ramenées de 175 à 123 (autant que de fausses alertes éloignées, comme au lot 4), plus au plus 2 réponses justes et propres de l'élève par question, en plus de la réponse du professeur.
- Chaîne automatique (`resultats/lot6/chaine-lot6.sh`, hors dépôt), pour ne pas dépendre de la disponibilité de Claude : assemblage, jeu de données Kaggle privé, noyau lancé le samedi 31 octobre à 2 h 15 (relancé toutes les 3 h s'il est refusé), GGUF rapatrié, gabarit sans réflexion, notation sur le Mac dans les deux conditions, comparaison avec le lot 4 sur les 188 cas.
