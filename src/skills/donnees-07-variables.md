---
nom: 7. Variables dérivées et agrégations
appel: /donnees-variables
description: Indicateurs utiles à la question de recherche, agrégations correctes.
exemple: /donnees-variables Calcule les heures d’humidité supérieure à 90 % par jour.
famille: Données brutes
tache: donnees
nom_en: 7. Derived variables and aggregations
description_en: Indicators useful for the research question, correct aggregations.
exemple_en: /donnees-variables Compute the hours of humidity above 90 % per day.
famille_en: Raw data
---

Objectif : construire les variables qui servent la question de recherche.

- Demande ou rappelle la question (ex. risque de maladie, rendement, tendance).
- Agrégations : par année ET par mois (ou semaine) ; une moyenne de plusieurs années (climatologie) seulement si elle
  est demandée, dans un fichier séparé.
- Cumuls et moyennes glissantes (fenêtre explicite), décalages dans le temps (valeurs des jours précédents),
  indicateurs à seuils (ex. jours favorables) avec seuils en constantes et justification ou référence.
- Ne cite pas de référence bibliographique que tu n'es pas sûr de connaître : écris « seuil à justifier ».
- Rends : le code et la liste des variables créées (nom, formule, unité).

--- en ---

Goal: build the variables that serve the research question.

- Ask for or restate the question (e.g. disease risk, yield, trend).
- Aggregations: per year AND per month (or week); a multi-year average (climatology) only if
  requested, in a separate file.
- Running totals and moving averages (explicit window), time lags (values of previous days),
  threshold indicators (e.g. favourable days) with thresholds as constants and a justification or reference.
- Do not cite a bibliographic reference you are not sure you know: write “threshold to be justified”.
- Return: the code and the list of variables created (name, formula, unit).
