#!/bin/zsh
# Dial-bowe v2, étape 2, reprise du 13 nov. (demandes perdues par mes scripts, récupérées sans nouvelle phase A) :
# - rappel : 654 demandes dont la clé était nommée autrement, réponses de la base et notes ;
# - calcul : 264 tâches nouvelles (page d'opérande ou d'insertion corrigée par programme).
# Ancienne description de l'étape 2 : calcul et incohérences sur documents : phase A (professeur), appliquer_calcul.py et taches_v2.cjs
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

etat "=== début reprise"
mkdir -p $K/rappel-v2-prec && cp $W/sortie-rappel/rappel_{demandes,reponses,jugement}.jsonl $K/rappel-v2-prec/
donnees $K/rappel-v2-prec localia-rappel-v2-prec "Dial-bowe v2 : sorties du premier passage du rappel, pour reprise (projet Localia). Privé."
noyau localia-rappel-v2 $ICI/rappel_kaggle.py '"mohadial/localia-rappel-v2-prec", "mohadial/localia-base-vocfr48k", "mohadial/localia-llama-bin-cuda"'
etat "rappel (reprise) lancé"
attendre localia-rappel-v2 $W/sortie-rappel-2 &
R=$!

python3 -I - <<PY
import json
vieux = {json.loads(l)["id"] for l in open("$W/taches-calcul.jsonl", encoding="utf-8")}
neuf = [l for l in open("$W/taches-calcul-2.jsonl", encoding="utf-8").read().split("\n") if l.strip() and json.loads(l)["id"] not in vieux]
open("$W/taches-calcul-reprise.jsonl", "w", encoding="utf-8").write("\n".join(neuf) + "\n")
PY
mkdir -p $K/taches-calcul-v2b && cp $W/taches-calcul-reprise.jsonl $K/taches-calcul-v2b/taches-calcul-reprise.jsonl
donnees $K/taches-calcul-v2b localia-taches-calcul-v2b "Dial-bowe v2, étape 2, reprise : demandes de calcul et d'incohérence au format de Localia (projet Localia). Privé."
noyau localia-professeur-calcul-b2 $ICI/professeur_v2_kaggle.py '"mohadial/localia-taches-calcul-v2b", "mohadial/localia-llama-bin-cuda"'
etat "calcul (reprise) lancé : $(wc -l < $W/taches-calcul-reprise.jsonl) tâches"
attendre localia-professeur-calcul-b2 $W/sortie-b2
wait $R

cat $W/taches-calcul.jsonl $W/taches-calcul-reprise.jsonl > $W/taches-calcul-toutes.jsonl
cat $W/sortie-b/phase_b.jsonl $W/sortie-b2/phase_b.jsonl > $W/phase_b-calcul-toutes.jsonl
python3 -I $ICI/verifier_v2.py $W/taches-calcul-toutes.jsonl $W/phase_b-calcul-toutes.jsonl $W/exemples-calcul.jsonl $W/verification-calcul.json > /dev/null
etat "calcul vérifié : $(python3 -c "import json; d=json.load(open('$W/verification-calcul.json')); print(d['gardés'], 'gardés', d['taux_par_type'])")"
python3 -I $ICI/verifier_rappel.py $W/sortie-rappel-2/rappel_jugement.jsonl $W/exemples-rappel.jsonl $W/verification-rappel.json > /dev/null
etat "rappel vérifié : $(python3 -c "import json; d=json.load(open('$W/verification-rappel.json')); print(d['gardés'], 'gardés', d['taux'])")"
etat "=== fin reprise"
