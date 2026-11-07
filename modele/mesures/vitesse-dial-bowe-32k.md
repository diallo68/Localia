# Après 32 768 jetons, processeur seul (-ngl 0), 8 fils, fa=0, -r 1 (2026-11-07 14:30)
== Q4_K_M ; CPU_Speed_Limit = 100 ; charge  9.72 13.84 12.47  ; free percentage: 69%
| qwen35 2B Q4_K - Medium        |   1.03 GiB |     1.70 B | BLAS       |       8 |   0 | pp1024 @ d32768 |         60.91 ± 0.00 |
| qwen35 2B Q4_K - Medium        |   1.03 GiB |     1.70 B | BLAS       |       8 |   0 |   tg64 @ d32768 |         12.05 ± 0.00 |
pic de mémoire (RSS) : 3.67 Go ; 424.92 s
== Q8_0 ; CPU_Speed_Limit = 56 ; charge  14.32 13.45 12.69  ; free percentage: 73%
| qwen35 2B Q8_0                 |   1.69 GiB |     1.70 B | BLAS       |       8 |   0 | pp1024 @ d32768 |         49.52 ± 0.00 |
| qwen35 2B Q8_0                 |   1.69 GiB |     1.70 B | BLAS       |       8 |   0 |   tg64 @ d32768 |          9.33 ± 0.00 |
pic de mémoire (RSS) : 3.73 Go ; 579.73 s
fin 14:47
