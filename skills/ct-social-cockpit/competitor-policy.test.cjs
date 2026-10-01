const assert = require('node:assert');
const {
  parseTrackingHandles,
  extractPublicViews,
  rankCompetitorPosts,
  rankPersistedCompetitorPosts,
} = require('./competitor-policy.cjs');

// Cobre so as funcoes puras de competitor-policy.cjs. O cockpit (build.js) ainda nao usa essa
// politica de rodadas de snapshot; quando usar, teste aqui tambem.
async function main() {
  const competitorMarkdown = [
    '# Concorrentes Monitorados',
    '',
    '## Tracking Instagram (3 perfis)',
    '',
    '| # | Handle | Nicho |',
    '|---|--------|-------|',
    '| 1 | @concorrenteum | IA para negocios |',
    '| 2 | @concorrentedois | Automacao |',
    '| 3 | @concorrentetres | SaaS |',
    '',
    '## Contexto do mercado (consultar, nao trackear diario)',
    '',
    '| Handle | Por que esta aqui |',
    '|--------|---|',
    '| @fora-da-lista | Nao entra na watchlist ativa |',
    '',
  ].join('\n');
  assert.deepStrictEqual(
    parseTrackingHandles(competitorMarkdown),
    [
      'concorrenteum',
      'concorrentedois',
      'concorrentetres',
    ],
    'somente os handles da secao ativa podem entrar na watchlist'
  );

  assert.strictEqual(extractPublicViews({ play_count: 0 }), 0);
  assert.strictEqual(extractPublicViews({ video_view_count: '450' }), 450);
  assert.strictEqual(
    extractPublicViews({ public_views: 123 }),
    null,
    'public_views normalizado nao pode ser aceito como payload bruto'
  );
  assert.strictEqual(extractPublicViews({ play_count: '  ' }), null);
  assert.strictEqual(
    extractPublicViews({ edge_media_preview_like: { count: 9999 }, edge_media_to_comment: { count: 9999 } }),
    null,
    'likes e comentarios nao podem substituir views publicas'
  );

  const ranked = rankCompetitorPosts([
    {
      shortcode: 'sem-views',
      edge_media_preview_like: { count: 9999 },
      edge_media_to_comment: { count: 9999 },
      is_viral: true,
    },
    { shortcode: 'play-count', play_count: 120, is_viral: true },
    { shortcode: 'video-view-count', video_view_count: 450 },
  ]);

  assert.deepStrictEqual(
    ranked.map((post) => post.shortcode),
    ['video-view-count', 'play-count', 'sem-views'],
    'posts com views publicas ordenam pela contagem de views'
  );
  const semViews = ranked.find((post) => post.shortcode === 'sem-views');
  const playCount = ranked.find((post) => post.shortcode === 'play-count');
  assert.strictEqual(semViews.public_views, null);
  assert.strictEqual(semViews.metric_state, 'sem_dado_disponivel');
  assert.strictEqual('is_viral' in semViews, false, 'o ranking novo nao pode carregar flag viral legada');
  assert.strictEqual('is_viral' in playCount, false, 'o ranking novo nao pode carregar flag viral legada');

  const persistedRanked = rankPersistedCompetitorPosts([
    { shortcode: 'persisted-absent', play_count: 999, is_viral: true },
    { shortcode: 'persisted-views', public_views: 300, is_viral: true },
  ]);
  assert.deepStrictEqual(
    persistedRanked.map((post) => post.shortcode),
    ['persisted-views', 'persisted-absent'],
    'o ranking persistido usa somente public_views normalizado'
  );
  const persistedAbsent = persistedRanked.find((post) => post.shortcode === 'persisted-absent');
  const persistedViews = persistedRanked.find((post) => post.shortcode === 'persisted-views');
  assert.strictEqual(persistedAbsent.public_views, null);
  assert.strictEqual(persistedAbsent.metric_state, 'sem_dado_disponivel');
  assert.strictEqual('is_viral' in persistedAbsent, false);
  assert.strictEqual('is_viral' in persistedViews, false);

  console.log('competitor-policy: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
