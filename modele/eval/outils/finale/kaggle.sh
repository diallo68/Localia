# Fonctions communes aux chaînes de l'étape 3.5 (sourcées). K : client kaggle ; R : dossier de la campagne.
K=~/localia-labo/modele-compact/env-entrainement/bin/kaggle
PY=~/localia-labo/modele-compact/env-entrainement/bin/python
etat() { echo "$(date '+%d %H:%M') $*" | tee -a $R/ETAT; }
# attendre <noyau> : attend la fin ; renvoie 0 seulement si COMPLETE.
attendre() {
  local st
  while true; do
    sleep 600
    st=$($K kernels status $1 2>&1 | grep -v outdated); echo "$(date '+%H:%M') $1 $st" >> $R/chaine.log
    case $st in *COMPLETE*) return 0;; *ERROR*|*CANCEL*) return 1;; esac
  done
}
# rapatrier <noyau> <préfixe> : télécharge les .jsonl et .log de sortie (URL signées), via un fichier temporaire.
rapatrier() {
  $PY ~/localia-labo/modele-compact/resultats/lot6/kaggle_sorties.py $1 2>/dev/null | grep -v outdated > $R/sorties-$2.tsv
  [[ -s $R/sorties-$2.tsv ]] || return 1
  while IFS=$'\t' read nom url; do
    [[ $nom == *.jsonl || $nom == *.log ]] || continue
    curl -fsS -L -o $R/.tmp "$url" || return 1
    mv $R/.tmp $R/$2-${nom:t}
  done < $R/sorties-$2.tsv
}
