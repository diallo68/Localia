# Tests d'usage, avant et après Dial-bowe v2

Questions réelles posées par l'auteur dans Localia, gardées pour comparer la v1 (`dial-bowe-gn-224-2b`) et la v2 à l'œil.
Ce n'est pas une mesure : pas de note, pas d'intervalle de confiance. Les jeux d'évaluation (G, G-test, S2) restent fermés
et sont les seuls à compter pour les critères du plan (§3). Ces questions ne servent pas à l'entraînement.

## 1. Plan d'un article IEEE sur le mildiou (13 nov. 2026)

Réglages : domaine Ingénierie, tâche Libre, sans document, Internet coupé.

> le sujet de mon article : Etude comparativesur la prediction et la detection du mildiou par le biais des algorithmes
> machine learning et deep learning et la structure c'est un article IEEE

**v1, ce qui va :** le plan est celui d'un article scientifique. Les méthodes (Random Forest, SVM, CNN, LSTM) et les
métriques (précision, rappel, F1, AUC) sont pertinentes. La réponse finit en proposant de développer une section.

**v1, défauts relevés :**
1. Section en double : « 1. Introduction » puis « 2. Introduction (Introduction) ». L'état de l'art devrait former
   une section à part (*Related Work*).
2. Titres répétés entre parenthèses : « Méthodologie (Méthodologie) », « Résultats (Résultats) ».
3. Erreur de fond : le mildiou est appelé « champignon foliaire ». C'est un oomycète (*Phytophthora infestans*,
   *Plasmopara viticola*).
4. Conclusions écrites avant l'étude : la section 6 affirme que le DL est supérieur, et la 5.1 suppose que le DL a
   surpassé le ML.
5. Format IEEE incomplet : il manque le résumé (*Abstract*), les mots-clés (*Index Terms*) et les références
   numérotées [1]. La numérotation n'est pas au format IEEE (I, II… puis A, B…).
6. Détection (images, CNN) et prédiction (séries météo, LSTM) mélangées, alors que ce sont deux tâches différentes.
7. Détails : « fail », « Champs techniques ».

**À regarder sur la v2 :** les points 1, 2 et 5 (forme, rédaction sous contrainte) ; le point 4 (prudence) ; le point
3 sans document. On ne s'attend pas à ce que l'entraînement corrige ce point : la solution est de joindre un document ou
d'allumer Internet.

**v2 :** à remplir.

## 2. Formulations mathématiques CNN et LSTM (13 nov. 2026, suite de la question 1)

Même conversation, mêmes réglages.

> e veux que tu me fasses les formulations mathématiques des algorithmes CNN et LSTM

**v1 : réponse fausse sous une forme savante.**
1. LSTM sans porte d'oubli. L'état de cellule est calculé comme une porte (σ), sans la mise à jour additive
   c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t. La formule de c_t est écrite deux fois (« Correction »).
2. σ est présentée comme « généralement tanh » (faux : sigmoïde).
3. La convolution est sommée sur toute l'image : c'est un produit scalaire global, sans position de sortie ni somme sur
   les canaux.
4. La formule du max pooling n'a pas de sens : max_i(y_{i·j}).
5. Sortie en régression, alors que la détection sur images est une classification (softmax).
6. Fausse attribution : LSTM attribué à « Hinton, 2012 » au lieu de Hochreiter et Schmidhuber (1997).
7. Fautes (« Célule », « Lstm »).

**À ne pas confondre avec les erreurs du modèle : l'affichage de Localia.** Localia convertissait le LaTeX en
texte (`markdown.js`, `latexToText`). Les exposants sans caractère Unicode sortaient donc en « ^H », les indices en
« k_(i,j) », et la formule avec `\tanh`, commande inconnue de la table, restait en LaTeX brut. L'auteur a d'abord
jugé les formules justes et leur affichage seul en cause. Correction le 13 nov. (branche `refonte-interface`) : les
formules sont affichées avec KaTeX. Pour la comparaison v1 / v2, juger le contenu des formules, pas leur affichage.

