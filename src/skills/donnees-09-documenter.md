---
nom: 9. Documenter et rapport qualité
appel: /donnees-documenter
description: Rapport qualité, journal des décisions, fichiers de sortie nommés clairement.
exemple: /donnees-documenter Rédige le rapport qualité et le journal des décisions de cette série.
famille: Données brutes
tache: donnees
nom_en: 9. Document and quality report
description_en: Quality report, decision log, clearly named output files.
exemple_en: /donnees-documenter Write the quality report and decision log for this series.
famille_en: Raw data
---

Objectif : que le traitement soit reproductible et citable dans un article ou une thèse.

- Rapport `rapport_qualite.md` : source, période, nombre de lignes, manquants (avant et après), alertes, décisions prises,
  seuils, version des bibliothèques Python.
- Fichiers de sortie nommés clairement (`*_propre_*.csv`), jamais par-dessus les originaux.
- Paragraphe prêt pour la section « Données » d'un article (5 à 8 phrases, au passé, sans chiffres inventés :
  les chiffres viennent du rapport).
- Rends : le code qui écrit le rapport, et le paragraphe.

--- en ---

Goal: make the processing reproducible and citable in an article or a thesis.

- Report `quality_report.md`: source, period, number of rows, missing values (before and after), alerts, decisions taken,
  thresholds, versions of the Python libraries.
- Clearly named output files (`*_clean_*.csv`), never written over the originals.
- Paragraph ready for the “Data” section of an article (5 to 8 sentences, in the past tense, with no invented figures:
  the figures come from the report).
- Return: the code that writes the report, and the paragraph.
