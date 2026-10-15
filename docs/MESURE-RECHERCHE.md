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

## Citations des réponses d’un vrai modèle

Mesure du 15 octobre 2026 avec `qwen3:8b` (Ollama, température 0, réflexion désactivée, 700
jetons au plus) : les 23 questions posées avec les extraits choisis par chaque méthode, aux deux
budgets, puis chaque citation de la réponse vérifiée par Localia (`checkProjectSources`, la
vérification affichée sous les réponses). 81 réponses distinctes (une réponse identique pour les
mêmes extraits n’est pas reposée). Commande :
`node scripts/mesure-recherche.cjs --modele=qwen3:8b --methodes=mots,bm25 --cache=… --json=…`.

| Budget | Méthode         | Citations | Retrouvées | Partielles | Document seulement | Non retrouvées | Réponses sans citation | Page attendue citée | Temps médian |
| ------ | --------------- | --------- | ---------- | ---------- | ------------------ | -------------- | ---------------------- | ------------------- | ------------ |
| 3 000  | mots (actuelle) | 22        | 17         | 2          | 1                  | 2              | 3/23                   | 17/23               | 52 s         |
| 3 000  | bm25            | 23        | 20         | 3          | 0                  | 0              | 4/23                   | 16/23               | 45 s         |
| 6 000  | mots (actuelle) | 26        | 21         | 3          | 1                  | 1              | 1/23                   | 20/23               | 114 s        |
| 6 000  | bm25            | 30        | 27         | 1          | 1                  | 1              | 1/23                   | 20/23               | 111 s        |

Chiffres obtenus avec le vérificateur corrigé (voir plus bas). Chaque citation non retrouvée ou
partielle a été relue à la main :

- **Vraies imprécisions du modèle** : A03 (budget 3 000, mots), « 36 jours » attribué à la page 4
  alors qu’il figure page 5 ; A10, écart de 100 mm calculé par le modèle, absent du document
  (partielle, signalement juste) ; B07, période d’évaluation donnée avec une page approximative.
- **Erreur que la vérification ne peut pas voir** : B14 au budget de 3 000, réponse construite
  avec les limites du _rapport_ alors que la question porte sur l’_article_ ; les citations
  renvoient bien aux pages d’où vient le texte. Au budget de 6 000, la même question reçoit une
  réponse juste, document par document.
- **Fausses alertes restantes** : B09 (3 cas), une phrase d’introduction (« Voici une
  vérification des auteurs… : ») dont la liste n’est pas rattachée à la citation.
- Les réponses sans citation (B08, C02) disent honnêtement que l’information n’est pas dans les
  extraits : elles suivent les questions dont la page attendue n’a pas été retenue. Plus de
  contexte (6 000 caractères) en laisse une seule.

### Défauts du vérificateur trouvés par cette mesure, corrigés

Le modèle annonce souvent la source autrement qu’à la fin de la phrase ; le vérificateur
comparait alors au passage cité un texte qui n’était pas l’affirmation :

1. renvoi seul sur sa ligne (« Ces informations sont tirées de [document — page 4] ») : vérifié
   contre le paragraphe qui précède ;
2. source annoncée avant le contenu (« Selon le document [document — page 2], les modèles… »,
   « **Dans l’article (document — page 4)** : » suivi d’une liste) : vérifiée contre le texte
   qui suit, liste comprise ;
3. lignes d’une liste placée sous une source annoncée : plus comptées comme « chiffres sans
   source ».

Avant ces corrections, sur les mêmes 101 citations, 14 étaient signalées « non retrouvées » ;
il en reste 4. Les 10 autres sont désormais retrouvées ou partielles, dont toutes les citations
correctes de B14 au budget de 6 000.

### Conclusion

- Aucune différence nette entre les deux méthodes : 2 citations non retrouvées sur 22 contre 0
  sur 23 au budget de 3 000, 1 sur 26 contre 1 sur 30 au budget de 6 000. La méthode actuelle
  reste en place.
- Le budget compte plus que la méthode : à 6 000 caractères, la page attendue est citée dans
  20 réponses sur 23 (contre 16 ou 17) et une seule réponse reste sans citation (contre 3 ou 4),
  pour un temps de réponse doublé sur cette machine (processeur seul).
- Le signal « lignes chiffrées sans source » reste élevé (19 à 24 par série de 23 réponses) : le
  modèle cite souvent une fois par paragraphe. Il est utile comme alerte, pas comme mesure.

## Limites et suites

- 23 questions et des documents courts : un corpus plus grand, avec des questions reformulées,
  est nécessaire pour conclure.
- Un seul modèle (`qwen3:8b`) mesuré ; la justesse des réponses n’est pas notée ici (voir le
  Benchmark pour la notation humaine).
