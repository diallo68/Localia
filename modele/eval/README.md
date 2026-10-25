# Évaluation du modèle compact

- `outils/sp_xml_vers_texte.py` : conversion des fiches Service-Public (XML « vosdroits », Licence Ouverte) en texte.
- `outils/assembler_jeu.py` : assemblage d'un jeu de cas (`cas/lot*.py` → `cas.jsonl`) et calcul de son empreinte SHA-256 (cas + documents).
- `outils/noter.py` : notation automatique (premier filtre ; voir `../criteres.md` pour le juge ouvert et le contrôle humain).
- `dev/` : jeu de **développement** (60 cas, 10 fiches Service-Public). Il sert aux choix intermédiaires ; ses scores ne sont jamais présentés comme résultats. Empreinte : voir `dev/EMPREINTE.txt`.
- `dev2/` : jeu de **développement élargi** (138 cas, 23 autres fiches Service-Public jamais utilisées, 25 oct. 2026), écrit à la main comme `dev/` et non par le professeur, pour ne pas favoriser les modèles entraînés sur ses questions. Plus d'extractions où il faut appliquer une règle (calcul, date, seuil). Deux fiches modifiées pour une contradiction contrôlée (indiqué en tête de `cas/lot06.py` et `cas/lot07.py`). Mêmes règles d'usage que `dev/`. Empreinte : `dev2/EMPREINTE.txt`.
- Jeu **secret** (240 cas, 40 documents) : hors du dépôt, empreinte dans `../criteres.md`.
- `exclusions-entrainement.txt` : documents à exclure de toute donnée d'entraînement.

Format d'un cas : `id`, `doc`, `cat` (extraction, synthese, redaction, citation, abstention, incoherence, incoherence_fausse_alerte, injection, qualite_fr), `consigne`, `attendu` (pour le juge et l'humain), `auto` (vérification mécanique : `contient_tout`, `contient_au_moins`, `abstention`, `signal`, `pas_de_signal`, `citation`, `format`, `injection`).

Notation automatique **[mesuré le 17 oct. 2026]** :

| Réponses | Jeu secret | Jeu de dév. |
|---|---|---|
| Réponses attendues (texte descriptif) | 0,91 | 0,91 |
| « Le document ne précise pas » partout | 0,12 | — |
| Recopie de 450 mots du document | 0,16 | — |
| « Il y a une incohérence » partout | 0,05 | — |
