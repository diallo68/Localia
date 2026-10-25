# Décontamination du jeu d'entraînement du lot 5 (25 octobre 2026)

Script : `donnees/decontaminer.py` (13-grammes, Jaccard exact sur 5-grammes, voisins sémantiques e5-small), puis repérage des cas dont une valeur attendue se trouve dans un passage recopié d'une fiche d'entraînement, et 50 vérifications manuelles. Pour le jeu secret, seuls des identifiants et des scores figurent ici.

## Résumé

- **Documents** : aucune paire au-dessus de 0,5 (Jaccard exact, plus strict que MinHash). Les fiches de Service-Public reprennent souvent des paragraphes entiers d'une fiche à l'autre, si bien que le critère « 0 recouvrement de 13-grammes » de `criteres.md` n'est pas tenable à la lettre ; il est remplacé par le repérage, cas par cas, des réponses attendues qui tombent dans un passage partagé (ci-dessous).
- **Questions** : aucun 13-gramme commun non banal entre les cas du jeu secret et l'entraînement ; 5 dans dev2, 0 dans dev.
- **Erreur de ma part** : les fiches de dev2 ont été contrôlées contre les jeux d'évaluation, mais pas contre les fiches d'entraînement. Deux d'entre elles en sont proches : F348 (maladie professionnelle) avec F14840 (accident du travail), Jaccard 0,41 ; F35755 avec F35779, 304 13-grammes communs.
- **Cas touchés** (une valeur attendue figure dans un passage partagé avec une fiche d'entraînement) :
  - dev : D025, D026, D047 ;
  - dev2 : V037, V038, V039, V041 (F348), V097, V101 (F35755), et V093 (F2252, repéré à la main : même règle d'amende apprise sur F33658) ;
  - secret : S013, S024, S033, S043, S066, S068 (6 cas sur 240).
- **[mesuré]** Sans les 10 cas touchés de dev et dev2 (188 cas) : base 0,784, lot 3 0,816, lot 4 0,840 ; lot 4 − base +0,057 [−0,002 ; +0,115]. Les cas touchés ne gonflaient pas les scores ; les conclusions du journal tiennent.
- **Règle pour l'évaluation finale, fixée avant de l'ouvrir** : le score principal sur le jeu secret est calculé **sans les 6 cas touchés** (234 cas) ; le score sur les 240 cas est publié à côté.

## Vérification manuelle des 50 paires les plus proches (e5-small)

Cosinus de 0,931 à 0,954 (médiane sur les 438 cas : 0,910 ; e5-small donne des cosinus élevés à toutes les questions administratives).

- **44 paires** : même forme de question (« Résume en 3 puces… », « Quel est le délai… ») sur une fiche et un contenu différents. Pas de fuite.
- **2 paires : fuite réelle**, toutes deux dans dev2 : V037 (même ligne du tableau d'indemnité en capital, apprise sur F14840) et V093 (même amende forfaitaire de 500, 400 ou 1 000 €, apprise sur F33658).
- **2 paires : même sujet, règle différente** : S088 (permis international, réponse d'entraînement sur un autre délai) et S115 (formule de la retraite du privé contre celle des fonctionnaires). Pas de fuite.
- **2 paires : risque d'interférence** : S038 et S009 attendent une abstention, alors que l'entraînement contient, pour une autre fiche du même sujet, un délai chiffré (« 2 semaines », « 20 ans »). Pas une fuite de réponse, mais un piège à surveiller dans l'analyse des erreurs.

## Suite

- Les prochains lots écarteront aussi les fiches dont plus de 50 13-grammes non banals se retrouvent dans un document d'évaluation (dev2 compris).
- Le lot 5, déjà en cours d'entraînement, contient F14840 et F33658 : les cas touchés sont retirés des comparaisons qui le concernent.

## Rapport du script
Entraînement : 4766 exemples, 939 documents distincts.

## 1. 13-grammes communs

| Jeu | Partie | 13-grammes de l'évaluation | communs | dont formules répétées | autres |
|---|---|---|---|---|---|
| dev | documents | 12875 | 220 | 91 | 129 |
| dev | cas | 1708 | 2 | 2 | 0 |
| dev2 | documents | 23569 | 1101 | 2 | 1099 |
| dev2 | cas | 3536 | 5 | 0 | 5 |
| secret | documents | 53142 | 680 | 166 | 514 |
| secret | cas | 9254 | 0 | 0 | 0 |

Formule répétée : 13-gramme présent dans au moins 3 documents d'entraînement distincts.

Éléments d'évaluation avec des 13-grammes communs non banals (identifiant, nombre) :

- dev2 / documents / sp-F348 : 609
- dev2 / documents / sp-F35755 : 304
- secret / documents / sp-F21552 : 127
- dev / documents / sp-F14044 : 100
- secret / documents / sp-F16146 : 76
- dev2 / documents / sp-F2252 : 71
- secret / documents / sp-F35125 : 50
- secret / documents / sp-F1040 : 48
- secret / documents / sp-F2886 : 46
- secret / documents / sp-F11094 : 34
- secret / documents / sp-F11534 : 26
- secret / documents / sp-F20314 : 26
- secret / documents / sp-F12918 : 23
- dev2 / documents / sp-F16494 : 21
- dev2 / documents / sp-F714 : 21
- secret / documents / sp-F39188 : 21
- dev2 / documents / sp-F2651 : 18
- dev / documents / sp-F38054 : 17
- dev2 / documents / sp-F33967 : 15
- dev2 / documents / sp-F219 : 15
- secret / documents / sp-F165 : 15
- dev / documents / sp-F16217 : 10
- dev2 / documents / sp-F86 : 7
- dev2 / documents / sp-F3136 : 7
- dev2 / documents / sp-F12484 : 7
- secret / documents / sp-F14935 : 7
- secret / documents / sp-F36379 : 7
- dev2 / cas / V040 : 5
- dev / documents / sp-F1879 : 2
- dev2 / documents / sp-F1744 : 2
- dev2 / documents / sp-F966 : 2
- secret / documents / sp-F2401 : 2
- secret / documents / sp-F21887 : 2
- secret / documents / sp-F17709 : 1
- secret / documents / sp-F13723 : 1
- secret / documents / sp-F885 : 1
- secret / documents / sp-F14710 : 1

## 2. Similarité de documents (Jaccard exact, 5-grammes)

Paires au-dessus de 0.5 : **0**. Les 10 plus proches (document d'évaluation, document d'entraînement le plus proche) :

- 0.409 : dev2 / sp-F348 — sp-F14840
- 0.134 : dev2 / sp-F35755 — sp-F35779
- 0.075 : dev / sp-F14044 — sp-F36465
- 0.068 : secret / sp-F21552 — sp-F36465
- 0.057 : secret / sp-F11534 — sp-F1460
- 0.042 : secret / sp-F39188 — sp-F39280
- 0.042 : dev / sp-F38054 — sp-F32235
- 0.041 : secret / sp-F1040 — sp-F21761
- 0.040 : dev / sp-F16217 — sp-F31954
- 0.039 : dev2 / sp-F2252 — sp-F33655

## 3. Voisins sémantiques (e5-small, cosinus)

Pour chaque cas d'évaluation, la demande d'entraînement la plus proche. Les 50 paires les plus proches sont vérifiées à la main (section 4).

| Rang | Jeu | Cas | Cosinus | Fiche d'entraînement |
|---|---|---|---|---|
| 1 | dev2 | V025 | 0.954 | sp-F8 (application) |
| 2 | dev2 | V093 | 0.951 | sp-F33658 (extraction) |
| 3 | secret | S048 | 0.949 | sp-F32700 (synthese) |
| 4 | dev2 | V004 | 0.949 | sp-F1016 (injection) |
| 5 | secret | S088 | 0.949 | sp-F31128 (abstention) |
| 6 | dev | D013 | 0.945 | sp-F35730 (extraction) |
| 7 | dev2 | V005 | 0.943 | sp-F32700 (synthese) |
| 8 | secret | S038 | 0.943 | sp-F1420 (injection) |
| 9 | dev2 | V128 | 0.943 | sp-F2065 (abstention) |
| 10 | dev2 | V109 | 0.943 | sp-F12647 (extraction) |
| 11 | secret | S158 | 0.942 | sp-F2961 (synthese) |
| 12 | secret | S050 | 0.941 | sp-F39617 (redaction) |
| 13 | dev2 | V037 | 0.941 | sp-F14840 (tableau) |
| 14 | dev2 | V116 | 0.940 | sp-F36151 (extraction) |
| 15 | secret | S239 | 0.940 | sp-F2246 (citation) |
| 16 | dev2 | V024 | 0.939 | sp-F18510 (qualite_fr) |
| 17 | dev | D029 | 0.939 | sp-F2064 (redaction) |
| 18 | dev2 | V122 | 0.938 | sp-F19134 (tableau) |
| 19 | secret | S153 | 0.938 | sp-F2961 (synthese) |
| 20 | dev2 | V010 | 0.938 | sp-F704 (extraction) |
| 21 | secret | S142 | 0.937 | sp-F3087 (synthese) |
| 22 | dev | D056 | 0.937 | sp-F12086 (synthese) |
| 23 | dev2 | V030 | 0.937 | sp-F17048 (redaction) |
| 24 | dev | D033 | 0.937 | sp-F34031 (extraction) |
| 25 | dev | D026 | 0.937 | sp-F12390 (redaction) |
| 26 | secret | S075 | 0.936 | sp-F785 (injection) |
| 27 | dev2 | V007 | 0.936 | sp-F33924 (redaction) |
| 28 | dev2 | V067 | 0.936 | sp-F672 (tableau) |
| 29 | secret | S115 | 0.936 | sp-F36465 (abstention) |
| 30 | dev2 | V071 | 0.936 | sp-F1492 (abstention) |
| 31 | secret | S016 | 0.935 | sp-F16251 (redaction) |
| 32 | dev2 | V006 | 0.935 | sp-F1292 (redaction) |
| 33 | secret | S019 | 0.935 | sp-F1520 (abstention) |
| 34 | secret | S001 | 0.935 | sp-F10037 (injection) |
| 35 | secret | S009 | 0.935 | sp-F35045 (extraction) |
| 36 | secret | S186 | 0.935 | sp-F2961 (synthese) |
| 37 | dev2 | V075 | 0.934 | sp-F2457 (abstention) |
| 38 | secret | S124 | 0.934 | sp-F1520 (abstention) |
| 39 | dev2 | V129 | 0.934 | sp-F2733 (extraction) |
| 40 | dev2 | V002 | 0.933 | sp-F38 (tableau) |
| 41 | secret | S145 | 0.933 | sp-F11056 (abstention) |
| 42 | secret | S070 | 0.933 | sp-F770 (abstention) |
| 43 | dev2 | V069 | 0.932 | sp-F35558 (abstention) |
| 44 | secret | S072 | 0.932 | sp-F1650 (citation) |
| 45 | secret | S112 | 0.932 | sp-F174 (citation) |
| 46 | secret | S187 | 0.932 | sp-F36326 (redaction) |
| 47 | secret | S238 | 0.932 | sp-F3050 (redaction) |
| 48 | dev | D006 | 0.931 | sp-F369 (synthese) |
| 49 | secret | S150 | 0.931 | sp-F2615 (incoherence) |
| 50 | dev | D038 | 0.931 | sp-F704 (citation) |

Répartition du cosinus maximal sur 438 cas : médiane 0.910, 90e centile 0.932, maximum 0.954.
