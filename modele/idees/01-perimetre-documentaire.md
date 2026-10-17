# 01 — Périmètre : le travail documentaire en français

**Statut** : proposé (Claude et Codex, analyses indépendantes convergentes), à valider par l'auteur.

## Hypothèse
Un modèle de 2 à 4 Md peut égaler ou dépasser des modèles de 20 à 40 Md sur les tâches **fondées sur un document fourni**, en français :
extraire, synthétiser, rédiger sous contraintes, citer ses sources, signaler une incohérence, et s'abstenir quand le document ne contient pas la réponse.

## Mécanisme
Dans ces tâches, les faits sont dans le contexte, pas dans les poids. La compétence demandée tient à quelques gestes : localiser l'information, la recopier sans la déformer, respecter un format, refuser d'inventer.
Ces gestes s'apprennent par post-entraînement, avec des récompenses vérifiables mécaniquement : le chiffre cité est-il dans le document ? l'abstention est-elle justifiée ?
Les connaissances encyclopédiques, elles, dépendent de la capacité du modèle (nombre de paramètres × jetons vus), que nous ne pouvons pas acheter.

## Ordre de grandeur (publié, fiches Hugging Face)
- Qwen3.5-4B en mode réflexion : MMMLU 76,1 ; MMLU-ProX 71,5 ; IFEval 89,8. Qwen3.5-9B : 81,2 / 76,3 / 91,5. L'écart de connaissances entre 4B et 9B (environ 5 points) ne se comble pas par post-entraînement.
- Qwen3.5-2B sans réflexion : IFEval 61,2 ; MMMLU 56,9. Une grande marge reste à gagner sur le suivi des consignes, ce qui relève du post-entraînement.

## Avocat du diable
- Les gros modèles sont aussi meilleurs pour lire : comprendre une négation, une condition ou un tableau. Un 4B peut rester en dessous, même spécialisé.
- Le risque de « gagner sur notre propre jeu de tests » est réel. Il faut donc aussi des tests publics (FQuAD, Belebele, IFEval-fr) et un jeu maison secret écrit avant tout entraînement.
- Un meilleur score de Localia peut venir de la recherche de passages plutôt que des poids. Il faut évaluer le modèle seul, à passages identiques.

## Expérience minimale de falsification
Avant tout entraînement, évaluer la base (Qwen3.5-4B Q4) et un modèle 5 à 10 fois plus gros sur 60 cas du jeu de développement.
Si l'écart dépasse 25 points sur les catégories documentaires, l'objectif « égaler » n'est pas réaliste avec un post-entraînement de quelques centaines d'euros. On le dira, et on visera « réduire l'écart de moitié ».

## Résultat mesuré
— (phase 2)

## Décision
Proposé comme périmètre principal. Reste mesuré sans prétention de gain : connaissances générales, maths (MGSM-fr), code.
