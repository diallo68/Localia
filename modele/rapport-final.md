# Défi « modèle compact » : rapport final

Rédigé le 7 novembre 2026 par Claude, à partir de `journal.md`, qui fait foi pour chaque chiffre. Les critères sont dans
`criteres.md`, figés le 17 octobre 2026, avec leurs amendements datés. Les désaccords avec Codex sont dans `desaccords.md`.

## En bref

- **But du défi** : un modèle de 2,5 Go au plus, qui tourne sur un ordinateur portable sans carte graphique et qui
  rivalise, pour le travail sur un document fourni en français, avec des modèles 5 à 10 fois plus gros.
- **Résultat : Échec**, au sens des critères fixés à l'avance.
  - Sur le jeu de test secret, le modèle retenu (lot 4, vocabulaire élagué) obtient **0,766**, contre **0,772** pour
    sa base Qwen3.5-2B. L'écart, −0,006 [−0,057 ; +0,047], n'est pas significatif. Le seuil le plus bas, +5 points,
    n'est pas atteint.
  - Le contrôle de régression obligatoire n'est pas tenu : IFEval −5,9 points, MGSM −7,2.
- **Ce qui progresse quand même** :
  - le modèle dit beaucoup plus souvent, à raison, que l'information n'est pas dans le texte : FQuAD 2.0 +19 points,
    SQuAD 2.0 +23 points. Ce gain appris en français se retrouve en anglais ;
  - le vocabulaire élagué rend le fichier plus léger (1,11 Go) et la génération plus rapide (de 13 à 28 %), sans
    perte mesurable.
- **Ce qui recule** : la détection d'incohérences, la résistance aux instructions cachées dans un document, le respect
  des consignes de rédaction et le calcul.
- **Publication** : l'auteur a choisi de publier le modèle malgré l'échec, avec ses mesures, sous le nom
  Dial-bowe-GN-224-2B (Apache 2.0). Trois fichiers sont prêts (Q4_K_M, Q5_K_M, Q8_0). L'envoi sur Hugging Face est
  fait par l'auteur (`publication/PUBLIER.md`).
- **Coût** : 0 €. Tout a tourné sur le Mac de l'auteur et sur les GPU T4 gratuits de Kaggle. Le crédit Google Cloud
  n'a pas été utilisé.

## 1. Ce qui avait été fixé avant de commencer

- **Machine de référence** : MacBook Pro 2019, Intel Core i9-9880H, 16 Go, processeur seul.
- **Conditions obligatoires** :
  - fichier de 2,5 Go au plus ;
  - au moins 5 jetons/s en génération à 8 192 jetons de contexte ;
  - 4 Go de mémoire au plus ;
  - import dans Ollama et dans Localia ;
  - décontamination, provenance de toutes les données ;
  - pas de régression générale (MMMLU, MGSM, IFEval).
- **Niveaux de résultat**, mesurés sur le score documentaire (S_doc) du jeu secret :
  - **Rivalise** : non inférieur à au moins 3 des 4 comparateurs de 9 à 12 Md et supérieur à au moins 1 ;
  - **Dépasse sa classe** : au moins 10 points de plus que la base, et supérieur à Qwen3.5-9B et à Gemma 3 12B ;
  - **Améliore la base** : au moins 5 points de plus que la base ;
  - **Échec** sinon, ou si une condition obligatoire manque.
- **Jeu secret** : 240 cas sur 40 documents, figé le 17 octobre (SHA-256 `622aac13…`), gardé hors du dépôt, ouvert une
  seule fois le 1er novembre.

## 2. Déroulement

