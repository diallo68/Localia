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
