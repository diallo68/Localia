# Protocole : quel modèle pour quel métier ?

Préparé le 7 octobre 2026. **Aucune série n'est lancée sans l'accord de l'utilisateur** : les séries occupent le Mac plusieurs heures.

## Modèles comparés

Tous sont lancés par le moteur intégré de Localia, à partir de fichiers GGUF Q4_K_M téléchargés sur Hugging Face, avec leur empreinte vérifiée.

| Modèle | Taille | Licence | Pourquoi |
|---|---|---|---|
| Gemma 4 E4B (`integre/gemma-4-e4b`) | 5,0 Go | Apache 2.0 | généraliste récent, déjà testé sur la thèse FAYE |
| Qwen 3.5 9B (`integre/qwen3.5-9b`) | 5,7 Go | Apache 2.0 | généraliste le plus solide qui tienne sur 16 Go |
| Phi-4 mini 3.8B (`integre/phi-4-mini`) | 2,5 Go | MIT | petit, fort en raisonnement et en calcul (finance, ingénierie) |
| MedGemma 1.5 4B (`integre/medgemma-1.5-4b`) | 2,5 Go | Health AI Developer Foundations | spécialiste santé ; **licence propre à lire avant toute diffusion dans Localia** |

## Séries (dossier `metiers/`)

Pour chaque métier, deux séries :

- **`serie-<métier>.txt`** : 5 questions sans document. Le texte nécessaire est dans la question.
- **`serie-<métier>-document.txt`** : 6 questions sur le document fictif `documents/doc-<métier>-….pdf` (2 pages).

Cela fait 11 questions par métier et 88 au total. Les catégories mesurées sont l'extraction, le calcul, les incohérences, la rédaction ou la synthèse, et l'honnêteté (information absente : la bonne réponse est de le dire).

## Pièges placés dans les documents

| Document | Pièges |
|---|---|
| Enseignement (cours sur la photosynthèse) | barème total de 19 au lieu de 20 ; copie d'élève avec une cause fausse (l'eau au lieu de la lumière) ; aucune moyenne de classe |
| Santé (compte rendu) | prise du traitement contradictoire (1 fois prescrite, 2 fois déclarée) ; créatinine demandée mais sans résultat ; données personnelles (nom, date de naissance, IPP, téléphone, adresse) |
| Juridique (contrat) | articles 4 et 7 contradictoires (paiement à 30 jours ou à réception) ; articles 5 et 6 déséquilibrés ; aucune clause sur les litiges |
| Administration (compte rendu de réunion) | 25 % de dossiers hors délai à calculer ; coût du recrutement absent ; données personnelles |
| Finance (relevé et facture) | solde final faux (1 890 000 et non 2 000 000) ; paiement en double à Pharma Plus ; facture fausse (831 250 et non 850 000) ; salaires au-dessus du budget ; IBAN |
| Entreprise (rapport de ventes) | total du semestre faux (135 M et non 140 M) ; hausse fausse (66,7 % et non 50 %) ; vente en ligne annoncée comme objectif seulement |
| Ingénierie (rapport d'incident) | production des panneaux solaires oubliée dans l'analyse ; coût absent |
| Communication (dépêche et interview) | 3 000 livres dans la dépêche, « plus de 5 000 » sur les réseaux sociaux ; nombre de livres en langues nationales non donné |

## Conditions identiques pour tous les modèles

Réglages par modèle (onglet Réglages) :
- température 0,6 ; top P 0,95 ; top K 20 ;
- contexte 16 384 ; longueur maximale de réponse 2 048 ; graine 42 ;
- **réflexion désactivée** ;
- consigne permanente vide.

MedGemma : il raisonne parfois de lui-même, entre des jetons spéciaux que Localia range comme « réflexion » (hors réponse). Le réglage « réflexion désactivée » ne l'en empêche pas : ce temps compte dans ses mesures.

Métier et anonymisation : les séries du Benchmark sont envoyées sans consigne de métier ni anonymisation, pour mesurer le modèle lui-même.

## Déroulement dans Localia

1. Benchmark → **1. Lancer une série** → **Importer des questions** → `serie-<métier>.txt` ; cocher les 4 modèles ; lancer.
2. Même chose avec `serie-<métier>-document.txt`, puis **＋ PDF** → le document du métier.
3. Enchaîner les 16 séries. La durée est estimée à environ **1 à 2 minutes par réponse** sur ce Mac (Intel, 16 Go) avec un petit document, soit 88 questions × 4 modèles ≈ **6 à 12 heures**. Prévoir 2 nuits, avec le départ programmé.

## Notation et décision

- Deux correcteurs indépendants, comme pour la thèse FAYE : Codex et Claude, chacun avec ses notes sur 5, son verdict et la case invention. Notes importées à l'étape 2 du Benchmark, qui calcule l'accord entre correcteurs.
- **Règle de choix par métier** :
  1. note moyenne la plus haute sur les 11 questions du métier ;
  2. si l'écart est inférieur à 0,3 point, le modèle **le plus petit** l'emporte, car plus rapide et moins gourmand ;
  3. un modèle avec plus d'une invention sur les questions « Honnêteté » est écarté pour ce métier.
- Le résultat devient la liste des **modèles conseillés par métier**, affichée au premier lancement et dans la Bibliothèque.