| Date | Étape | Résultat |
|---|---|---|
| 17 oct. | Conception, critères, jeu secret figé | Le 4B est trop lent sur cette machine (4,1 à 4,35 jetons/s à 8k) : la base sera Qwen3.5-2B |
| 18 oct. | Vocabulaire élagué (248 320 → 131 203 jetons) | Plus rapide, presque sans perte sur dev |
| 18-19 oct. | Chaîne de données : un professeur, Qwen3.6-35B-A3B, écrit à partir de fiches Service-Public.fr, puis vérification par programme | Lot 2 : 1 950 exemples |
| 19-24 oct. | Lot 3 (3 633 exemples) ; fuite de mémoire de l'entraînement trouvée et corrigée | dev 0,884 ; trop d'abstentions à tort |
| 25 oct. | Courbe d'échelle (500, 1 000, 3 633 exemples) ; dev2 (138 cas écrits à la main) | Plus d'exemples ne suffit pas : c'est leur nature qui compte |
| 25 oct. | **Lot 4** (4 094 exemples, dont des cas où il faut appliquer une règle) | Meilleur sur dev et dev2 : 0,851 contre 0,793 pour la base (188 cas) |
| 25-26 oct. | Lot 5 (tableaux, contradictions éloignées) | Non retenu : il corrige sa cible, mais crée de fausses alertes (0,43 contre 1,00) |
| 26 oct. | Vitesse et mémoire ; élagage du lot 4 | Version à livrer : lot 4 élagué, 1,11 Go |
| 26-31 oct. | Lot 6 (réponses de l'élève triées par le professeur) | Non retenu : −0,008 face au lot 4, et 64 % des réponses « justes » avaient un raisonnement faux |
| 1er nov. | Bancs publics ; LoRA atténuée | Régression IFEval et MGSM ; aucune intensité réduite ne passe le contrôle |
| 1er nov. | **Jeu secret ouvert** (14 modèles) | 0,766 contre 0,772 : Échec |
| 2 nov. | Juge ouvert (Mistral Small 3.2) et contrôle humain sur 60 réponses | κ auteur/juge −0,04 : le juge n'est pas retenu, le niveau reste Échec |
| 2-7 nov. | Entraînement refait pour retrouver la pleine précision ; quantifications ; préparation de la publication | Le refait est équivalent au livré ; trois fichiers prêts |

## 3. Résultats

### 3.1 Jeu secret (résultat principal)

Le score principal porte sur 234 cas : les 6 cas trop proches des données d'entraînement sont retirés. Il est noté
automatiquement, et les intervalles de confiance à 95 % sont obtenus par bootstrap sur les documents.

| Modèle | S_doc | Lot 4 − modèle | Verdict |
|---|---:|---|---|
| Qwen3.8-27B (info) | 0,933 | −0,167 [−0,209 ; −0,124] | inférieur |
| Gemma 4 31B QAT (info) | 0,919 | −0,153 [−0,202 ; −0,100] | inférieur |
| Qwen3.6-35B-A3B (info, professeur) | 0,892 | −0,126 [−0,174 ; −0,078] | inférieur |
| Mistral Small 3.2 24B (info) | 0,870 | −0,103 [−0,149 ; −0,056] | inférieur |
| **Qwen3.5-9B** | 0,867 | −0,101 [−0,157 ; −0,044] | inférieur |
| **Gemma 4 12B QAT** | 0,863 | −0,097 [−0,140 ; −0,053] | inférieur |
| Qwen3.5-4B (repère) | 0,857 | −0,091 [−0,138 ; −0,042] | inférieur |
| **Gemma 3 12B** | 0,845 | −0,079 [−0,128 ; −0,020] | inférieur |
| Gemma 3 27B (info) | 0,833 | −0,067 [−0,122 ; −0,003] | inférieur |
| Base Qwen3.5-2B | 0,772 | −0,006 [−0,057 ; +0,047] | indécis |
| **Lot 4 élagué** | **0,766** | | |
| **Mistral-Nemo 12B** | 0,737 | +0,029 [−0,021 ; +0,083] | non inférieur |
| Ministral 3 3B (repère) | 0,719 | +0,047 [−0,006 ; +0,101] | non inférieur |
| Phi-4-mini (repère) | 0,693 | +0,073 [+0,023 ; +0,121] | supérieur |

- Les comparateurs en gras sont ceux qui décident du niveau « Rivalise ».
- Sur les 240 cas : lot 4 0,765, base 0,772, mêmes verdicts.
- « Rivalise » n'est pas rempli : le modèle n'est non inférieur qu'à 1 des 4 comparateurs de 9 à 12 Md, Mistral-Nemo,
  alors qu'il en fallait 3.

**Par catégorie, écart lot 4 − base :**

- en progrès : abstention +0,08, citation +0,06, qualité du français +0,09, extraction +0,03 ;
- en recul : incohérences −0,15, injections −0,08, rédaction contrainte −0,07, synthèse −0,02.

Les gains et les pertes s'annulent.

### 3.2 Fiabilité de la note

- L'auteur a noté à l'aveugle 60 réponses, avec la même grille que le juge.
  - Entre l'auteur et le juge ouvert, κ = −0,038 [−0,121 ; +0,058].
  - Entre l'auteur et la note automatique, κ = 0,048 [−0,070 ; +0,174].
- La règle fixée avant le passage du juge disait : si κ < 0,6, le juge n'est pas fiable. Le niveau reste donc celui de
  la note automatique.
- À titre secondaire, le juge donnait lot 4 0,696 contre base 0,675 (+0,021 [−0,024 ; +0,067]), ce qui ne changerait
  pas non plus le niveau.
- Observation : l'auteur a noté presque tout à 1 (55 réponses sur 60). Avec une note aussi concentrée, le κ reste
  faible même quand l'accord brut est moyen (76,7 % avec la note automatique). Aucun des deux correcteurs
  automatiques ne reproduit le jugement de l'auteur. C'est la principale limite de toute l'évaluation.

### 3.3 Conditions obligatoires

| Condition | Seuil | Mesure | Tenue |
|---|---|---|---|
| Taille du fichier | ≤ 2,5 Go | 1,11 Go (Q4_K_M) | oui |
| Génération à 8k, processeur seul | ≥ 5 jetons/s | 26 oct., machine chargée : 5,22 / 5,35 / 4,94, médiane 5,22. 7 nov. : 16,8 à 17,1 | oui, de justesse en charge |
| Mémoire à 8k | ≤ 4 Go | 1,77 Go (26 oct.), 2,39 Go (7 nov.) | oui |
| Import dans Ollama et Localia | fonctionne | Ollama 0.40.5 et 0.40.14 ; Localia par Ollama et par le moteur intégré (conversation de trois tours, 7 nov.) | oui |
| Décontamination | règle amendée le 25 oct. | 36 fiches d'évaluation et 44 fiches proches exclues ; 6 cas retirés du score principal | oui |
| Provenance | 100 % des sources | `provenance.md` | oui |
| Régression générale | MMMLU ≥ base − 2 ; MGSM ≥ base − 3 ; IFEval ≥ base | MMMLU +0,2 ; **MGSM −7,2** ; **IFEval −5,9** | **non** |

Le 1er novembre, l'auteur a décidé de garder le lot 4 élagué en déclarant le contrôle de régression non tenu, plutôt
que de choisir après coup une LoRA atténuée : aucune ne passait le contrôle, et toutes lisaient moins bien.

### 3.4 Bancs publics

Écart avec la base Qwen3.5-2B, sans réflexion, température 0 [IC 95 %] :

| Banc | Base | Lot 4 élagué |
|---|---:|---|
| FQuAD 2.0 (français, 800, moitié sans réponse) | 0,420 | +0,190 [+0,142 ; +0,260] |
| Belebele (français, 900) | 0,701 | +0,020 [0 ; +0,040] |
| MMMLU (français, 2 850) | 0,518 | +0,002 [−0,011 ; +0,015] |
| IFEval (anglais, 541) | 0,654 | −0,059 [−0,100 ; −0,018] |
| MGSM (français, 250) | 0,584 | −0,072 [−0,136 ; −0,004] |
| SQuAD 2.0 (anglais, 800, moitié sans réponse) | 0,344 | +0,233 [+0,199 ; +0,270] |
| Belebele (anglais, 900) | 0,683 | +0,033 [+0,012 ; +0,055] |

- Le gain sur FQuAD et SQuAD vient de l'abstention juste sur les questions sans réponse : de 0,22 à 0,62 sur FQuAD,
  de 0,14 à 0,52 sur SQuAD. Le F1 sur les questions avec réponse ne bouge presque pas en français, et gagne 9 points
  en anglais.
- Sur IFEval, l'élagage coûte environ 2,5 points : le modèle ne sait plus écrire les langues à écriture non latine
  demandées par certaines consignes. L'entraînement coûte environ 3 points de plus. Sur MGSM, c'est l'entraînement
  qui coûte.

### 3.5 Domaines où le modèle est inférieur

`criteres.md` demande de les nommer :

- **face à sa base** : détection d'incohérences, résistance aux injections, rédaction sous contrainte de format ou
  de longueur, suivi de consignes vérifiables (IFEval), calcul (MGSM), langues à écriture non latine ;
- **face aux modèles de 9 à 12 Md** : le travail documentaire dans son ensemble, sauf face à Mistral-Nemo 12B ;
- **non mesurés, attendus inférieurs** : culture générale sans document (MMMLU, au niveau de la base, est bas), code,
  qualité des réponses en contexte long (le fonctionnement à 32 768 jetons est mesuré, pas la qualité).

### 3.6 Fichiers publiés

| Fichier | Taille | Évaluation | KL / F16 |
|---|---:|---|---:|
| Q4_K_M | 1,11 Go | jeu secret, bancs publics, dev, dev2 | 0,0427 |
| Q5_K_M | 1,25 Go | dev, dev2 et KL seulement | 0,0134 |
| Q8_0 | 1,82 Go | dev, dev2 et KL seulement | 0,0010 |

- La version pleine précision du lot 4 n'avait pas été gardée. Le lot 4 a été refait à partir du pas 480 pour
  produire le Q5_K_M et le Q8_0.
- Son Q4_K_M a la même divergence KL que le fichier livré (0,0428 contre 0,0427), et aucun écart significatif n'est
  détecté sur dev ni sur dev2.
- Le Q4_0 est écarté : −0,11 sur dev.

## 4. Ce que le défi a appris

1. **Le jeu de développement a trompé, comme le jeu secret devait le détecter.** Sur les 188 cas de dev et dev2, le
   lot 4 avait +0,057 sur la base ; sur le jeu secret, −0,006. Les lots 4 et 5 avaient été ciblés sur les défauts vus
   en développement. Une partie du gain était donc un ajustement à ces deux jeux. Sans jeu secret, nous aurions
   annoncé un progrès qui n'existe pas.
2. **Corriger un défaut en crée souvent un autre.** Le lot 5 a corrigé la détection d'incohérences (0,15 → 0,80 sur
   dev2), mais il a fait apparaître de fausses alertes. Le lot 4 a cessé de refuser à tort, mais il s'est mis à
   appliquer la mauvaise ligne d'un tableau.
