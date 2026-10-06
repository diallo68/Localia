const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkKind,
  taskKey,
  validateMessages,
  documentMessages,
  documentBudget,
  withSystem,
  contextSize,
  exceedsContext,
  chatBody,
  streamStats,
} = require('../src/chat.cjs');

const doc = {
  name: 'facture.pdf',
  emptyPages: [],
  pages: [
    { number: 1, text: 'Invoice total 120 EUR' },
    { number: 2, text: 'Items 50 EUR + 60 EUR = 110 EUR' },
  ],
};

test('type d’opération inconnu refusé avec un message distinct', () => {
  checkKind('chat');
  checkKind('pull');
  assert.throws(() => checkKind('delete'), /Opération inconnue/);
});

test('messages invalides ou trop longs refusés', () => {
  validateMessages([{ role: 'user', content: 'Bonjour' }]);
  for (const messages of [
    null,
    [],
    [{ role: 'system', content: 'x' }],
    [{ role: 'user', content: 42 }],
    [null],
    [{ role: 'user', content: 'x'.repeat(100001) }],
    Array.from({ length: 401 }, () => ({ role: 'user', content: 'x' })),
  ])
    assert.throws(() => validateMessages(messages), /invalide ou trop longue/);
});

test('avec un PDF : consigne système, source puis historique récent limité à 5 000 caractères', () => {
  const messages = [
    { role: 'user', content: 'a'.repeat(3000) },
    { role: 'assistant', content: 'b'.repeat(3000) },
    { role: 'user', content: 'Vérifie le total' },
  ];
  const result = documentMessages(doc, messages);
  assert.equal(result.partial, false);
  assert.deepEqual(result.pages, [1, 2]);
  assert.equal(result.messages[0].role, 'system');
  assert.match(result.messages[1].content, /^SOURCE DOCUMENTAIRE — début\n/);
  assert.match(result.messages[1].content, /110 EUR/);
  // Le message de 3 000 caractères le plus récent tient, le précédent dépasserait 5 000.
  assert.deepEqual(result.messages.slice(2), messages.slice(1));
});

test('avec un PDF : extraits proportionnés au contexte choisi', () => {
  assert.equal(documentBudget(4096, 2048), 10000);
  assert.equal(documentBudget(16384, 2048), 32731);
  // Réponse longue demandée : moins de place pour le document.
  assert.ok(documentBudget(16384, 8000) < documentBudget(16384, 2048));
  assert.equal(documentBudget(1000000), 200000);
});

test('avec un PDF : question de plus de 5 000 caractères refusée', () => {
  assert.throws(
    () => documentMessages(doc, [{ role: 'user', content: 'x'.repeat(5001) }]),
    /5 000 caractères/,
  );
});

test('conversation longue signalée au-delà de l’approximation du contexte', () => {
  const long = [
    { role: 'user', content: 'x'.repeat(7000) },
    { role: 'assistant', content: 'y'.repeat(7000) },
  ];
  assert.equal(exceedsContext([{ role: 'user', content: 'x'.repeat(1000) }]), false);
  assert.equal(exceedsContext(long), true);
  assert.equal(exceedsContext(long, 16384), false);
});

test('contexte : réglage utilisateur, sinon Modelfile, sinon 4096 ; au moins 8192 avec un PDF', () => {
  const info = { parameters: 'temperature 0.2\nnum_ctx                        16384\n' };
  assert.equal(contextSize({}, {}, false), 4096);
  assert.equal(contextSize({}, info, false), 16384);
  assert.equal(contextSize({ options: { num_ctx: 2048 } }, info, false), 2048);
  assert.equal(contextSize({ options: { num_ctx: 2048 } }, info, true), 8192);
  assert.equal(contextSize({}, info, true), 16384);
});

test('corps de requête : options, maintien en mémoire et réflexion selon le modèle', () => {
  const messages = [{ role: 'user', content: 'Bonjour' }];
  const modelSettings = { options: { temperature: 0.3 }, keepAlive: '30m', think: 'false' };
  const body = chatBody({ model: 'm', messages, numCtx: 8192, modelSettings });
  assert.deepEqual(body.options, { temperature: 0.3, num_ctx: 8192 });
  assert.equal(body.keep_alive, '30m');
  assert.equal(body.think, undefined, 'modèle sans capacité « thinking »');
  const info = { capabilities: ['completion', 'thinking'] };
  assert.equal(chatBody({ model: 'm', messages, numCtx: 1, modelSettings, info }).think, false);
  assert.equal(
    chatBody({ model: 'm', messages, numCtx: 1, modelSettings, keepAlive: 0 }).keep_alive,
    0,
  );
  assert.equal(chatBody({ model: 'm', messages, numCtx: 1 }).keep_alive, '5m');
});

test('consigne permanente ajoutée sans document et combinée avec la consigne PDF', () => {
  const messages = [{ role: 'user', content: 'Vérifie le total' }];
  assert.equal(withSystem(messages, undefined), messages);
  assert.deepEqual(withSystem(messages, 'Réponds en anglais.')[0], {
    role: 'system',
    content: 'Réponds en anglais.',
  });
  const withDoc = documentMessages(doc, messages, 'Réponds en anglais.');
  assert.match(withDoc.messages[0].content, /Cite les pages[\s\S]*Réponds en anglais\./);
});

test('mesures Ollama converties en millisecondes', () => {
  assert.equal(streamStats({ done: false }), null);
  assert.deepEqual(
    streamStats({
      done: true,
      done_reason: 'length',
      total_duration: 5_000_000_000,
      load_duration: 1_500_000_000,
      prompt_eval_count: 20,
      prompt_eval_duration: 400_000_000,
      eval_count: 100,
      eval_duration: 2_000_000_000,
    }),
    {
      totalMs: 5000,
      loadMs: 1500,
      promptTokens: 20,
      promptMs: 400,
      outputTokens: 100,
      outputMs: 2000,
      doneReason: 'length',
    },
  );
});

test('conversation et comparaison partagent le même verrou', () => {
  assert.equal(taskKey('chat'), taskKey('compare'));
  assert.notEqual(taskKey('chat'), taskKey('pull'));
  checkKind('compare');
});

test('avec un PDF : pages citées dans une seule numérotation (position, puis page imprimée)', () => {
  const result = documentMessages(doc, [{ role: 'user', content: 'Vérifie le total' }]);
  assert.match(
    result.messages[0].content,
    /« Page N » de l’extrait[\s\S]*« p\. 65 \(impr\. 46\) »/,
  );
});
