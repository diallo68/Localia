#!/bin/zsh
# Dial-bowe v2, étape 2 (le rappel est à part : chaine_rappel.sh) enchaînée sans intervention (accord de l'auteur, 12 nov.) :
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

etat "=== début étape 2 (calcul)"
# Calcul et incohérences : phase A
mkdir -p $K/calcul-v2-a && cp $W/fiches-calcul.jsonl $K/calcul-v2-a/fiches-calcul.jsonl
donnees $K/calcul-v2-a localia-calcul-v2-a "Dial-bowe v2, étape 2 : fiches de documents sous licence ouverte pour des questions de calcul et d'incohérence (projet Localia). Privé."
noyau localia-professeur-calcul-a $ICI/professeur_v2_kaggle.py '"mohadial/localia-calcul-v2-a", "mohadial/localia-llama-bin-cuda"'
etat "calcul phase A lancée"
attendre localia-professeur-calcul-a $W/sortie-a
etat "calcul phase A : $(wc -l < $W/sortie-a/phase_a.jsonl) fiches revenues"

python3 -I $ICI/appliquer_calcul.py $W/sortie-a/phase_a.jsonl $W/fiches-calcul.jsonl $W/phase_a_complet.jsonl $W/pages-modif > $W/appliquer.json
etat "appliquer : $(python3 -c "import json; print(json.load(open('$W/appliquer.json'))['rejets'])")"
node $ICI/taches_v2.cjs $W/phase_a_complet.jsonl $W/fiches-calcul.jsonl $S $LOCALIA $W/taches-calcul.jsonl $W/pages-modif >> $W/ETAT

# Phase B (un seul noyau)
mkdir -p $K/taches-calcul-v2 && cp $W/taches-calcul.jsonl $K/taches-calcul-v2/taches-calcul.jsonl
python3 -I -c "import json; [json.loads(l) for l in open('$K/taches-calcul-v2/taches-calcul.jsonl', encoding='utf-8')]" || { etat "tâches illisibles"; exit 1; }
donnees $K/taches-calcul-v2 localia-taches-calcul-v2 "Dial-bowe v2, étape 2, phase B : demandes de calcul et d'incohérence au format de Localia (projet Localia). Privé."
noyau localia-professeur-calcul-b $ICI/professeur_v2_kaggle.py '"mohadial/localia-taches-calcul-v2", "mohadial/localia-llama-bin-cuda"'
etat "calcul phase B lancée"
attendre localia-professeur-calcul-b $W/sortie-b
etat "calcul phase B : $(wc -l < $W/sortie-b/phase_b.jsonl) réponses revenues"
python3 -I $ICI/verifier_v2.py $W/taches-calcul.jsonl $W/sortie-b/phase_b.jsonl $W/exemples-calcul.jsonl $W/verification-calcul.json > /dev/null
etat "calcul vérifié : $(python3 -c "import json; d=json.load(open('$W/verification-calcul.json')); print(d['gardés'], 'gardés', d['taux_par_type'])")"

etat "=== fin calcul"
