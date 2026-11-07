# Installer Dial-bowe-GN-224-2B dans Localia

**Statut : modèle non publié.** Le fichier n'est pas sur Hugging Face : il se trouve sur le Mac de l'auteur
(`~/localia-labo/modele-compact/bases/lot4/gguf/`). Ce guide suppose qu'on a ce fichier. Les étapes 1 à 4 ont été
vérifiées le 2 novembre 2026 sur macOS (Mac Intel, Ollama 0.40.5). La fiche du modèle est `fiche-modele.md`.

## Ce qu'il faut

- Localia, et [Ollama](https://ollama.com). Pour un modèle qui ne vient pas de Hugging Face, Ollama est
  aujourd'hui le seul chemin d'installation (voir l'étape 5).
- Le fichier `qwen35-2b-lora-Q4_K_M-sansreflexion-vocfr48k.gguf` (1,11 Go).
- Environ 2 Go de mémoire vive libre : le pic mesuré est de 1,77 Go, à 8 192 jetons de contexte.

## 1. Vérifier le fichier

```bash
shasum -a 256 qwen35-2b-lora-Q4_K_M-sansreflexion-vocfr48k.gguf
# a4b5f4bc2fa3457cfcc5237b87df0327610b23b4199e4e646ccdde5babf6d4ad
```

Une autre empreinte signifie un autre fichier. Ne pas continuer.

## 2. Vérifier le gabarit sans réflexion

Le fichier livré porte déjà le gabarit `ollama/gabarit_sans_reflexion.jinja` : le bloc de réflexion est toujours
vide. **C'est indispensable.** Avec le gabarit d'origine de Qwen3.5, Ollama active la réflexion par défaut. Le
modèle n'a pas été entraîné pour : il réfléchit jusqu'à remplir le contexte, et la réponse arrive vide après une
dizaine de minutes.

Pour un autre GGUF du même modèle (une autre quantification, par exemple), il faut appliquer le gabarit avant
l'étape 3. La commande est dans `ollama/README.md`.

## 3. Créer le modèle dans Ollama

Placer le GGUF dans le même dossier que `ollama/Modelfile` (une copie ou un lien), puis :

```bash
ollama create dial-bowe-gn-224-2b -f Modelfile
ollama show dial-bowe-gn-224-2b    # quantization Q4_K_M, num_ctx 8192, temperature 0.3
```

`ollama show` affiche la capacité « thinking » : elle vient du nom de l'architecture. Avec ce gabarit, elle reste
sans effet (étape 4).

## 4. Essai rapide

```bash
ollama run dial-bowe-gn-224-2b "Document : La carte de bibliothèque est gratuite pour les moins de 18 ans. Pour les adultes, elle coûte 15 € par an. Les prêts sont limités à 6 livres pendant 3 semaines. --- Demande : combien de livres peut-on emprunter, et pour combien de temps ?"
ollama run dial-bowe-gn-224-2b "Document : La carte de bibliothèque est gratuite pour les moins de 18 ans. Pour les adultes, elle coûte 15 € par an. Les prêts sont limités à 6 livres pendant 3 semaines. --- Demande : à quelle heure ouvre la bibliothèque ?"
```

Mesuré le 7 novembre 2026 sur le fichier publié, comme `ollama run` l'envoie (sans consigne, température 0,3 du
Modelfile), 5 essais par question :

- 1re question : « 6 livres » et « 3 semaines » dans les 5 réponses ;
- 2e question : les 5 réponses disent que le document ne donne pas l'heure, sans l'inventer ;
- aucune réflexion.

L'ancien exemple (période d'essai de 3 mois renouvelable une fois, durée maximale ?) a été retiré : le modèle y
répond le plus souvent « 3 mois » au lieu de 6, même avec la consigne de Localia ou une question plus précise
(juste dans 2 essais sur 6 à 0,3 avec la question précise). Un calcul, même simple, qui n'est pas écrit dans le
document reste un point faible.

Vitesse : sur le processeur seul, comptez de 5 jetons/s (machine chargée) à 17 jetons/s (machine au repos) :
`mesures/vitesse-dial-bowe-quantifs.md`.

## 5. Utiliser le modèle dans Localia

1. Ouvrir **Bibliothèque de modèles**. `dial-bowe-gn-224-2b` apparaît sous **Installés sur ce Mac**, avec le moteur Ollama.
2. Dans une conversation, choisir `dial-bowe-gn-224-2b` et joindre le document (PDF). Pour un document long, Localia
   n'envoie que les extraits utiles, dans la limite du contexte.
3. Réglages du modèle conseillés (Bibliothèque, réglages par modèle) :
   - **réflexion désactivée** ;
   - contexte de 8 192 jetons ;
   - température 0 pour des réponses reproductibles. Toutes les mesures publiées ont été faites à 0 ; le Modelfile
     met 0,3 ;
   - consigne permanente : rien à ajouter. Localia met sa propre consigne pour les documents, et le modèle a été
     mesuré avec elle (`journal.md`, 25 octobre 2026 : 0,851 sur 188 cas de dev et dev2).

**Moteur intégré (sans Ollama ensuite).** Sur la ligne du modèle, le bouton « Utiliser avec le moteur intégré » reprend
le fichier d'Ollama sans le copier ; le modèle s'appelle alors `integre/dial-bowe-gn-224-2b`. Ollama 0.40.5 range les
modèles récents dans `~/.ollama/models/manifests-v2/ollama.com/`, que Localia ne lisait pas avant le
2 novembre 2026 (« Modèle Ollama introuvable sur cet ordinateur »). C'est corrigé dans `src/local-engine.cjs`. Le
lecteur GGUF du moteur intégré lit bien le fichier (architecture `qwen35`, gabarit sans réflexion), et une
conversation de trois tours a été essayée le 7 novembre 2026 avec le moteur de Localia (`src/llama-worker.mjs`,
node-llama-cpp 3.22.1), sur processeur seul : réponses justes, environ 19 jetons/s, aucune réflexion.
Jusqu'à la version 0.7.5 comprise, chaque réponse du moteur intégré commence par deux sauts de ligne quand la
réflexion n'est pas réglée : régler **réflexion désactivée** (étape 3) l'évite. C'est corrigé sur `main` (commit
57d2133) pour la version suivante.

## 6. Quel fichier selon la mémoire de l'ordinateur

Trois fichiers sont prêts (Q4_K_M, Q5_K_M, Q8_0). Le Q4_K_M est le choix par défaut : c'est le plus rapide, et le
seul évalué sur le jeu secret. Les pics de mémoire de chaque fichier sont dans
`publication/Dial-bowe-GN-224-2B/README.md`, § Fichiers.

## 7. Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| Longue attente, puis réponse vide | gabarit d'origine, réflexion active | refaire l'étape 2 avec le bon fichier, puis l'étape 3 |
| « Modèle Ollama introuvable » avec le moteur intégré | version de Localia antérieure au 2 novembre 2026 (étape 5) | mettre Localia à jour, ou utiliser le modèle par Ollama |
| Refus à tort (« impossible de répondre ») | prudence du modèle, vue sur environ 5 réponses sur 138 de dev2 | reformuler la demande ou vérifier dans le document ; voir les limites dans `fiche-modele.md` |
| Moins de 5 jetons/s | processeur seul, bridé quand le Mac chauffe | normal pour ce Mac ; fermer d'autres applications |
