const { test } = require('node:test');
const assert = require('node:assert/strict');
const markdownit = require('markdown-it');
const { createMarkdown } = require('../src/markdown.js');

const render = createMarkdown(markdownit);

test('gras, listes, code et retours à la ligne mis en forme', () => {
  const html = render('Coupure en **septembre 2021**.\nSuite\n\n- un\n- deux\n\n```\nx = 1\n```');
  assert.match(html, /<strong>septembre 2021<\/strong>/);
  assert.match(html, /<br>/);
  assert.match(html, /<ul>\s*<li>un<\/li>/);
  assert.match(html, /<pre><code>x = 1\n<\/code><\/pre>/);
});

test('HTML du modèle affiché comme texte, jamais exécuté', () => {
  const html = render('<script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test('images ignorées et liens javascript: refusés', () => {
  assert.doesNotMatch(render('![logo](https://exemple.fr/a.png)'), /<img/);
  assert.doesNotMatch(render('[clic](javascript:alert(1))'), /href="javascript/);
});
