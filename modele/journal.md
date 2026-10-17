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
