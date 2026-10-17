**Je recommande un modèle spécialisé dans le travail documentaire en français : extraire, synthétiser, rédiger sous contraintes, citer et savoir s’abstenir.** Premier candidat : **Qwen3.5-2B**, confronté à Ministral 3 3B et SmolLM3-3B avant tout entraînement. La voie réaliste combine distillation de réponses vérifiées, SFT LoRA et préférences ciblées. Battre certains 20–40B sur ce périmètre est une hypothèse défendable ; battre leur compétence générale ne l’est pas.

Analyse indépendante, en lecture seule, au 17 octobre 2026. **Observé localement** : Ollama 0.40.5, llama.cpp build 11146, environ 21 Gio libres. Aucun benchmark d’inférence exécuté ici. Ci-dessous, « publié » désigne une information du fournisseur, « calculé » un résultat reproductible, « supposé » une estimation à tester.

**Les leviers réels sont surtout les données et le calcul déjà investis.** Un petit modèle récent bénéficie d’un corpus mieux filtré, dédupliqué, équilibré et beaucoup plus longtemps exploité. SmolLM3 annonce ainsi **11,2 billions de jetons de préentraînement**, puis 140 milliards de jetons de raisonnement : une économie d’inférence obtenue grâce à un investissement initial considérable. [Fiche SmolLM3](https://huggingface.co/HuggingFaceTB/SmolLM3-3B)

La distillation transmet des réponses et des procédures utiles sans obliger l’élève à les découvrir. Le SFT améliore la manière d’exploiter ses capacités ; les préférences corrigent notamment verbosité, abstention et suivi des consignes. Le RL apporte surtout quelque chose lorsque la récompense distingue réellement réussite et échec. Les résultats de DeepSeek-R1 soutiennent l’intérêt de la distillation vers de petits modèles, sans démontrer qu’un petit budget RL reproduit le travail du professeur. [Rapport DeepSeek-R1](https://arxiv.org/abs/2501.12948)

L’architecture réduit mémoire et calcul ; elle ne remplace pas les connaissances absentes. Enfin, certaines comparaisons favorables cachent davantage de jetons de réflexion, des outils supplémentaires ou un benchmark étroit. Contre-exemple publié : en mode sans réflexion, Qwen3.5-2B obtient **61,2 sur IFEval**, contre **83,4 pour Qwen3-4B-2507**. « Plus récent » ne signifie donc pas automatiquement « meilleur ». [Fiche Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B)

**Le périmètre gagnable est la fidélité documentaire, pas “le français” entier.** Les documents fournissent les faits ; l’apprentissage peut se concentrer sur leur sélection, leur reformulation et leurs limites. Un spécialiste peut dépasser un généraliste plus gros en précision des citations, respect d’un format métier ou détection d’informations manquantes.

Je m’attends en revanche à une infériorité en connaissances sans documents, ambiguïtés complexes, raisonnement long, programmation de dépôts entiers et planification autonome. Ce ne sont pas des impossibilités mathématiques ; ce sont des paris peu crédibles avec ces budgets.

Il faudra comparer séparément **modèle seul avec passages identiques** et **application complète**. Une meilleure recherche documentaire constitue un progrès de Localia, mais ne prouve pas une supériorité des poids.

**Le plafond de fichier élimine plusieurs candidats séduisants.** Tailles ci-dessous : fichiers publiés, Go décimaux, partie textuelle sans projecteur multimodal ; elles ne représentent pas la RAM totale.

| Candidat | Licence publiée | GGUF publié | Appréciation |
|---|---|---:|---|
| Qwen3.5-2B | Apache 2.0 | Q4_K_M **1,28 Go** | Favori matériel ; qualité française à établir |
| Qwen3.5-4B | Apache 2.0 | Q4_K_M **2,74 Go** ; Q4_0 **2,58 Go** | Hors plafond strict de 2,5 Go |
| Gemma 4 E2B | Apache 2.0 | Q4_0 **2,84 Go** ; Q4_K_M **3,11 Go** | Hors plafond ; « E2B » trompeur pour le stockage |
| Gemma 4 E4B | Apache 2.0 | Q4_0 **4,59 Go** ; Q4_K_M **4,98 Go** | À écarter pour cet artefact |
| SmolLM3-3B | Apache 2.0 | Q4_K_M **1,92 Go** | Candidat simple à adapter, français explicitement couvert |
| Ministral **3** 3B Instruct 2512 | Apache 2.0 | Q4_K_M **2,15 Go** | Concurrent sérieux ; ne pas confondre avec les générations antérieures |

Sources des fichiers : [Qwen 2B](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/tree/main), [Qwen 4B](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/tree/main), [Gemma E2B](https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/tree/main), [E2B K-quants](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/tree/main), [Gemma E4B](https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/tree/main), [E4B K-quants](https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/tree/main), [SmolLM3](https://huggingface.co/unsloth/SmolLM3-3B-GGUF/tree/main), [Ministral officiel](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF/tree/main).

Chez Gemma, les embeddings par couche augmentent fortement le nombre de paramètres stockés, même si seule une petite partie est consultée par jeton. Les variantes mobiles très compactes utilisent d’autres schémas et moteurs : leurs tailles ne prouvent pas la faisabilité d’un GGUF Q4 équivalent. [Documentation Google](https://ai.google.dev/gemma/docs/core)

Chez Qwen, le vocabulaire de 248 320 entrées représente déjà **509 millions de paramètres** pour l’embedding lié du 2B, calculés avec une dimension de 2 048. On ne peut donc pas estimer correctement le fichier par « paramètres × 0,5 octet ».

Le support existe dans llama.cpp pour [Qwen3.5](https://github.com/ggml-org/llama.cpp/blob/master/src/models/qwen35.cpp), [Gemma 4](https://github.com/ggml-org/llama.cpp/blob/master/src/models/gemma4.cpp) et [SmolLM3](https://github.com/ggml-org/llama.cpp/blob/master/src/models/smollm3.cpp). Qwen et Gemma figurent aussi au catalogue [Ollama](https://ollama.com/library). Cela ne valide pas encore l’export de notre futur dérivé sur le build local.

Pour Qwen, **LoRA BF16 est documenté**, mais Unsloth déconseille actuellement QLoRA pour cette famille. Les projections de DeltaNet peuvent recevoir des adaptations linéaires ; il faut toutefois inspecter les modules effectivement entraînés : cibler uniquement `q_proj/v_proj` ne couvre pas automatiquement les blocs récurrents. Je commencerais par MLP et attention, puis une ablation incluant DeltaNet. [Guide de fine-tuning](https://unsloth.ai/docs/models/qwen3.5/fine-tune)

Je ne dispose pas d’une évaluation française homogène permettant de classer honnêtement ces candidats. Ministral et SmolLM3 simplifient l’expérimentation ; Qwen2B offre la meilleure marge matérielle. Qwen3-4B déjà installé constitue également un témoin utile.

**Mon jugement sur les sept stratégies** : les gains suivants sont des hypothèses sur notre score spécialisé, en points absolus, non des résultats ni des gains cumulables.

| Stratégie | Gain espéré | Coût et risque | Verdict |
|---|---|---|---|
| **A — SFT, préférences, RL vérifiable** | +5 à +15 points | Quelques dizaines à centaines d’euros ; oubli, surapprentissage, récompense détournée | Priorité SFT ; DPO ensuite ; RL seulement sur tâches vérifiables |
| **B — Distillation séquences/logits** | +3 à +12 | Séquences économiques ; logits plus complexes ; imitation des erreurs | Séquences vérifiées en premier |
| **C — Élagage structuré + récupération** | Réduction de taille de 20–40 %, qualité généralement initialement dégradée | Pilote 200–1 000 € ; récupération non garantie dans 3 000 € | Mauvais premier investissement |
| **D — Fusion/adaptateurs** | 0 à +5 | Peu coûteux ; interférences entre compétences | Tester après un bon adaptateur unique |
| **E — Préentraînement ≤1B** | Contrôle intégral, sans avantage qualitatif attendu ici | Données, calcul et post-training insuffisants | Écarter pour le produit |
| **F — Optimisations CPU** | Qualité inchangée ; vitesse potentiellement améliorée | Dépend des kernels et du taux d’acceptation spéculatif | Indispensable à mesurer |
| **G — Apprentissage spécifique aux documents** | Réduction ciblée des erreurs | Dépend fortement du protocole de validation | Meilleur terrain de différenciation |

L’élagage fonctionne scientifiquement : Minitron montre l’intérêt d’élaguer puis distiller. Mais « moins cher que repartir de zéro » ne signifie pas « moins cher que spécialiser un excellent 2B existant ». Une sparsité non structurée n’accélère pas automatiquement les kernels CPU denses. [Minitron](https://arxiv.org/abs/2407.14679)

Pour E, le calcul \(6ND\) donne **1,2 × 10²⁰ FLOP** pour 1B sur 20 milliards de jetons : environ **333 heures à 100 TFLOP/s utiles**, soit autour de 1 000–1 330 € de H100, hors préparation et essais. Ce serait un modèle très peu entraîné comparé aux petits modèles compétitifs actuels.

**Le budget doit acheter des expériences comparables.** Runpod publie notamment 0,89 $/h pour 4090, 1,09 pour L40S, 1,79 pour A100 80 Go et 2,89–3,99 pour H100. Pour budgéter, je suppose prudemment **1 $ = 1 €**, sans prétendre donner le taux de change actuel ; ajouter taxes éventuelles, stockage et reprises. [Tarifs publiés](https://www.runpod.io/articles/guides/ai-server-cost)

Hypothèses : élève 2–4B, séquences surtout 2k, packing, checkpointing, implémentation GPU optimisée. Les durées restent **supposées**, à remplacer par un pilote.

| Expérience | Volume | GPU-heures | Calcul seul |
|---|---|---:|---:|
| SFT LoRA | 20 M jetons × 2 passages | 4090 : 10–35 ; L40S : 8–25 ; A100 : 6–20 ; H100 : 3–12 | Respectivement 9–31 ; 9–27 ; 11–36 ; 9–48 € |
| SFT complet | Même volume | H100 80 Go : 12–40 | 35–160 € |
| DPO | 10 000 paires, réponses courtes | L40S : 6–20 | 7–22 € |
| GRPO | 2 000 questions × 8 sorties × 512 jetons | H100 : 20–80 | 58–320 € |
| Distillation logits | 20 M positions, professeur puis élève | H100 : 15–50 | 43–200 € |
| Synthèse par professeur 27–35B | 10 M jetons produits, environ 40 M lus | H100 : 8–30 | 23–120 € |

Le SFT complet avec Adam requiert approximativement **32–64 Go d’états et poids** pour 2–4B, avant activations : la 4090 n’est pas le choix naturel. Le professeur 27B peut tenir en BF16 sur 80 Go avec batch prudent ; le 35B laisse moins de marge.

Les logits complets sont particulièrement coûteux à conserver : **20 M × 248 320 × 2 octets = 9,93 To**. Un top-64 avec identifiants et valeurs représente environ **7,68 Go**, plus métadonnées ; il exige une approximation explicite de la masse restante. Vérifier l’identité des tokenizers avant toute KL directe.

Je propose ces enveloppes, hors travail humain :

- **0 €** : mesures CPU, choix du candidat, protocole, prompts et vérification documentaire. Aucun nouveau modèle entraîné promis.
- **100–300 €** : un à trois LoRA, synthèse limitée, éventuellement DPO. Exemple à **250 €** : génération 50, SFT 60, DPO 20, évaluation 60, réserve 60.
- **1 000–3 000 €** : plusieurs graines, ablations, meilleur corpus et évaluation approfondie. Exemple à **2 000 €** : génération 300, SFT 500, DPO 150, RL 250, évaluation 400, réserve 400.

Conversion, fusion BF16 et quantification se feraient sur le serveur loué. Seuls GGUF, adaptateur et rapports reviendraient sur le Mac.

**Le débit de 5 jetons/s semble plausible pour 2B, incertain pour 4B.** La DDR4-2666 double canal donne :

\[
2666 \times 10^6 \times 8 \times 2 = 42,7\ \text{Go/s}.
\]

Intel annonce 41,8 Go/s maximum. Je suppose **18–28 Go/s soutenus**, à mesurer. [Spécifications Intel](https://www.intel.com/content/www/us/en/products/sku/192987/intel-core-i99880h-processor-16m-cache-up-to-4-80-ghz/specifications.html)

En approximant une lecture des poids par jeton, les plafonds mémoire sont **14–22 jetons/s pour 1,28 Go**, **6,6–10,2 pour 2,74 Go**, avant attention, déquantification et autres calculs.

À 8k, le KV FP16 calculé des couches d’attention Qwen vaut **96 Mio pour 2B**, **256 Mio pour 4B**. Les états DeltaNet ajoutent approximativement **18 et 48 Mio**, hors buffers. Le cache KV double de 4k à 8k ; les états récurrents restent de taille constante. [Configuration 4B](https://huggingface.co/Qwen/Qwen3.5-4B/blob/main/config.json)

Mon intervalle prudent, **supposé**, est **6–12 jetons/s pour 2B**, **3–6 pour 4B**, sans swap. Avec seulement 2 Go disponibles, même 2B risque de manquer de marge. Un Transformer GQA classique paiera davantage le contexte ; NoPE seul ne supprime pas le cache KV.

MTP/spéculatif peut amortir les lectures, mais coûte génération du brouillon et vérification. Aucun multiplicateur garanti sur AVX2. Mesurer 4/8/16 threads, contexte réellement rempli, température stabilisée, premier jeton et durée complète. À 5 jetons/s, 1 000 jetons de réflexion ajoutent déjà 200 secondes.

**La preuve doit précéder toute annonce.** Je retiendrais FQuAD pour la compréhension française et ALCE pour les réponses sourcées ; ALCE reste anglophone et ne suffit donc pas à prouver notre spécialité française. [FQuAD](https://arxiv.org/abs/2002.06071), [ALCE](https://github.com/princeton-nlp/ALCE)

Les [147 questions existantes](/Users/mohamedbenhussein/localia-public/benchmark/banque/PROTOCOLE.md) serviront au développement. Le test final comportera **240 cas nouveaux**, répartis entre extraction, synthèse, rédaction contrainte, citations, abstention/contradictions et injections documentaires.

Préenregistrer les métriques : exactitude, couverture, précision des citations, affirmations non étayées, utilité à couverture comparable, latence et RAM. Comparer base, modèle adapté BF16, GGUF Q4 et grands modèles avec mêmes passages et outils. Employer des corrections humaines aveugles et des intervalles appariés, regroupés par document.

Décontaminer avant synthèse : séparation par document/source, doublons exacts, n-grammes, MinHash, voisins sémantiques et vérification manuelle. Garder le test final secret pendant les choix. **On ne peut pas certifier l’absence des benchmarks dans le préentraînement opaque des bases.** Avec 100 cas, l’incertitude peut approcher ±10 points : une petite avance ne prouvera rien.

Les données d’apprentissage auront provenance et licence enregistrées. Aucun exemple, corrigé, classement DPO ou signal RL issu de Claude/GPT/Codex. Une licence Apache sur les poids ne régularise pas automatiquement les droits des documents utilisés.

**Trois expériences originales au niveau du projet**, sans revendication de nouveauté scientifique :

1. **Réponse construite depuis des preuves localisées.** Produire d’abord extraits et identifiants, puis rédiger ; vérifier mécaniquement leur présence. Réfutation : sur 120 cas, aucune baisse d’au moins 30 % des affirmations non étayées à couverture comparable.
2. **Documents contrefactuels appariés.** Modifier dates, montants ou responsabilités et apprendre à suivre la version fournie. Réfutation : sur 100 paires inédites, le modèle conserve autant ses anciennes réponses que le SFT ordinaire.
3. **Apprentissage ciblé sur les erreurs introduites par Q4.** Repérer sur développement les divergences BF16/Q4 et entraîner une récupération limitée. Réfutation : aucune amélioration sur 100 cas distincts, ou régression française supérieure à deux points.

**Ce que je ne sais pas encore** : le classement français réel, le débit thermique soutenu du Mac, la robustesse des kernels DeltaNet locaux, le gain du MTP et le coût exact de notre pipeline. Je confirme les fiches Apache de [Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) et [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), mais pas leur supériorité comme professeurs. Le MoE 35B n’active que 3B : gagner contre lui ne serait pas gagner contre dix fois plus de calcul. Le premier engagement raisonnable reste un pilote chiffré, puis une décision fondée sur les mesures.