const { test } = require('node:test');
const assert = require('node:assert/strict');
const { documentNotes } = require('../src/document-notes.js');
const { documentMessages } = require('../src/chat.cjs');

test('repère « % BR » : ajouté seulement pour une garantie en pourcentage de la BR', () => {
  assert.match(
    documentNotes('Analyses et examens de laboratoire   100 % BR'),
    /^REPÈRE DE LECTURE/,
  );
  assert.match(documentNotes('Consultation : + 50 % de la BR'), /tarif de la Sécurité sociale/);
  assert.match(documentNotes('Analyses 100 % BR', 'en'), /^READING NOTE/);
  assert.equal(documentNotes('Taux de TVA : 20 %. Code BR-2026.'), '');
  assert.equal(documentNotes('Rendement de 100 % BRUT.'), '');
  assert.equal(documentNotes(''), '');
});

test('PDF joint : repère placé dans la source documentaire, avant le texte', () => {
  const doc = {
    name: 'contrat.pdf',
    emptyPages: [],
    pages: [{ number: 1, text: 'Analyses et examens de laboratoire : 100 % BR.' }],
  };
  const result = documentMessages(doc, [
    { role: 'user', content: 'Mes analyses sont-elles remboursées ?' },
  ]);
  assert.match(result.messages[1].content, /^SOURCE DOCUMENTAIRE — début\nREPÈRE DE LECTURE/);
  const plain = documentMessages(
    { name: 'contrat.pdf', emptyPages: [], pages: [{ number: 1, text: 'Facture : 110 EUR.' }] },
    [{ role: 'user', content: 'Total ?' }],
  );
  assert.doesNotMatch(plain.messages[1].content, /REPÈRE/);
});
