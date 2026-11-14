#!/bin/zsh
# Dial-bowe v2, reprise du complément (14 nov.) : la chaîne du 14 nov. (chaine_complement.sh) a fini avec les seules
# tâches web. Fiches documents et calcul de même identifiant (« c-<document> », 231 documents) : la phase A avait été
# mal partagée entre les deux sortes, et des nombres non finis (Infinity) faisaient échouer taches_v2.cjs.
# Corrigé à la main sur le Mac le 14 nov. : phase A repartagée selon les types de demandes, tâches calcul renommées
# « k-… », résultats web gardés (exemples-web.jsonl). Ce script lance la phase B des tâches documents et calcul, puis
# la vérification, et assemble les exemples du complément.
# Usage : nohup caffeinate -i zsh reprise_complement.sh > /dev/null 2>&1 &
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
W=~/localia-labo/modele-compact/donnees-v2/complement
ICI=~/localia-public/modele/donnees-v2
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $W/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }
arret() { etat "ARRÊT : $*"; exit 1; }
[[ -s $W/taches-doc.jsonl && -s $W/taches-calcul.jsonl ]] || { echo "tâches absentes"; exit 1; }
grep -q "=== reprise" $W/ETAT && { echo "reprise déjà lancée"; exit 1; }

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
noyau() {
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

etat "=== reprise : tâches documents $(wc -l < $W/taches-doc.jsonl), calcul $(wc -l < $W/taches-calcul.jsonl)"
cat $W/taches-doc.jsonl $W/taches-calcul.jsonl | grep -v '^$' > $W/taches-dc.jsonl
python3 -I - $W/taches-dc.jsonl $W/taches-dc-lot <<'EOF'
import random, sys  # mélange puis deux lots égaux
L = [l for l in open(sys.argv[1], encoding="utf-8").read().split("\n") if l.strip()]
random.Random(20261114).shuffle(L)
for k, x in enumerate("ab"):
    open(f"{sys.argv[2]}-{x}.jsonl", "w", encoding="utf-8").write("\n".join(L[k::2]) + "\n")
EOF
for x in a b; do
  mkdir -p $K/taches-v2e-$x && cp $W/taches-dc-lot-$x.jsonl $K/taches-v2e-$x/taches-v2e-$x.jsonl
  donnees $K/taches-v2e-$x localia-taches-v2e-$x "Dial-bowe v2, complément (reprise), phase B, lot $x : demandes au format de Localia sur des documents sous licence ouverte (projet Localia). Privé."
  noyau localia-professeur-v2e-$x-b localia-taches-v2e-$x
  etat "phase B (reprise) lot $x lancée"
done
attendre localia-professeur-v2e-a-b $W/sortie-e-a-b &
attendre localia-professeur-v2e-b-b $W/sortie-e-b-b &
wait
cat $W/sortie-e-a-b/phase_b.jsonl $W/sortie-e-b-b/phase_b.jsonl > $W/phase_b_dc.jsonl 2>/dev/null
[[ -s $W/phase_b_dc.jsonl ]] || arret "phase B vide"
etat "phase B (reprise) : $(wc -l < $W/phase_b_dc.jsonl) réponses revenues"
python3 -I $ICI/verifier_v2.py $W/taches-dc.jsonl $W/phase_b_dc.jsonl $W/exemples-dc.jsonl $W/verification-dc.json > /dev/null
etat "vérification : $(python3 -c "import json; d=json.load(open('$W/verification-dc.json')); print(d['gardés'], 'gardés', d['taux_par_type'])")"
cat $W/exemples-dc.jsonl $W/exemples-web.jsonl | grep -v '^$' > $W/exemples-complement.jsonl
etat "exemples du complément : $(wc -l < $W/exemples-complement.jsonl)"
etat "=== fin reprise"
