# Journal d'expériences

Une entrée par action significative. Une entrée contient : la date, qui l'a faite, ce qui a été fait, le résultat **mesuré** et le fichier de résultat.

## 2026-10-17 — Phase 1 (conception)

- **Claude** : diagnostic de la machine.
  - Matériel : i9-9880H, AVX2 sans AVX-512, 16 Go.
  - Logiciels : Ollama 0.40.5, llama.cpp build 11146, Python 3.13 sans PyTorch.
  - Disque : 22 Go libres au départ, 15 Go après les téléchargements.
- **Claude** : vitesse des modèles installés.
  - Phi-4-mini Q4_K_M : 10,1 jetons/s.
  - Gemma 4 E4B : 6,8 jetons/s.
  - Qwen3.5-9B : 3,7 jetons/s.
  - Fichier : `mesures/vitesse-cpu-reference.md`.
- **Claude** : téléchargement de 3 bases candidates (chacune < 3 Go, 5,9 Go au total) dans `~/localia-labo/modele-compact/bases/` :
  - Qwen3.5-2B Q4_K_M ;
  - Qwen3.5-4B IQ4_XS ;
  - Ministral 3 3B Q4_K_M.
- **Claude** : vitesse des bases à 0 et 8k de contexte. Fichier : `mesures/vitesse-bases-candidates.md`.
- **Claude** : empreintes SHA-256 de tokenizer.json.
  - Qwen3.5-2B, Qwen3.5-4B et Qwen3.6-35B-A3B : identiques (5f9e4d49…).
  - Qwen3.8-27B : différente (0997f410…), alors que le vocabulaire a la même taille (248 320).
- **Codex** : analyse indépendante. Fichier : `codex/01-analyse-independante.md`.
- **Claude** : fiches d'idées 01 à 14, `criteres.md`, `provenance.md`, `00-conception.md`.
- **Codex** : critique croisée **échouée**, limite d'usage atteinte (prochain créneau : 22 oct. 2026, 10 h 20). Brief prêt : `codex/brief-02-critique.md`.
- **Claude** : auto-critique, corrections dans `desaccords.md`, `criteres.md` et `00-conception.md`.
- **Claude** : vitesse à 8k avec et sans flash attention (`mesures/vitesse-flash-attention.md`). Sur ce CPU, la flash attention ralentit la génération à contexte long (Ministral : 2,0 avec, 4,2 sans). Correction de la conclusion « l'hybride est indispensable ».
- **Claude** : constat d'une forte variabilité. Charge de 16 à 25 et 3 Go de swap, liés à d'autres logiciels ouverts. Mesure alternée en 3 passes (`mesures/vitesse-alternee-2b-4b.md`) : 4B IQ4_XS de 4,1 à 4,35 jetons/s à 8k, sous l'exigence ; 2B de 7,2 à 9,3.
- **Claude** : couverture du vocabulaire (fiche 08, `mesures/couverture-vocabulaire*.md`). Un ensemble « français fréquent + ASCII » retire 48 % du vocabulaire, avec ≤ 0,1 % d'allongement des textes tenus à part. Matrice de vocabulaire en Q6_K : 33 % du fichier du 2B, 20 % du 4B.
- **Claude** : téléchargement du 4B Q4_K_S (2,59 Go). À 8k : 4,4 à 4,6 jetons/s ; lecture du contexte 1,7 fois plus rapide qu'en IQ4_XS (`mesures/vitesse-4b-q4ks.md`). Disque : 14 Go libres.
