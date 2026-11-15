#!/bin/zsh
# Dial-bowe v2 : SFT complet (plan §6), après l'essai du 14 nov. (8 192 jetons au plus sur une T4).
# 1. assemble le lot (documents, calcul, rappel, complément, schémas Mermaid ; abstention plafonnée à 500) ;
# 2. raccourcit les exemples de plus de 8 000 jetons (raccourcir_8k.py, accord de l'auteur du 14 nov.) ;
# 3. publie une nouvelle version du jeu localia-sft-v2-donnees ;
# 4. lance le noyau localia-sft-v2 (MODE = « sft ») ; s'il s'arrête sur la garde de 11 h sans fini.json, envoie
#    reprise.pt dans le jeu localia-sft-v2-reprise et relance (3 sessions au plus) ;
# 5. télécharge la sortie (adaptateur, GGUF F16, Q8_0, Q5_K_M, Q4_K_M, vocfr48k) dans resultats/sft-v2/final.
# État : ~/localia-labo/modele-compact/resultats/sft-v2/ETAT-sft.
# Usage : nohup caffeinate -i zsh chaine_sft_v2.sh [heures de la 1re session, 11 par défaut] [session 2 pas avant « AAAA-MM-JJ HH:MM »] > /dev/null 2>&1 &
# Attente de la session 2 (quota Kaggle épuisé) : levée plus tôt si le fichier resultats/sft-v2/SANS-ATTENTE existe.
# Reprise après arrêt de la chaîne : DEBUT=2 zsh chaine_sft_v2.sh <heures de cette session> (lot et reprise.pt
# déjà publiés ; repart de la session DEBUT).
set -u
KG=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
PY=~/localia-labo/modele-compact/env-entrainement/bin/python
K=~/localia-labo/modele-compact/kaggle
D=~/localia-labo/modele-compact/donnees-v2
R=~/localia-labo/modele-compact/resultats/sft-v2
ICI=~/localia-public/modele/donnees-v2
E=$R/ETAT-sft
mkdir -p $R
etat() { echo "$(date '+%d/%m %H:%M') $*" >> $E; }
kg() { $KG "$@" 2>&1 | grep -v "outdated"; }
DEBUT=${DEBUT:-1}
[[ -e $E && $DEBUT == 1 ]] && { echo "déjà lancée ($E)"; exit 1; }
N=localia-sft-v2
if [[ $DEBUT == 1 ]]; then
etat "=== SFT v2 : assemblage"
entrees=($D/etape1/exemples-documents.jsonl $D/etape2/exemples-calcul.jsonl $D/etape2/exemples-rappel.jsonl
         $D/complement/exemples-complement.jsonl $D/mermaid/exemples-mermaid.jsonl)
for f in $entrees; do [[ -s $f ]] || { etat "ARRÊT : $f absent"; exit 1; }; done
python3 -I $ICI/assembler_sft.py $R/lot-brut.jsonl $R/releve-lot-final.json $entrees \
  --plafond abstention=500 > /dev/null || { etat "ARRÊT : assemblage"; exit 1; }
etat "lot assemblé : $(wc -l < $R/lot-brut.jsonl) exemples"
$PY -I $ICI/raccourcir_8k.py $R/lot-brut.jsonl $K/sft-v2-donnees/exemples.jsonl $R/raccourci-8k.json > /dev/null \
  || { etat "ARRÊT : raccourcissement"; exit 1; }
etat "lot 8k : $(python3 -c "import json; d=json.load(open('$R/raccourci-8k.json')); print(d['total gardés'], 'exemples,', d['jetons après'], 'jetons ; raccourcis', dict(d['raccourcis']))")"
cp $ICI/sft_v2_entrainement.py $K/sft-v2-donnees/
kg datasets version -p $K/sft-v2-donnees -m "lot final 8k (raccourci), schémas Mermaid" | tail -1
sleep 30
until kg datasets status mohadial/localia-sft-v2-donnees | grep -q ready; do sleep 30; done
etat "jeu de données publié"
else
etat "=== SFT v2 : reprise de la chaîne à la session $DEBUT"
fi

