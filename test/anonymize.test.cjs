const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnonymizer, anonymizedSummary } = require('../src/anonymize.js');

test('anonymisation : données personnelles repérées et remplacées par des étiquettes stables', () => {
  const a = createAnonymizer();
  const masked = a.mask(
    [
      'Patient : Mamadou DIALLO, né le 12/03/1985, dossier IPP 2024-5531.',
      'Adressé par le Dr Fatoumata Bah. Tél. +224 622 12 34 56, courriel m.diallo@exemple.org.',
      'Domicile : 14 rue des Manguiers, 75011 Paris.',
      'Virement sur FR76 3000 6000 0112 3456 7890 189 ; sécurité sociale 1 85 03 75 123 456 78.',
      'Revu le 20/09/2026 par M. Diallo et Mme Camara.',
    ].join('\n'),
  );
  for (const secret of [
    'Mamadou DIALLO',
    '12/03/1985',
    '2024-5531',
    'Fatoumata Bah',
    '622 12 34 56',
    'm.diallo@exemple.org',
    'rue des Manguiers',
    'FR76 3000',
    '1 85 03 75 123 456 78',
    'Camara',
  ])
    assert.ok(!masked.includes(secret), `${secret} encore visible : ${masked}`);
  assert.match(masked, /Patient : \[PERSONNE \d\], né le \[DATE DE NAISSANCE 1\]/);
  const patient = Object.keys(a.map).find((label) => a.map[label] === 'Mamadou DIALLO');
  assert.match(masked, /Revu le 20\/09\/2026/, 'les autres dates restent : utiles au raisonnement');
  // Même valeur, même étiquette ; la réponse est remise en clair.
  const again = a.mask('Mamadou DIALLO a rappelé.');
  assert.equal(again, `${patient} a rappelé.`);
  assert.equal(
    a.unmask(`Conclusion pour ${patient} ([EMAIL 1]).`),
    'Conclusion pour Mamadou DIALLO (m.diallo@exemple.org).',
  );
  assert.match(anonymizedSummary(a.counts), /personnes/);
});

test('anonymisation : étiquettes de la conversation reprises, sigles épargnés, liste personnelle', () => {
  const first = createAnonymizer();
  first.mask('Contrat signé par Aïssatou SOW.');
  const next = createAnonymizer(first.map, ['Clinique Pasteur']);
  const masked = next.mask(
    'Aïssatou SOW travaille à la Clinique Pasteur ; rapport de l’ONU en PDF.',
  );
  assert.equal(masked, '[PERSONNE 1] travaille à la [MOT MASQUÉ 1] ; rapport de l’ONU en PDF.');
  assert.equal(
    next.unmask(masked),
    'Aïssatou SOW travaille à la Clinique Pasteur ; rapport de l’ONU en PDF.',
  );
  // Un texte sans donnée personnelle ne change pas.
  const plain = 'Le budget prévoit 1 200 000 GNF pour 2026, soit 12 % de plus.';
  assert.equal(createAnonymizer().mask(plain), plain);
});
