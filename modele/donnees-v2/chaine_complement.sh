#!/bin/zsh
# Dial-bowe v2, complément du 14 nov. (accord de l'auteur le 13 nov. : « comble les manques samedi ») :
# - documents : nouvelles demandes globales, d'extraction et de rédaction sous contrainte sur 450 documents déjà
#   sélectionnés (autre graine, fiches « c-… ») ;
# - calcul : 4 calculs et 1 reprise (altérée ou saine) sur les 360 documents riches en nombres, avec la phase A plus
#   stricte et l'indication du professeur en phase B ;
# - pages Internet : 240 fiches de 3 pages (fiches_web.py), nouveau type ;
# - domaines administration et entreprise (ajoutés le 13 nov., accord de l'auteur) : toutes les demandes de l'étape 1.
# Fiches et jeux de données préparés tout de suite ; noyaux GPU lancés après la remise à zéro du quota Kaggle
# (sam. 14 nov., 2 h 15). Journal : $W/ETAT. Ne pas relancer si $W/ETAT existe déjà (reprendre à la main).
# Usage : nohup caffeinate -i zsh chaine_complement.sh > /dev/null 2>&1 &
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
S=~/localia-labo/modele-compact/donnees-v2/sources
W=~/localia-labo/modele-compact/donnees-v2/complement
ICI=~/localia-public/modele/donnees-v2
LOCALIA=~/localia-recherche/src
DEPART="2026-11-14 02:15"
if [[ -e $W/ETAT ]]; then echo "$W/ETAT existe : chaîne déjà lancée"; exit 1; fi
mkdir -p $W
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $W/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }
arret() { etat "ARRÊT : $*"; exit 1; }

attendre() {  # attendre la fin d'un noyau, puis récupérer ses sorties
  local n=$1 dest=$2
  sleep 60
  while kg kernels status mohadial/$n | grep -q "RUNNING\|QUEUED"; do sleep 120; done
  etat "$n : $(kg kernels status mohadial/$n | tail -1)"
  mkdir -p $dest
  (cd $dest && kg kernels output mohadial/$n -p . > /dev/null)
}

donnees() {  # jeu de données privé (nom nouveau)
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

partager() {  # $1 : fichier jsonl, $2 : préfixe de sortie (lots a et b, une ligne sur deux)
  python3 -I - "$1" "$2" <<'EOF'
import sys
L = [l for l in open(sys.argv[1], encoding="utf-8").read().split("\n") if l.strip()]  # pas splitlines : U+2028
for k, x in enumerate("ab"):
    open(f"{sys.argv[2]}-{x}.jsonl", "w", encoding="utf-8").write("\n".join(L[k::2]) + "\n")
EOF
}

etat "=== début complément"
# Fiches (sur le Mac, sans GPU)
python3 -I $ICI/fabriquer_fiches.py $S $W/fiches-doc-anciens.jsonl --max 450 --sauf-domaines administration,entreprise --plan globale:1.6,extraction:0.8,contrainte:1.0 --graine 20261114 --prefixe c- >> $W/ETAT || arret "fiches documents"
# Domaines ajoutés le 13 nov. (administration, entreprise) : composition complète de l'étape 1
python3 -I $ICI/fabriquer_fiches.py $S $W/fiches-doc-nouveaux.jsonl --domaines administration,entreprise --graine 20261115 --prefixe c- >> $W/ETAT || arret "fiches nouveaux domaines"
cat $W/fiches-doc-anciens.jsonl $W/fiches-doc-nouveaux.jsonl > $W/fiches-doc.jsonl
python3 -I $ICI/fiches_calcul.py $S $W/fiches-calcul.jsonl --calcul 4 --reprise --graine 20261114 --prefixe c- >> $W/ETAT || arret "fiches calcul"
python3 -I $ICI/fiches_web.py $S $W/fiches-web.jsonl --max 240 --graine 20261114 >> $W/ETAT || arret "fiches web"
cat $W/fiches-doc.jsonl $W/fiches-calcul.jsonl $W/fiches-web.jsonl > $W/fiches-toutes.jsonl
python3 -I - $W/fiches-toutes.jsonl <<'EOF'
import random, sys  # mélange : chaque lot reçoit autant de fiches de chaque sorte
L = [l for l in open(sys.argv[1], encoding="utf-8").read().split("\n") if l.strip()]
random.Random(20261114).shuffle(L)
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(L) + "\n")
EOF
for x in a b; do mkdir -p $K/donnees-v2d-$x; done
partager $W/fiches-toutes.jsonl $W/fiches-lot
for x in a b; do cp $W/fiches-lot-$x.jsonl $K/donnees-v2d-$x/fiches-v2d-$x.jsonl; done
for x in a b; do
  donnees $K/donnees-v2d-$x localia-donnees-v2d-$x "Dial-bowe v2, complément, lot $x : fiches de documents sous licence ouverte (HAL, arXiv, Wikipédia, Banque mondiale) pour un professeur ouvert (projet Localia). Privé."
