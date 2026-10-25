# Import dans Ollama

1. Remplacer le gabarit de conversation du GGUF par `gabarit_sans_reflexion.jinja` (même gabarit que Qwen3.5, mais le bloc `<think>` vide est toujours émis) :

   ```
   PYTHONPATH=<llama.cpp>/gguf-py python <llama.cpp>/gguf-py/gguf/scripts/gguf_new_metadata.py \
     --chat-template-file gabarit_sans_reflexion.jinja qwen35-2b-lora-Q4_K_M.gguf qwen35-2b-lora-Q4_K_M-sansreflexion.gguf
   ```

2. Placer le GGUF à côté de `Modelfile`, puis : `ollama create localia-doc-2b -f Modelfile`.

Pourquoi : Ollama 0.40.5 lit le gabarit Jinja du GGUF et active la réflexion par défaut (`ollama show` : « thinking, default true »). Un `TEMPLATE` dans le Modelfile est ignoré pour ce GGUF, et `PARAMETER think` n'existe pas. Localia n'envoie le réglage `think` que si l'utilisateur l'a choisi. **[mesuré]** Sans correction, la réponse est vide après 9 min 40 (contexte de 8 192 jetons rempli par la réflexion) ; avec le gabarit corrigé, réponse directe, que `think` soit absent ou vrai.
