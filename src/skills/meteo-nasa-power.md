---
nom: Données météo NASA POWER (Dalaba)
appel: /meteo-nasa-power
description: Script complet de préparation des données journalières NASA POWER pour la prévision du mildiou.
exemple: /meteo-nasa-power Prépare les données NASA POWER journalières de Labé pour 2023 à 2025.
famille: Données météo
tache: donnees
nom_en: NASA POWER weather data (Dalaba)
description_en: Complete script preparing NASA POWER daily data for late blight forecasting.
exemple_en: /meteo-nasa-power Prepare the NASA POWER daily data for Labé for 2023 to 2025.
famille_en: Weather data
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

--- en ---

Write **a single Python script** (pandas, numpy; matplotlib for the figures) that I will run myself in the folder of the data file. Comment each step in English, in one line: what it does and why.

## Input data

- File: `POWER_Point_Daily_19950101_20241231_010d70N_012d27W_UTC.csv` (NASA POWER, daily data, UTC).
- Site: Dalaba (Guinea), latitude 10.703, longitude -12.274, mean grid-cell elevation 502.9 m.
- 15-line header to skip (`skiprows=15`), comma separator.
- Columns, to be used **exactly** under these names:

| Column      | Meaning                                          | Unit   |
| ----------- | ------------------------------------------------ | ------ |
| YEAR        | year                                             | —      |
| DOY         | day of the year (1 to 366, **not** day of month) | —      |
| T2M         | mean temperature at 2 m                          | °C     |
| T2M_MAX     | maximum temperature at 2 m                       | °C     |
| T2M_MIN     | minimum temperature at 2 m                       | °C     |
| RH2M        | relative humidity at 2 m                         | %      |
| PRECTOTCORR | corrected precipitation                          | mm/day |
| QV2M        | specific humidity at 2 m                         | g/kg   |
| WS2M        | wind speed at 2 m                                | m/s    |

- NASA POWER missing value: `-999`.

## General rules

- **Never** modify the original file; write the results to an `output/` folder (create it if it does not exist).
- Do not invent any value or column. When a choice is up to me, apply the value proposed below **and** show it clearly in the report, so that I can change it.
- Group all thresholds at the top of the script, as named constants.

## Steps

### 1. Reading and structure check

- Read the file with `skiprows=15`.
- Check that the 9 columns above are present and numeric.
- Print the number of rows (expected: 10,958, one per day from 1 January 1995 to 31 December 2024).

### 2. Dates

- Create the `date` column: `pd.to_datetime(df['YEAR'] * 1000 + df['DOY'], format='%Y%j')`.
- Sort by date; report and remove duplicate dates (keep the first).
- List the missing days between the first and last date (do not invent them: add them as empty rows, missing values).

### 3. Missing values

- Replace `-999` (and any value ≤ -99) with `NaN`.
- Count missing values per column and per year.
- Temperatures (T2M, T2M_MAX, T2M_MIN), RH2M, QV2M, WS2M: linear interpolation **only** for gaps of 3 days at most (`limit=3`); beyond that, leave `NaN`.
- PRECTOTCORR: **no interpolation** (a day without data is not a day without rain); leave `NaN`.
- Add an `interpolated` column (True/False) to keep track of the filled values.

### 4. Outliers (physical check)

Flag in an `alert` column (text) every row that breaks a rule, without deleting it:

- RH2M outside [0; 100] %.
- PRECTOTCORR < 0, or > 200 mm/day (threshold `MAX_PLAUSIBLE_RAIN = 200`, to be confirmed).
- Temperatures outside [5; 45] °C.
- Inconsistency: T2M_MIN > T2M or T2M > T2M_MAX.
- WS2M < 0.

Known case to report first: **586.67 mm on 20 August 2022** (the next value is 262.32 mm). Default decision: set rain above `MAX_PLAUSIBLE_RAIN` to `NaN` in the clean file, keep it in the report. I will check against another source (CHIRPS or a local station).

### 5. Variables for late blight risk

Compute, per day:

- `favourable_day`: RH2M ≥ 90 % **and** 10 °C ≤ T2M ≤ 25 °C (thresholds `RH_THRESHOLD = 90`, `T_MIN_FAVOURABLE = 10`, `T_MAX_FAVOURABLE = 25`).
  State in the report that this is a **daily approximation**: the classic criteria (Smith, Hutton) require hours of high humidity, which daily data do not provide.
- `rain_3d` and `rain_7d`: precipitation total over the last 3 and 7 days (rolling window, NaN if a value is missing in the window).
- `T2M_mean_7d` and `RH2M_mean_7d`: 7-day moving averages.
- `favourable_days_7d`: number of favourable days over the last 7 days.

### 6. Aggregations

- By **year and month** (`date.dt.to_period('M')`), without mixing years: means of T2M, T2M_MAX, T2M_MIN, RH2M; total PRECTOTCORR; number of favourable days; number of missing days.
- Climatology (30-year mean per calendar month) in a **separate file**, clearly named.

### 7. Preparation for the LSTM

- **Chronological** split (never random): training 1995-2017, validation 2018-2020, test 2021-2024 (constants to change if needed).
- Normalisation (mean and standard deviation) computed **on the training period only**, then applied to the three periods; save these parameters.
- Do not build the sequence windows yet: I will do it in the model script.

### 8. Outputs (`output/` folder)

- `dalaba_clean_daily.csv`: cleaned daily data, with `date`, `interpolated`, `alert` and the variables of step 5.
- `dalaba_monthly.csv`: aggregations by year and month.
- `dalaba_monthly_climatology.csv`: means per calendar month.
- `training_normalisation.csv`: mean and standard deviation per variable (training period).
- `quality_report.md`: number of rows, period, missing days, missing values per column and per year, interpolated values, list of alerts (date, column, value, rule), thresholds used.
- PNG figures: daily series of T2M and RH2M, monthly rain, number of favourable days per month.

### 9. End of the script

Print a short summary (period, rows, missing values, number of alerts, files written) and the command to run the script.
