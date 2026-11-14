# Idée : dessiner les schémas écrits par le modèle (14 nov. 2026)

**Statut** : idée notée, rien décidé ni commencé.

## Constat
- Demande réelle de l'auteur dans Localia : « tu peux me montrer les schémas de ces filtres ? » (passe-bas,
  passe-haut, passe-bande, coupe-bande). Dial-bowe v1 a d'abord bouclé sur un schéma en caractères, puis a répondu
  qu'il ne pouvait pas dessiner (voir `modele/tests-usage-v2.md`, test 5, dans localia-public).
- Un modèle de langage n'écrit que du texte. Mais ce texte peut être du **code de dessin** : c'est ce que Claude a fait
  le même jour (programme Python et matplotlib : circuits RC, CR, RLC, réjecteur LC et leurs courbes de gain).
- Localia dessine déjà les formules LaTeX avec KaTeX (commit 20f23e7). Le même principe peut s'appliquer aux schémas.

## Trois niveaux, du plus simple au plus lourd
1. **Mermaid** (organigrammes, schémas-blocs, séquences, frises) : bloc ```mermaid``` dans la réponse, dessiné par la
   bibliothèque mermaid (MIT), sans exécuter de code. Couvre « Entrée → Filtre → Sortie », les étapes d'une méthode,
   un plan d'article.
2. **SVG simple** : bloc ```svg``` affiché comme image, après nettoyage strict (aucun script, aucun lien externe,
   aucune balise `foreignObject`). Couvre un circuit simple ou un croquis.
3. **Courbes calculées** (réponse en fréquence, fonctions) : le modèle écrit une description de la courbe
   (expression, bornes, échelle log), et Localia la trace lui-même (par exemple avec une petite bibliothèque de
   graphiques), sans exécuter le code du modèle. Plus sûr qu'un interpréteur Python.

## Version texte
Comme pour KaTeX : la copie, l'écoute et les exports gardent le code source (Mermaid, SVG) ou une description.

## Avocat du diable
- Un modèle de 2 Md écrira souvent un code Mermaid ou SVG faux : il faut afficher le code brut, avec un message
  clair, quand le dessin échoue, et ne jamais bloquer la réponse.
- Un schéma bien dessiné mais faux (composants mal placés) paraît plus crédible qu'un texte faux : rappel « vérifiez
  le schéma » sous chaque dessin.
- Le SVG est une surface d'attaque (scripts, liens) : nettoyage obligatoire, ou ne garder que Mermaid.
- Taille : la bibliothèque mermaid pèse plusieurs Mo (à mesurer) ; à charger seulement quand une réponse contient un bloc mermaid.

## Mesure avant de décider
Poser 10 demandes de schémas (circuits, organigrammes, plan de méthode) à Dial-bowe, Gemma 4 E4B et Qwen 9B, et
compter les codes Mermaid et SVG qui se dessinent et sont justes. Si le 2B échoue presque toujours, réserver la
fonction aux modèles plus gros, ou à la v2 entraînée avec quelques exemples Mermaid.
