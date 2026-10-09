# Diffuser Localia sur d'autres Mac

`npm run package` construit `dist/mac/Localia.app` pour **ce** Mac : l'application n'est ni signée
par un développeur identifié ni notariée. Copiée sur un autre Mac, elle est bloquée par macOS
(« Localia est endommagée » ou « développeur non identifié »). Pour la diffuser, il faut une
signature Developer ID et une notarisation par Apple.

## Ce qu'il faut une fois

1. **Un compte Apple Developer** (99 $ par an) : https://developer.apple.com/programs/
2. **Un certificat « Developer ID Application »**, créé dans Xcode (Réglages → Comptes → Gérer
   les certificats → +) ou sur developer.apple.com, puis installé dans le trousseau de ce Mac.
   Vérification : `security find-identity -v -p codesigning` doit afficher une ligne
   « Developer ID Application : Nom (ÉQUIPE) ».
3. **Un mot de passe pour application**, créé sur https://account.apple.com (Connexion et
   sécurité → Mots de passe pour app). Il sert uniquement à la notarisation.
4. **L'identifiant d'équipe** (10 caractères), visible sur developer.apple.com → Membership.

## À chaque version

Dans un terminal, depuis `~/localia-desktop` :

```sh
export APPLE_ID="adresse@exemple.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABCDE12345"
npm run package:diffusion            # Mac Intel
npm run package:diffusion -- --arm64 # Mac Apple Silicon
```

Le script vérifie d'abord le certificat et les trois variables, et s'arrête avec un message clair
s'il en manque. Il produit ensuite un `.dmg` et un `.zip` dans `dist/`, signés avec le runtime
renforcé (autorisations : `build/entitlements.mac.plist`) puis notariés. La notarisation prend en
général quelques minutes.

Vérification sur le paquet produit :

```sh
spctl --assess --type execute --verbose dist/mac/Localia.app
```

La réponse attendue est « accepted, source=Notarized Developer ID ».

## Limites connues

- Ce parcours n'a pas encore pu être essayé faute de certificat : le premier passage peut
  demander d'ajuster les autorisations si une bibliothèque du moteur intégré est refusée.
- L'icône est encore celle d'Electron : ajoutez `build/icon.icns` avant une diffusion.
- Windows a son propre circuit de signature (certificat de signature de code), non traité ici.
