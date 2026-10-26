# 3.3 : vitesse alternée base / lot 4 (processeur seul, -ngl 0), 8 fils, fa=0 (2026-10-26 09:06)
== passe 1 Qwen3.5-2B-Q4_K_M.gguf ; CPU_Speed_Limit = 100 ; charge  2.78 3.53 3.49 
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         24.84 ± 1.80 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.55 ± 0.23 |
pic de mémoire (RSS) : 1.91 Go
== passe 1 qwen35-2b-lora-Q4_K_M-sansreflexion.gguf ; CPU_Speed_Limit = 100 ; charge  12.85 11.72 7.78 
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.29 ± 0.92 |
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.80 ± 0.02 |
pic de mémoire (RSS) : 2.02 Go
== passe 2 Qwen3.5-2B-Q4_K_M.gguf ; CPU_Speed_Limit = 87 ; charge  10.91 12.48 9.62 
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         26.13 ± 0.16 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          4.53 ± 0.67 |
pic de mémoire (RSS) : 2.02 Go
== passe 2 qwen35-2b-lora-Q4_K_M-sansreflexion.gguf ; CPU_Speed_Limit = 50 ; charge  12.48 13.67 11.31 
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         25.99 ± 0.13 |
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          5.18 ± 0.04 |
pic de mémoire (RSS) : 1.92 Go
== passe 3 Qwen3.5-2B-Q4_K_M.gguf ; CPU_Speed_Limit = 54 ; charge  13.24 14.45 12.69 
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         22.65 ± 1.69 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          4.16 ± 0.12 |
pic de mémoire (RSS) : 2.02 Go
== passe 3 qwen35-2b-lora-Q4_K_M-sansreflexion.gguf ; CPU_Speed_Limit = 54 ; charge  12.41 13.86 13.14 
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |  pp1024 @ d8192 |         22.97 ± 1.41 |
| qwen35 2B Q4_K - Medium        |   1.21 GiB |     1.94 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          4.66 ± 0.01 |
pic de mémoire (RSS) : 1.97 Go
fin 09:43
