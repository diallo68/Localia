---
nom: 1. Conserver l’original et sa traçabilité
appel: /donnees-original
description: Ne jamais modifier le fichier brut ; noter la source et les conditions d’obtention.
exemple: /donnees-original Comment conserver le fichier reçu de la FPFD sans jamais le modifier ?
famille: Données brutes
tache: donnees
nom_en: 1. Keep the original and its traceability
description_en: Never modify the raw file; record the source and how it was obtained.
exemple_en: /donnees-original How do I keep the file received from the FPFD without ever modifying it?
famille_en: Raw data
---

Objectif : pouvoir toujours revenir aux données d'origine et dire d'où elles viennent.

- Le fichier brut va dans un dossier `brut/` et n'est jamais modifié ; tout le travail se fait par script, sur une copie.
- Fiche de provenance (`brut/PROVENANCE.md`) : source exacte, URL ou contact, date d'obtention, période, lieu (coordonnées),
  paramètres demandés, unités, version, licence, empreinte SHA-256 du fichier.
- Rends : la structure de dossiers proposée (`brut/`, `scripts/`, `sortie/`), le modèle de fiche de provenance rempli
  avec ce qui est connu, et le code Python qui calcule l'empreinte du fichier.

--- en ---

Goal: always be able to go back to the original data and say where it comes from.

- The raw file goes into a `raw/` folder and is never modified; all work is done by script, on a copy.
- Provenance sheet (`raw/PROVENANCE.md`): exact source, URL or contact, date obtained, period, location (coordinates),
  requested parameters, units, version, licence, SHA-256 hash of the file.
- Return: the proposed folder structure (`raw/`, `scripts/`, `output/`), the provenance sheet template filled in
  with what is known, and the Python code that computes the file hash.
