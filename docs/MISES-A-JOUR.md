# Mises à jour de Localia

## Pour l'utilisateur

- Au démarrage, Localia lit la liste **publique** des versions sur GitHub (diallo68/Localia).
  Aucune donnée ne quitte l'ordinateur. Désactivable dans *Confidentialité et sécurité →
  Mises à jour de Localia*, où l'on peut aussi chercher à la main.
- Une nouvelle version apparaît dans un bandeau. Rien n'est téléchargé ni installé sans accord.
- **Windows et Linux (AppImage)** : téléchargement en arrière-plan, installation au redémarrage
  (electron-updater).
- **macOS non signé** : macOS refuse l'installation automatique d'une application sans signature
  Apple. Localia télécharge l'image disque (`.dmg`) dans Téléchargements, vérifie son empreinte
  SHA-256 publiée par GitHub et l'ouvre : il reste à glisser Localia dans Applications.
- **macOS signé** (`npm run package:diffusion`, compte Apple Developer) : la version porte
  `signedRelease: true` et s'installe automatiquement, comme sous Windows.

## Publier une nouvelle version

1. Dans `~/localia-desktop`, changer `version` dans `package.json` (ex. `0.6.0`), tester, puis
   reporter les commits dans `~/localia-public` comme d'habitude.
2. Dans `~/localia-public` :
   ```sh
   git tag v0.6.0
   env -u GITHUB_TOKEN git push origin main v0.6.0
   ```
3. Le workflow **Publication** construit les 4 applications (macOS Apple Silicon et Intel,
   Windows, Linux) et les dépose dans une publication **en brouillon** (environ 30 min).
4. Sur GitHub, onglet *Releases* : relire le brouillon, écrire les nouveautés (elles s'affichent
   dans Localia), puis **Publier**. Les utilisateurs voient alors la mise à jour.

## Limites connues

- Les deux constructions macOS déposent chacune un `latest-mac.yml` ; tant que le Mac est en mode
  assisté, Localia ne s'en sert pas (il choisit le `.dmg` de son processeur). Avant de passer au
  mode automatique signé, il faudra fusionner les deux fichiers (une seule construction
  `--mac --x64 --arm64`, ou une étape de fusion).
- Linux `.deb` : pas de mise à jour automatique ; l'AppImage, oui.
