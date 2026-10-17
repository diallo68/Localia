Tu es Codex, chercheur-ingénieur associé à Claude sur un défi. Réponds en français. Tu travailles en LECTURE SEULE : ne modifie aucun fichier, rends ton analyse comme réponse finale (elle sera enregistrée).

# Défi
Créer « notre » modèle de langage de 1 à 4 Md de paramètres (fichier Q4 de 1 à 2,5 Go, GGUF pour Ollama / llama.cpp, utilisé dans l'application Localia) qui, sur un périmètre ciblé, égale ou dépasse des modèles ouverts 5 à 10 fois plus gros. Périmètre à choisir parmi : français (priorité), code, raisonnement/maths, usage d'outils. Il faut dire honnêtement où le modèle est inférieur. Chaque affirmation sera prouvée par benchmark public ET jeu de tests maison (100+ cas), après décontamination.

# Contraintes
- Machine cible (et seule machine locale) : MacBook Pro Intel i9-9880H 8c/16t, AVX2/FMA/F16C (pas d'AVX-512), 16 Go RAM dont 2 à 6 Go libres, pas de GPU utilisable, ~22 Go de disque libre, macOS 15.8.1, pas de MLX, pas de PyTorch installé. llama.cpp (build récent, llama-bench, llama-perplexity, llama-quantize) et Ollama 0.40.5 présents.
- Objectif vitesse : ≥ 5 jetons/s en génération sur CPU seul avec un contexte de 4k à 8k.
- Entraînement lourd = GPU loué, uniquement après validation d'un plan chiffré. 3 scénarios de budget : 0 €, ~100-300 €, ~1 000-3 000 €.
- Légal : INTERDIT d'utiliser des sorties de Claude, GPT/Codex ou tout service dont les conditions interdisent d'entraîner des concurrents. Seulement données publiques à licence claire et sorties de modèles ouverts dont la licence autorise la distillation. Base ouverte permissive (dérivés + redistribution). Décontamination obligatoire.
- Date : 17 octobre 2026. Modèles ouverts connus disponibles localement : Qwen3.5-9B, Qwen3.6-35B-A3B (MoE), Qwen3.8-27B, Gemma 4 E4B, Phi-4-mini, Qwen3 4B/8B, Gemma 3 12B. Qwen3.5 petits modèles (0.8B, 2B, 4B, 9B ; Apache 2.0 ; architecture hybride Gated DeltaNet + attention, vocab 248k, MTP). Gemma 4 (E2B, E4B, 26B-A4B, 31B ; Apache 2.0). SmolLM3-3B (Apache 2.0). Vérifie ce que tu peux, signale ce que tu supposes.
- Contexte Localia : application de bureau locale, en français, beaucoup d'usages « assistant de travail » : rédaction, synthèse, réponses fondées sur des documents fournis (RAG), avec vérification des sources.

# Ce que je te demande (analyse INDÉPENDANTE, Claude fait la sienne de son côté ; vous confronterez ensuite)
1. Les vrais leviers qui expliquent qu'un petit modèle récent égale un ancien gros (données, durée, distillation, RL, architecture), sans marketing.
2. Quel périmètre recommandes-tu, et pourquoi c'est là qu'un 2-4B peut réellement battre un 20-40B ? Où c'est impossible (connaissances factuelles, etc.) ?
3. Évalue les stratégies A (post-training SFT+préférences+RL vérifiable d'une base ouverte), B (distillation séquences/logits depuis un grand ouvert), C (élagage structuré + distillation de récupération), D (fusion/adaptateurs), E (pré-entraînement de zéro ≤1B), F (innovations d'architecture CPU : MTP/spéculatif, KV économe...), G (idées originales). Pour chacune : gain attendu, coût, risque, verdict.
4. Choix du modèle de base : compare au moins Qwen3.5-2B, Qwen3.5-4B, Gemma 4 E2B/E4B, SmolLM3-3B, et toute autre base pertinente (ex. Ministral 3B si Apache) : licence, taille Q4 réelle (attention aux gros vocabulaires / per-layer embeddings), support llama.cpp/Ollama de l'architecture, qualité française, facilité de fine-tuning (LoRA sur DeltaNet ?).
5. Budget : GPU-heures et euros (H100/A100/L40S/4090 loués, prix actuels supposés à indiquer) pour SFT LoRA, SFT complet, DPO, GRPO, distillation logits, génération synthétique par un professeur 27-35B.
6. Vitesse : calcule (bande passante mémoire DDR4-2666 double canal) le débit attendu pour un 2B et un 4B Q4 sur cette machine, et l'effet du contexte 8k selon l'architecture.
7. Trois idées originales que tu défendrais, chacune avec l'expérience minimale qui la réfuterait.
8. Ce que tu ne sais pas.

Sois concret, chiffré, critique. Distingue « mesuré / calculé / supposé ». Longueur : 1 500 à 2 500 mots.
