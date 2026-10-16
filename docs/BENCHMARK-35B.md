# Un modèle de 35 milliards de paramètres dans le Benchmark de Localia

Suite de l'[élagage personnalisé des experts](ELAGAGE-EXPERTS.md), le 16 octobre 2026. Question : le
Qwen3.6-35B-A3B élagué à 192 experts sur 256 (8,47 Go) fait-il mieux, sur des questions de métier,
que les petits modèles que Localia propose aujourd'hui ?

## Protocole

- **Machine** : Mac Intel i9-9880H (8 cœurs), 16 Go de mémoire, processeur seul. C'est la même
  machine et le même moteur (llama.cpp de node-llama-cpp 3.22.1) que pour les quatre autres modèles.
- **Questions** : les 4 séries partagées du Benchmark, soit **139 questions**. Mildiou (6), cybersécurité
  (11), nouveaux métiers (34), métiers complète (88) : extraction, calcul, code, synthèse, rédaction,
  honnêteté, incohérences, raisonnement, conversations à plusieurs tours.
- **Rejeu à l'identique** : `scripts/labo/rejouer-series.mjs` renvoie au modèle les messages exacts
  qu'avaient reçus les autres modèles, avec les mêmes réglages (température 0,6, graine 42,
  contexte 16 384, 2 048 jetons au plus, sans réflexion).
- **Notation** : Claude (Anthropic) et Codex (OpenAI) ont noté les 139 réponses **séparément**,
  avec la grille du Benchmark (`docs/mesures/benchmark-35b/notes/consigne-notation.md`) : verdict
  correct, partiel, faux ou hors-sujet ; invention oui ou non ; note de 1 à 5. Chacun a ensuite relu
  les 40 désaccords nets avec l'argument de l'autre, puis a donné sa note finale, maintenue ou révisée.
- **Ajout au Benchmark** : `scripts/labo/ajouter-au-benchmark.mjs` ajoute les réponses au fichier
  des comparaisons de Localia, avec la vérification des calculs, puis importe les notes au format
  CSV de l'application. Les statistiques ci-dessous viennent du code de l'application
  (`src/benchmark-stats.js`).

## Résultats

### Série métiers complète (88 questions), notes de Claude et de Codex

C'est la seule comparaison à armes égales : les cinq modèles y ont été notés par les deux mêmes
correcteurs.

| Modèle | Acceptable | Correct | Invention | Note /5 | Lecture | Écriture | Durée médiane | Fichier |
|---|---|---|---|---|---|---|---|---|
| Gemma 4 E4B | 96 % | **74 %** | **10 %** | **4,27** | 42,2 j/s | 6,7 j/s | 46 s | 5,0 Go |
| **Qwen3.6-35B-A3B élagué** | **98 %** | 67 % | 19 % | 4,09 | 27,5 j/s | 6,6 j/s | 61 s | 8,5 Go |
| Qwen3.5 9B | 94 % | 66 % | 27 % | 3,90 | 16,4 j/s | 3,7 j/s | 117 s | 5,7 Go |
| Phi-4 mini | 73 % | 41 % | 33 % | 3,10 | 45,5 j/s | 8,4 j/s | 24 s | 2,5 Go |
| MedGemma 1.5 4B | 68 % | 39 % | 39 % | 2,84 | 50,3 j/s | 7,1 j/s | 132 s | 2,5 Go |

Acceptable = verdict correct ou partiel. ChatGPT a aussi noté les quatre autres modèles, mais pas
le 35B. En ajoutant ses notes, l'ordre ne change pas : Gemma 4 obtient 4,39 et le 35B 4,09.

### Les 4 séries (139 questions), notes de Claude seul

| Modèle | Acceptable | Correct | Invention | Note /5 |
|---|---|---|---|---|
| Gemma 4 E4B | 94 % | 77 % | **6 %** | **4,14** |
| **Qwen3.6-35B-A3B élagué** | 90 % | 77 % | 14 % | 4,11 |
| Qwen3.5 9B | 94 % | 77 % | 24 % | 3,91 |
| Phi-4 mini | 67 % | 40 % | 34 % | 2,81 |
| MedGemma 1.5 4B | 59 % | 36 % | 37 % | 2,52 |

Sur les trois petites séries, Codex n'a noté que le 35B. Comme il est plus sévère que Claude, un
classement « Claude + Codex » sur les 139 questions désavantagerait le 35B. Le tableau ci-dessus
s'en tient donc à Claude.

### Par catégorie (4 séries, Claude seul : part de réponses correctes · note moyenne)

