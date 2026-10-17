# 04 — SFT sur réponses de professeurs ouverts, filtrées par vérification

**Statut** : retenu (socle). Proposé par les deux.

## Hypothèse
Une base suivra mieux les consignes documentaires en français si on l'entraîne (SFT, LoRA ou complet) sur 20 000 à 60 000 exemples. Chaque exemple associe :
- un document public à licence claire ;
- une consigne ;
- une réponse produite par un professeur ouvert (Qwen3.6-35B-A3B, Gemma 4 31B ou Mistral Small 4), qui n'est **gardée que si elle passe des vérificateurs mécaniques**.

Effet attendu : +5 à +15 points sur le jeu documentaire, par rapport à la base (supposé ; Codex donne la même fourchette).

## Mécanisme
Les vérificateurs :
- chaque nombre, date ou citation de la réponse existe dans le document : vérification littérale, reprise de la logique de `verify.js` de Localia ;
- quand la question n'a pas de réponse dans le document (cas construits), la réponse s'abstient ;
- le format demandé est respecté : longueur, puces, tableau.

Les références de fond :
- LIMA, arXiv:2305.11206 ; LIMO, arXiv:2502.03387 ; s1, arXiv:2501.19393 : peu d'exemples suffisent s'ils sont choisis avec soin.
- Tülu 3, arXiv:2411.15124 : méthode complète de post-entraînement ouvert.

## Sources de documents envisagées (licences à confirmer une par une dans `provenance.md`)
- Fiches pratiques de Service-Public.fr (Licence Ouverte / Etalab 2.0, selon data.gouv.fr).
- Codes et textes de Légifrance (Licence Ouverte).
- Wikipédia en français (CC BY-SA 4.0 ; obligations de partage à l'identique à étudier pour les sorties).
- Rapports publics, données de data.gouv.fr (Licence Ouverte).
- FineWeb-2, partie française (ODC-By) : documents variés, avec filtrage qualité.

## Ordre de grandeur (calculé)
- Génération : 40 000 exemples × environ 2 500 jetons lus et 400 produits ≈ 100 M jetons lus et 16 M produits. Le professeur MoE n'active que 3 Md de paramètres : environ 4 à 10 H100-h, soit 15 à 40 €.
- SFT complet du 4B sur 16 M jetons cibles et 100 M jetons lus, 2 passes : 6 × 4e9 × 2e8 ≈ 4,8e18 FLOP, soit 4 à 8 H100-h.

## Avocat du diable
- Les vérificateurs littéraux favorisent le copier-coller : on risque des réponses plates et extractives. Il faut garder un critère de qualité rédactionnelle, noté par un juge ouvert puis contrôlé par un humain sur un échantillon.
- Le professeur peut avoir appris sur des données contaminées par les benchmarks. La décontamination de nos données ne protège pas de celle du professeur : on le signalera.
- Oubli catastrophique des capacités générales : on garde une part de données générales (environ 20 %), et une limite de régression sur MMMLU-fr et MGSM-fr.

## Expérience de falsification
Phase 2 :
- 2 000 exemples ;
- LoRA sur Qwen3.5-0.8B (CPU ou Kaggle gratuit) ;
- comparaison avec la base sur 60 cas de développement.

Aucun gain mesurable (IC à 95 % qui contient 0) avec 2 000 exemples propres, c'est un signal fort contre l'idée. Avant de conclure, vérifier la chaîne.

## Résultat mesuré
—

## Décision
Retenu comme première étape de tous les scénarios.
