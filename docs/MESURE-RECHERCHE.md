# Recherche dans les documents d’un projet : mesure avant changement

Date : 15 octobre 2026. Script : `node scripts/mesure-recherche.cjs` (options `--embed=modèle`,
`--modele=modèle`, `--json=fichier`).

## Question posée

Quand les documents d’un projet ne tiennent pas dans le contexte du modèle, Localia n’envoie que
les passages « les plus proches de la question ». Méthode actuelle : nombre de mots de la question
(4 lettres ou plus) présents dans le passage. Faut-il la remplacer par une méthode pondérée ou
sémantique ?

## Protocole

- **Corpus** : les 15 documents PDF de la banque du Benchmark (`benchmark/banque/documents` et
  `benchmark/banque/metiers/documents`), réunis dans un seul projet : 26 862 caractères, 36
  passages de 1 400 caractères au plus.
- **Questions** : les 23 questions des séries A, B et C dont la réponse attendue indique la page
  (référence : la page citée dans « Attendu »).
- **Budgets** : 3 000 et 6 000 caractères d’extraits (environ 2 et 4 passages), pour que le choix
  des passages compte.
- **Mesures** : page attendue présente dans les extraits choisis (rappel), rang réciproque moyen
  du premier bon passage dans le classement complet, temps de calcul, mémoire.
- **Méthodes** :
  - `mots` : méthode actuelle ;
  - `bm25` : racines des mots (pluies → pluie), mots vides retirés, mots rares pondérés (BM25) ;
  - `hybride` : somme des deux scores normalisés ;
  - `sémantique` : similarité cosinus entre vecteurs du modèle d’embeddings `bge-m3` (Ollama).
- **Machine** : Intel Core i9-9880H, 16 Go, Ollama 0.40.4.

## Résultats

| Budget | Méthode             | Page attendue retrouvée | Rang réciproque moyen | Questions manquées |
| ------ | ------------------- | ----------------------- | --------------------- | ------------------ |
| 3 000  | mots (actuelle)     | 19/23 (83 %)            | 0,75                  | A09, B02, B08, C02 |
| 3 000  | bm25                | 19/23 (83 %)            | 0,77                  | A09, B04, B09, C02 |
| 3 000  | hybride             | 19/23 (83 %)            | 0,78                  | A09, B02, B09, C02 |
| 3 000  | sémantique (bge-m3) | 19/23 (83 %)            | 0,74                  | B08, B09, B14, C02 |
| 6 000  | mots (actuelle)     | 21/23 (91 %)            | 0,75                  | B02, C02           |
| 6 000  | bm25                | 21/23 (91 %)            | 0,77                  | A09, B09           |
| 6 000  | hybride             | 20/23 (87 %)            | 0,78                  | A09, B02, B09      |
| 6 000  | sémantique (bge-m3) | 22/23 (96 %)            | 0,74                  | B09                |

Coûts :

- méthodes par mots (`mots`, `bm25`, `hybride`) : moins de 3 ms par question, quelques centaines
  de Ko de mémoire au plus ;
- sémantique : 32 s pour transformer les 36 passages en vecteurs (environ 0,9 s par passage sur
  cette machine), puis 85 ms par question ; un modèle supplémentaire de 1,2 Go à installer et à
  garder en mémoire pendant l’indexation.

## Conclusion

- Aucune méthode ne se détache. Les écarts portent sur une ou deux questions sur 23 ; les
  méthodes ne manquent pas les mêmes questions. Ce n’est pas un gain démontré.
- La recherche sémantique gagne une question au budget de 6 000 caractères, mais son indexation
  prendrait environ 75 minutes pour un projet de 100 documents de 50 pages sur cette machine.
- **Décision** : la méthode actuelle (`mots`) est conservée. Les autres restent dans
  `src/retrieval.js` pour de nouvelles mesures.
- Ajouté sans changer le classement : quand aucun extrait choisi ne contient de mot de la question,
  le modèle reçoit une consigne d’avertissement et l’utilisateur voit « Aucun extrait ne contient
  les mots de la question… ». Les passages transmis sont indiqués (document et pages).

## Citations des réponses d’un vrai modèle (budget de 3 000 caractères)

Mesure du 15 octobre 2026 avec `qwen3:8b` (Ollama, température 0, réflexion désactivée) : les 23
questions posées avec les extraits choisis par chaque méthode, puis chaque citation de la réponse
vérifiée par Localia (`checkProjectSources`, la vérification affichée sous les réponses).
Commande : `--modele=qwen3:8b --methodes=mots,bm25 --budgets=3000 --cache=…`.

| Méthode         | Citations | Retrouvées | Partielles | Document seulement | Non retrouvées | Réponses sans citation | Page attendue citée | Temps médian |
| --------------- | --------- | ---------- | ---------- | ------------------ | -------------- | ---------------------- | ------------------- | ------------ |
| mots (actuelle) | 22        | 15         | 1          | 2                  | 4              | 3/23                   | 17/23               | 52 s         |
| bm25            | 23        | 17         | 2          | 3                  | 1              | 4/23                   | 16/23               | 45 s         |

Relecture des citations signalées (méthode `mots`) :

- **2 vraies erreurs du modèle** : A03, « 36 jours » attribué à la page 4 (il figure page 5) ;
  B14, une limite attribuée à la page 4 au lieu de la page 5, et surtout une réponse construite
  avec les limites du _rapport_ (document A) alors que la question porte sur l’_article_
  (document B). Ce second défaut — bon passage, mauvais document pour la question — n’est pas
  détectable par une comparaison de texte.
- **2 fausses alertes du vérificateur** : une phrase d’introduction suivie d’une liste
  (« Voici une vérification… : », « … comme indiqué dans les documents suivants : »).
- Les partielles (A10) portent sur un écart calculé par le modèle (100 mm), absent du document :
  le signalement est juste.

Défaut du vérificateur trouvé par cette mesure et corrigé : un renvoi seul sur sa ligne
(« Ces informations sont tirées de [document — page 4] ») était comparé à ses propres mots, donc
signalé « non retrouvé ». Il porte désormais sur le paragraphe qui précède. Avant cette
correction, la méthode `mots` comptait 14 citations retrouvées et 4 « non retrouvées », dont la
moitié à tort.

Autres constats :

- 19 à 20 lignes chiffrées sans source par série de 23 réponses : le modèle cite souvent une fois
  par paragraphe ou à la fin, pas à chaque ligne ; ce signal est donc bruyant.
- Les réponses sans citation (B08, C02) sont des réponses honnêtes « l’information n’est pas dans
  les extraits » : elles suivent les questions dont la page attendue n’a pas été retenue.
- Deux durées faussées par une mise en veille de l’ordinateur : d’où le temps médian.

Conclusion : à ce budget, aucune différence nette entre les deux méthodes (2 vraies erreurs
contre 1, sur 22 et 23 citations). La méthode actuelle reste en place. Le budget de 6 000
caractères n’est pas encore mesuré avec le modèle (environ 45 réponses restantes) : la commande
reprend là où la mesure s’est arrêtée grâce au fichier `--cache`.

## Limites et suites

- 23 questions et des documents courts : un corpus plus grand, avec des questions reformulées,
  est nécessaire pour conclure.
- Un seul modèle (`qwen3:8b`) et un seul budget mesurés avec le modèle ; la justesse des
  réponses n’est pas notée ici (voir le Benchmark pour la notation humaine).
