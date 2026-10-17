# Couverture du vocabulaire Qwen3.5 (fiche 08)

Tokenizer : 248044 jetons BPE + 26 spéciaux. Sélection sur 22122 documents FineWeb-2 fr (16 228 573 jetons) ; 70 223 jetons distincts y apparaissent au moins une fois.

| K demandé | Gardés (après fermeture) | Couverture sélection | Allongement : FineWeb-2 fr (tenu à part) | Allongement : calibration-localia-fr.txt | Allongement : code-localia-js.txt | Allongement : README.md |
|---|---|---|---|---|---|---|
| 16000 | 129859 | 99.890 % | +0.30 % | +0.63 % | +0.19 % | +0.19 % |
| 32000 | 130326 | 99.955 % | +0.15 % | +0.10 % | +0.09 % | +0.03 % |
| 48000 | 131170 | 99.974 % | +0.10 % | +0.01 % | +0.05 % | +0.00 % |
| 64000 | 134395 | 99.992 % | +0.05 % | +0.01 % | +0.02 % | +0.00 % |

Allongement = jetons nécessaires avec le vocabulaire élagué / jetons avec le vocabulaire complet − 1, sur des textes non utilisés pour la sélection.