**À regarder sur la v2 :** les connaissances (points 1 à 6) ne sont pas la cible du SFT v2, qui porte sur la lecture
de documents, le calcul, l'abstention et les pages Internet. On s'attend à peu de progrès sans document. Point à
surveiller : la v2 dit-elle qu'elle n'est pas sûre, ou invente-t-elle une référence ? Avec un document de cours
joint, la réponse doit reprendre les formules du document.

**v2 :** à remplir.

## 3. Section « Résultats » de l'article (13 nov. 2026, suite des questions 1 et 2)

Même conversation. Le modèle avait proposé de rédiger la section « Résultats » avec des formules de performance ;
l'auteur a répondu « oui ». Réponse exportée en PDF depuis Localia.

> oui

**v1 : résultats inventés, présentés comme ceux de l'étude de l'auteur.** Le modèle annonce des « valeurs chiffrées
spécifiques à ton étude », alors qu'aucune expérience n'a eu lieu. Il invente un jeu de 500 images « synthétiques »,
ResNet-50, « BiLSTM-12 », puis les précisions, rappels et F1 de six modèles. Ce défaut est le plus grave des trois
tests : recopiés dans un article, ces chiffres seraient de la fabrication de données.

Calculs vérifiés :
- F1 des tableaux 1 et 2 : cohérents avec la formule (SVM : 0,840 annoncé, 0,838 recalculé).
- Tableau 3 contradictoire avec les tableaux 1 et 2 : la précision du ML (0,835) est en fait le F1 de Random Forest
  (moyenne des précisions : 0,85) ; le rappel du ML est 0,840 (moyenne : 0,823) ; la précision et le rappel de
  l'hybride valent 0,935 et 0,935, au lieu de 0,94 et 0,93 dans le tableau 2. Les différences sont bien calculées,
  mais à partir de ces valeurs fausses.

Autres défauts :
1. Mildiou encore appelé « champignon ».
2. « Précision moyenne de 0,82 à 0,88 » : une plage n'est pas une moyenne.
3. Random Forest et SVM « optimisés par une méthode de régression logistique ».
4. Tableaux intitulés « matrice de confusion » sans matrice de confusion.
5. LSTM sur images fixes avec des « dépendances temporelles » ; la partie prédiction (météo) a disparu.
6. « Supériorité significative » sans test statistique (100 images de test).

**Comportement attendu :** rédiger la section comme un gabarit, avec des tableaux vides ou des valeurs marquées
« [à remplir] », et dire clairement que les résultats doivent venir des expériences de l'auteur. Ou demander ses
résultats.

**À regarder sur la v2 :**
- Le plan v2 entraîne l'abstention et la réponse partielle sur documents, pas ce cas sans document : il faut voir
  si ces exemples s'étendent jusqu'ici.
- La cohérence entre tableaux d'une même réponse relève du type « calcul ».

