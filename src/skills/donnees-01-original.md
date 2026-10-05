---
nom: 1. Conserver l’original et sa traçabilité
appel: /donnees-original
description: Ne jamais modifier le fichier brut ; noter la source et les conditions d’obtention.
famille: Données brutes
tache: donnees
---

Objectif : pouvoir toujours revenir aux données d'origine et dire d'où elles viennent.

- Le fichier brut va dans un dossier `brut/` et n'est jamais modifié ; tout le travail se fait par script, sur une copie.
- Fiche de provenance (`brut/PROVENANCE.md`) : source exacte, URL ou contact, date d'obtention, période, lieu (coordonnées),
  paramètres demandés, unités, version, licence, empreinte SHA-256 du fichier.
- Rends : la structure de dossiers proposée (`brut/`, `scripts/`, `sortie/`), le modèle de fiche de provenance rempli
  avec ce qui est connu, et le code Python qui calcule l'empreinte du fichier.
