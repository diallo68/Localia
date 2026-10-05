---
nom: Données météo NASA POWER (Dalaba)
appel: /meteo-nasa-power
description: Script complet de préparation des données journalières NASA POWER pour la prévision du mildiou.
famille: Données météo
tache: donnees
---

Écris **un seul script Python** (pandas, numpy ; matplotlib pour les figures) que j'exécuterai moi-même dans le dossier du fichier de données. Commente chaque étape en français, en une ligne : ce qu'elle fait et pourquoi.

## Données d'entrée

- Fichier : `POWER_Point_Daily_19950101_20241231_010d70N_012d27W_UTC.csv` (NASA POWER, données journalières, UTC).
- Site : Dalaba (Guinée), latitude 10,703, longitude -12,274, altitude moyenne de la maille 502,9 m.
- En-tête de 15 lignes à sauter (`skiprows=15`), séparateur virgule.
- Colonnes, à utiliser **exactement** sous ces noms :

| Colonne     | Signification                                      | Unité   |
| ----------- | -------------------------------------------------- | ------- |
| YEAR        | année                                              | —       |
| DOY         | jour de l'année (1 à 366, **pas** le jour du mois) | —       |
| T2M         | température moyenne à 2 m                          | °C      |
| T2M_MAX     | température maximale à 2 m                         | °C      |
| T2M_MIN     | température minimale à 2 m                         | °C      |
| RH2M        | humidité relative à 2 m                            | %       |
| PRECTOTCORR | précipitations corrigées                           | mm/jour |
| QV2M        | humidité spécifique à 2 m                          | g/kg    |
| WS2M        | vitesse du vent à 2 m                              | m/s     |

- Valeur manquante de NASA POWER : `-999`.

## Règles générales

- Ne modifie **jamais** le fichier d'origine ; écris les résultats dans un dossier `sortie/` (le créer s'il n'existe pas).
- N'invente aucune valeur ni colonne. Quand un choix dépend de moi, applique la valeur proposée ci-dessous **et** affiche-la clairement dans le rapport, pour que je puisse la changer.
- Regroupe tous les seuils en haut du script, dans des constantes nommées.

## Étapes

### 1. Lecture et contrôle de structure

- Lire le fichier avec `skiprows=15`.
- Vérifier que les 9 colonnes ci-dessus sont présentes et numériques.
- Afficher le nombre de lignes (attendu : 10 958, soit un jour par jour du 1er janvier 1995 au 31 décembre 2024).

### 2. Dates

- Créer la colonne `date` : `pd.to_datetime(df['YEAR'] * 1000 + df['DOY'], format='%Y%j')`.
- Trier par date ; signaler et supprimer les dates en double (garder la première).
- Lister les jours absents entre la première et la dernière date (ne pas les inventer : les ajouter comme lignes vides, valeurs manquantes).

### 3. Valeurs manquantes

- Remplacer `-999` (et toute valeur ≤ -99) par `NaN`.
- Compter les manquants par colonne et par année.
- Températures (T2M, T2M_MAX, T2M_MIN), RH2M, QV2M, WS2M : interpolation linéaire **seulement** pour les trous de 3 jours au plus (`limit=3`) ; au-delà, laisser `NaN`.
- PRECTOTCORR : **aucune interpolation** (un jour sans donnée n'est pas un jour sans pluie) ; laisser `NaN`.
- Ajouter une colonne `interpole` (True/False) pour garder la trace des valeurs comblées.

### 4. Valeurs aberrantes (contrôle physique)

Marquer dans une colonne `alerte` (texte) chaque ligne qui viole une règle, sans la supprimer :

- RH2M hors de [0 ; 100] %.
- PRECTOTCORR < 0, ou > 200 mm/jour (seuil `PLUIE_MAX_PLAUSIBLE = 200`, à confirmer).
- Températures hors de [5 ; 45] °C.
- Incohérence : T2M_MIN > T2M ou T2M > T2M_MAX.
- WS2M < 0.

Cas connu à signaler en priorité : **586,67 mm le 20 août 2022** (la valeur suivante est 262,32 mm). Décision par défaut : mettre en `NaN` les pluies au-dessus de `PLUIE_MAX_PLAUSIBLE` dans le fichier propre, les garder dans le rapport. Je vérifierai avec une autre source (CHIRPS ou station locale).

### 5. Variables pour le risque de mildiou

Calculer, par jour :

- `jour_favorable` : RH2M ≥ 90 % **et** 10 °C ≤ T2M ≤ 25 °C (seuils `RH_SEUIL = 90`, `T_MIN_FAVORABLE = 10`, `T_MAX_FAVORABLE = 25`).
  Indiquer dans le rapport que c'est une **approximation journalière** : les critères classiques (Smith, Hutton) demandent des heures d'humidité élevée, que des données journalières ne donnent pas.
- `pluie_3j` et `pluie_7j` : cumul des précipitations sur les 3 et 7 derniers jours (fenêtre glissante, NaN si une valeur manque dans la fenêtre).
- `T2M_moy_7j` et `RH2M_moy_7j` : moyennes glissantes sur 7 jours.
- `jours_favorables_7j` : nombre de jours favorables sur les 7 derniers jours.

### 6. Agrégations

- Par **année et par mois** (`date.dt.to_period('M')`), pas en mélangeant les années : moyennes de T2M, T2M_MAX, T2M_MIN, RH2M ; cumul de PRECTOTCORR ; nombre de jours favorables ; nombre de jours manquants.
- Climatologie (moyenne des 30 années par mois calendaire) dans un **fichier séparé**, clairement nommé.

### 7. Préparation pour le LSTM

- Découpage **chronologique** (jamais aléatoire) : entraînement 1995-2017, validation 2018-2020, test 2021-2024 (constantes à modifier si besoin).
- Normalisation (moyenne et écart-type) calculée **sur la seule période d'entraînement**, puis appliquée aux trois périodes ; enregistrer ces paramètres.
- Ne pas encore construire les fenêtres de séquences : je le ferai dans le script du modèle.

### 8. Sorties (dossier `sortie/`)

- `dalaba_propre_journalier.csv` : données journalières nettoyées, avec `date`, `interpole`, `alerte` et les variables de l'étape 5.
- `dalaba_mensuel.csv` : agrégations par année et mois.
- `dalaba_climatologie_mensuelle.csv` : moyennes par mois calendaire.
- `normalisation_entrainement.csv` : moyenne et écart-type par variable (période d'entraînement).
- `rapport_qualite.md` : nombre de lignes, période, jours absents, manquants par colonne et par année, valeurs interpolées, liste des alertes (date, colonne, valeur, règle), seuils utilisés.
- Figures PNG : série journalière de T2M et RH2M, pluie mensuelle, nombre de jours favorables par mois.

### 9. Fin du script

Afficher un résumé court (période, lignes, manquants, nombre d'alertes, fichiers écrits) et la commande pour lancer le script.
