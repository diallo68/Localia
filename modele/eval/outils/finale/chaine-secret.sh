#!/bin/zsh
# Étape 3.5, une seule fois : jeu secret (240 cas). Kaggle : comparateurs, groupes a (24-35 Md) et b (3-12 Md) ;
# Mac (processeur, comme dev et dev2) : base Qwen3.5-2B et lot 4 élagué (mac.sh). Puis noter.py, comparer_secret.py.
# Contrôles (relecture de Codex, 1er nov.) : empreinte de la copie envoyée et du jeu reconstruit dans chaque noyau,
# campagne dans un dossier neuf, statuts vérifiés, erreurs techniques retentées puis écartées et signalées.
setopt nullglob
cd ~/localia-labo/modele-compact
R=resultats/secret/finale
[[ -e $R ]] && { echo "$R existe déjà : la campagne a déjà été lancée"; exit 1; }
mkdir -p $R; source resultats/secret/kaggle.sh
O=~/localia-public/modele/eval/outils; E=622aac134a08e2c9c7d035e209cf9d4c1f1b0efea03de0870508d90f6e577f49
etat "secret : empreintes"
for d in eval-secret kaggle/eval-secret; do
  python3 -I $O/verifier_empreinte.py $d $E > /dev/null || { etat "secret : erreur, empreinte de $d changée"; exit 1; }
done
etat "secret : envoi du jeu (privé)"
$K datasets create -p kaggle/eval-secret -q 2>&1 | grep -v outdated >> $R/chaine.log
sleep 120
until $K datasets status mohadial/localia-eval-secret 2>&1 | grep -q ready; do sleep 60; done
for g in a b; do
  $K kernels push -p kaggle/comparateurs-secret-$g 2>&1 | grep -v outdated | tee -a $R/chaine.log | grep -q "successfully pushed" \
    || { etat "secret : erreur, envoi du noyau $g refusé"; exit 1; }
done
etat "secret : noyaux a et b envoyés ; Mac : base puis lot 4"

{ resultats/secret/mac.sh eval-secret $R && etat "secret : Mac fini" || etat "secret : Mac en erreur (voir executer-*.log)"; } &
pmac=$!

for g in a b; do
  attendre mohadial/localia-comparateurs-secret-$g && s=fini || s=erreur
  rapatrier mohadial/localia-comparateurs-secret-$g $g || s="$s, rapatriement impossible"
  etat "secret : noyau $g : $s"
  for f in $R/$g-secret-*.jsonl; do mv $f $R/${${f:t}#$g-}; done
done
wait $pmac

etat "secret : notation"
python3 -I resultats/secret/compter_erreurs.py $R/secret-*.jsonl > $R/notes.txt
for f in $R/secret-*.jsonl; do
  nom=${${f:t:r}#secret-}
  python3 -I $O/noter.py eval-secret $f $R/note-$nom.json > /dev/null || etat "secret : notation de $nom en erreur"
done
python3 -I $O/comparer_secret.py $R lot4 >> $R/notes.txt 2>&1
etat "secret fini : voir resultats/secret/finale/notes.txt"
