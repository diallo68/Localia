Tu es Codex, chercheur-ingénieur associé à Claude. Réponds en français. LECTURE SEULE : ne modifie aucun fichier ; ta réponse finale sera enregistrée dans modele/codex/02-critique-croisee.md.

Claude a lu ton analyse indépendante (modele/codex/01-analyse-independante.md) et rédigé la conception de phase 1. Lis attentivement, dans /Users/mohamedbenhussein/localia-public/modele/ :
- 00-conception.md
- criteres.md
- provenance.md
- idees/*.md (14 fiches)
- mesures/*.md (vitesses mesurées sur la machine de référence)

Mission : CRITIQUE CROISÉE SÉVÈRE, en pair, pas en relecteur complaisant. En particulier :
1. Vérifie dans les fichiers et, si possible, en ligne ou par calcul, les affirmations chiffrées de Claude (FLOP, H100-h, tailles d'embedding, capacité 2 bits/paramètre, gains de l'élagage du vocabulaire, IC ±4-7 points avec 240 cas regroupés par ~40 documents, etc.). Signale toute erreur avec la correction.
2. Claude préfère Qwen3.5-4B alors que tu préférais le 2B. Les mesures montrent : 2B Q4_K_M 17,2 j/s à vide et 11,1 à 8k ; 4B IQ4_XS 6,1 j/s à vide et pp512 à 27 j/s. Qui a raison ? Propose un critère de décision mesurable.
3. Le levier « distillation sur politique depuis Qwen3.6-35B-A3B grâce au tokenizer identique » (fiche 03) : est-il solide ? Outillage réel (TRL GKDTrainer, OpenRLHF, verl…) compatible avec l'architecture Qwen3.5 (Gated DeltaNet) ? Pièges ?
4. Fiche 08 (élagage du vocabulaire) : faisabilité technique dans un GGUF qwen35 (BPE, fusions, jetons spéciaux, lm_head lié), gain réaliste sur ce CPU, et l'expérience minimale.
5. criteres.md : les seuils sont-ils honnêtes, atteignables, falsifiables ? Le niveau « Rivalise » est-il bien défini ? Manque-t-il un comparateur ou une condition ? Le juge ouvert non-Qwen est-il un bon choix ?
6. Le budget à 250 € est-il réaliste (temps d'ingénierie, échecs, stockage, transferts) ?
7. Ce que Claude a oublié ou sous-estimé.
8. Liste finale : POINTS D'ACCORD, DÉSACCORDS (avec ta position argumentée), CORRECTIONS À APPORTER (précises, fichier par fichier).

Distingue mesuré / calculé / supposé. 1 200 à 2 000 mots.
