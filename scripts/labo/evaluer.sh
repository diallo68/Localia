#!/bin/zsh
DEPOT=${0:A:h:h:h}
cd "${LABO:-$HOME/localia-labo}"
ORIG="$HOME/Library/Application Support/localia-desktop/modeles/Qwen3.6-35B-A3B-UD-IQ2_XXS.gguf"
mkdir -p resultats
for pair in "original|$ORIG" "fr-192|$PWD/qwen36-fr-192.gguf" "fr-128|$PWD/qwen36-fr-128.gguf"; do
  name=${pair%%|*}; file=${pair#*|}
  echo "=== $name"
  ./llama.cpp/build/bin/llama-perplexity -m "$file" -f eval/documents-banque.txt -c 512 -t 8 -ngl 0 2>&1 | grep -E "Final estimate|PPL =" | tail -1 | tee resultats/ppl-$name.txt
  node $DEPOT/scripts/mesure-vitesse.mjs "$file" --contexte=2048 --fils=8 --jetons=150 --json=resultats/vitesse-$name.json 2>&1 | grep -v "^\[node-llama-cpp\]" | grep -E "jetons|ÉCHEC"
  node "$DEPOT/scripts/labo/eval-mgsm.mjs" "$file" $DEPOT/benchmark/banque/serie-mgsm-fr.txt --json=resultats/mgsm-$name.json 2>resultats/mgsm-$name.log | tail -1
done
echo FIN
