#!/bin/zsh
# Dial-bowe v2, étape 1 enchaînée sans intervention : phase A sur Kaggle (deux lots en parallèle), tâches au format
# de Localia sur le Mac, phase B sur Kaggle (deux lots), puis vérification. Journal : $W/ETAT.
# Usage : zsh chaine_etape1.sh
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
S=~/localia-labo/modele-compact/donnees-v2/sources
W=~/localia-labo/modele-compact/donnees-v2/etape1
ICI=~/localia-public/modele/donnees-v2
LOCALIA=~/localia-recherche/src
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $W/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }

attendre() {  # attendre la fin d'un noyau, puis récupérer ses sorties
  local n=$1 dest=$2
  sleep 60
  while kg kernels status mohadial/$n | grep -q "RUNNING\|QUEUED"; do sleep 120; done
  etat "$n : $(kg kernels status mohadial/$n | tail -1)"
  mkdir -p $dest
  (cd $dest && kg kernels output mohadial/$n -p . > /dev/null)
}

donnees() {  # jeu de données privé : création, ou nouvelle version s'il existe
  local dir=$1 nom=$2 desc=$3
  echo "{\"title\": \"$nom\", \"id\": \"mohadial/$nom\", \"licenses\": [{\"name\": \"other\"}], \"description\": \"$desc\"}" > $dir/dataset-metadata.json
  kg datasets create -p $dir | tail -1
  until kg datasets status mohadial/$nom | grep -q ready; do sleep 20; done
}

noyau() {  # noyau du professeur sur un jeu de données
  local nom=$1 jeu=$2
  mkdir -p $K/$nom
  cp $ICI/professeur_v2_kaggle.py $K/$nom/professeur.py
  cat > $K/$nom/kernel-metadata.json <<EOF
{"id": "mohadial/$nom", "title": "$nom", "code_file": "professeur.py", "language": "python", "kernel_type": "script",
 "is_private": true, "enable_gpu": true, "enable_internet": true, "machine_shape": "NvidiaTeslaT4",
 "dataset_sources": ["mohadial/$jeu", "mohadial/localia-llama-bin-cuda"], "competition_sources": [], "kernel_sources": []}
EOF
  kg kernels push -p $K/$nom | tail -1
}

etat "=== début étape 1"
# Phase A
for x in a b; do
  donnees $K/donnees-v2-$x localia-donnees-v2-$x "Dial-bowe v2, étape 1, lot $x : fiches de documents sous licence ouverte (HAL, arXiv, Wikipédia, Banque mondiale) pour un professeur ouvert (projet Localia). Privé."
  noyau localia-professeur-v2-$x localia-donnees-v2-$x
  etat "phase A lot $x lancée"
done
attendre localia-professeur-v2-a $W/sortie-a &
attendre localia-professeur-v2-b $W/sortie-b &
wait
cat $W/sortie-a/phase_a.jsonl $W/sortie-b/phase_a.jsonl > $W/phase_a.jsonl
etat "phase A : $(wc -l < $W/phase_a.jsonl) fiches revenues"

# Tâches au format de Localia
node $ICI/taches_v2.cjs $W/phase_a.jsonl $W/fiches-toutes.jsonl $S $LOCALIA $W/taches-toutes.jsonl >> $W/ETAT
for x in a b; do mkdir -p $K/taches-v2-$x; done
python3 -I - <<EOF
L = [l for l in open("$W/taches-toutes.jsonl", encoding="utf-8").read().split("\n") if l.strip()]  # pas splitlines : U+2028 dans les textes
open("$K/taches-v2-a/taches-v2-a.jsonl", "w").write("\n".join(L[0::2]) + "\n")
open("$K/taches-v2-b/taches-v2-b.jsonl", "w").write("\n".join(L[1::2]) + "\n")
EOF

# Phase B
for x in a b; do
  donnees $K/taches-v2-$x localia-taches-v2-$x "Dial-bowe v2, étape 1, phase B, lot $x : demandes au format de Localia sur des documents sous licence ouverte (projet Localia). Privé."
  noyau localia-professeur-v2-$x-b localia-taches-v2-$x
  etat "phase B lot $x lancée"
done
attendre localia-professeur-v2-a-b $W/sortie-a-b &
attendre localia-professeur-v2-b-b $W/sortie-b-b &
wait
cat $W/sortie-a-b/phase_b.jsonl $W/sortie-b-b/phase_b.jsonl > $W/phase_b.jsonl
etat "phase B : $(wc -l < $W/phase_b.jsonl) réponses revenues"

# Vérification
python3 -I $ICI/verifier_v2.py $W/taches-toutes.jsonl $W/phase_b.jsonl $W/exemples-documents.jsonl $W/verification.json > /dev/null
etat "vérification : $(python3 -c "import json; d=json.load(open('$W/verification.json')); print(d['gardés'], 'gardés', d['taux_par_type'])")"
etat "=== fin"
