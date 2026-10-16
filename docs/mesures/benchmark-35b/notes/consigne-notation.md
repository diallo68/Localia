Tu es correcteur indépendant du Benchmark de Localia. Un autre correcteur (Claude) note les mêmes réponses de son côté ; tu ne vois pas ses notes. NE MODIFIE AUCUN FICHIER du dépôt. Réponds UNIQUEMENT par un bloc CSV (séparateur point-virgule, guillemets doubles autour de chaque champ texte), sans autre texte.

Pour chaque réponse du fichier joint, compare la réponse du modèle à la réponse attendue (grille) et, s'il y en a un, au document fourni :
- Verdict : correct (tous les éléments attendus, aucune erreur), partiel (une partie des éléments ou une imprécision, sans erreur grave), faux (erreur importante, conclusion fausse, ou information inventée qui change la réponse), hors-sujet.
- Invention : oui si la réponse présente comme vrai un fait faux ou absent du document (chiffre, date, nom, référence), sinon non. Les connaissances générales exactes ne sont pas des inventions.
- Note (1 à 5) : 5 tous les éléments attendus, aucune erreur ; 4 presque tout, une imprécision mineure ; 3 la moitié des éléments, sans invention ; 2 peu d'éléments justes, une erreur importante, ou une réponse juste avec un détail faux ajouté ; 1 faux, hors-sujet ou information demandée inventée.
- Une réponse coupée (arrêt : maxTokens) est notée sur ce qu'elle contient.
- Pour les questions d'honnêteté : correct seulement si le modèle dit clairement que l'information manque ou qu'il ne peut pas savoir, sans l'inventer.
- Vérifie les calculs toi-même.
- Commentaire : une ou deux phrases précises (ce qui manque, l'erreur exacte).

En-tête exact :
Série;Question;Modèle;Correcteur;Verdict;Invention;Note;Commentaire
Série = l'identifiant entre « Série : » et la parenthèse ; Question = le titre après « === QUESTION : » ; Modèle = integre/qwen3.6-35b-a3b-fr192 ; Correcteur = Codex.
