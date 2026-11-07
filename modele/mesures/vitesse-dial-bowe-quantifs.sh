#!/bin/zsh
# Vitesse et mémoire des fichiers publiés de Dial-bowe-GN-224-2B, même protocole que vitesse-lot4-vocfr48k.md :
# llama-bench, processeur seul (-ngl 0), 8 fils, fa=0, pp1024 et tg64 après 8 192 jetons, passes alternées.
B=~/localia-labo/llama.cpp/build/bin/llama-bench; D=~/localia-labo/modele-compact/publication-hf-gn224
O=~/localia-public/modele/mesures/vitesse-dial-bowe-quantifs.md
echo "# Vitesse des fichiers publiés, processeur seul (-ngl 0), 8 fils, fa=0 ($(date '+%Y-%m-%d %H:%M'))" > $O
for passe in 1 2; do for q in Q8_0 Q5_K_M Q4_K_M; do
  f=$D/Dial-bowe-GN-224-2B-$q.gguf
  echo "== passe $passe $(basename $f) ; $(pmset -g therm | grep -o 'CPU_Speed_Limit.*' | tr -s ' \t' ' ') ; charge $(sysctl -n vm.loadavg | tr -d '{}')" >> $O
  /usr/bin/time -l $B -m $f -ngl 0 -t 8 -fa 0 -p 1024 -n 64 -d 8192 -r 2 2> $O.tmp | grep "qwen35" >> $O
  echo "pic de mémoire (RSS) : $(awk '/maximum resident/ {printf "%.2f", $1/1e9}' $O.tmp) Go" >> $O
done; done; rm -f $O.tmp; echo "fin $(date +%H:%M)" >> $O
