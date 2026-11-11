# Désaccords Claude / Codex

Chaque désaccord indique : la position de chacun, les arguments, ce qui le tranchera (mesure ou source) et l'état actuel.

> **Note du 17 octobre 2026** : la critique croisée de Codex sur la conception (`codex/brief-02-critique.md`) **n'a pas pu avoir lieu**. Codex a atteint sa limite d'usage, et le prochain créneau ouvre le **22 octobre 2026 à 10 h 20**. La seconde passe est donc due. En attendant, Claude a fait une contre-vérification seul (section « Auto-critique » ci-dessous), ce qui ne remplace pas un regard indépendant.

## D1 — Base principale : 2B (Codex) ou 4B (Claude)

- **Codex (analyse 1)** : Qwen3.5-2B est le « favori matériel ». Il estimait le 4B à 3-6 jetons/s, donc incertain.
- **Claude** : le 4B. Ses scores publiés sont nettement supérieurs, notamment sans réflexion. Il partage le tokenizer du professeur, tout comme le 2B.
- **Mesures [mesuré]** :
  - 2B Q4_K_M : 17,2 jetons/s à vide, 11,1 à 8k ;
  - 4B IQ4_XS : 6,1 jetons/s à vide, lecture du contexte à 27 j/s ;
  - 4B à 8k : voir `mesures/vitesse-bases-candidates.md`.

  L'estimation de Codex sur le 4B se confirme pour la quantification IQ4_XS, la seule sous 2,5 Go. Celle de Claude, d'environ 9 jetons/s (extrapolée de Phi-4-mini en Q4_K_M), était **trop optimiste** : les IQ-quants sont plus lents sur ce CPU.
- **Ce qui tranche** : deux mesures à 0 € en phase 2.
  - Vitesse d'un 4B en Q4_K_S ou Q4_K_M à vocabulaire élagué (fiche 08), sous 2,5 Go.
  - Écart de qualité 2B/4B sur le jeu de développement.

  Règle proposée : on prend le 4B s'il tient **≥ 5 jetons/s à 8k** et s'il dépasse le 2B d'au moins 5 points sur le jeu de développement après un même SFT pilote. Sinon, on prend le 2B.
- **Mesure complémentaire** (3 passes alternées, machine en charge) : 4B entre 4,1 et 4,35 jetons/s à 8k, sous l'exigence ; 2B entre 7,2 et 9,3. **Sur la vitesse, Codex avait raison.** Claude retient le 2B comme candidat principal par défaut. Le 4B ne garde qu'une chance, via l'élagage du vocabulaire (fiche 08) et le passage en Q4_K.
- **État** : ouvert, mais penche vers le 2B.

## D2 — Place de la distillation sur logits

- **Codex** : séquences vérifiées d'abord. Les logits sont « plus complexes » : 9,93 To pour des logits complets, top-64 nécessaire.
- **Claude** : d'accord pour commencer par les séquences. Mais la distillation **sur politique** n'a pas besoin de stocker de logits, puisque le professeur note en direct les échantillons de l'élève. Le tokenizer identique en fait le levier n° 1 après le SFT.
- **Ce qui tranche** : le pilote de la fiche 03. On compare SFT seul et SFT + distillation sur politique, à calcul égal.
- **État** : ouvert, à soumettre à Codex le 22 octobre.

## D3 — Format « preuves avant réponse » (fiche 07)

- **Codex** : produire d'abord des extraits et leurs identifiants.
- **Claude** : oui sur le principe, mais à 6-11 jetons/s des extraits complets coûtent 15 à 25 s par réponse. Il propose des repères courts que Localia résout.
- **Ce qui tranche** : l'expérience de la fiche 07 (affirmations non étayées et temps de réponse).
- **État** : ouvert.

## D4 — Récupération Q4 (fiche 09)

- **Codex** : idée originale à part entière.
- **Claude** : à n'entreprendre que si l'écart BF16/Q4 dépasse 1,5 point. Sur un 4B en Q4_K, il est souvent faible.
- **État** : différé, la mesure tranchera.

## Auto-critique de Claude (en l'absence de la seconde passe de Codex)

