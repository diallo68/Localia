# 07 — Preuves d'abord, réponse ensuite (idée de Codex, amendée par Claude)

**Statut** : à tester ; tension avec la vitesse.

## Hypothèse
Si le modèle écrit d'abord de courts extraits littéraux (ou leurs repères), puis sa réponse, deux choses se produisent :
- les affirmations non étayées baissent ;
- Localia peut vérifier mécaniquement les extraits.

## Amendement de Claude (coût)
À 7-10 jetons/s, 150 jetons d'extraits ajoutent 15 à 20 secondes par réponse. Variante économe : citer des **repères** courts (« [§3] », numéro de page ou de passage) que Localia résout, plutôt que des extraits complets. Il faudra mesurer les deux.

## Avocat du diable
- Les gros modèles le font aussi bien quand on le leur demande dans le prompt. Le gain ne serait alors pas propre à nos poids. Le comparatif doit donner le même prompt à tous.
- Les extraits peuvent être exacts et la réponse fausse quand même (mauvais raisonnement à partir de bonnes preuves).

## Expérience de falsification
Sur 120 cas, comparer à couverture égale « réponse directe » et « repères puis réponse » sur le même modèle entraîné. Si la baisse des affirmations non étayées est inférieure à 30 %, ou si le temps de réponse augmente de plus de 25 %, on écarte le format.

## Résultat mesuré
—

## Décision
À tester en phase 2 (format) et en phase 3 (entraînement).