3. **Vérifier le résultat ne suffit pas à vérifier le raisonnement.** Parmi les réponses de l'élève que le contrôle
   automatique jugeait justes, le professeur en a écarté 64 % : raisonnement faux arrivant au bon chiffre, ou fautes
   de français.
4. **Mesurer la qualité est le vrai goulot d'étranglement.** Ni la note automatique ni un juge de 24 Md ne
   s'accordent avec l'auteur. Un progrès de quelques points ne peut pas être démontré avec ces outils et cette taille
   d'échantillon : l'IC d'un écart sur le jeu secret fait environ ±5 points.
5. **Ce qui a marché sans ambiguïté** :
   - l'abstention juste, qui se transfère à l'anglais ;
   - l'élagage du vocabulaire, qui rend le fichier plus léger et plus rapide sans perte pour le français ni l'anglais ;
   - la chaîne de données sans aucune sortie de modèle propriétaire ;
   - le coût nul.
6. **La vitesse dépend autant de la machine que du modèle.** Sur le même Mac, avec le même fichier et le même
   programme, la génération à 8k est passée de 5 jetons/s (26 octobre, beaucoup de logiciels ouverts) à 15-17 jetons/s
   (7 novembre). Une exigence de vitesse doit dire dans quel état de la machine elle se mesure.
