# 08 — Élagage du vocabulaire (idée de Claude)

**Statut** : expérience à 0 € prévue en phase 2 ; premier jalon mesurable sans GPU.

## Hypothèse
Le vocabulaire de Qwen3.5 compte 248 320 jetons et couvre 201 langues. Pour un usage français, anglais et code, 60 000 à 100 000 jetons couvrent plus de 99,9 % des occurrences. Retirer les autres apporte trois choses :
1. **taille** : le 4B passe sous 2,5 Go même en Q4_K_M, au lieu de 2,74 Go ;
2. **vitesse** : la matrice de sortie liée, lue à chaque jeton, rétrécit. Gain borné par la part de cette matrice dans les octets lus par jeton ;
3. **qualité** : zéro perte sur les textes du périmètre, si aucun jeton utile n'est retiré.

## Calcul (calculé)
- Embedding lié du 4B : 248 320 × 2 560 = 636 M paramètres, soit environ 15 % des quelque 4,2 Md (la fiche HF annonce 4B et les métadonnées 5B, vision comprise). Pour le 2B : 248 320 × 2 048 = 509 M, environ 25 %.
- En ne gardant que 80 000 jetons : 4B −431 M paramètres, 2B −345 M.
- En Q4/Q6, cela fait environ 0,25 à 0,35 Go de moins pour le 4B, et un gain de vitesse théorique de 10 à 15 % (4B) ou 15 à 20 % (2B), si le calcul de la sortie est limité par la mémoire.
- Littérature : Bogoychev et al., 2023, arXiv:2311.09709 annoncent jusqu'à 50 % de mémoire en moins sur les petits modèles et au plus 25 % de vitesse, avec des rendements décroissants sur les gros modèles et des résultats inégaux selon les langues. Voir aussi Ushio et al., 2023 (EMNLP Findings) et Nozaki et al., 2025 (COLING Industry).

## Mécanisme technique
- On réécrit le GGUF : on garde les lignes de `token_embd` des jetons conservés et on renumérote. Le précédent local est `~/localia-labo/prune-gguf.py`, déjà utilisé pour élaguer des experts.
- **Difficulté réelle** : le tokenizer BPE doit rester cohérent. Une fusion dont le résultat a disparu ne doit jamais s'appliquer. Une approche sûre consiste à ne retirer que des jetons qui ne sont le résultat d'aucune fusion nécessaire aux jetons gardés (fermeture par les fusions), en conservant tous les octets de base.
- Distillation sur logits (fiche 03) : le vocabulaire élagué étant un sous-ensemble de celui du professeur, il suffit de restreindre et renormaliser.

## Avocat du diable
- Si la matrice de sortie est déjà en Q6_K et que le calcul n'est pas limité par la mémoire sur ce CPU, le gain de vitesse peut être quasi nul.
- Un jeton rare retiré (symbole, nom propre étranger dans un document) change la tokenisation : le texte devient plus long, mais rien ne casse si les octets de base sont gardés.
- On perd la compatibilité directe avec les outils qui supposent le tokenizer d'origine. Ollama lit le tokenizer dans le GGUF : a priori pas de problème, **à vérifier**.

## Expérience de falsification (0 €, CPU)
1. Couverture : tokeniser 5 à 20 M de caractères de français varié et de code, puis tracer la couverture en fonction de la taille du vocabulaire gardé.
2. Prototype sur le 2B : GGUF élagué. Perplexité française (llama-perplexity) identique à ±0,5 %, et vitesse mesurée avec llama-bench.

On abandonne si le gain de vitesse est inférieur à 5 %, ou si la perplexité se dégrade de plus de 1 %.

## Résultat mesuré (17 oct. 2026, 0 €, aucun entraînement)

Scripts : `mesures/couverture_vocab.py` et `couverture_vocab_ascii.py`. Résultats : `mesures/couverture-vocabulaire*.md`.

**Protocole** : sélection des jetons sur 22 122 documents de FineWeb-2 fr (fichier de test, 67 Mo, ODC-By, mesure seulement). Mesure de l'allongement des textes sur des textes **tenus à part** :
- les 22 123 autres documents FineWeb ;
- les textes de calibration de Localia (200 ko) ;
- du code JavaScript de Localia (630 ko) ;
- le README anglais.

Le BPE élagué est reconstruit, avec fermeture par les fusions.

1. **Sélection sur le français seul** : environ 74 000 jetons distincts apparaissent. Garder 67 000 jetons n'allonge le français web que de **+0,22 %**, mais le code s'allonge de **+25,6 %** et l'anglais de +10,4 %. La sélection ne doit donc pas reposer sur le français seul.
2. **Français fréquent + tous les jetons ASCII** (127 755 jetons ASCII dans le vocabulaire) : on garde 130 000 à 134 000 jetons, soit **48 % retirés**. Allongement ≤ 0,1 % sur les quatre jeux tenus à part, à 32 000 jetons français ou plus.
3. **Poids réel de la matrice de vocabulaire** (lu dans les GGUF, Q6_K) :
   - 2B Q4_K_M : 417 Mo sur 1 270 Mo, soit **33 % du fichier** ;
   - 4B Q4_K_S / IQ4_XS : 521 Mo sur 2 579 / 2 466 Mo, soit 20 %.

   Elle est liée à la sortie, donc relue en entier à chaque jeton.

**Conséquences calculées** pour 48 % de vocabulaire retiré, en supposant la génération limitée par la mémoire :
- **2B** : −200 Mo (1,07 Go), environ **+19 % de vitesse** ;
- **4B Q4_K_S** : −250 Mo (2,33 Go, **sous le plafond**), environ +11 %.

Gain possible en plus : une sélection plus fine des jetons ASCII, sur un corpus anglais et code. Le gain réel de vitesse reste **à mesurer** sur un GGUF élagué (phase 2).

**Limites** : corpus de code et d'anglais minuscules (un seul projet JavaScript, un seul README). Aucun texte avec beaucoup de noms propres étrangers, de formules ou d'emojis. Allongement sur la calibration Localia de +3,8 % avec la sélection française seule : non analysé en détail.
## Décision
Retenu pour l'expérience à 0 €.