mkdir -p $K/$N
sed 's/^MODE = "essai"$/MODE = "sft"/' $ICI/sft_v2_kaggle.py > $K/$N/sft.py
grep -q '^MODE = "sft"$' $K/$N/sft.py || { etat "ARRÊT : MODE non réécrit"; exit 1; }
sources='"mohadial/localia-sft-v2-donnees", "mohadial/localia-elagage"'
(( DEBUT > 1 )) && sources="$sources"', "mohadial/localia-sft-v2-reprise"'
H1=${1:-11}
for session in $(seq $DEBUT 3); do
  h=$([[ $session == $DEBUT ]] && echo $H1 || echo 11)
  if [[ $session == 2 && $DEBUT == 1 && -n "${2:-}" ]]; then
    etat "session 2 : attente jusqu'au $2 (ou fichier $R/SANS-ATTENTE)"
    cible=$(date -j -f "%Y-%m-%d %H:%M" "$2" +%s)
    until (( $(date +%s) >= cible )) || [[ -e $R/SANS-ATTENTE ]]; do sleep 600; done
  fi
  sed -i '' "s/^HEURES_MAX = .*/HEURES_MAX = $h/" $K/$N/sft.py
  cat > $K/$N/kernel-metadata.json <<EOF
{"id": "mohadial/$N", "title": "$N", "code_file": "sft.py", "language": "python", "kernel_type": "script",
 "is_private": true, "enable_gpu": true, "enable_internet": true, "machine_shape": "NvidiaTeslaT4",
 "dataset_sources": [$sources], "competition_sources": [], "kernel_sources": []}
EOF
  kg kernels push -p $K/$N | tail -1
  etat "session $session lancée (garde : $h h)"
  sleep 120
  while kg kernels status mohadial/$N | grep -q "RUNNING\|QUEUED"; do sleep 300; done
  etat "session $session : $(kg kernels status mohadial/$N | tail -1)"
  S=$R/session-$session
  mkdir -p $S
  (cd $S && kg kernels output mohadial/$N -p . > /dev/null)
  if [[ -e $S/fini.json ]]; then
    rm -rf $R/final && mv $S $R/final
    etat "fini : $(cat $R/final/fini.json | head -c 400)"
    etat "GGUF : $(cd $R/final/gguf && ls *.gguf 2>/dev/null | tr "\n" " ")"
    etat "=== fin SFT"
    exit 0
  fi
  [[ -s $S/reprise.pt ]] || { etat "ARRÊT : ni fini.json ni reprise.pt (voir $S/*.log)"; exit 1; }
  mkdir -p $K/sft-v2-reprise
  cp $S/reprise.pt $K/sft-v2-reprise/reprise.pt
  if [[ ! -e $K/sft-v2-reprise/dataset-metadata.json ]]; then
    echo '{"title": "localia-sft-v2-reprise", "id": "mohadial/localia-sft-v2-reprise", "licenses": [{"name": "other"}], "description": "Dial-bowe v2 : point de reprise du SFT entre deux sessions (projet Localia). Privé."}' > $K/sft-v2-reprise/dataset-metadata.json
    kg datasets create -p $K/sft-v2-reprise | tail -1
  else
    kg datasets version -p $K/sft-v2-reprise -m "reprise après la session $session" | tail -1
  fi
  sleep 30
  until kg datasets status mohadial/localia-sft-v2-reprise | grep -q ready; do sleep 30; done
  etat "reprise.pt de la session $session publiée"
  sources='"mohadial/localia-sft-v2-donnees", "mohadial/localia-elagage", "mohadial/localia-sft-v2-reprise"'
done
etat "ARRÊT : 3 sessions sans fin"
