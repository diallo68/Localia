---
nom: 4. Dates et continuité temporelle
appel: /donnees-dates
description: Construire une vraie date, trier, repérer les jours manquants et les doublons.
famille: Données brutes
tache: donnees
---

Objectif : une colonne `date` fiable et une série sans trous cachés.

- Construis la date selon les colonnes présentes ; attention : DOY = jour de l'année (format `%Y%j`), pas le jour du mois.
- Précise le fuseau horaire (UTC ou local) et ne le change pas sans le dire.
- Trie, signale les dates en double, liste les dates absentes ; ajoute-les comme lignes vides (valeurs manquantes),
  sans inventer de valeurs.
- Rends : le code, et le nombre de dates en double et absentes.
