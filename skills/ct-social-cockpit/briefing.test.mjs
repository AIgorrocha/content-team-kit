// Teste do briefing semanal com dados falsos: nao precisa de banco nem de rede.
// Uso: node skills/ct-social-cockpit/briefing.test.mjs
import assert from 'node:assert/strict';
import { loadSignals, seedTemplates } from './briefing.js';

async function main() {
  const calls = [];
  const rest = async (query) => {
    calls.push(query);
    if (query.includes('platform=eq.instagram&kind=eq.best_time')) return [{ payload: { sample_size: 30 } }];
    if (query.includes('platform=eq.twitter&kind=eq.trends')) return [{ payload: { by_keyword: [{ keyword: 'ia', n: 3 }] } }];
    if (query.startsWith('ct_competitors?')) {
      return [{ id: 'c1', handle: 'concorrente_a' }, { id: 'c2', handle: 'concorrente_b' }];
    }
    if (query.startsWith('ct_competitor_posts?')) {
      assert.ok(query.includes('competitor_id=in.(c1,c2)'));
      return [
        { competitor_id: 'c1', content_preview: 'post baixo', engagement: { score: 5 } },
        { competitor_id: 'c2', content_preview: 'post alto', engagement: { score: 50 } },
      ];
    }
    return []; // demais redes sem dado
  };

  const signals = await loadSignals('acme', { rest });
  assert.deepEqual(Object.keys(signals.best_time), ['instagram'], 'so entra rede que tem best_time');
  assert.equal(signals.best_time.instagram.sample_size, 30);
  assert.equal(signals.trends.by_keyword[0].keyword, 'ia');
  assert.deepEqual(signals.topComp, { handle: 'concorrente_b', text: 'post alto', score: 50 }, 'concorrente com maior score');

  const semConcorrentes = await loadSignals('acme', { rest: async () => [] });
  assert.equal(semConcorrentes.topComp, null);
  assert.equal(semConcorrentes.trends, null);

  await assert.rejects(
    () => loadSignals('acme', { rest: async () => { throw new Error('REST 500'); } }),
    /REST 500/,
    'falha de leitura e ruidosa (o briefing nao pode sair vazio em silencio)'
  );

  // Marca sem pautas proprias: usa os modelos genericos, 2 por semana, e muda de uma semana para outra.
  const semana0 = seedTemplates('marca-sem-arquivo-de-defaults', 0, {});
  const semana1 = seedTemplates('marca-sem-arquivo-de-defaults', 1, {});
  assert.equal(semana0.length, 2);
  assert.ok(semana0.every((t) => t.title && t.angle && t.cta));
  assert.notDeepEqual(semana0.map((t) => t.title), semana1.map((t) => t.title), 'rotaciona por semana');

  console.log('briefing: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
