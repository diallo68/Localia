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
