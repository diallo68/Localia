// Mise en forme des réponses. Chargé comme script dans l'interface et par les tests Node.
// Le HTML écrit par le modèle est affiché comme texte ; les images ne sont pas chargées.
function createMarkdown(markdownit) {
  const md = markdownit({ html: false, linkify: false, breaks: true });
  md.disable('image');
  return (text) => md.render(text);
}
if (typeof module !== 'undefined') module.exports = { createMarkdown };
