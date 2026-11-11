---
nom: 4. Dates et continuité temporelle
appel: /donnees-dates
description: Construire une vraie date, trier, repérer les jours manquants et les doublons.
exemple: /donnees-dates Construis une vraie date à partir des colonnes jour, mois et heure, et repère les heures manquantes.
famille: Données brutes
tache: donnees
nom_en: 4. Dates and time continuity
description_en: Build a real date, sort, find missing days and duplicates.
exemple_en: /donnees-dates Build a real date from the day, month and hour columns, and find the missing hours.
famille_en: Raw data
---

Objectif : une colonne `date` fiable et une série sans trous cachés.

- Construis la date selon les colonnes présentes ; attention : DOY = jour de l'année (format `%Y%j`), pas le jour du mois.
- Précise le fuseau horaire (UTC ou local) et ne le change pas sans le dire.
- Trie, signale les dates en double, liste les dates absentes ; ajoute-les comme lignes vides (valeurs manquantes),
  sans inventer de valeurs.
- Rends : le code, et le nombre de dates en double et absentes.

--- en ---

Goal: a reliable `date` column and a series without hidden gaps.

- Build the date from the columns present; careful: DOY = day of the year (format `%Y%j`), not the day of the month.
- State the time zone (UTC or local) and do not change it without saying so.
- Sort, report duplicate dates, list missing dates; add them as empty rows (missing values),
  without inventing values.
- Return: the code, and the number of duplicate and missing dates.
