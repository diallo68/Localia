# Banque de questions élargie et nouveaux modèles (action 20)

Préparé le 6 octobre 2026. **Rien n'a été lancé** : ce document décrit ce qu'il faudra faire, quand l'auteur le décidera.

## 1. Pourquoi

La première banque (série article IRASET, série générale) comptait, une fois les doublons retirés, 1 à 6 questions par type de tâche, et aucune pour les données. Le tableau « Quel modèle pour quelle tâche ? » du Benchmark restait donc indicatif. Cette banque vise **au moins 15 questions par type de tâche**, chacune avec une réponse attendue vérifiable, et trois documents dont toutes les erreurs sont connues.

## 2. Contenu

| Fichier | Questions | Document à joindre | Catégories |
|---|---|---|---|
| `serie-A-rapport.txt` | 16 | `documents/doc-A-rapport-campagne-dalaba-2025.pdf` | Extraction 7, Incohérences 5, Pièges 3, Calcul 1 |
| `serie-B-article.txt` | 16 | `documents/doc-B-article-prevision-mildiou.pdf` | Extraction 5, Incohérences 6, Synthèse 2, Pièges 2, Calcul 1 |
| `serie-C-note.txt` | 11 | `documents/doc-C-note-technique-donnees-meteo.pdf` | Extraction 5, Synthèse 3, Incohérences 1, Pièges 1, Calcul 1 |
| `serie-calcul.txt` | 15 | aucun | Calcul 12, Raisonnement 3 |
| `serie-mgsm-fr.txt` | 15 | aucun | Raisonnement (MGSM en français) |
| `serie-redaction.txt` | 15 | aucun | Rédaction |
| `serie-synthese.txt` | 9 | aucun | Synthèse |
| `serie-code.txt` | 15 | aucun | Code (Python, SQL, R, regex) |
| `serie-donnees.txt` | 15 | aucun | Données |
| `serie-honnetete.txt` | 15 | aucun | Honnêteté 11, Pièges à invention 4 |
| `serie-actions-2.txt` | 5 | aucun | Actions sur fichiers (complète `../serie-actions.txt`, 10) |
| **Total** | **147** | | |

Questions par tâche de Localia, en ajoutant les questions distinctes des séries existantes : extraction 32, relecture 17, synthèse 15, calcul et raisonnement 36, rédaction 17, code 17, données 15, actions sur fichiers 15, question générale 25.

### Documents fictifs

Les trois PDF sont **fictifs** (mention en pied de chaque page) : personnes, organismes et références inventés, lieux réels. Ils sont courts (2 à 5 pages, moins de 6 000 caractères) : Localia les transmet **en entier**, sans sélection d'extraits, ce qui rend la comparaison plus juste qu'avec l'article IRASET.

Erreurs placées volontairement (clé de correction) :

- **Rapport (A)** : 4 parcelles annoncées dans le résumé contre 5 (P1–P5) ; incidence moyenne 38 % contre 41 % calculée ; cumul de pluie 1 487 mm contre 1 387 mm ; « 18,4 kg/ha » au lieu de t/ha ; « plus des deux tiers » des jours favorables en juillet-août alors que 33/50 = 66 % ; moyenne « des parcelles traitées » (19,8 t/ha) qui exclut P5 sans le dire (17,9 t/ha avec P5).
- **Article (B)** : période 2013–2023 dans le résumé contre 2014–2023 ; F1 du LSTM annoncé 0,79 contre 0,75 dans le tableau ; renvoi à une « figure 4 » inexistante ; « Traoré [7] » alors que [7] est de Bah et Kouyaté. Points **justes** à ne pas signaler : F1 cohérents avec précision et rappel ; 3 652 = 2 557 + 1 095 jours.
- **Note (C)** : aucune erreur (test de fausses alertes).

La vérification des citations de l'onglet Bibliographie trouve bien « Traoré [7] » (contrôlé le 6 octobre 2026).

Recréer les PDF : `node benchmark/banque/outils/creer-documents.cjs` (contenu dans `outils/documents.cjs`).

### MGSM

`serie-mgsm-fr.txt` : 15 problèmes tirés au hasard (graine 42) parmi les 250 de MGSM en français (Shi et al., 2022, « Language Models are Multilingual Chain-of-Thought Reasoners »), licence **CC BY-SA 4.0** ; la série adaptée reste sous cette licence. Régénérer : `python3 benchmark/banque/outils/mgsm.py 15 42`.

