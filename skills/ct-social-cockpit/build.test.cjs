// Teste do cockpit (build.js) com dados falsos: nao precisa de banco nem de rede.
// Uso: node skills/ct-social-cockpit/build.test.cjs
const assert = require('node:assert');
const { platformSummary, buildMarkdown, topCompetitors } = require('./build.js');

async function main() {
  // --- platformSummary: 1 linha por post (a mais recente), top 3 por interacoes, engajamento medio ---
  const rows = [
    { post_id: 'a', snapshot_date: '2026-08-19', post_type: 'reel', likes: 1, comments: 0, engagement_rate: 1 },
    { post_id: 'a', snapshot_date: '2026-08-20', post_type: 'reel', likes: 100, comments: 10, engagement_rate: 4 },
    { post_id: 'b', snapshot_date: '2026-08-20', post_type: 'carousel', likes: 20, comments: 5, shares: 2, saves: 3, engagement_rate: 2 },
    { post_id: 'c', snapshot_date: '2026-08-20', post_type: 'image', likes: 5, engagement_rate: null },
    { post_id: 'd', snapshot_date: '2026-08-20', post_type: 'image', likes: 1 },
  ];
  const calls = [];
  const rest = async (query) => { calls.push(query); return rows; };

  const s = await platformSummary('acme', 'instagram', { rest });
  assert.match(calls[0], /client_slug=eq\.acme&platform=eq\.instagram&grain=eq\.post/);
  assert.strictEqual(s.posts_30d, 4, 'posts repetidos contam uma vez so');
  assert.strictEqual(s.total_interactions_30d, 110 + 30 + 5 + 1, 'usa o snapshot mais recente de cada post');
  assert.strictEqual(s.avg_engagement_rate, 3, 'media so dos posts com taxa informada (4 e 2)');
  assert.deepStrictEqual(s.top_posts.map((p) => p.interactions), [110, 30, 5]);
  assert.strictEqual(s.top_posts.length, 3);

  assert.strictEqual(await platformSummary('acme', 'tiktok', { rest: async () => [] }), null, 'sem dado devolve null');

  // --- topCompetitors: monta a lista dos 5 melhores pelo score ---
  const competitors = await topCompetitors('acme', {
    rest: async (query) => {
      if (query.startsWith('ct_competitors?')) {
        return [
          { id: 'c1', handle: 'concorrente_a', platform: 'instagram', followers_count: 10 },
          { id: 'c2', handle: 'concorrente_b', platform: 'instagram', followers_count: 20 },
        ];
      }
      assert.match(query, /competitor_id=in\.\(c1,c2\)/);
      return [
        { competitor_id: 'c1', platform: 'instagram', content_preview: 'post baixo', engagement: { score: 5 } },
        { competitor_id: 'c2', platform: 'instagram', content_preview: 'post alto', engagement: { score: 50 } },
      ];
    },
  });
  assert.deepStrictEqual(competitors.map((c) => c.competitor_name), ['concorrente_b', 'concorrente_a']);
  assert.strictEqual(competitors[0].engagement_score, 50);

  assert.deepStrictEqual(
    await topCompetitors('acme', { rest: async () => [] }),
    [],
    'sem concorrente cadastrado devolve lista vazia'
  );
  assert.deepStrictEqual(
    await topCompetitors('acme', { rest: async () => { throw new Error('REST fora do ar'); } }),
    [],
    'falha de leitura de concorrentes nao derruba o cockpit (vira lista vazia)'
  );

  // --- buildMarkdown ---
  const markdown = buildMarkdown('acme', {
    platforms: { instagram: s }, best_time: {}, competitors, trends: null, pieces: null,
  });
  assert.match(markdown, /Cockpit.*acme/);
  assert.match(markdown, /## instagram\n- Posts \(30d\): 4 · interacoes: 146 · engaj medio: 3%/);
  assert.match(markdown, /## Concorrentes bombando/);
  assert.match(markdown, /@concorrente_b \(instagram\) · score 50/);
  assert.doesNotMatch(markdown, /## linkedin/, 'rede sem dado nao aparece');

  console.log('cockpit-build: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
