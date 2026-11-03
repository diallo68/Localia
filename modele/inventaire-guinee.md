# Inventaire des données ouvertes : langues guinéennes et droit guinéen

Fait le 3 novembre 2026 par Claude, à la demande de l'auteur. C'est un inventaire : rien n'a été téléchargé ni
entraîné. Chaque licence a été lue sur la page de la source elle-même. « À vérifier » signale ce qui n'a pas pu
l'être.

## Synthèse

| Besoin | Ressource ouverte trouvée | Utilisable pour entraîner ? |
|---|---|---|
| Malinké, texte | nicolingua-0005 : N'Ko ↔ français et anglais, 130 850 paires, 3,3 M de mots en N'Ko | **oui**, CC BY-SA 4.0 (mention de la source et partage à l'identique) |
| Pular, texte | rien de libre et vérifié ; un modèle de traduction non commercial (MaLiNaLi : Bible, Coran, dictionnaires) | **non**, en l'état |
| Soussou, texte | rien trouvé | non |
| Malinké, pular, soussou, parole | nicolingua-0004 (OpenSLR 106) : 10 083 énoncés, 49 locuteurs, avec le français | **oui**, CC BY-SA 4.0 (reconnaissance vocale) |
| Pular, parole | Fula-pular sur Hugging Face : 9 761 extraits audio avec texte | **non** : aucune licence, origine inconnue |
| Droit guinéen | codes, lois et décrets en ligne (droitguineen.com, legisguinee.com, invest.gov.gn) | **les textes officiels oui** (domaine public, à confirmer dans la loi de 2019) ; **pas l'extraction en masse des sites privés** |

Le malinké est la langue la mieux servie, grâce à l'écriture N'Ko et au travail de la communauté N'Ko. Le pular, la
langue la plus parlée, n'a presque rien d'ouvert à l'écrit. Le soussou n'a que de la parole.

## 1. Pular (peul du Fuuta Jaloo, code ISO `fuf`)

- **Modèle de traduction français ↔ pular** `flutter-painter/nllb-fra-fuf-v2` (Hugging Face). Il ne couvre que le
  pular de Guinée et du Fouta-Djalon. BLEU 16 (fra → fuf) et 15 (fuf → fra). Licence **CC BY-NC 4.0, non
  commerciale**. Données : « Bible, Coran et dictionnaires », sans volumes ni licences publiés. Le projet source,
  MaLiNaLi (`github.com/refacto-org/MaLiNaLi`), renvoie une erreur 404 : **à vérifier**. Les traductions de la Bible
  et du Coran sont souvent protégées par leurs éditeurs.
- **Jeu de parole Fula-pular** (`Kppwdfgu1/Fula-pular`, copie de `Pullo-Africa-Protagonist/Fula-pular`) :
  9 761 extraits audio avec texte, 1,9 Go, orthographe pular (ɓ, ɗ, ŋ, ƴ). **Aucune licence**, producteur et origine
  inconnus : inutilisable tant que ce n'est pas éclairci.
- **Manuscrits ajami du Fuuta Jalon** (Boston University, African Ajami Library) : CC BY-NC 4.0, recherche et
  enseignement seulement, en écriture arabe.
- **Common Voice** (Mozilla) : du fulfulde de l'Adamaoua (`fub`, 13 h), une autre variété. Pas de pular de Guinée
  trouvé.
- **Non ouverts, mais à garder comme partenaires possibles** : la chaîne YouTube « Apprendre le pulaar Guinée »
  (Siraajo Jallo, 101 vidéos, licence YouTube standard) ; l'application Dialect (pulaar du Sénégal, tous droits
  réservés).
- À vérifier : Bloom Library (livres illustrés souvent sous Creative Commons), les guides de santé Hesperian en
  pular, les livres de l'éditeur guinéen Ganndal (dictionnaires illustrés en français, pular, soussou et malinké),
  et la couverture du pular par les modèles de parole de Meta (MMS).

## 2. Malinké (maninka, écriture N'Ko et latine)

