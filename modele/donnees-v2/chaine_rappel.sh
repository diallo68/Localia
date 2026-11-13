#!/bin/zsh
# Dial-bowe v2, étape 2, exemples de rappel (rappel_kaggle.py), sans intervention (accord de l'auteur, 12 nov.) :
# calcul et incohérences sur documents : phase A (professeur), appliquer_calcul.py et taches_v2.cjs
#   sur le Mac, phase B (un seul noyau : au plus deux sessions GPU en même temps), vérification.
# Journal : $W/ETAT.  Usage : zsh chaine_etape2.sh
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
S=~/localia-labo/modele-compact/donnees-v2/sources
W=~/localia-labo/modele-compact/donnees-v2/etape2
ICI=~/localia-public/modele/donnees-v2
LOCALIA=~/localia-recherche/src
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $W/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }

attendre() {
  local n=$1 dest=$2
  sleep 60
  while kg kernels status mohadial/$n | grep -q "RUNNING\|QUEUED"; do sleep 120; done
  etat "$n : $(kg kernels status mohadial/$n | tail -1)"
  mkdir -p $dest
  (cd $dest && kg kernels output mohadial/$n -p . > /dev/null)
}

donnees() {
  local dir=$1 nom=$2 desc=$3
  echo "{\"title\": \"$nom\", \"id\": \"mohadial/$nom\", \"licenses\": [{\"name\": \"other\"}], \"description\": \"$desc\"}" > $dir/dataset-metadata.json
  kg datasets create -p $dir | tail -1
  until kg datasets status mohadial/$nom | grep -q ready; do sleep 20; done
}

noyau() {  # nom, script, jeux de données (séparés par des virgules, entre guillemets JSON)
  local nom=$1 script=$2 jeux=$3
  mkdir -p $K/$nom
  cp $script $K/$nom/script.py
  cat > $K/$nom/kernel-metadata.json <<EOF
{"id": "mohadial/$nom", "title": "$nom", "code_file": "script.py", "language": "python", "kernel_type": "script",
 "is_private": true, "enable_gpu": true, "enable_internet": true, "machine_shape": "NvidiaTeslaT4",
 "dataset_sources": [$jeux], "competition_sources": [], "kernel_sources": []}
EOF
  kg kernels push -p $K/$nom | tail -1
}

etat "=== début rappel"
# Rappel
noyau localia-rappel-v2 $ICI/rappel_kaggle.py '"mohadial/localia-base-vocfr48k", "mohadial/localia-llama-bin-cuda"'
etat "rappel lancé"
attendre localia-rappel-v2 $W/sortie-rappel

# Fin du rappel
python3 -I $ICI/verifier_rappel.py $W/sortie-rappel/rappel_jugement.jsonl $W/exemples-rappel.jsonl $W/verification-rappel.json > /dev/null
etat "rappel vérifié : $(python3 -c "import json; d=json.load(open('$W/verification-rappel.json')); print(d['gardés'], 'gardés', d['taux'])")"
etat "=== fin rappel"
