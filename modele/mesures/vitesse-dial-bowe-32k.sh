#!/bin/zsh
# Même protocole que vitesse-dial-bowe-quantifs.sh, après 32 768 jetons, une passe.
B=~/localia-labo/llama.cpp/build/bin/llama-bench; D=~/localia-labo/modele-compact/publication-hf-gn224
O=~/localia-public/modele/mesures/vitesse-dial-bowe-32k.md
echo "# Après 32 768 jetons, processeur seul (-ngl 0), 8 fils, fa=0, -r 1 ($(date '+%Y-%m-%d %H:%M'))" > $O
for q in Q4_K_M Q8_0; do
  echo "== $q ; $(pmset -g therm | grep -o 'CPU_Speed_Limit.*' | tr -s ' \t' ' ') ; charge $(sysctl -n vm.loadavg | tr -d '{}') ; $(memory_pressure | grep -o 'free percentage.*')" >> $O
  /usr/bin/time -l $B -m $D/Dial-bowe-GN-224-2B-$q.gguf -ngl 0 -t 8 -fa 0 -p 1024 -n 64 -d 32768 -r 1 2> $O.tmp | grep "qwen35" >> $O
  echo "pic de mémoire (RSS) : $(awk '/maximum resident/ {printf "%.2f", $1/1e9}' $O.tmp) Go ; $(awk '/real/ {print $1" s"}' $O.tmp)" >> $O
done; rm -f $O.tmp; echo "fin $(date +%H:%M)" >> $O
