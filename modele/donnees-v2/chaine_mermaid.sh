#!/bin/zsh
# Dial-bowe v2 : exemples de schémas en Mermaid (accord de l'auteur du 14 nov. 2026). Attend la fin de la reprise
# du complément (deux sessions GPU prises), lance mermaid_kaggle.py sur Kaggle (professeur Qwen3.6-35B-A3B), puis
# trie les réponses sur le Mac (verifier_mermaid.cjs) : exemples-mermaid.jsonl, à joindre au lot SFT.
# État : ~/localia-labo/modele-compact/donnees-v2/mermaid/ETAT.
# Usage : nohup caffeinate -i zsh chaine_mermaid.sh > /dev/null 2>&1 &
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
D=~/localia-labo/modele-compact/donnees-v2
W=$D/mermaid
ICI=~/localia-public/modele/donnees-v2
mkdir -p $W
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $W/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }
[[ -e $W/ETAT ]] && { echo "déjà lancée ($W/ETAT)"; exit 1; }

etat "=== schémas Mermaid : attente de la fin de la reprise du complément"
until grep -q "=== fin reprise\|ARRÊT" $D/complement/ETAT; do sleep 300; done

N=localia-mermaid-v2
mkdir -p $K/$N
cp $ICI/mermaid_kaggle.py $K/$N/mermaid.py
cat > $K/$N/kernel-metadata.json <<EOF
{"id": "mohadial/$N", "title": "$N", "code_file": "mermaid.py", "language": "python", "kernel_type": "script",
 "is_private": true, "enable_gpu": true, "enable_internet": true, "machine_shape": "NvidiaTeslaT4",
 "dataset_sources": ["mohadial/localia-llama-bin-cuda"], "competition_sources": [], "kernel_sources": []}
EOF
kg kernels push -p $K/$N | tail -1
etat "noyau $N lancé"
sleep 60
while kg kernels status mohadial/$N | grep -q "RUNNING\|QUEUED"; do sleep 120; done
etat "$N : $(kg kernels status mohadial/$N | tail -1)"
mkdir -p $W/sortie
(cd $W/sortie && kg kernels output mohadial/$N -p . > /dev/null)
[[ -s $W/sortie/mermaid_jugement.jsonl ]] || { etat "ARRÊT : pas de mermaid_jugement.jsonl"; exit 1; }
etat "réponses notées : $(wc -l < $W/sortie/mermaid_jugement.jsonl)"
node $ICI/verifier_mermaid.cjs $W/sortie/mermaid_jugement.jsonl $W/exemples-mermaid.jsonl $W/verification.json \
  > /dev/null || { etat "ARRÊT : vérification"; exit 1; }
etat "vérification : $(python3 -c "import json; d=json.load(open('$W/verification.json')); print(d['gardés'], 'gardés sur', d['total'], d['par_sorte'])")"
etat "=== fin"
