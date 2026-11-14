# Idée : dessiner les schémas écrits par le modèle (14 nov. 2026)

**Statut** : niveau 1 (Mermaid) construit le 14 nov. 2026 (branche `schemas`) ; niveaux 2 et 3 non commencés.

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

## Mesure du 14 nov. 2026 (Mermaid seulement)
10 demandes de schémas en français (filtre passe-bas, chaîne d'acquisition, organigramme d'une étude ML, plan
d'article IEEE, diagramme de séquence, cycle du mildiou, Gantt de thèse, architecture CNN, procédure de passeport,
quatre filtres), consigne système : « écris les schémas en Mermaid dans un bloc ```mermaid``` ». Ollama, sans
réflexion. Rendu vérifié par mermaid 11 (analyse puis SVG) dans Chromium ; justesse jugée par Claude en lisant le code.

| Modèle | Se dessine tel quel | Après 2 réparations¹ | Juste | À moitié | Faux ou illisible | Temps par réponse |
|---|---:|---:|---:|---:|---:|---|
| Dial-bowe v1 (2 Md) | 9/10 | 10/10 | 6 | 3 | 1 | 4 à 29 s |
| qwen3-4b | 8/10 | 9/10 | 7 | 2 | 1 | 9 à 26 s |
| Qwen3.5-9B *abliterated* | 3/10 | 6/10 | 5 | 1 | 4 | 26 à 143 s |

¹ Bloc ```mermaid``` non fermé en fin de réponse (Dial-bowe, q. 5) ; libellé `[ … ( … ) … ]` mis entre guillemets
(erreur la plus fréquente : qwen3-4b q. 6 ; 9B q. 3, 4, 8).

Défauts de fond relevés :
- **Dial-bowe** : passe-bas réduit à « Entrée → Filtre → Sortie » (aucune information) ; CNN et Random Forest
  entraînés l'un après l'autre au lieu d'en parallèle ; Gantt faux (1,5 an au lieu de 3, soutenance avant la fin des
  expériences, tout marqué « fait ») ; quatre filtres avec des flèches qui bouclent sur elles-mêmes.
- **qwen3-4b** : Gantt en syntaxe inventée ; « coupe-bande → fréquences supprimées → sortie » (sens inversé).
- **9B abliterated** (version modifiée, pas le Qwen officiel) : passe-bas remplacé par un récepteur radio ;
  mildiou attribué à *Uredinopsis* (c'est *Phytophthora infestans*) ; « quatre filtres » transformés en
  filtration d'eau. Plus lent et moins fiable que les deux petits modèles sur cette tâche.

Conclusions :
1. **Le niveau 1 (Mermaid) est faisable même avec Dial-bowe** : la syntaxe est bien tenue ; le contenu, lui,
   doit être vérifié comme le texte (le dessin ne rend pas le schéma plus juste).
2. Prévoir les deux réparations et, en cas d'échec, afficher le code avec un message, sans bloquer la réponse.
3. Le **Gantt** est le point faible des trois modèles : plutôt le faire construire par Localia à partir du
   calendrier (étape « rétroplanning »), pas par le modèle.
4. Ce que Mermaid ne fait pas : un vrai circuit (résistance, condensateur) ni une courbe de gain ; ce sont les
   niveaux 2 et 3.
5. Coût : mermaid.min.js pèse 3,4 Mo, à charger seulement quand une réponse contient un bloc mermaid.

## Niveau 1 construit (14 nov. 2026)
- Consigne ajoutée aux conversations (`src/diagrams.js`, DIAGRAM_INSTRUCTION) ; blocs ```mermaid``` dessinés à la
  fin de la réponse par `vendor/mermaid` (11.12.1, chargé au premier schéma), montrés comme image SVG (la CSP de
  Localia interdit les styles en ligne ; l'image garde les siens). Mesure des textes faite avec la même police que
  l'image (sinon textes coupés et boîtes deux fois trop hautes : marges des paragraphes de Localia).
- Réparations : libellés à parenthèses mis entre guillemets, fermeture recopiée retirée ; un code faux reste en
  code avec un avis. Sous chaque dessin : « vérifiez-le » et « Voir le code ». Copie, écoute et Word : le code ;
  export PDF : l'image.
- Question réelle de l'auteur (« tu peux generer le schémas du filtre passe bas ») : avec une consigne qui disait
  « un circuit se décrit en texte », Dial-bowe répondait 2 fois sur 3 en texte (avec erreurs) ; consigne changée
  (« chaque composant est un nœud relié à ses voisins ») : 3/3 en Mermaid, aucun dessin en caractères. **Mais le
  circuit est faux** chez Dial-bowe (passe-haut dans un passe-bas, R, L, C tous en série) comme chez qwen3-4b :
  ces modèles ne connaissent pas le schéma d'un filtre RC. Le dessin rend l'erreur visible, il ne la corrige pas.
