# Accessibilité : contrôles exécutés

Date : 15 octobre 2026. Script : `node scripts/audit-accessibilite.cjs [--json=fichier]`.

Ce document décrit des **contrôles automatiques** exécutés dans l’application réelle. Ils ne
valent pas une déclaration de conformité WCAG : ni un essai avec un lecteur d’écran (VoiceOver,
NVDA), ni un essai avec des personnes concernées n’a été fait.

## Ce qui est contrôlé

Sur 14 écrans (accueil, recherche, projet ouvert, conversation ouverte, automatisations avec un
résultat ouvert, Benchmark, bibliothèque, bibliographie, fichiers, compétences, performances,
réglages, confidentialité, guide), avec des données de démonstration, dans 5 configurations :
thème clair, thème sombre, contraste renforcé, zoom à 200 % (mise en page de 640 px), texte
« très grand » dans une fenêtre de 900 px (mise en page de 692 px).

| Contrôle                                                                            | Critère                                      | Résultat                    |
| ----------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| Contraste des textes visibles (commandes désactivées exclues)                       | 1.4.3 : 4,5:1, ou 3:1 pour les grands textes | aucun texte sous le minimum |
| Défilement horizontal de la page                                                    | 1.4.10 et 1.4.4                              | aucun                       |
| Commandes sans nom accessible                                                       | 4.1.2                                        | aucune                      |
| Cibles de moins de 24 × 24 px (hors liens dans une phrase)                          | 2.5.8                                        | aucune                      |
| Clavier : 160 appuis sur Tab depuis l’accueil, chaque entrée de la colonne atteinte | 2.1.1                                        | toutes atteintes            |
| Focus visible (contour ou ombre)                                                    | 2.4.7                                        | visible à chaque arrêt      |
| Focus non masqué par un autre élément                                               | 2.4.11                                       | jamais masqué               |

## Problèmes trouvés puis corrigés

- 46 commandes de moins de 24 px de haut (boutons de langue et de taille du texte, « Utiliser »,
  « Modifier le fichier », appels des compétences, menus déroulants, sections dépliables) :
  hauteur minimale de 24 px.
- Numéro de l’étape du Benchmark : contraste 4,27:1 (clair), 2,26:1 (contraste renforcé).
- Contraste renforcé : le projet sélectionné avait un fond de la couleur des bordures (3,14:1).
- Zoom à 200 % : la page Compétences (chemin du dossier non coupé), la page Confidentialité et la
  Bibliographie (rangées de boutons et de champs sur une seule ligne) défilaient horizontalement.

## Ce qui n’est pas vérifié

- Lecture par un lecteur d’écran : ordre de lecture, annonces des zones `role="status"`, fenêtre
  de relecture des notes.
- Espacement des cibles (exception de 2.5.8) et taille des cibles dans les autres configurations
  que le thème clair.
- Contraste des icônes et des éléments graphiques (1.4.11), images et graphiques du Benchmark.
- Clavier au-delà de 160 arrêts, dans les fenêtres de dialogue et les listes longues.
- Mode simple : non parcouru par le script.
