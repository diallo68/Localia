# Mémoire et vitesse selon le contexte, Dial-bowe-Guinee-2B-Q4_K_M (2026-11-03)

Fichier préparé par publication/preparer_gguf.py (SHA-256 437607848b5a…, poids identiques à a4b5f4bc…).
Processeur seul, 8 fils, fa=0.

## llama-server, au repos après une courte requête (RSS ; même réponse à température 0 que l'original)

| contexte | RSS |
|---:|---:|
| 8 192 | 1 378 Mo |
| 16 384 | 1 476 Mo |
| 32 768 | 1 672 Mo |
| 65 536 | 2 065 Mo |

Cache : 6 couches d'attention complète × 2 têtes KV × 256 × (K+V) × 2 octets = 12 Ko par jeton.

## llama-bench -d 32768 -p 1024 -n 64 -r 1, /usr/bin/time -l

```
| model                          |       size |     params | backend    | threads |  fa |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --: | --------------: | -------------------: |
| qwen35 2B Q4_K - Medium        |   1.03 GiB |     1.70 B | BLAS       |       8 |   0 | pp1024 @ d32768 |          7.17 ± 0.00 |
| qwen35 2B Q4_K - Medium        |   1.03 GiB |     1.70 B | BLAS       |       8 |   0 |   tg64 @ d32768 |          3.00 ± 0.00 |
     4116.89 real     33065.67 user       447.81 sys
          2907172864  maximum resident set size
CPU_Speed_Limit CPU_Speed_Limit 	= 50
```
