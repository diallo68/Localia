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

- [x] Choisir le fichier publié (7 nov., accord de l'auteur) : Q4_K_M livré (évalué sur le jeu secret), Q5_K_M et Q8_0
  refaits. Le lot 4 refait est équivalent au livré (journal, 7 nov. 12 h 30) ; Q4_0 écarté (−0,11 sur dev).
  - Si le modèle refait est équivalent au lot 4 sur dev et dev2 (et par la KL du témoin), publier toute sa famille
    (Q8_0, Q5_K_M, Q4_K_M, Q4_0) et reprendre ses empreintes.
  - Sinon, ne publier que le Q4_K_M actuel (`a4b5f4bc…`), seul à avoir été mesuré sur le jeu secret.
  - Dans les deux cas, le README dit quel fichier a été mesuré sur le jeu secret (avant le changement de métadonnées :
    `a4b5f4bc…` ; mêmes poids après).
- [x] Mesurer la vitesse et la mémoire de chaque quantification retenue sur le Mac (llama-bench, mêmes réglages que
  `mesures/vitesse-lot4-vocfr48k.md`).
- [x] Remplir les `À_COMPLÉTER` du README : tableau des fichiers, empreintes, choix selon la RAM, vitesses.
- [x] Préparer chaque GGUF avec `preparer_gguf.py SOURCE.gguf <quant> <dossier>` (depuis `~/localia-labo`, avec
  `modele-compact/env-entrainement/bin/python -I`). Le script renomme en `Dial-bowe-Guinee-2B-<quant>.gguf`, met
  `general.name`, corrige `general.base_model` (le convertisseur avait écrit Qwen3.5-2B-**Base**, alors que la base
  entraînée est Qwen/Qwen3.5-2B) et retire l'étiquette `image-text-to-text`. Il refuse le fichier si le gabarit
  diffère de `gabarit_sans_reflexion.jinja` ou si un tenseur change, puis écrit l'empreinte dans `SHA256SUMS`.
  Essai du 3 nov. sur le Q4_K_M actuel : 335 tenseurs identiques, SHA-256 `437607848b5a…` (contre `a4b5f4bc…` avant
  les métadonnées), même réponse que l'original à température 0 dans llama-server.
  Fait le 7 nov. dans `~/localia-labo/modele-compact/publication-hf/` ; les fichiers refaits portaient le gabarit
  d'origine de Qwen3.5 (réflexion activable), remplacé avec `--remplacer-gabarit`. Empreintes dans `SHA256SUMS`.
- [x] Essai rapide dans Ollama (guide, étape 4) : 7 nov., Ollama 0.40.14, les trois fichiers ; aucune réflexion même
  avec `think: true`, bonne réponse sur une exception (« gratuit, sauf en cas de perte ») ; 18, 17 et 13 j/s.

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
