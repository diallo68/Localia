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
