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

## Limites et suites

- 23 questions et des documents courts : un corpus plus grand, avec des questions reformulées,
  est nécessaire pour conclure.
- Les citations incorrectes dans les réponses n’ont pas été mesurées ici : il faut poser les
  questions à un modèle (`--modele=qwen3:8b`), ce qui prend plusieurs dizaines de minutes sur
  cette machine. Le script le permet ; le résultat sera ajouté une fois mesuré.
