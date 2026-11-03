# Publication de Dial-bowe-Guinee-2B : liste de contrôle

Préparé le 3 novembre 2026. **Rien n'est envoyé sans l'accord explicite de l'auteur, le jour de la publication.**
Le dossier `Dial-bowe-Guinee-2B/` est le contenu du dépôt Hugging Face ; ce fichier-ci n'en fait pas partie.

## Décisions de l'auteur

- [x] Nom : Dial-bowe-Guinee-2B (Ollama : `dial-bowe-guinee-2b`).
- [x] Licence : Apache 2.0 (décision de l'auteur, 3 nov. 2026 ; texte standard dans `LICENSE`).
- [x] Plateformes : Hugging Face seul pour l'instant ; Ollama éventuellement plus tard.
- [x] Mise en ligne : dépôt d'abord **privé** pour relecture, puis rendu public par l'auteur.
- [x] Compte : `madma2022` → dépôt `madma2022/Dial-bowe-Guinee-2B`.
- [x] Qui envoie : **l'auteur**, avec sa propre connexion Hugging Face (commandes ci-dessous, lancées par lui).
- [x] Calendrier : on attend les résultats du noyau du samedi 7 novembre avant toute publication.

## Après le noyau du 7 novembre (`resultats/lot4-fin/comparaison.txt`)

- [ ] Choisir le fichier publié.
  - Si le modèle refait est équivalent au lot 4 sur dev et dev2 (et par la KL du témoin), publier toute sa famille
    (Q8_0, Q5_K_M, Q4_K_M, Q4_0) et reprendre ses empreintes.
  - Sinon, ne publier que le Q4_K_M actuel (`a4b5f4bc…`), seul à avoir été mesuré sur le jeu secret.
  - Dans les deux cas, le README dit quel fichier a été mesuré sur le jeu secret.
- [ ] Mesurer la vitesse et la mémoire de chaque quantification retenue sur le Mac (llama-bench, mêmes réglages que
  `mesures/vitesse-lot4-vocfr48k.md`).
- [ ] Remplir les `À_COMPLÉTER` du README : tableau des fichiers, empreintes, choix selon la RAM, vitesses.
- [ ] Renommer les GGUF (`Dial-bowe-Guinee-2B-<quant>.gguf`) et mettre `general.name` à `Dial-bowe-Guinee-2B` avec
  `gguf_new_metadata.py`. Ce changement de métadonnées modifie l'empreinte : la recalculer **après**.
- [ ] Vérifier que chaque GGUF porte le gabarit sans réflexion, puis essai rapide dans Ollama (guide, étape 4).

## Avant l'envoi

- [ ] Relecture critique du README par Codex (prévue avant le rapport final). Ses désaccords vont dans
  `desaccords.md`.
- [ ] Relire le README avec l'auteur, et vérifier qu'aucun chiffre ne dit plus que le journal.
- [ ] Vérifier qu'aucun fichier du dépôt ne contient le jeu secret, les jeux dev et dev2, les données privées (thèse)
  ou un jeton.
- [ ] Mentions : Service-Public.fr (DILA), Licence Ouverte ; « ni produit ni approuvé par l'équipe Qwen ».

## Envoi (le jour J, avec accord)

```bash
huggingface-cli repo create Dial-bowe-Guinee-2B --type model --private   # dépôt privé d'abord
huggingface-cli upload madma2022/Dial-bowe-Guinee-2B Dial-bowe-Guinee-2B/ . --repo-type model
```

Puis, si l'auteur le décide, Ollama : `ollama cp dial-bowe-guinee-2b <compte>/dial-bowe-guinee-2b` et
`ollama push <compte>/dial-bowe-guinee-2b` (clé du compte ollama.com requise).
