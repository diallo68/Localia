# Installer localia-doc-2b dans Localia

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
ollama create localia-doc-2b -f Modelfile
ollama show localia-doc-2b    # quantization Q4_K_M, num_ctx 8192, temperature 0.3
```

`ollama show` affiche la capacité « thinking » : elle vient du nom de l'architecture. Avec ce gabarit, elle reste
sans effet (étape 4).

## 4. Essai rapide

```bash
ollama run localia-doc-2b "Document : La période d'essai d'un technicien en CDI dure 3 mois, renouvelable une fois. --- Demande : quelle est sa durée maximale ?"
```

Mesuré sur le cas V001 de dev2, avec la consigne de l'évaluation et une température de 0 :

- réponse directe et juste (6 mois) ;
- aucune réflexion, même quand `think` est demandé ;
- 43 jetons, à 16 jetons/s. Ollama se sert ici de la carte graphique du Mac. Sur le processeur seul, comptez
  de 5 jetons/s (machine chargée) à 17 jetons/s (machine au repos) : `mesures/vitesse-dial-bowe-quantifs.md`.

## 5. Utiliser le modèle dans Localia

1. Ouvrir **Bibliothèque de modèles**. `localia-doc-2b` apparaît sous **Installés sur ce Mac**, avec le moteur Ollama.
2. Dans une conversation, choisir `localia-doc-2b` et joindre le document (PDF). Pour un document long, Localia
   n'envoie que les extraits utiles, dans la limite du contexte.
3. Réglages du modèle conseillés (Bibliothèque, réglages par modèle) :
   - **réflexion désactivée** ;
   - contexte de 8 192 jetons ;
   - température 0 pour des réponses reproductibles. Toutes les mesures publiées ont été faites à 0 ; le Modelfile
     met 0,3 ;
   - consigne permanente : rien à ajouter. Localia met sa propre consigne pour les documents, et le modèle a été
     mesuré avec elle (`journal.md`, 25 octobre 2026 : 0,851 sur 188 cas de dev et dev2).

**Moteur intégré (sans Ollama ensuite).** Sur la ligne du modèle, le bouton « Utiliser avec le moteur intégré » reprend
le fichier d'Ollama sans le copier ; le modèle s'appelle alors `integre/localia-doc-2b`. Ollama 0.40.5 range les
modèles récents dans `~/.ollama/models/manifests-v2/ollama.com/`, que Localia ne lisait pas avant le
2 novembre 2026 (« Modèle Ollama introuvable sur cet ordinateur »). C'est corrigé dans `src/local-engine.cjs`. Le
lecteur GGUF du moteur intégré lit bien le fichier (architecture `qwen35`, gabarit sans réflexion), mais une
conversation complète par ce moteur n'a pas encore été essayée.

## 6. Quel fichier selon la mémoire de l'ordinateur

*Phase 4* : le tableau 8, 16 et 32 Go sera rempli d'après les quantifications comparées
(`resultats/lot4-fin/comparaison.txt`). Aujourd'hui, seul le Q4_K_M existe ; il convient dès 8 Go de RAM.

## 7. Dépannage

| Symptôme | Cause | Solution |
|---|---|---|
| Longue attente, puis réponse vide | gabarit d'origine, réflexion active | refaire l'étape 2 avec le bon fichier, puis l'étape 3 |
| « Modèle Ollama introuvable » avec le moteur intégré | version de Localia antérieure au 2 novembre 2026 (étape 5) | mettre Localia à jour, ou utiliser le modèle par Ollama |
| Refus à tort (« impossible de répondre ») | prudence du modèle, vue sur environ 5 réponses sur 138 de dev2 | reformuler la demande ou vérifier dans le document ; voir les limites dans `fiche-modele.md` |
| Moins de 5 jetons/s | processeur seul, bridé quand le Mac chauffe | normal pour ce Mac ; fermer d'autres applications |
