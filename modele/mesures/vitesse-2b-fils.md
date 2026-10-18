# 2.2 bis : Qwen3.5-2B Q4_K_M, fils et profondeur (2026-10-18 10:49) ; charge 2.87 2.20 2.01 ; total = 5120.00M  used = 4229.25M  free = 890.75M  (encrypted)
| model                          |       size |     params | backend    | threads |  fa |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --: | --------------: | -------------------: |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |          pp1024 |         60.09 ± 1.49 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |            tg64 |          2.04 ± 1.27 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |  pp1024 @ d4096 |         21.47 ± 3.20 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |    tg64 @ d4096 |          3.47 ± 0.01 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |  pp1024 @ d8192 |         16.77 ± 0.04 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       4 |   0 |    tg64 @ d8192 |          3.18 ± 0.01 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |          pp1024 |         72.78 ± 0.41 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |            tg64 |          5.32 ± 0.03 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |  pp1024 @ d4096 |         32.35 ± 0.44 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |    tg64 @ d4096 |          4.92 ± 0.03 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |  pp1024 @ d8192 |         21.36 ± 0.01 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       6 |   0 |    tg64 @ d8192 |          4.50 ± 0.02 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |          pp1024 |         61.28 ± 3.33 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |            tg64 |          4.01 ± 0.15 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d4096 |         30.71 ± 0.95 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d4096 |          5.08 ± 0.01 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         22.03 ± 0.52 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.15 ± 0.23 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |          pp1024 |         68.57 ± 0.32 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |            tg64 |          5.98 ± 0.13 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |  pp1024 @ d4096 |         35.94 ± 0.01 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |    tg64 @ d4096 |          4.86 ± 0.06 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |  pp1024 @ d8192 |         20.12 ± 3.72 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |      12 |   0 |    tg64 @ d8192 |          4.54 ± 0.22 |

build: 7fe450e19 (11146)
fin 11:40 ; charge 16.93 18.23 15.92

Bridage thermique (`pmset -g therm`, CPU_Speed_Limit) relevé pendant et après la mesure : 43 puis 50 (100 = pleine vitesse).

# Échantillonnage du serveur (11:45) : cas D059, 2 116 jetons d'entrée, 200 en sortie, 8 fils, cache de prompt désactivé
CPU_Speed_Limit : 64 avant, 50 après.
defaut_t0      lecture 52.8 j/s  génération 4.65 j/s
top_k1         lecture 47.9 j/s  génération 4.90 j/s
defaut_t0_bis  lecture 50.2 j/s  génération 4.87 j/s
top_k1_bis     lecture 49.2 j/s  génération 4.74 j/s
