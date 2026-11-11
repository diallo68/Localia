const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDuckResults } = require('../src/web.cjs');

// Page de résultats DuckDuckGo réduite : une publicité, deux résultats, un doublon.
const PAGE = `
<div class="result results_links results_links_deep result--ad">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fduckduckgo.com%2Fy.js%3Fad_domain%3Dshop.fr&amp;rut=1">Achetez <b>maintenant</b></a>
  <a class="result__snippet" href="#">Publicité.</a>
</div>
<div class="result results_links results_links_deep web-result ">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ffr.wikipedia.org%2Fwiki%2FMildiou&amp;rut=2">Mildiou &amp; pomme de terre — <b>Wikipédia</b></a>
  <a class="result__snippet" href="#">Le mildiou est causé par &#x27;Phytophthora infestans&#x27;.</a>
</div>
<div class="result results_links results_links_deep web-result ">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=http%3A%2F%2Fexemple.gn%2Fpage&amp;rut=3">Exemple</a>
</div>
<div class="result results_links results_links_deep web-result ">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ffr.wikipedia.org%2Fwiki%2FMildiou&amp;rut=4">Doublon</a>
</div>`;

test('recherche Internet : vrais résultats seulement, adresse réelle, texte sans balises', () => {
  const results = parseDuckResults(PAGE);
  assert.deepEqual(results, [
    {
      title: 'Mildiou & pomme de terre — Wikipédia',
      url: 'https://fr.wikipedia.org/wiki/Mildiou',
      snippet: "Le mildiou est causé par 'Phytophthora infestans'.",
    },
    { title: 'Exemple', url: 'http://exemple.gn/page', snippet: '' },
  ]);
  assert.equal(parseDuckResults(PAGE, 1).length, 1);
  assert.deepEqual(parseDuckResults('<html>aucun résultat</html>'), []);
});
