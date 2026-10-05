const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseQuestions, formatQuestions } = require('../src/questions.js');

test('une seule question sans séparateur', () => {
  assert.deepEqual(parseQuestions('  Bonjour ?  '), [{ label: 'Q1', prompt: 'Bonjour ?' }]);
});

test('série : séparateurs, titres, réponses attendues non envoyées', () => {
  const text = `## A1
Quelle accuracy ?
Attendu : 99,35 %
38 classes
---

Deuxième question
sur deux lignes

   ---
## C1 — incohérences
def f():
    return 1
attendu: aucun écart`;
  assert.deepEqual(parseQuestions(text), [
    { label: 'A1', prompt: 'Quelle accuracy ?', expected: '99,35 %\n38 classes' },
    { label: 'Q2', prompt: 'Deuxième question\nsur deux lignes' },
    { label: 'C1 — incohérences', prompt: 'def f():\n    return 1', expected: 'aucun écart' },
  ]);
});

test('un tiret dans le texte ne coupe pas la question', () => {
  assert.equal(parseQuestions('a --- b\n- liste\n----').length, 1);
});

test('erreurs explicites : question vide, trop longue, trop de questions', () => {
  assert.throws(() => parseQuestions('## A1\nAttendu : x'), /« A1 » est vide/);
  assert.throws(() => parseQuestions('x'.repeat(20001)), /20 000/);
  assert.throws(() => parseQuestions(Array(101).fill('q').join('\n---\n')), /100 questions/);
  assert.deepEqual(parseQuestions('\n---\n\n'), []);
});

test('formatQuestions redonne un texte relisible à l’identique', () => {
  const text = '## A1\nQuestion\nAttendu : réponse\n---\n## Q2\nAutre';
  const questions = parseQuestions(text);
  assert.deepEqual(parseQuestions(formatQuestions(questions)), questions);
  assert.equal(formatQuestions([{ label: 'Q1', prompt: 'Seule' }]), 'Seule');
});

test('catégorie facultative, jamais envoyée, conservée par formatQuestions', () => {
  const text =
    '## A1\nCatégorie : Extraction\nQuelle accuracy ?\nAttendu : 99,35 %\n---\n## B1\nQuestion\nAttendu : réponse\ncatégorie : pas une catégorie';
  const questions = parseQuestions(text);
  assert.deepEqual(questions[0], {
    label: 'A1',
    prompt: 'Quelle accuracy ?',
    category: 'Extraction',
    expected: '99,35 %',
  });
  assert.equal(
    questions[1].category,
    undefined,
    'une ligne dans la réponse attendue reste attendue',
  );
  assert.match(questions[1].expected, /pas une catégorie/);
  assert.deepEqual(parseQuestions(formatQuestions(questions)), questions);
});

test('mots-clés anglais : Category et Expected', () => {
  assert.deepEqual(parseQuestions('## K1\nCategory: Code\nWrite a function.\nExpected: it runs'), [
    { label: 'K1', prompt: 'Write a function.', category: 'Code', expected: 'it runs' },
  ]);
});
