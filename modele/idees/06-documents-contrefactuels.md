# 06 — Documents contrefactuels appariés (idée de Codex)

**Statut** : retenu, peu coûteux (données seulement).

## Hypothèse
Un petit modèle « connaît » parfois une réponse et la donne à la place de celle du document : date, montant, responsable.
Entraîner sur des paires (document original, document modifié) avec la réponse qui suit **le document fourni** réduit ces substitutions.

## Mécanisme
On construit les paires par réécriture contrôlée : dates, montants, noms d'organismes fictifs, seuils réglementaires modifiés.
La réponse attendue est calculée mécaniquement à partir du document modifié, sans aucun modèle. Données « gratuites » et vérifiables.
Références : recherches sur les conflits entre connaissances apprises et contexte (Longpre et al., 2021, arXiv:2109.05052 ; Xie et al., 2023, arXiv:2305.13300).

## Avocat du diable
- Le modèle peut apprendre que « le document a toujours raison », même quand il se contredit. Il faut alors des cas d'**incohérence interne** à signaler (la banque Localia en contient : le rapport A).
- Les modifications peuvent laisser des traces artificielles (dates incohérentes avec le reste) que le modèle apprend à repérer à la place de la tâche.

## Expérience de falsification
Sur 100 paires inédites, mesurer le taux de « réponse apprise au lieu du document » pour la base, pour le SFT seul et pour le SFT avec contrefactuels. Une baisse de moins de 30 % par rapport au SFT seul conduit à abandonner l'idée.

## Résultat mesuré
—

## Décision
Retenu : environ 10 % des données SFT.
