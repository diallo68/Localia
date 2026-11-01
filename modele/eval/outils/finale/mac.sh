#!/bin/zsh
# Fait passer un jeu à nos modèles 2B sur le Mac (processeur, comme dev et dev2), avec les contrôles de l'étape 3.5 :
# port libre, serveur vivant sous un alias vérifié, empreinte du GGUF, trois passes d'executer.py (seuls les cas en
# erreur sont retentés). Usage : mac.sh <dossier du jeu> <dossier de sortie> [--ids a,b,c]
setopt nullglob
cd ~/localia-labo/modele-compact
J=$1; R=$2; shift 2
EXE=~/localia-public/modele/eval/outils/executer.py
for arg in base=bases/pilote-2.5/qwen35-2b-base-Q4_K_M.gguf lot4=bases/lot4/gguf/qwen35-2b-lora-Q4_K_M-sansreflexion-vocfr48k.gguf; do
  nom=${arg%%=*}; M=${arg#*=}
  if curl -s -m 2 http://127.0.0.1:8081/health > /dev/null; then echo "$nom : port 8081 déjà occupé" >&2; exit 1; fi
  echo "{\"modele\": \"$nom\", \"fichier\": \"$M\", \"sha256\": \"$(shasum -a 256 $M | cut -d' ' -f1)\", \"llama\": \"$(/usr/local/bin/llama-server --version 2>&1 | grep version | tr -d '"')\"}" >> $R/manifeste-mac.jsonl
  /usr/local/bin/llama-server -m $M -a $nom -c 8192 -t 8 -fa off --jinja --port 8081 --host 127.0.0.1 -np 1 > $R/serveur-$nom.log 2>&1 &
  pid=$!
  pret=0
  for i in $(seq 1 150); do
    kill -0 $pid 2>/dev/null || break
    curl -s http://127.0.0.1:8081/health | grep -q ok && { pret=1; break; }
    sleep 2
  done
  servi=$(curl -s http://127.0.0.1:8081/v1/models | python3 -c "import json,sys; print(','.join(m['id'] for m in json.load(sys.stdin)['data']))" 2>/dev/null)
  if [[ $pret != 1 || $servi != $nom ]]; then echo "$nom : serveur pas prêt ou modèle servi inattendu ($servi)" >&2; kill $pid 2>/dev/null; exit 1; fi
  for passe in 1 2 3; do
    /usr/local/bin/python3.12 -I $EXE $J $R/secret-$nom.jsonl --url http://127.0.0.1:8081/v1 --modele $nom $@ >> $R/executer-$nom.log 2>&1
    kill -0 $pid 2>/dev/null || { echo "$nom : le serveur s'est arrêté" >&2; exit 1; }
  done
  kill $pid; wait $pid 2>/dev/null
done