| Catégorie (questions) | Gemma 4 E4B | Qwen3.6-35B élagué | Qwen3.5 9B | Phi-4 mini | MedGemma |
|---|---|---|---|---|---|
| Calcul (43) | 81 % · 4,3 | **93 % · 4,6** | 91 % · 4,3 | 37 % · 2,7 | 21 % · 2,0 |
| Extraction (15) | 80 % · 4,5 | **93 % · 4,6** | 87 % · 4,1 | 53 % · 3,8 | 60 % · 3,2 |
| Incohérences (18) | 67 % · 3,8 | 72 % · 3,8 | 72 % · 3,9 | 33 % · 2,4 | 39 % · 2,4 |
| Honnêteté (19) | **95 % · 4,8** | 79 % · 4,2 | 79 % · 4,0 | 79 % · 3,9 | 63 % · 3,2 |
| Rédaction (27) | **70 % · 3,7** | 59 % · 3,5 | 59 % · 3,5 | 22 % · 2,3 | 37 % · 2,9 |
| Code (8) | **75 % · 4,0** | 63 % · 4,0 | 75 % · 4,0 | 25 % · 1,8 | 13 % · 1,9 |
| Synthèse (5) | **80 % · 4,0** | 60 % · 3,6 | 80 % · 2,8 | 40 % · 2,8 | 20 % · 2,6 |
| Raisonnement (4) | 25 % · 3,0 | 25 % · 2,5 | 25 % · 2,8 | 25 % · 1,8 | 25 % · 2,0 |

Sur la série complète, avec Claude et Codex, le 35B reste en tête en calcul (88 % de réponses
correctes contre 81 % pour Gemma 4, sur 32 questions). Il est en revanche nettement derrière pour
les incohérences (41 % contre 77 %). Les catégories de moins de 10 questions ne permettent pas de
conclure.

## Lecture

- **Le 35B élagué n'a presque jamais de réponse inutilisable** : 98 % de réponses acceptables sur
  la série complète, le meilleur taux. Il est **en tête en calcul et en extraction**. Il écrit presque
  aussi vite que Gemma 4 (6,6 contre 6,7 jetons/s), soit environ 1,8 fois plus vite que Qwen3.5 9B.
- **Il ne bat pas Gemma 4 E4B**, qui reste devant pour la note globale, l'honnêteté, la rédaction
  et la détection d'incohérences. Le 35B invente deux fois plus souvent.
- **Ses erreurs typiques** :
  - il se croit en 2024 ;
  - il affirme qu'une couverture est « partielle » sans que rien ne l'indique ;
  - il ajoute à une réponse juste des détails faux.

  L'élagage à 192 experts et la quantification à 2 bits ont pu entamer les connaissances
  pointues. On l'avait déjà vu sur le nom du pathogène du mildiou.
- **Prix** : 8,5 Go sur disque, et au plus 8,7 Go de mémoire pendant la série (version à 192
  experts), contre 5 Go de fichier pour Gemma 4. C'est possible sur un PC de 16 Go, pas sur un PC
  de 8 Go.
- **Verdict** : Gemma 4 E4B reste le bon choix par défaut. Le 35B élagué devient un second choix
  sérieux pour les calculs et l'extraction de données, à condition d'avoir 16 Go.

## Deux correcteurs : désaccords et réconciliation

| | Avant réconciliation | Après |
|---|---|---|
| Même verdict | 71/139 (51 %) | 87/139 (63 %) |
| Même jugement acceptable / inacceptable | 117/139 (84 %) | 134/139 (96 %) |
| Écart de note ≤ 1 | 114/139 (82 %) | 120/139 (86 %) |
| Même avis sur l'invention | 105/139 (76 %) | 116/139 (83 %) |

- Sur les 40 désaccords nets, Claude a révisé 13 notes et Codex 27. Codex a reconnu une erreur
  de comptage : un mot de passe de 12 caractères, et non de 11.
- Même après réconciliation, **Codex reste nettement plus sévère** :
  - 43 % de réponses correctes, contre 77 % pour Claude ;
  - 30 % d'inventions, contre 14 % ;
  - une note de 3,60, contre 4,11.

  Les deux correcteurs s'accordent sur ce qui est utilisable ou non. Ils divergent sur la frontière
  entre « correct » et « partiel », et sur ce qui compte comme invention.
- Conséquence : **comparer des modèles notés par des correcteurs différents fausse le classement**.
  C'est pourquoi chaque tableau ci-dessus ne retient que des modèles notés par les mêmes correcteurs.

## Vitesse : ce qui marche et ce qui ne marche pas

Mesures avec `scripts/labo/mesure-leviers.mjs` sur une question qui demande de lire un tableau
d'environ 5 470 jetons, avec 300 jetons de réponse et un contexte de 8 192 jetons. Le 35B mesuré ici
est la version à **128 experts** (6,2 Go), pas celle du Benchmark. Chaque mesure n'a été faite qu'une
fois : seuls les grands écarts sont sûrs, et les petits restent à confirmer par des répétitions.

