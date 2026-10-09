# Logo de Localia

Un cercle, comme l'iris d'un œil : l'humain regarde l'IA (la pile de serveurs), et l'avenir se
lève derrière elle (le soleil sur l'horizon). Dessin et couleurs : `scripts/logo.cjs`.

Six fonds sont gardés ici, chacun en deux fichiers :

| Fond | Signe seul | Icône d'application (fond Aube) |
|---|---|---|
| **Blanc** (choisi le 9 octobre 2026) | `blanc-signe.svg` | `blanc-icone.svg` |
| Crème | `creme-signe.svg` | `creme-icone.svg` |
| Bleu ciel | `ciel-signe.svg` | `ciel-icone.svg` |
| Bleu nuit | `nuit-signe.svg` | `nuit-icone.svg` |
| Sarcelle | `sarcelle-signe.svg` | `sarcelle-icone.svg` |
| Anthracite | `anthracite-signe.svg` | `anthracite-icone.svg` |

## Changer de fond

```sh
npm run logo -- nuit      # ou : blanc, creme, ciel, sarcelle, anthracite
npm run package           # reconstruire l'application avec la nouvelle icône
```

La commande récrit le logo de l'interface (`src/assets/logo.svg`) et les icônes
(`build/icon.png` pour Windows et Linux, `build/icon.icns` pour macOS). Pour que le choix
reste celui par défaut, modifiez aussi `CHOISI` dans `scripts/logo.cjs`.
