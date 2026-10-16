# Labo : élagage personnalisé des experts d'un modèle MoE

Outils expérimentaux pour faire tenir un gros modèle à experts (MoE) sur un petit PC, en retirant
les experts que l'usage de l'utilisateur ne sollicite presque jamais (idée de REAP). Les poids gardés
sont recopiés octet pour octet : la quantification d'origine est conservée. Résultats et limites :
[docs/ELAGAGE-EXPERTS.md](../../docs/ELAGAGE-EXPERTS.md).

Rien de tout cela n'est utilisé par l'application.

## Préparer le labo (hors du dépôt, `~/localia-labo` par défaut)

```sh
git clone https://github.com/ggml-org/llama.cpp ~/localia-labo/llama.cpp
cd ~/localia-labo/llama.cpp && git checkout 7fe450e19     # version embarquée par node-llama-cpp 3.22.1
mkdir examples/moe-stats && cp <dépôt>/scripts/labo/{moe-stats.cpp,CMakeLists.txt} examples/moe-stats/
echo 'add_subdirectory(moe-stats)' >> examples/CMakeLists.txt
cmake -B build -DGGML_METAL=OFF && cmake --build build -j8 --target llama-moe-stats llama-perplexity
pip install gguf numpy
```

## Étapes

1. **Statistiques d'usage** sur des textes représentatifs (ici 77 fichiers en français, ~56 000 jetons) :
   `llama-moe-stats -m modele.gguf -c 512 -t 8 --out stats.json calibration/*.txt`
   Pour chaque couche et chaque expert : nombre de routages, somme des poids de routage, score REAP.
2. **Élagage** : `python3 prune-gguf.py modele.gguf stats.json sortie.gguf --garder 192`
   (`--garder 256` sur Qwen3.6-35B-A3B produit une copie identique octet pour octet, ce qui vérifie l'outil).
3. **Évaluation** : `evaluer.sh` enchaîne perplexité (`llama-perplexity` sur des textes absents de
   la calibration), vitesse et mémoire (`scripts/mesure-vitesse.mjs`) et calcul (`eval-mgsm.mjs`,
   15 problèmes MGSM en français corrigés automatiquement).
