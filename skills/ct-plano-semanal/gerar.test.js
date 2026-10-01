const test = require('node:test');
const assert = require('node:assert');
const { parseCadencia, defaultSlots } = require('./gerar.js');

test('parseCadencia: total de pecas vira feeds', () => {
  const c = parseCadencia('- Ritmo: 3 peças por semana; quem aprova: Ana');
  assert.deepStrictEqual(c, { feeds: 3, stories: 3, reels: 0 });
});

test('parseCadencia: contagens explicitas', () => {
  const c = parseCadencia('## Preferências de formato\n- Ritmo: 2 carrosséis, 1 reel, 4 stories');
  assert.deepStrictEqual(c, { feeds: 2, stories: 4, reels: 1 });
});

test('parseCadencia: sem linha ou modelo nao preenchido devolve null', () => {
  assert.strictEqual(parseCadencia('# Marca\nsem ritmo'), null);
  assert.strictEqual(parseCadencia('- Ritmo: [N] peças por semana; quem aprova: [nome]'), null);
  assert.strictEqual(parseCadencia(null), null);
});

test('defaultSlots: uma linha por feed e por reel', () => {
  const s = defaultSlots({ feeds: 2, stories: 3, reels: 1 });
  assert.strictEqual(s.length, 3);
  assert.strictEqual(s[2].formato, 'reel');
});
