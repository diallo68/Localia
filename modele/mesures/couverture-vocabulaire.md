# Couverture du vocabulaire Qwen3.5 (fiche 08)

Tokenizer : 248044 jetons BPE + 26 spéciaux. Sélection sur 22122 documents FineWeb-2 fr (16 228 573 jetons) ; 70 223 jetons distincts y apparaissent au moins une fois.

| K demandé | Gardés (après fermeture) | Couverture sélection | Allongement : FineWeb-2 fr (tenu à part) | Allongement : calibration-localia-fr.txt | Allongement : code-localia-js.txt | Allongement : README.md |
|---|---|---|---|---|---|---|
| 32000 | 33472 | 99.304 % | +1.11 % | +6.12 % | +38.91 % | +26.62 % |
| 48000 | 49742 | 99.818 % | +0.45 % | +4.28 % | +30.93 % | +15.14 % |
| 64000 | 67223 | 99.964 % | +0.22 % | +3.87 % | +25.56 % | +10.39 % |
| 80000 | 73954 | 100.000 % | +0.16 % | +3.77 % | +24.60 % | +9.32 % |
| 100000 | 73954 | 100.000 % | +0.16 % | +3.77 % | +24.60 % | +9.32 % |
| 128000 | 73954 | 100.000 % | +0.16 % | +3.77 % | +24.60 % | +9.32 % |

Allongement = jetons nécessaires avec le vocabulaire élagué / jetons avec le vocabulaire complet − 1, sur des textes non utilisés pour la sélection.