7. **Il faut garder les fichiers intermédiaires.** Le noyau du lot 4 n'avait gardé que le Q4_K_M : il a fallu
   un entraînement de plus sur Kaggle, plus une évaluation à refaire, pour retrouver la pleine précision.

## 5. Amendements aux critères

Tous sont datés dans `criteres.md` et ont été décidés avant le résultat qu'ils touchent, sauf mention contraire.

- **25 octobre**, avant l'ouverture du jeu secret : la décontamination « 0 recouvrement de 13-grammes » devient
  « aucune paire au-dessus de 0,5 et retrait des cas touchés ». Les fiches Service-Public partagent des paragraphes
  entiers.
- **1er novembre**, avant tout résultat des bancs : IFEval-fr, mal annoté, est remplacé par IFEval d'origine en
  anglais.
- **1er novembre**, avant l'ouverture du jeu secret (relecture de Codex, décisions de l'auteur) :
  - « au moins 5 points » exige aussi une borne basse de l'IC > 0 ;
  - « Rivalise » se juge sur les comparateurs de 9 à 12 Md, puisque le modèle est un 2B ;
  - Gemma 4 est évalué en QAT Q4_0 ;
  - le noteur ne reconnaît plus un nombre à l'intérieur d'un autre ;
  - un cas en erreur technique écarte le modèle au lieu de compter 0.
