#!/bin/zsh
# Dial-bowe v2 : essai du SFT (accord de l'auteur du 14 nov.). Attend la fin de reprise_complement.sh (les deux
# sessions GPU sont prises jusque-là), assemble le lot SFT (abstention et réponse partielle plafonnées à 500,
# plan §5.2), l'envoie sur Kaggle avec sft_v2_entrainement.py et lance le noyau en mode « essai » : mémoire et
# temps par longueur jusqu'à 16 384 jetons sur chaque T4, 6 pas réels sur les deux cartes, reprise relue ;
# deux fois : DeltaNet en PyTorch pur (recette v1), puis avec flash-linear-attention.
# Résultats : ~/localia-labo/modele-compact/resultats/sft-v2/essai/essai-{reference,fla}.json ; état : …/sft-v2/ETAT.
# Usage : nohup caffeinate -i zsh chaine_essai_sft.sh > /dev/null 2>&1 &
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
K=~/localia-labo/modele-compact/kaggle
D=~/localia-labo/modele-compact/donnees-v2
R=~/localia-labo/modele-compact/resultats/sft-v2
ICI=~/localia-public/modele/donnees-v2
mkdir -p $R
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $R/ETAT; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }
[[ -e $R/ETAT ]] && { echo "déjà lancée ($R/ETAT)"; exit 1; }

etat "=== essai SFT : attente de la fin de la reprise du complément"
until grep -q "=== fin reprise\|ARRÊT" $D/complement/ETAT; do sleep 300; done
etat "reprise : $(tail -1 $D/complement/ETAT)"

mkdir -p $K/sft-v2-donnees
entrees=($D/etape1/exemples-documents.jsonl $D/etape2/exemples-calcul.jsonl $D/etape2/exemples-rappel.jsonl)
if [[ -s $D/complement/exemples-complement.jsonl ]]; then entrees+=($D/complement/exemples-complement.jsonl)
else entrees+=($D/complement/exemples-web.jsonl); fi
python3 -I $ICI/assembler_sft.py $K/sft-v2-donnees/exemples.jsonl $R/releve-lot.json $entrees \
  --plafond abstention=500 > /dev/null || { etat "ARRÊT : assemblage"; exit 1; }
cp $ICI/sft_v2_entrainement.py $K/sft-v2-donnees/
etat "lot assemblé : $(wc -l < $K/sft-v2-donnees/exemples.jsonl) exemples ($(python3 -c "import json; print(json.load(open('$R/releve-lot.json'))['langues'])"))"

echo '{"title": "localia-sft-v2-donnees", "id": "mohadial/localia-sft-v2-donnees", "licenses": [{"name": "other"}], "description": "Dial-bowe v2 : lot SFT (exemples vérifiés, documents sous licence ouverte) et script d entraînement (projet Localia). Privé."}' > $K/sft-v2-donnees/dataset-metadata.json
kg datasets create -p $K/sft-v2-donnees | tail -1
until kg datasets status mohadial/localia-sft-v2-donnees | grep -q ready; do sleep 30; done
etat "jeu de données prêt"

N=localia-sft-v2-essai
mkdir -p $K/$N
cp $ICI/sft_v2_kaggle.py $K/$N/sft.py  # MODE = "essai" par défaut
cat > $K/$N/kernel-metadata.json <<EOF
{"id": "mohadial/$N", "title": "$N", "code_file": "sft.py", "language": "python", "kernel_type": "script",
 "is_private": true, "enable_gpu": true, "enable_internet": true, "machine_shape": "NvidiaTeslaT4",
 "dataset_sources": ["mohadial/localia-sft-v2-donnees", "mohadial/localia-elagage"], "competition_sources": [], "kernel_sources": []}
EOF
kg kernels push -p $K/$N | tail -1
etat "noyau $N lancé"
sleep 60
while kg kernels status mohadial/$N | grep -q "RUNNING\|QUEUED"; do sleep 120; done
etat "$N : $(kg kernels status mohadial/$N | tail -1)"
mkdir -p $R/essai
(cd $R/essai && kg kernels output mohadial/$N -p . > /dev/null)
for v in reference fla; do
  if [[ -s $R/essai/essai-$v.json ]]; then
    etat "essai $v : $(python3 -c "import json; d=json.load(open('$R/essai/essai-$v.json')); print(d.get('pas', d['mesures'][-1]))")"
  else
    etat "essai $v : pas de résultat (voir $R/essai/*.log)"
  fi
done
etat "=== fin essai"
