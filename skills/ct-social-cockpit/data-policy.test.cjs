const assert = require('node:assert');
const { latestPerPost, filterPublishedSince } = require('./data-policy.cjs');

function main() {
  const now = new Date('2026-08-20T12:00:00.000Z');
  const oldPostMeasuredToday = {
    post_id: 'old-post',
    snapshot_date: '2026-08-20',
    published_at: '2026-06-01T12:00:00.000Z',
  };
  const olderSnapshotOfOldPost = {
    post_id: 'old-post',
    snapshot_date: '2026-08-19',
    published_at: '2026-06-01T12:00:00.000Z',
  };
  const justBeforeLowerBoundary = {
    post_id: 'just-before-lower-boundary',
    snapshot_date: '2026-08-20',
    published_at: '2026-07-21T11:59:59.999Z',
  };
  const exactLowerBoundary = {
    post_id: 'exact-lower-boundary',
    snapshot_date: '2026-08-20',
    published_at: '2026-07-21T12:00:00.000Z',
  };
  const dateTruncatedButTooOld = {
    post_id: 'date-truncated-but-too-old',
    snapshot_date: '2026-08-20',
    published_at: '2026-07-21T00:00:00.000Z',
  };
  const exactNow = {
    post_id: 'exact-now',
    snapshot_date: '2026-08-20',
    published_at: '2026-08-20T12:00:00.000Z',
  };
  const futurePost = {
    post_id: 'future-post',
    snapshot_date: '2026-08-20',
    published_at: '2026-08-21T12:00:00.000Z',
  };
  const invalidPublicationDate = {
    post_id: 'invalid-publication-date',
    snapshot_date: '2026-08-20',
    published_at: 'not-a-date',
  };
  const postWithoutPublicationDate = {
    post_id: 'unavailable-post',
    snapshot_date: '2026-08-20',
    published_at: null,
  };

  const historicalCatalog = latestPerPost([
    olderSnapshotOfOldPost,
    oldPostMeasuredToday,
    justBeforeLowerBoundary,
    exactLowerBoundary,
    dateTruncatedButTooOld,
    exactNow,
    futurePost,
    invalidPublicationDate,
    postWithoutPublicationDate,
  ]);

  assert.deepStrictEqual(
    historicalCatalog.map((row) => row.post_id).sort(),
    [
      'date-truncated-but-too-old',
      'exact-lower-boundary',
      'exact-now',
      'future-post',
      'invalid-publication-date',
      'just-before-lower-boundary',
      'old-post',
      'unavailable-post',
    ],
    'o catalogo historico preserva posts antigos, futuros e com data ausente ou invalida'
  );
  assert.strictEqual(
    historicalCatalog.find((row) => row.post_id === 'old-post').snapshot_date,
    '2026-08-20',
    'o catalogo historico conserva a medicao mais recente por post'
  );

  const publishedInWindow = filterPublishedSince(historicalCatalog, now);
  assert.deepStrictEqual(
    publishedInWindow.map((row) => row.post_id),
    ['exact-lower-boundary', 'exact-now'],
    'a janela fechada de 30 dias corridos inclui apenas os dois limites e exclui datas antigas, futuras, ausentes ou invalidas'
  );

  console.log('data-policy: OK');
}

main();