- **nicolingua-0005-nqo-nmt-resources** (`github.com/mdoumbouya/nicolingua-0005-nqo-nmt-resources`), licence lue :
  **CC BY-SA 4.0**.
  - Volumes : 130 850 entrées parallèles (25 848 trilingues N'Ko-anglais-français, 59 442 N'Ko-anglais, 45 560
    N'Ko-français), 3 291 371 mots de N'Ko seul, et un dictionnaire N'Ko-français.
  - Contenu : textes religieux, chaînes de localisation de téléphone, **Constitution guinéenne en N'Ko**.
  - Donateurs : Baba Mamadi Diané, Solo Farabado Cissé, Djibrila Diané, Nafadji Sory Condé, Kalo Mory Diané ;
    Stanford University et N'Ko USA. À citer.
- **maninka-mt** (`github.com/icbrahimc/maninka-mt`) : ces données translittérées en latin, environ 119 000 paires
  d'entraînement, plus 500 de développement et 500 de test, sous CC BY-SA 4.0. Ses modèles affinés sont non
  commerciaux.
- Article de référence : *Machine Translation for Nko: Tools, Corpora and Baseline Results* (arXiv 2310.15612).
- Conséquence technique : le vocabulaire élagué de Dial-bowe-Guinee-2B ne sait pas écrire le N'Ko. Il faudrait
  repartir de la base complète.

## 3. Soussou (susu, `sus`)

- Aucun corpus de texte ouvert trouvé.
- Parole : voir § 4. Le corpus radio nicolingua contient aussi du soussou, sans transcription.

## 4. Parole (les trois langues)

- **nicolingua-0004-west-african-va-asr-corpus** (OpenSLR 106) : français, malinké, pular et soussou. 10 083 énoncés
  enregistrés par 49 locuteurs (16 femmes, 33 hommes, de 5 à 76 ans). Licence lue : **CC BY-SA 4.0**. Une revue
  l'estime à environ 51 heures, chiffre **à vérifier**. Article : Doumbouya, Einstein et Piech, AAAI 2021.
- **West African Radio Corpus** (même équipe) : 17 091 extraits de 30 s de six radios guinéennes, non annotés. La
  licence n'a pas été lue.

## 5. Droit et administration guinéens (en français)

- **Statut des textes officiels.** La loi guinéenne sur le droit d'auteur est la loi L/2019/0028/AN du 7 juin 2019
  (WIPO Lex, GN007), qui abroge celle de 1980. Les textes officiels sont **probablement** exclus de la protection,
  comme dans les lois voisines, mais l'article n'a pas pu être lu : le PDF de WIPO demande un lien signé.
  **À vérifier dans le texte** avant tout usage. Les CGU de droitguineen.com disent aussi que « les textes de loi
  relèvent du domaine public ».
- **droitguineen.com** (Djouri Tech SAS, service privé non affilié au gouvernement) : Constitution, codes (civil 2019,
  travail, pénal, minier…), lois, décrets, arrêtés, Journal officiel, textes OHADA et jurisprudence. Ses CGU
  interdisent « l'extraction substantielle » de ses bases, les téléchargements systématiques et l'extraction
  automatisée sans autorisation. Les téléchargements sont réservés à un usage personnel. **On ne peut donc pas
  aspirer ce site.** Il faut prendre les textes à leur source officielle, ou obtenir l'accord de l'éditeur.
- **legisguinee.com** : répertoire des codes en vigueur. Conditions non lues : **à vérifier**.
- **Sources officielles** : site d'investissement du gouvernement (invest.gov.gn, Code du travail de 2014, loi
  L/2014/072/CNT), Journal officiel de la République de Guinée (seul à faire foi), textes OHADA (communs à 17 pays).
  Pas d'accès officiel en ligne au Journal officiel trouvé : **à chercher**.
- Anciennes versions qui circulent (Code civil sur jafbase.fr ou sur le site de l'UNICEF) : antérieures au Code
  civil de 2019. À éviter, sauf pour l'histoire.
- La Constitution guinéenne existe aussi en N'Ko (nicolingua-0005) : c'est un pont possible entre droit et langues.

## Prochaines étapes proposées

1. Lire l'article d'exclusion de la loi L/2019/0028/AN, et le texte de l'accord de Bangui (OAPI) s'il s'applique.
2. Chercher l'accès officiel aux textes : Secrétariat général du Gouvernement, Journal officiel, OHADA.
3. Écrire à droitguineen.com, et à Siraajo Jallo pour le pular, pour proposer un partenariat.
4. Mesurer ce que les modèles existants savent déjà en droit guinéen et dans les trois langues, avant tout
   entraînement.
