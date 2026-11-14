# Calendrier de Localia : plan (14 nov. 2026)

Demande de l’auteur : un calendrier dans Localia pour relier projets et recherches, noter des échéances et faire des
plannings. Choix de l'auteur (14 nov.) : **échanges par fichiers .ics** (pas de compte en ligne, rien ne sort de
l'ordinateur sans action de l'utilisateur) et **première étape : les échéances des projets**.

## Étape 1 : échéances (faite le 14 nov., branche `calendrier`)

### Données
Fichier `calendrier.json` dans le dossier de données, chiffré comme les autres (`readJson` / `writeJson`).
Une échéance :

| Champ | Contenu |
|---|---|
| `id` | identifiant |
| `title` | intitulé (200 caractères au plus) |
| `date` | jour `AAAA-MM-JJ` ; `time` facultatif `HH:MM` (heure locale) |
| `projectId` | projet rattaché, facultatif |
| `kind` | `echeance`, `reunion`, `rappel` ou `autre` |
| `done` | faite ou non |
| `notes` | texte libre (2 000 caractères) |
| `source` | si proposée par le modèle : document, page, extrait cité, conversation, modèle, date |

Module `src/calendar.js` (logique pure, chargé par le processus principal, l'interface et les tests) :
`normalizeCalendar`, tri, échéances d'une période, retards, et **ICS** : `toIcs` (RFC 5545 : `VCALENDAR`/`VEVENT`,
`UID` stable, `DTSTART;VALUE=DATE` pour une journée, échappement `\,` `\;` `\n`, lignes repliées à 75 octets)
et `fromIcs` (lecture tolérante des `VEVENT` : `SUMMARY`, `DTSTART`, `DESCRIPTION`, `UID` ; doublons écartés par `UID`).

### Interface
- Entrée **Calendrier** dans la colonne de navigation (à côté d'Automatisations), raccourci à choisir.
- Vue **mois** (grille) et vue **liste** (en retard / cette semaine / plus tard), filtre par projet.
- Formulaire d'ajout et de modification ; case « faite ».
- Dans chaque projet : ses échéances, bouton « Ajouter une échéance ».
- Accueil : les 3 prochaines échéances (et les retards), sans modèle.
- Boutons **Exporter (.ics)** (tout, ou un projet) et **Importer (.ics)**.

### Échéances proposées par le modèle (la partie propre à Localia)
- Bouton « Chercher les dates » sur une réponse ou un document joint : le modèle liste les dates trouvées
  (intitulé, date, page). Localia **vérifie** chaque proposition sans modèle : la date doit figurer dans la page
  citée (formats « 15 janvier 2027 », « 15/01/2027 », « January 15, 2027 », « 2027-01-15 »). Les propositions non
  retrouvées sont montrées comme « à vérifier », jamais ajoutées d'office.
- L'utilisateur coche ce qu'il garde ; rien n'entre au calendrier sans validation. La source (document, page,
  extrait) reste attachée à l'échéance, cliquable comme les « p. N » des réponses.

### Tests
`test/calendar.test.cjs` : normalisation et limites, aller-retour `toIcs` → `fromIcs`, échappement et repli des
lignes, fichier .ics réel exporté par Calendrier d'Apple et par Outlook, vérification des dates dans une page
(formats FR et EN), fuseau : une échéance « journée entière » ne change pas de jour.

### Constat sur de vrais modèles (14 nov.)
Sur un appel à communications fictif de 3 pages : qwen3-4b suit le format demandé (6 dates, 5 vérifiées) ;
Dial-bowe v1 et la base Qwen3.5-2B écrivent la date en toutes lettres, changent l'ordre des colonnes et citent une
page fausse. La lecture est donc tolérante (date en toutes lettres ou ISO, dans n'importe quelle colonne ; page
facultative) et la vérification corrige la page en le signalant : Dial-bowe passe de 0 à 6 dates vérifiées sur 6.
Les plages (« du 12 au 14 juin 2027 ») sont reconnues par leurs deux bouts.

## Étapes suivantes (non commencées)
2. **Rétroplanning** : à partir d'une date limite, le modèle propose des étapes datées ; l'utilisateur ajuste et valide.
3. **Rappels datés** : déclencheur « date » pour les automatisations (rappel, synthèse du lundi). Ne tourne que si
   Localia est ouverte (comme les routines actuelles) ; notification du système.
4. Échéances de la **veille bibliographique** (`watch.js`) affichées dans le même calendrier.

## Hors champ
Synchronisation automatique avec iCloud, Google ou Outlook (choix de l'auteur) ; partage du calendrier.