- **2 novembre**, avant le passage du juge **mais après la note automatique** (déjà Échec) :
  - choix du juge (Mistral Small 3.2) ;
  - contrôle humain sur 60 réponses au lieu de 20 % des cas ;
  - règle de décision par κ.
  Les deux niveaux, celui du juge et celui de la note automatique, sont publiés côte à côte.

## 6. Travail annexe

- **Recherche de passages dans les longs documents** (20-21 octobre) : des essais sur 200 pages, sur une thèse et sur
  le RGPD ont mené à une recherche combinant mots-clés et sens, intégrée sur une branche locale de Localia
  (`recherche-sections`). C'est la réponse pratique au contexte long sur un processeur : envoyer les passages utiles
  plutôt que le document entier.
- **Localia** : le modèle s'utilise par Ollama et par le moteur intégré. La version 0.7.5 de Localia est sortie le
  4 novembre.
  - Défaut relevé dans le moteur intégré : quand la réflexion n'est pas réglée (cas par défaut), node-llama-cpp
    n'ajoute pas le bloc de réflexion vide du gabarit, et le modèle commence chaque réponse par deux sauts de ligne.
  - Si la réflexion est ensuite désactivée en cours de conversation, ces sauts de ligne restés dans l'historique ont
    produit une réponse contradictoire (journal, 7 novembre).
  - Corrigé sur `main` le 7 novembre (commit 57d2133, publié dans Localia 0.7.6 le même jour) : pour un gabarit qui émet toujours
    le bloc vide, l'absence de réglage vaut « réflexion désactivée ». Réessayé : plus de sauts de ligne, cas mixte juste.

## 7. Suites possibles (rien n'est décidé)

- Un jeu d'évaluation noté par des humains, plus grand, pour pouvoir mesurer des écarts de quelques points.
- Un entraînement par préférences (paires bonne/mauvaise réponse) sur les catégories en recul : incohérences,
  injections, contraintes de format.
- L'idée d'un modèle pour la Guinée (droit guinéen, pular, malinké, soussou) : seul l'inventaire des données est fait
  (`inventaire-guinee.md`).
- La stratégie voulue par l'auteur : un petit modèle, ou une LoRA, par domaine technique.
