const { test } = require('node:test');
const assert = require('node:assert/strict');
const { alwaysEmptyThought, effectiveThink } = require('../src/thinking-template.cjs');

// Fin du gabarit de Dial-bowe-Guinee-2B (bloc vide toujours émis, enable_thinking cité en commentaire).
const sansReflexion = `{%- for message in messages %}{{- message.content }}{%- endfor %}
{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\\n' }}
    {#- Localia : modèle entraîné sans réflexion ; le bloc vide est toujours émis, quel que soit enable_thinking. #}
    {{- '<think>\\n\\n</think>\\n\\n' }}
{%- endif %}`;
// Qwen3 d'origine : bloc vide seulement si enable_thinking vaut false.
const qwen3 = `{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\\n' }}
    {%- if enable_thinking is defined and enable_thinking is false %}
        {{- '<think>\\n\\n</think>\\n\\n' }}
    {%- endif %}
{%- endif %}`;
// DeepSeek-R1 : réflexion ouverte, jamais vide.
const r1 = `{% if add_generation_prompt %}{{'<｜Assistant｜><think>\\n'}}{% endif %}`;
// Gemma : pas de réflexion du tout.
const gemma = `{%- if add_generation_prompt -%}{{'<start_of_turn>model\\n'}}{%- endif -%}`;
// Bloc vide dans l'historique seulement (réponses précédentes), pas à la génération.
// Réflexion ouverte dans une branche, bloc vide dans l'autre (relecture de Codex, 7 nov. 2026).
const conditionnel = `{%- if add_generation_prompt %}
    {{- '<|im_start|>assistant\\n' }}
    {%- if thinking %}{{- '<think>\\n' }}{%- else %}{{- '<think>\\n\\n</think>\\n\\n' }}{%- endif %}
{%- endif %}`;
const historique = `{%- for m in messages %}{{- '<think>\\n\\n</think>\\n\\n' + m.content }}{%- endfor %}
{%- if add_generation_prompt %}{{- '<|im_start|>assistant\\n' }}{%- endif %}`;

test('gabarit qui émet toujours le bloc de réflexion vide reconnu', () => {
  assert.equal(alwaysEmptyThought(sansReflexion), true);
});

test('gabarits où la réflexion reste réglable ou absente non reconnus', () => {
  for (const g of [qwen3, r1, gemma, historique, conditionnel, '', undefined, null, 42])
    assert.equal(alwaysEmptyThought(g), false, String(g).slice(0, 40));
});

test('pas de réglage de la réflexion : désactivée pour un modèle entraîné sans réflexion', () => {
  assert.equal(effectiveThink(undefined, sansReflexion), false);
  assert.equal(effectiveThink(null, sansReflexion), false);
  assert.equal(effectiveThink(undefined, qwen3), undefined);
  assert.equal(effectiveThink(undefined, undefined), undefined);
});

test('le réglage choisi par l’utilisateur est toujours gardé', () => {
  assert.equal(effectiveThink(true, sansReflexion), true);
  assert.equal(effectiveThink(false, sansReflexion), false);
  assert.equal(effectiveThink(false, qwen3), false);
  assert.equal(effectiveThink(true, qwen3), true);
});