| Levier | Mesure | Décision |
|---|---|---|
| **Garder le document en mémoire entre deux questions** (Gemma 4) | 2ᵉ question : **23 jetons relus, premier mot en 1,2 s** au lieu de 5 460 jetons et environ 3 min | **Intégré dans la 0.7.2** (voir plus bas) |
| Même chose sur le 35B (modèle hybride) | Relit les 5 454 jetons, même avec un point de reprise tous les 1 024 jetons | À creuser : point de reprise explicite à la fin du document |
| Lots de lecture de 2 048 jetons (au lieu de 512) | 1ʳᵉ mesure : +17 % en lecture. **Mesures alternées refaites** (2 × 2 essais, document de 2 800 jetons) : Gemma 4 67 s au lieu de 69 s (−3 %, dans le bruit), 35B à 192 experts 72 s au lieu de 77 s (−6 %) ; **+0,4 Go de mémoire** | Non retenu : gain faible pour la mémoire qu'il coûte |
| Nombre de fils (4, 6, 8, 12, 16) | De 33 à 37 j/s en lecture, de 5,9 à 6,9 j/s en écriture, sans tendance | Pas de gain visible, on garde 8 |
| Quantification K au lieu de IQ, à 2 bits (6,2 à 7,1 Go) | `llama-bench` : 6,6 (IQ), 6,5 et 5,8 j/s (K) ; mesure sur 300 jetons : 6,7, 6,8 et 8,0 j/s | Pas de gain net : les deux mesures se contredisent |
| Quantification 4 bits (11,7 Go) | `llama-bench` : 7,7 j/s ; mesure sur 300 jetons, le document à lire en plus : 5,5 j/s | Pas de gain dans les conditions réelles, et la mémoire est presque pleine |
| Recopie par prédiction (InputLookupTokenPredictor) | 5 % des prédictions acceptées ; Gemma 4 3,2 au lieu de 3,9 j/s ; 35B **1,0 au lieu de 6,9 j/s** | Abandonné : le modèle reformule au lieu de recopier |

### Dans Localia 0.7.2 : le document gardé en mémoire

Le moteur intégré ne vide plus sa mémoire entre deux demandes. Il compare la nouvelle demande aux
jetons déjà calculés, et ne relit que ce qui suit leur début commun. Essai dans le moteur de
l'application, avec Gemma 4 E4B et un document de 2 800 jetons :

| Demande | À froid | Mémoire gardée |
|---|---|---|
| 1ʳᵉ question | 2 794 jetons lus, 64 s | 2 794 jetons lus, 92 s |
| Question de suite dans la conversation | 2 819 jetons lus, 63 s | **45 jetons lus, 3,1 s** |
| Autre question sur le même document | 2 798 jetons lus, 73 s | **24 jetons lus, 1,4 s** |

Deux réponses sur trois sont identiques. La troisième diffère (43 au lieu de 41 ; la bonne réponse
est 31) : llama.cpp découpe les jetons en lots autrement quand le début est déjà calculé, et un
arrondi différent peut faire basculer un chiffre incertain, même à température 0. Les modèles
hybrides (Qwen3.5, Qwen3.6) ne reviennent en arrière que jusqu'à un point de reprise : à défaut,
ils relisent tout, comme avant. Quand un long document dépasse la place disponible, Localia choisit
des passages différents selon la question : le début change et le gain diminue.

Données brutes : `docs/mesures/benchmark-35b/leviers/`.

## Limites

- Le 35B a été rejoué hors de l'application, avec le même moteur et les mêmes messages. Ses durées
  n'incluent pas le chargement, contrairement à celles des autres modèles.
- Le script de rejeu ne comptait que le dernier message. Pour les conversations à plusieurs tours,
  le nombre de jetons lus a donc été repris de Qwen3.5 9B, qui utilise le même tokenizer : l'écart
  vaut exactement 11 jetons sur les questions simples.
- Pendant la série, la question F05 a été ralentie par la mise en veille du Mac. Elle a été rejouée :
  le texte obtenu est identique, et le temps réel est de 94 s.
- Une seule exécution par question. Les correcteurs sont des modèles d'IA, et leurs écarts montrent
  la part de jugement dans la note.
- Les documents des séries sont fictifs.

## Fichiers

- `docs/mesures/benchmark-35b/reponses-qwen36-fr-192.json` : les 139 réponses et leurs statistiques.
- `docs/mesures/benchmark-35b/comparaisons-4-series.json` : les 4 séries telles que le Benchmark
  de Localia les contient, avec les questions, les réponses des 5 modèles et toutes les notes (Claude,
  Codex, ChatGPT). Tous les tableaux ci-dessus se recalculent à partir de ce fichier avec
  `src/benchmark-stats.js`.
- `docs/mesures/benchmark-35b/notes/` : les notes initiales et finales de Claude et de Codex, au
  format d'import du Benchmark, et les consignes données aux correcteurs.
- `docs/mesures/benchmark-35b/leviers/` : les mesures de vitesse et leur journal.
- Scripts : `scripts/labo/rejouer-series.mjs`, `ajouter-au-benchmark.mjs` et `mesure-leviers.mjs`.
