// Gabarit de conversation (tokenizer.chat_template du GGUF) qui émet toujours un bloc de réflexion
// vide après « assistant », sans tenir compte de enable_thinking : modèle entraîné sans réflexion,
// comme Dial-bowe-Guinee-2B. Pour un tel modèle, l'absence de réglage de la réflexion vaut
// « réflexion désactivée » : sinon le moteur intégré écrit l'invite sans ce bloc, dans un format
// que le modèle n'a pas vu à l'entraînement (réponses précédées de sauts de ligne, et une réponse
// contradictoire observée le 7 nov. 2026).
function alwaysEmptyThought(template) {
  if (typeof template !== 'string') return false;
  const code = template.replace(/\{#[\s\S]*?#\}/g, ''); // commentaires Jinja retirés
  // Gabarit qui dépend du réglage (Qwen3, Qwen3.5 d'origine) : la réflexion reste réglable.
  if (/enable_thinking/.test(code)) return false;
  const generation = code.lastIndexOf('add_generation_prompt');
  if (generation < 0) return false;
  return /<think>(?:\\n|\n|\s)*<\/think>/.test(code.slice(generation));
}

// Réglage de la réflexion à appliquer : celui de l'utilisateur s'il en a choisi un.
function effectiveThink(think, template) {
  if (think !== undefined && think !== null) return think;
  return alwaysEmptyThought(template) ? false : think;
}

module.exports = { alwaysEmptyThought, effectiveThink };
