# 05 — RL à récompense vérifiable sur documents (citations, abstention)

**Statut** : retenu pour les scénarios 2 et 3, après les fiches 04 et 03.

## Hypothèse
Une récompense calculable sans juge produit un modèle qui invente moins qu'un modèle passé par le SFT seul, à couverture égale. Elle combine quatre termes :
- +1 si la valeur extraite est exacte ;
- −1 par chiffre ou citation absents du document ;
- +1 pour une abstention justifiée, −1 pour une abstention injustifiée ;
- une pénalité de longueur.

## Mécanisme
L'algorithme est GRPO ou une variante (DeepSeekMath, arXiv:2402.03300 ; DeepSeek-R1, arXiv:2501.12948). C'est le RL à récompense vérifiable de Tülu 3 (RLVR), appliqué à des documents plutôt qu'à des maths.
Le vérificateur est le même que pour le filtrage de la fiche 04, ce qui fait une seule source de vérité. Il reprend la logique de vérification des sources de Localia : la même définition d'« affirmation étayée » sert à l'entraînement et au produit.

## Ordre de grandeur (calculé)
2 000 consignes × 8 échantillons × 500 jetons = 8 M jetons générés par itération complète. Avec un élève 4B sous vLLM sur H100 : 20 à 80 H100-h selon le nombre d'itérations, soit 60 à 300 €.

## Avocat du diable
- **Piratage de la récompense** : le modèle peut apprendre à ne citer aucun chiffre, ou à s'abstenir dès qu'il hésite. Parades : un terme de couverture, et des cas « réponse présente » majoritaires.
- **Signal pauvre** : la récompense est vraie ou fausse sur des réponses longues, ce qui coûte cher en échantillons. La distillation sur politique (fiche 03) est plus dense.
- **Biais du vérificateur** : un vérificateur littéral pénalise une conversion d'unités correcte. Le vérificateur doit normaliser les nombres et les dates.

## Expérience de falsification
Pilote de 10 H100-h sur le 2B après le SFT. Si le taux d'affirmations non étayées ne baisse pas d'au moins 30 % à couverture constante (± 2 points), le RL n'apporte rien : on s'arrête à SFT + distillation.

## Résultat mesuré
—

## Décision
Retenu sous condition.