Si la v2 invente encore des résultats, ce sera un cas à ajouter aux données de la v3 (refuser d'inventer des mesures).

**v2 :** à remplir.

## 4. Étude bibliographique rédigée, avec et sans sources (13 nov. 2026)

Réglages : domaine Enseignement / Recherche, mode avancé, profil neuf, Internet coupé ; essai lancé par script dans
l'interface réelle (Playwright). Même consigne pour les trois essais ; seule la pièce jointe change. Réponses complètes
gardées hors du dépôt (`~/Documents/essais-dial-bowe-mildiou/articles/`).

> Rédige un article scientifique complet : une étude bibliographique sur les méthodes de détection et de prédiction du
> mildiou par machine learning (ML) et deep learning (DL).
>
> Structure attendue :
> 1. Titre, résumé (150 à 250 mots) et mots-clés.
> 2. Introduction : le mildiou (agents, cultures touchées, enjeux) et l'intérêt du ML et du DL.
> 3. Méthodes de détection à partir d'images : jeux de données, algorithmes (ML classique, CNN, détecteurs
>    d'objets…), métriques, résultats rapportés.
> 4. Méthodes de prédiction à partir de données météorologiques et agronomiques : modèles de référence, algorithmes
>    ML et DL, métriques, résultats rapportés.
> 5. Tableau comparatif des études citées : référence, culture, tâche, données, algorithmes, meilleur résultat.
> 6. Discussion : apports, limites, et pistes de recherche.
> 7. Conclusion.
> 8. Références numérotées [1], [2]…, citées dans le texte.
>
> Règles :
> - ne cite que des études réelles, et attribue chaque chiffre à la bonne étude ;
> - n'invente aucun résultat ; si tu n'es pas sûr d'un chiffre ou d'une référence, dis-le.

Pièces jointes :
- 4a : aucune (connaissances du modèle seules) ;
- 4b : deux articles en PDF, Chen et al. 2020 (PLOS ONE 15(3) e0230254, prédiction du mildiou de la vigne,
  Bordeaux) et Zhang et al. 2022 (Frontiers in Plant Science 13:872107, YOLOv5-CA) ;
- 4c : bibliographie vérifiée en Markdown (18 études vérifiées sur Crossref, tableau de synthèse, références IEEE).

Un premier essai, avec une consigne qui demandait un tableau « à partir uniquement des documents joints », a été
écarté : la consigne était fausse (rien n'était joint dans le cas sans document) et ne demandait pas d'article.

### 4a. Sans document (91 s)

**v1 : article présentable en apparence, mais fabriqué.**
1. Les 3 références sont inventées (« Smith & Johnson 2022, Journal of Agricultural Engineering », « Chen & Wang
   2023 », « Dubois et al. 2021, Plant Disease »), avec des chiffres inventés au tableau (98 %, R² = 0,85, 95 %).
   Aucun doute exprimé, malgré la règle.
2. Mildiou appelé « champignon » ; cultures touchées : pomme de terre, **maïs**, tomate. La référence [2] porte sur
   les pertes de rendement du maïs.
3. Phrase vide : CNN « couplés à des techniques de réduction de dimensionnalité comme la convolutional neural
   network (CNN) ».
4. Aucune citation [n] dans le texte ; résultats généraux affirmés sans source.
5. Structure suivie (titre, résumé, sections, tableau, références).

### 4b. Avec les deux PDF (199 s)

Localia a transmis des extraits : Chen p. 1, 2, 9, 20 sur 20 ; Zhang p. 1 à 7, 10, 11 sur 12. La page 8 de Chen
(AUC 0,86, gradient boosting) n'est pas transmise.

**v1 : appuyé sur les documents, avec des erreurs de chiffres et une forme incomplète.**
- Justes : *Plasmopara viticola* qualifié d'oomycète ; Bordeaux, 10 traitements en moyenne en 2013 (10,1 dans
  Chen) ; LASSO, forêt aléatoire, gradient boosting comparés aux GLM ; la date d'apparition pèse plus que la météo ;
  Zhang : précision 85,59 %, 58,82 images/s, mAP 89,55 %, comparaison avec Faster R-CNN, YOLOv4, YOLOv5.
- Juste aussi : « précision de 88,82 % avec augmentation de données » (Zhang p. 10, tableau 3). Une première
  vérification l'avait jugé inventé à tort (recherche tronquée), corrigé le 13 nov.
- Faux : « précision de 83,70 % » (c'est le rappel) ; F1 donné comme métrique de Chen (Chen utilise l'AUC) ; « GML » ;
  « maladie des vignerons ».
- Forme : pas de section Références, aucune citation [n] ; Chen deux fois dans le tableau ; titre « Bibliographie… ».
- Par rapport au premier essai (consigne écartée) : plus de boucle de répétition ni d'auteurs inventés.

**4b refait après correction de Localia (329 s).** Le 13 nov., le choix des extraits a été corrigé (branche
`refonte-interface`, `src/documents.cjs`) : pages de références écartées, sections de résultats favorisées, et part
égale pour chaque document dans une demande de synthèse ou de bibliographie. Pages transmises : Chen p. 1, 2, 6 à 10,
12, 13, 14, 16 (dont la p. 8, AUC 0,86) ; Zhang p. 1 à 7, 10, 11. Avec le même modèle v1 :
- Justes, en plus : AUC 0,86 (gradient boosting, incidence sur feuilles) ; réduction des traitements de 53,3 % à 80,9 %
  (par rapport à 2010) et de 63,5 % à 85,1 % (par rapport à 2013) ; Faster R-CNN 80,65 % et YOLOv5 87,41 % de mAP ;
  précision 88,82 % et mAP 90,02 % avec augmentation ; Yangling ; appareil Canon. Section Références présente, avec
  titres, revues et DOI justes.
- Faux : auteurs de Zhang (« Zhang, Y., & Zhang, Y. » au lieu de Z. Zhang, Y. Qiao, Y. Guo, D. He) ; « Makowski »
  en double ; titre de Zhang inexact ; « maladie fongique » puis « oomycète » dans la même phrase ; « croissance des
  vignerons » ; gradient boosting « combiné à des mécanismes d'attention » ; YOLOv5-CA classé parmi les méthodes de
  prédiction ; « jeux de données synthétiques » (absent des deux articles).
- Manque : LASSO et forêt aléatoire de Chen ; citations [n] dans le texte.
- Conclusion : la moitié des erreurs du premier passage venait des extraits transmis. Pour comparer v1 et v2, utiliser
  cette version corrigée de Localia et comparer à ce passage-ci.

### 4c. Avec la bibliographie vérifiée (190 s)

**v1 : fiable sur les faits, faible comme article.**
- Justes : oomycète et non champignon ; *P. infestans* (pomme de terre, tomate) et *P. viticola* (vigne) bien
  distingués ; tableau de 18 lignes identique à la source (contrôle automatique) ; deux constats repris : écart entre
  laboratoire (≈ 99 %) et champ, absence de comparaison LSTM / ML classique sur séries météo.
- Défauts : pas de section Références alors que les 18 références complètes étaient dans le fichier ; aucune
  citation [n] ; chiffres mal regroupés (« F1 < 0,7 à 0,9 » ; « exactitudes équilibrées de 0,8 à 0,87 » mélange
  [14] et [15] et deux métriques) ; contresens : forêt aléatoire et C5.0 présentés comme « modèles statistiques
  classiques » qui surpassent « les approches purement statistiques » ; texte qui recopie le tableau sans analyser.

### Bilan v1

| | Faits | Références | Structure |
|---|---|---|---|
| 4a. Sans document | inventés | 3 inventées | suivie |
| 4b. Avec PDF | 1 métrique mal nommée, 1 fausse | absentes | incomplète |
| 4c. Avec bibliographie | justes | absentes | suivie |

Plus le modèle a de sources, plus il est fiable. Sans source, il fabrique des références avec assurance. Dans aucun
cas il ne produit de liste de références citées par [n].

**À regarder sur la v2 :**
- 4a : dit-elle qu'elle ne peut pas citer de références sûres sans document ou Internet, ou en invente-t-elle encore ?
  Comme pour le test 3, le plan v2 n'entraîne pas ce cas sans document ; s'il persiste, l'ajouter aux données v3
  (refuser d'inventer des références et des mesures).
- 4b et 4c : citations [n] et section Références (citation des sources, plan v2) ; chiffre attribué à la bonne étude
  et à la bonne métrique (extraction, calcul).
- 4b dépend aussi de Localia : choix des extraits (pages de résultats non transmises). Garder la même version de
  Localia pour comparer v1 et v2, ou noter le changement.

**v2 :** à remplir.