Points corrigés dans la conception :
1. **Mon estimation de vitesse du 4B était fausse** : ≈ 9 jetons/s supposés, 6,1 mesurés en IQ4_XS. Corrigé dans le texte.
2. **Comparateurs si le modèle final est le 2B** : « 5 à 10 fois plus gros » signifie alors 10 à 20 Md, et non 20 à 40. Comparateurs ajoutés dans `criteres.md` : Gemma 3 12B, Mistral-Nemo-12B, Gemma 4 12B, plus Qwen3.5-9B comme limite basse.
3. **La mesure « décisive » de l'étape 2.2 était impossible** telle qu'écrite : les modèles de 20 à 40 Md ne tiennent pas dans 16 Go de RAM. Correction : à 0 €, on mesure l'écart avec les 9-12 Md installés. Pour les 20-40 Md, l'auteur peut choisir une API gratuite ou peu chère qui sert ces mêmes modèles ouverts. C'est autorisé, car leurs sorties ne servent qu'à l'évaluation, jamais à l'entraînement. Sinon, on attend le scénario payant.
4. **Intervalle de confiance** : l'effet de grappe (≈ 6 cas par document, corrélation intra-document de 0,1) multiplie l'erreur type par environ 1,2. Fourchette corrigée : **± 5 à 8 points**.
5. **Juge ouvert** : Gemma 4 31B et Mistral Small 4 ne tournent pas sur la machine. En phase 2 à 0 €, la notation sera automatique, plus humaine.
6. **Nombre de fils** : toutes les mesures sont à 8 fils. 6, 12 et 16 fils n'ont pas été testés : à faire avant de conclure sur le 4B.

## Relecture du README de publication par Codex (7 novembre 2026)

Codex a relevé 16 problèmes. Claude les a vérifiés dans les sources. Presque tous sont fondés et ont été corrigés
dans `publication/Dial-bowe-Guinee-2B/README.md` :

- RAM : mesures faites sur un Mac de 16 Go et pics de llama-bench, présentés par fichier ; « 8 Go » ramené à une
  indication non vérifiée ;
- vitesse : pas d'opposition « au repos / en charge » ni de coefficient général, car le processeur était bridé à
  47-50 % lors des deux séries ; la mesure à 32k date du 3 novembre, pas du 26 octobre ;
- résultat présenté comme un **échec** au sens des critères, contrôle de régression non tenu inclus ; κ de la note
  automatique (0,05) ajouté à côté de celui du juge ; résultat du juge donné à titre secondaire ;
- « ne fait pas mieux » remplacé par « aucune amélioration démontrée » ; écarts par catégorie présentés comme des
  tendances ;
- score S_doc défini ; 240 cas (0,765) distingués des 234 du score principal, y compris dans le résumé anglais ;
- conditions des bancs (moitié sans réponse, 50 questions par matière, IFEval en anglais) et Gemma 4 en QAT Q4_0 ;
- KL : « très proche » et non « exactement » ; témoin et F16 du second entraînement nommés ; dev et dev2 ont servi
  au choix du modèle ;
- contexte long : fonctionnement mesuré à 32k, qualité non évaluée ; Modelfile (FROM, num_ctx, SYSTEM), version
  d'Ollama ;
- 1,7 milliard de paramètres après élagage ; langues guinéennes non évaluées (au lieu de « ne parle pas ») ; cas
  d'évaluation écrits par Claude ; élagage : −0,002 au lieu de « sans perte ».

Point non retenu : « 40 × 512 jetons non corroboré ». Ce chiffre est dans le script du noyau
(`kaggle/lot4-fin-eval/lot4_fin_eval.py`, `-c 512 --chunks 40`). Il est gardé, précisé en « 40 fenêtres de 512
jetons ».

## Plan de la v2 (relecture de Codex du 11 nov. 2026, `codex/03-relecture-plan-v2.md`)

Points de Codex vérifiés et retenus (plan, §3 bis) : séparation de G en G (développement) et G-test ; précision de S2
corrigée (±8,5 points et non ±5) ; « base » = base élaguée ; mémoire de 1,77 à 2,39 Go (et non 1,11 Go, qui est la
taille du fichier) ; rappel à 23,4 % des exemples ; un seul changement à la fois après un échec ; essai de la DPO
avant la production ; garde-fou de longueur par paire.

Point tranché par l'auteur le 11 nov. : les deux seuils sont gardés (objectif > 50 %, « démontré » à 27 sur 40). Rappel de la question : Codex rappelle qu'avec 40 paires sans
égalité, il faut environ 27 victoires pour un écart démontré (test binomial bilatéral à 5 %), alors que le plan
demande « plus de 50 % ». Les deux lectures sont possibles : un seuil descriptif (préférée plus souvent) ou un
seuil démontré (27 sur 40).
