# Vitesse des bases candidates (llama-bench, 8 fils, CPU seul, 2026-10-17 10:06)
== Qwen3.5-2B-Q4_K_M.gguf
| model                          |       size |     params | backend    | threads |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --------------: | -------------------: |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |           pp512 |        126.12 ± 1.94 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |            tg64 |         17.20 ± 0.02 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |   pp512 @ d8192 |         67.66 ± 0.32 |
| qwen35 2B Q4_K - Medium        |   1.18 GiB |     1.88 B | BLAS       |       8 |    tg64 @ d8192 |         11.06 ± 0.69 |
== Qwen3.5-4B-IQ4_XS.gguf
| model                          |       size |     params | backend    | threads |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --------------: | -------------------: |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |           pp512 |         26.61 ± 3.48 |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |            tg64 |          6.13 ± 0.40 |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |   pp512 @ d8192 |         21.30 ± 0.81 |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |    tg64 @ d8192 |          5.48 ± 0.36 |
== Ministral-3-3B-Instruct-2512-Q4_K_M.gguf
| model                          |       size |     params | backend    | threads |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --------------: | -------------------: |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |           pp512 |         75.30 ± 6.07 |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |            tg64 |          9.68 ± 2.18 |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |   pp512 @ d8192 |         20.81 ± 0.72 |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |    tg64 @ d8192 |          2.09 ± 0.06 |
== Phi-4-mini-instruct-Q4_K_M.gguf
| model                          |       size |     params | backend    | threads |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --------------: | -------------------: |
| phi3 3B Q4_K - Medium          |   2.31 GiB |     3.84 B | BLAS       |       8 |           pp512 |         37.65 ± 1.80 |
| phi3 3B Q4_K - Medium          |   2.31 GiB |     3.84 B | BLAS       |       8 |            tg64 |          6.44 ± 0.26 |
| phi3 3B Q4_K - Medium          |   2.31 GiB |     3.84 B | BLAS       |       8 |   pp512 @ d8192 |         21.29 ± 0.61 |
| phi3 3B Q4_K - Medium          |   2.31 GiB |     3.84 B | BLAS       |       8 |    tg64 @ d8192 |          2.18 ± 0.04 |