done
etat "fiches prêtes : $(wc -l < $W/fiches-toutes.jsonl) ; attente du quota ($DEPART)"

# Attente de la remise à zéro du quota GPU
CIBLE=$(date -j -f "%Y-%m-%d %H:%M" "$DEPART" +%s)
while (( $(date +%s) < CIBLE )); do sleep 300; done

# Phase A
for x in a b; do
  noyau localia-professeur-v2d-$x localia-donnees-v2d-$x
  etat "phase A lot $x lancée"
done
attendre localia-professeur-v2d-a $W/sortie-a &
attendre localia-professeur-v2d-b $W/sortie-b &
wait
cat $W/sortie-a/phase_a.jsonl $W/sortie-b/phase_a.jsonl > $W/phase_a.jsonl 2>/dev/null
[[ -s $W/phase_a.jsonl ]] || arret "phase A vide"
etat "phase A : $(wc -l < $W/phase_a.jsonl) fiches revenues"

# Tâches au format de Localia
python3 -I - $W <<'EOF'
import json, sys  # phase A partagée selon la sorte de fiche
W = sys.argv[1]
for sorte in ("doc", "calcul"):
    ids = {json.loads(l)["fiche"] for l in open(f"{W}/fiches-{sorte}.jsonl", encoding="utf-8")}
    with open(f"{W}/phase_a_{sorte}_brut.jsonl", "w", encoding="utf-8") as f:
        for l in open(f"{W}/phase_a.jsonl", encoding="utf-8"):
            if l.strip() and json.loads(l)["fiche"] in ids:
                f.write(l.rstrip("\n") + "\n")
EOF
python3 -I $ICI/appliquer_calcul.py $W/phase_a_calcul_brut.jsonl $W/fiches-calcul.jsonl $W/phase_a_calcul.jsonl $W/pages-modif > $W/appliquer.json
etat "appliquer calcul : $(python3 -c "import json; print(json.load(open('$W/appliquer.json'))['rejets'])")"
node $ICI/taches_v2.cjs $W/phase_a_doc_brut.jsonl $W/fiches-doc.jsonl $S $LOCALIA $W/taches-doc.jsonl >> $W/ETAT
node $ICI/taches_v2.cjs $W/phase_a_calcul.jsonl $W/fiches-calcul.jsonl $S $LOCALIA $W/taches-calcul.jsonl $W/pages-modif >> $W/ETAT
python3 -I $ICI/appliquer_web.py $W/phase_a.jsonl $W/fiches-web.jsonl $W/taches-web.jsonl > $W/appliquer-web.json
etat "appliquer web : $(python3 -c "import json; d=json.load(open('$W/appliquer-web.json')); print(d['taches'], d['rejets'])")"
cat $W/taches-doc.jsonl $W/taches-calcul.jsonl $W/taches-web.jsonl | grep -v '^$' > $W/taches-toutes.jsonl
etat "tâches : $(wc -l < $W/taches-toutes.jsonl)"
for x in a b; do mkdir -p $K/taches-v2d-$x; done
partager $W/taches-toutes.jsonl $W/taches-lot
for x in a b; do cp $W/taches-lot-$x.jsonl $K/taches-v2d-$x/taches-v2d-$x.jsonl; done

# Phase B
for x in a b; do
  donnees $K/taches-v2d-$x localia-taches-v2d-$x "Dial-bowe v2, complément, phase B, lot $x : demandes au format de Localia sur des documents sous licence ouverte (projet Localia). Privé."
  noyau localia-professeur-v2d-$x-b localia-taches-v2d-$x
  etat "phase B lot $x lancée"
done
attendre localia-professeur-v2d-a-b $W/sortie-a-b &
attendre localia-professeur-v2d-b-b $W/sortie-b-b &
wait
cat $W/sortie-a-b/phase_b.jsonl $W/sortie-b-b/phase_b.jsonl > $W/phase_b.jsonl 2>/dev/null
etat "phase B : $(wc -l < $W/phase_b.jsonl) réponses revenues"

# Vérification
python3 -I $ICI/verifier_v2.py $W/taches-toutes.jsonl $W/phase_b.jsonl $W/exemples-complement.jsonl $W/verification.json > /dev/null
etat "vérification : $(python3 -c "import json; d=json.load(open('$W/verification.json')); print(d['gardés'], 'gardés', d['taux_par_type'])")"
etat "=== fin"