QASPER (questions sur des articles scientifiques entiers) n'est pas retenu : articles trop longs pour être lus en entier par des modèles locaux sur un ordinateur de 16 Go, et réponses peu vérifiables automatiquement.

## 3. Modèles

Vérifiés dans le catalogue d'Ollama le 6 octobre 2026 (taille du téléchargement). **Ne pas les télécharger pendant une série.**

| Modèle | Taille | Rôle | Sur le Mac de l'auteur (16 Go, processeur) |
|---|---|---|---|
| `gemma3-12b-16k` (installé) | 8,1 Go | référence : le plus fiable de la première série | possible, mémoire juste |
| `qwen3-8b-16k` (installé) | 5,2 Go | référence | confortable |
| `qwen35-9b-abliterated-16k` (installé) | 5,6 Go | à comparer avec Qwen3.5 officiel | confortable |
| `qwen3-4b-local` (installé) | 2,5 Go | référence petit modèle | confortable |
| `gemma4:12b` | 8,0 Go | nouveau | possible, mémoire juste |
| `gemma4:e4b` | 6,6 Go | nouveau, conçu pour les petites machines | confortable |
| `ministral-3:8b` | 6,0 Go | nouveau (Mistral) | confortable |
| `qwen3.5:9b` | 6,6 Go | **officiel** : comparaison officiel / « abliterated » | confortable |
| `qwen3.5:4b` | 3,3 Go | nouveau petit modèle | confortable |
| `ministral-3:14b` | 9,1 Go | facultatif | possible, mémoire juste, lent |

Téléchargement (environ 30 Go, quand l'auteur le décide) : onglet Bibliothèque de modèles, ou `ollama pull gemma4:12b gemma4:e4b ministral-3:8b qwen3.5:9b qwen3.5:4b`.

## 4. Réglages (identiques à la première série, pour comparer)

Pour **chaque** modèle, dans Réglages des modèles : température 0,6 ; top P 0,95 ; top K 20 ; graine 42 ; contexte 16384 ; longueur maximale 2048 ; réflexion désactivée ; consigne permanente vide. Répétitions : 1 pour le premier passage ; 3 ensuite sur les séries A et B seulement (stabilité).

## 5. Durée prévue et plan des nuits

Durées médianes mesurées dans la première série sur ce Mac : avec PDF, 2,1 min (4B) à 7,0 min (Gemma 3 12B) par question ; sans PDF, 0,5 à 2,7 min. Pour les 147 questions (43 avec PDF, 104 sans) : environ 2,5 h pour un modèle de 4B, 4,5 h pour 8–9B, 10 h pour 12B, soit **environ 47 h** pour les 9 modèles (une répétition).

Plan proposé (départ programmé à 22 h dans Comparaison, Mac branché, couvercle ouvert) :

| Nuit | Modèles | Durée |
|---|---|---|
| 1 | `qwen3.5:9b`, `qwen3.5:4b` | ~7 h |
| 2 | `ministral-3:8b`, `gemma4:e4b` | ~9 h |
| 3 | `gemma4:12b` | ~10 h |
| 4 | `gemma3-12b-16k` (référence) | ~10 h |
| 5 | `qwen3-8b-16k`, `qwen35-9b-abliterated-16k`, `qwen3-4b-local` | ~11 h |

Une comparaison ne prend qu'un document : lancer les séries A, B et C séparément (avec leur PDF), puis les séries sans document ; ou regrouper les séries sans document dans une seule importation (copier les fichiers à la suite, séparés par `---`).

## 6. Notation

- **Automatique (sans modèle)** : calculs refaits, citations et chiffres contrôlés dans les documents, plans d'actions vérifiés (Benchmark → Vérifications automatiques).
- **Correcteurs** : comme pour la première série, deux correcteurs indépendants (Claude et Codex) à partir de la fiche de notation exportée (verdict correct, partiel, faux ou hors sujet ; invention oui/non ; note de 1 à 5), puis accord entre correcteurs (kappa). Chaque « Attendu » sert de corrigé.
- **Aveugle** : la notation de l'auteur se fait avec « Noter à l'aveugle ».

## 7. Ce que les résultats alimenteront

- Le tableau « Quel modèle pour quelle tâche ? » et le modèle conseillé dans les conversations, les compétences et l'onglet Fichiers.
- L'article : comparaison de 9 modèles sur 9 types de tâches, avec Gemma 4, Ministral 3 et Qwen3.5 officiel contre sa version « abliterated », vitesses mesurées sur un ordinateur sans carte graphique utilisable.
