# 2.3 : vitesse alternée 2B complet / 2B vocabulaire élagué (vocfr48k), 8 fils, fa=0 (2026-10-18 11:50)
== passe 1 Qwen3.5-2B-Q4_K_M ;  CPU_Speed_Limit = 100 ; charge 2.90 8.23 12.13
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.61 ± 0.40 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.10 ± 0.16 |
== passe 1 Qwen3.5-2B-Q4_K_M-vocfr48k ;  CPU_Speed_Limit = 52 ; charge 13.05 12.40 12.88
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.12 ± 0.24 |
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.72 ± 0.14 |
== passe 2 Qwen3.5-2B-Q4_K_M ;  CPU_Speed_Limit = 52 ; charge 11.59 12.53 12.87
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         24.93 ± 0.24 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.18 ± 0.15 |
== passe 2 Qwen3.5-2B-Q4_K_M-vocfr48k ;  CPU_Speed_Limit = 52 ; charge 11.44 13.01 13.12
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         22.65 ± 1.24 |
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.34 ± 0.00 |
== passe 3 Qwen3.5-2B-Q4_K_M ;  CPU_Speed_Limit = 50 ; charge 10.86 12.36 12.85
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.29 ± 0.65 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.31 ± 0.05 |
== passe 3 Qwen3.5-2B-Q4_K_M-vocfr48k ;  CPU_Speed_Limit = 52 ; charge 11.91 13.05 13.20
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.24 ± 0.37 |
| qwen35 2B Q4_K - Medium        | 1023.40 MiB |     1.64 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.92 ± 0.19 |
fin 12:28
