# Génération à 8k avec et sans flash attention (8 fils, 2026-10-17 10:33)
== Ministral-3-3B-Instruct-2512-Q4_K_M.gguf
| model                          |       size |     params | backend    | threads |  fa |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --: | --------------: | -------------------: |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          4.21 ± 0.17 |
| mistral3 3B Q4_K - Medium      |   1.99 GiB |     3.43 B | BLAS       |       8 |   1 |    tg64 @ d8192 |          1.97 ± 0.13 |
== Qwen3.5-4B-IQ4_XS.gguf
| model                          |       size |     params | backend    | threads |  fa |            test |                  t/s |
| ------------------------------ | ---------: | ---------: | ---------- | ------: | --: | --------------: | -------------------: |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |   0 |    tg64 @ d8192 |          4.24 ± 0.14 |
| qwen35 4B IQ4_XS - 4.25 bpw    |   2.30 GiB |     4.21 B | BLAS       |       8 |   1 |    tg64 @ d8192 |          3.60 ± 0.21 |
