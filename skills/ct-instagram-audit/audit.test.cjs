const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { buildAudit, renderMarkdown, run } = require('./audit.cjs');
const { createSanitizedEvidence } = require('./evidence.cjs');

// This fixture catches a broken normalization branch that turns absent metrics into zero,
// a report that hides its evidence count, and a monthly trend emitted without enough data.
const dataset = {
  handle: 'acme.co',
  fetched_at: '2026-04-01T00:00:00.000Z',
  media: [
    {
      id: 'jan-reel-1',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Uma linha sobre automação.',
      timestamp: '2026-01-05T09:00:00.000Z',
      permalink: 'https://instagram.com/reel/jan-reel-1',
      like_count: 10,
      comments_count: 0,
      insights: { reach: 100, views: 100, saved: 2, shares: 1 },
    },
    {
      id: 'jan-carousel-1',
      media_type: 'CAROUSEL_ALBUM',
      caption: '- Primeiro passo\n- Segundo passo\n- Terceiro passo',
      timestamp: '2026-01-06T10:00:00.000Z',
      permalink: 'https://instagram.com/p/jan-carousel-1',
      like_count: 20,
      comments_count: 2,
      insights: { reach: 200, views: 200, saved: 4, shares: 2 },
    },
    {
      id: 'jan-image-1',
      media_type: 'IMAGE',
      caption: 'Uma reflexão\nem duas linhas.',
      timestamp: '2026-01-12T11:00:00.000Z',
      permalink: 'https://instagram.com/p/jan-image-1',
      like_count: 30,
      comments_count: 3,
      insights: { reach: 300, views: 300, saved: 6, shares: 3 },
    },
    {
      id: 'jan-reel-2',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Outra legenda curta.',
      timestamp: '2026-01-20T12:00:00.000Z',
      permalink: 'https://instagram.com/reel/jan-reel-2',
      like_count: 40,
      comments_count: 4,
      insights: { reach: 400, views: 400, saved: 8, shares: 4 },
    },
    {
      id: 'jan-carousel-2',
      media_type: 'CAROUSEL_ALBUM',
      caption: '- Um\n- Dois\n- Três',
      timestamp: '2026-01-25T13:00:00.000Z',
      permalink: 'https://instagram.com/p/jan-carousel-2',
      like_count: 50,
      comments_count: 5,
      insights: { reach: 500, views: 5000, saved: 10, shares: 5 },
    },
    {
      id: 'feb-reel-1',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Reel de fevereiro.',
      timestamp: '2026-02-02T09:00:00.000Z',
      permalink: 'https://instagram.com/reel/feb-reel-1',
      like_count: 15,
      comments_count: 1,
      insights: { reach: 150, views: 150, saved: 3, shares: 1 },
    },
    {
      id: 'feb-image-1',
      media_type: 'IMAGE',
      caption: 'Imagem com contexto.',
      timestamp: '2026-02-07T10:00:00.000Z',
      permalink: 'https://instagram.com/p/feb-image-1',
      like_count: 25,
      comments_count: 2,
      insights: { reach: 250, views: 250, saved: 5, shares: 2 },
    },
    {
      id: 'feb-carousel-1',
      media_type: 'CAROUSEL_ALBUM',
      caption: '- Diagnóstico\n- Plano\n- Execução',
      timestamp: '2026-02-12T11:00:00.000Z',
      permalink: 'https://instagram.com/p/feb-carousel-1',
      like_count: 35,
      comments_count: 3,
      insights: { reach: 350, views: 350, saved: 7, shares: 3 },
    },
    {
      id: 'feb-reel-2',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Reel com prova.',
      timestamp: '2026-02-19T12:00:00.000Z',
      permalink: 'https://instagram.com/reel/feb-reel-2',
      like_count: 45,
      comments_count: 4,
      insights: { reach: 450, views: 450, saved: 9, shares: 4 },
    },
    {
      id: 'feb-image-2',
      media_type: 'IMAGE',
      caption: 'Imagem de fevereiro.',
      timestamp: '2026-02-24T13:00:00.000Z',
      permalink: 'https://instagram.com/p/feb-image-2',
      like_count: 55,
      comments_count: 5,
      insights: { reach: 550, views: 550, saved: 11, shares: 5 },
    },
    {
      id: 'mar-carousel-1',
      media_type: 'CAROUSEL_ALBUM',
      caption: '- Contexto\n- Decisão\n- Resultado',
      timestamp: '2026-03-03T09:00:00.000Z',
      permalink: 'https://instagram.com/p/mar-carousel-1',
      like_count: 18,
      comments_count: 2,
      insights: { reach: 180, views: 180, saved: 4, shares: 2 },
    },
    {
      id: 'mar-reel-1',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Reel de março.',
      timestamp: '2026-03-08T10:00:00.000Z',
      permalink: 'https://instagram.com/reel/mar-reel-1',
      like_count: 28,
      comments_count: 3,
      insights: { reach: 280, views: 280, saved: 6, shares: 3 },
    },
    {
      id: 'mar-image-1',
      media_type: 'IMAGE',
      caption: 'Imagem com bastidor.',
      timestamp: '2026-03-13T11:00:00.000Z',
      permalink: 'https://instagram.com/p/mar-image-1',
      like_count: 38,
      comments_count: 4,
      insights: { reach: 380, views: 380, saved: 8, shares: 4 },
    },
    {
      id: 'mar-carousel-2',
      media_type: 'CAROUSEL_ALBUM',
      caption: '- Caso\n- Processo\n- Próximo passo',
      timestamp: '2026-03-20T12:00:00.000Z',
      permalink: 'https://instagram.com/p/mar-carousel-2',
      like_count: 48,
      comments_count: 5,
      insights: { reach: 480, views: 480, saved: 10, shares: 5 },
    },
    {
      id: 'mar-reel-2',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Reel final do trimestre.',
      timestamp: '2026-03-26T13:00:00.000Z',
      permalink: 'https://instagram.com/reel/mar-reel-2',
      like_count: 58,
      comments_count: 0,
      insights: { reach: 580, views: 580, saved: 12, shares: 6 },
    },
    {
      id: 'missing-metrics',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      caption: 'Post sem métricas disponíveis.',
      timestamp: '2026-04-01T14:00:00.000Z',
      permalink: 'https://instagram.com/reel/missing-metrics',
      insights: {},
    },
  ],
};

const durationsById = {
  'jan-reel-1': 5,
  'jan-reel-2': 30,
  'feb-reel-1': 15,
  'feb-reel-2': 45,
  'mar-reel-1': 70,
  'mar-reel-2': 10,
  'missing-metrics': 30,
};

function groupedMedia({
  id,
  mediaType = 'IMAGE',
  reels = false,
  caption = 'Legenda de uma linha.',
  timestamp = '2026-01-05T15:00:00.000Z',
  views = 100,
  comments = 1,
}) {
  const insights = { reach: 100, saved: 1, shares: 1 };
  if (views !== null) insights.views = views;
  const media = {
    id,
    media_type: mediaType,
    caption,
    timestamp,
    like_count: 10,
    insights,
  };
  if (reels) media.media_product_type = 'REELS';
  if (comments !== null) media.comments_count = comments;
  return media;
}

const audit = buildAudit(dataset, { durationsById });

const todos = audit.distribution[0];
assert.equal(todos.format, 'todos');
assert.equal(todos.n, 16);
assert.equal(todos.views.n, 15);
assert.equal(todos.views.mean, 643.3333333333334);
assert.equal(todos.views.median, 350);
assert.ok(Number.isFinite(todos.views.sample_std_dev));
assert.deepEqual(
  audit.distribution.map(({ format, n }) => ({ format, n })),
  [
    { format: 'todos', n: 16 },
    { format: 'reel', n: 7 },
    { format: 'carrossel', n: 5 },
    { format: 'imagem', n: 4 },
  ]
);
assert.equal(
  audit.normalized_media.find((post) => post.id === 'missing-metrics').views,
  null
);

const viewsCorrelation = audit.duration_correlations.find(({ metric }) => metric === 'views');
assert.equal(viewsCorrelation.n, 6);
assert.equal(viewsCorrelation.verdict, 'amostra_insuficiente');
assert.equal(audit.duration_buckets.find(({ bucket }) => bucket === '0_10s').n, 2);
assert.equal(audit.caption_types.find(({ caption_type }) => caption_type === 'longa_em_lista').n, 5);
assert.deepEqual(
  audit.monthly_trend.rows.map(({ month, n }) => ({ month, n })),
  [
    { month: '2026-01', n: 5 },
    { month: '2026-02', n: 5 },
    { month: '2026-03', n: 5 },
  ]
);
assert.equal(audit.monthly_trend.available, true);
assert.equal(audit.comments.overall.zero_comments_n, 2);
assert.deepEqual(audit.outliers.views.posts.map(({ id }) => id), ['jan-carousel-2']);
assert.ok(
  audit.limitations.some(
    ({ metric, n }) => metric === 'views' && n === 1
  )
);
assert.throws(
  () => buildAudit({ ...dataset, handle: '' }),
  /exige um snapshot com "handle"/
);

const markdown = renderMarkdown(audit);
assert.match(markdown, /\| Todos \| 16 \|/);
assert.ok(markdown.indexOf('| Todos |') < markdown.indexOf('| Reels |'));
assert.match(markdown, /\| Reels \| 7 \|/);
assert.match(markdown, /Desvio padrão amostral/);
assert.match(markdown, /amostra_insuficiente/);
assert.match(markdown, /Correlação não prova causalidade\./);
assert.match(markdown, /sem dado disponível/);

test('aplica America/Sao_Paulo ao mês, dia e hora editorial', () => {
  const crossMidnightDataset = {
    handle: 'acme.co',
    fetched_at: '2026-02-01T02:00:00.000Z',
    media: [
      {
        id: 'cross-midnight',
        media_type: 'IMAGE',
        caption: 'Post que cruza a meia-noite UTC.',
        timestamp: '2026-02-01T01:30:00.000Z',
        like_count: 10,
        comments_count: 1,
        insights: { reach: 100, views: 100, saved: 1, shares: 1 },
      },
    ],
  };

  const saoPauloAudit = buildAudit(crossMidnightDataset);
  assert.equal(saoPauloAudit.normalized_media[0].month, '2026-01');
  assert.deepEqual(
    saoPauloAudit.weekday_hour.map(({ weekday, hour, n }) => ({ weekday, hour, n })),
    [{ weekday: 'sábado', hour: 22, n: 1 }]
  );
  assert.match(
    renderMarkdown(saoPauloAudit),
    /## Views por dia e hora \(America\/Sao_Paulo\)/
  );
  assert.match(
    renderMarkdown(saoPauloAudit),
    /\| Dia \(America\/Sao_Paulo\) \| Hora \(America\/Sao_Paulo\) \| n \|/
  );

  const utcAudit = buildAudit(crossMidnightDataset, { timeZone: 'UTC' });
  assert.deepEqual(
    utcAudit.weekday_hour.map(({ weekday, hour, n }) => ({ weekday, hour, n })),
    [{ weekday: 'domingo', hour: 1, n: 1 }]
  );
});

test('qualifica a amostra mensal e torna meses omitidos e não contíguos explícitos', () => {
  const makeMonthlyMedia = (month, count) => Array.from({ length: count }, (_, index) => ({
    id: `monthly-${month}-${index + 1}`,
    media_type: 'IMAGE',
    caption: 'Post mensal.',
    timestamp: `2026-${month}-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
    like_count: 10,
    comments_count: 1,
    insights: { reach: 100, views: 100 + index, saved: 1, shares: 1 },
  }));
  const monthlyDataset = {
    handle: 'acme.co',
    fetched_at: '2026-06-01T00:00:00.000Z',
    media: [
      ...makeMonthlyMedia('01', 5),
      ...makeMonthlyMedia('02', 2),
      ...makeMonthlyMedia('03', 5),
      ...makeMonthlyMedia('04', 1),
      ...makeMonthlyMedia('05', 5),
    ],
  };

  const monthlyAudit = buildAudit(monthlyDataset);
  assert.deepEqual(
    monthlyAudit.monthly_trend.omitted_rows.map(({ month, n }) => ({ month, n })),
    [
      { month: '2026-02', n: 2 },
      { month: '2026-04', n: 1 },
    ]
  );

  const monthlyMarkdown = renderMarkdown(monthlyAudit);
  assert.match(monthlyMarkdown, /## Amostra mensal qualificada/);
  assert.match(monthlyMarkdown, /Critério: meses com pelo menos 5 posts com views disponíveis\./);
  assert.match(monthlyMarkdown, /\| 2026-02 \| 2 \| amostra_insuficiente \| n insuficiente \|/);
  assert.match(monthlyMarkdown, /\| 2026-04 \| 1 \| amostra_insuficiente \| n insuficiente \|/);
  assert.match(
    monthlyMarkdown,
    /Meses não contíguos não sustentam conclusão de alta, queda ou tendência contínua\./
  );
  assert.doesNotMatch(monthlyMarkdown, /## Tendência mensal/);
});

test('descreve o limiar mensal sem confundi-lo com a quantidade de meses qualificados', () => {
  const months = ['01', '02', '03', '04', '05'];
  const media = months.flatMap((month) => Array.from({ length: 5 }, (_, index) => ({
    id: `criterion-${month}-${index + 1}`,
    media_type: 'IMAGE',
    caption: 'Post da amostra qualificada.',
    timestamp: `2026-${month}-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
    like_count: 10,
    comments_count: 1,
    insights: { reach: 100, views: 100, saved: 1, shares: 1 },
  })));
  const criterionMarkdown = renderMarkdown(buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-06-01T00:00:00.000Z',
    media,
  }));

  assert.match(
    criterionMarkdown,
    /Critério: meses com pelo menos 5 posts com views disponíveis\./
  );
  assert.doesNotMatch(criterionMarkdown, /Critério: \d+ meses/);
});

test('lista mês observado sem views como omitido por n insuficiente', () => {
  const januaryPosts = Array.from({ length: 5 }, (_, index) => ({
    id: `january-${index + 1}`,
    media_type: 'IMAGE',
    caption: 'Post com views.',
    timestamp: `2026-01-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
    like_count: 10,
    comments_count: 1,
    insights: { reach: 100, views: 100, saved: 1, shares: 1 },
  }));
  const zeroViewsAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-03-01T00:00:00.000Z',
    media: [
      ...januaryPosts,
      {
        id: 'february-without-views',
        media_type: 'IMAGE',
        caption: 'Post observado sem views.',
        timestamp: '2026-02-15T15:00:00.000Z',
        like_count: 10,
        comments_count: 1,
        insights: { reach: 100, saved: 1, shares: 1 },
      },
    ],
  });

  assert.deepEqual(
    zeroViewsAudit.monthly_trend.omitted_rows.map(({ month, n }) => ({ month, n })),
    [{ month: '2026-02', n: 0 }]
  );
  assert.match(
    renderMarkdown(zeroViewsAudit),
    /\| 2026-02 \| 0 \| sem_dado_disponivel \| n insuficiente \|/
  );
});

test('calcula taxa mensal na mesma amostra dos posts com views', () => {
  const makeQualifiedMonth = (month) => Array.from({ length: 5 }, (_, index) => ({
    id: `qualified-${month}-${index + 1}`,
    media_type: 'IMAGE',
    caption: 'Post mensal qualificado.',
    timestamp: `2026-${month}-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
    like_count: 8,
    comments_count: 0,
    insights: { reach: 100, views: 100, saved: 1, shares: 1 },
  }));
  const sampleAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: [
      ...makeQualifiedMonth('01'),
      ...makeQualifiedMonth('02'),
      ...makeQualifiedMonth('03'),
      {
        id: 'january-without-views',
        media_type: 'IMAGE',
        caption: 'Post sem views.',
        timestamp: '2026-01-20T15:00:00.000Z',
        like_count: 98,
        comments_count: 0,
        insights: { reach: 100, saved: 1, shares: 1 },
      },
    ],
  });
  const january = sampleAudit.monthly_trend.rows.find(({ month }) => month === '2026-01');

  assert.deepEqual(
    {
      views_n: january.n,
      engagement_n: january.engagement_rate.n,
      engagement_mean: january.engagement_rate.mean,
    },
    { views_n: 5, engagement_n: 5, engagement_mean: 0.1 }
  );
});

test('renderiza outlier de taxa de engajamento como porcentagem', () => {
  const rateOutlierAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: Array.from({ length: 8 }, (_, index) => groupedMedia({
      id: index === 7 ? 'rate-outlier' : `rate-base-${index + 1}`,
      timestamp: `2026-01-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
      views: 100,
      comments: 0,
    })).map((media, index) => ({
      ...media,
      like_count: index === 7 ? 100 : 1,
      insights: { reach: 100, views: 100, saved: 0, shares: 0 },
    })),
  });

  const markdownWithRateOutlier = renderMarkdown(rateOutlierAudit);
  assert.match(markdownWithRateOutlier, /rate-outlier \(100%\)/);
  assert.doesNotMatch(markdownWithRateOutlier, /rate-outlier \(1\)/);
});

test('atribui vereditos de views próprios a cada faixa de duração', () => {
  const media = [
    groupedMedia({
      id: 'duration-no-views',
      mediaType: 'VIDEO',
      reels: true,
      views: null,
    }),
    ...Array.from({ length: 4 }, (_, index) => groupedMedia({
      id: `duration-small-${index + 1}`,
      mediaType: 'VIDEO',
      reels: true,
    })),
    ...Array.from({ length: 10 }, (_, index) => groupedMedia({
      id: `duration-adequate-${index + 1}`,
      mediaType: 'VIDEO',
      reels: true,
    })),
  ];
  const durationsById = Object.fromEntries(media.map((item) => [
    item.id,
    item.id === 'duration-no-views' ? 5 : item.id.startsWith('duration-small') ? 15 : 45,
  ]));
  const durationAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media,
  }, { durationsById });

  assert.deepEqual(
    durationAudit.duration_buckets.map((row) => ({
      bucket: row.bucket,
      viewsN: row.views.n,
      verdict: row.views.sample_verdict,
    })),
    [
      { bucket: '0_10s', viewsN: 0, verdict: 'sem_dado_disponivel' },
      { bucket: '10_30s', viewsN: 4, verdict: 'amostra_insuficiente' },
      { bucket: '30_60s', viewsN: 10, verdict: 'amostra_adequada' },
    ]
  );
  const durationMarkdown = renderMarkdown(durationAudit);
  assert.match(durationMarkdown, /\| Faixa \| n \| Views média \| Veredito de views \| Taxa de engajamento média \| Veredito de engajamento \|/);
  assert.match(durationMarkdown, /\| 0_10s \| 1 \| sem dado disponível \(n=0\) \| sem_dado_disponivel \|/);
  assert.match(durationMarkdown, /\| 10_30s \| 4 \| 100 \(n=4\) \| amostra_insuficiente \|/);
  assert.match(durationMarkdown, /\| 30_60s \| 10 \| 100 \(n=10\) \| amostra_adequada \|/);
});

test('atribui vereditos de views próprios a cada estrutura de legenda', () => {
  const captionAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: [
      groupedMedia({ id: 'caption-no-views', views: null }),
      ...Array.from({ length: 4 }, (_, index) => groupedMedia({
        id: `caption-small-${index + 1}`,
        caption: '- Diagnóstico\n- Plano\n- Execução',
      })),
      ...Array.from({ length: 10 }, (_, index) => groupedMedia({
        id: `caption-adequate-${index + 1}`,
        caption: 'Contexto\nque não é lista.',
      })),
    ],
  });

  assert.deepEqual(
    captionAudit.caption_types.map((row) => ({
      type: row.caption_type,
      viewsN: row.views.n,
      verdict: row.views.sample_verdict,
    })),
    [
      { type: 'curta_uma_linha', viewsN: 0, verdict: 'sem_dado_disponivel' },
      { type: 'longa_em_lista', viewsN: 4, verdict: 'amostra_insuficiente' },
      { type: 'outra', viewsN: 10, verdict: 'amostra_adequada' },
    ]
  );
  assert.match(
    renderMarkdown(captionAudit),
    /\| Estrutura \| n \| Views média \| Veredito de views \| Taxa de engajamento média \| Veredito de engajamento \|/
  );
});

test('atribui vereditos métricos a cada agrupamento de dia e hora', () => {
  const makeHourGroup = (hour, count, views) => Array.from({ length: count }, (_, index) => groupedMedia({
    id: `hour-${hour}-${index + 1}`,
    timestamp: `2026-01-05T${String(hour).padStart(2, '0')}:${String(index).padStart(2, '0')}:00.000Z`,
    views,
  }));
  const weekdayHourAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: [
      ...makeHourGroup(12, 1, null),
      ...makeHourGroup(13, 4, 100),
      ...makeHourGroup(14, 10, 100),
    ],
  });

  assert.deepEqual(
    weekdayHourAudit.weekday_hour.map((row) => ({
      posts: row.n,
      viewsN: row.views.n,
      verdict: row.views.sample_verdict,
    })),
    [
      { posts: 1, viewsN: 0, verdict: 'sem_dado_disponivel' },
      { posts: 4, viewsN: 4, verdict: 'amostra_insuficiente' },
      { posts: 10, viewsN: 10, verdict: 'amostra_adequada' },
    ]
  );
  assert.match(
    renderMarkdown(weekdayHourAudit),
    /\| Dia \(America\/Sao_Paulo\) \| Hora \(America\/Sao_Paulo\) \| n \| Views média \| Veredito de views \| Taxa de engajamento média \| Veredito de engajamento \|/
  );
});

test('atribui vereditos métricos às linhas mensais qualificadas e omitidas', () => {
  const makeMonth = (month, count, views) => Array.from({ length: count }, (_, index) => groupedMedia({
    id: `month-${month}-${index + 1}`,
    timestamp: `2026-${month}-${String(index + 1).padStart(2, '0')}T15:00:00.000Z`,
    views,
  }));
  const monthlyVerdictAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-06-01T00:00:00.000Z',
    media: [
      ...makeMonth('01', 1, null),
      ...makeMonth('02', 4, 100),
      ...makeMonth('03', 10, 100),
      ...makeMonth('04', 10, 100),
      ...makeMonth('05', 10, 100),
    ],
  });

  assert.deepEqual(
    monthlyVerdictAudit.monthly_trend.omitted_rows.map((row) => ({
      month: row.month,
      viewsN: row.views.n,
      verdict: row.views.sample_verdict,
    })),
    [
      { month: '2026-01', viewsN: 0, verdict: 'sem_dado_disponivel' },
      { month: '2026-02', viewsN: 4, verdict: 'amostra_insuficiente' },
    ]
  );
  assert.ok(monthlyVerdictAudit.monthly_trend.rows.every((row) => (
    row.views.n === 10 && row.views.sample_verdict === 'amostra_adequada'
  )));
  const monthlyVerdictMarkdown = renderMarkdown(monthlyVerdictAudit);
  assert.match(monthlyVerdictMarkdown, /\| Mês \| n \| Views média \| Veredito de views \| Taxa de engajamento média \| Veredito de engajamento \|/);
  assert.match(monthlyVerdictMarkdown, /\| Mês \| n de views \| Veredito de views \| Motivo \|/);
  assert.match(monthlyVerdictMarkdown, /\| 2026-01 \| 0 \| sem_dado_disponivel \| n insuficiente \|/);
  assert.match(monthlyVerdictMarkdown, /\| 2026-02 \| 4 \| amostra_insuficiente \| n insuficiente \|/);
});

test('atribui vereditos à amostra de comentários por formato', () => {
  const commentsVerdictAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: [
      groupedMedia({ id: 'comments-no-data', mediaType: 'VIDEO', reels: true, comments: null }),
      ...Array.from({ length: 4 }, (_, index) => groupedMedia({
        id: `comments-small-${index + 1}`,
        mediaType: 'CAROUSEL_ALBUM',
      })),
      ...Array.from({ length: 10 }, (_, index) => groupedMedia({
        id: `comments-adequate-${index + 1}`,
        mediaType: 'IMAGE',
      })),
    ],
  });

  assert.deepEqual(
    commentsVerdictAudit.comments.by_format.map((row) => ({
      format: row.format,
      commentsN: row.comments.n,
      verdict: row.comments.sample_verdict,
    })),
    [
      { format: 'reel', commentsN: 0, verdict: 'sem_dado_disponivel' },
      { format: 'carrossel', commentsN: 4, verdict: 'amostra_insuficiente' },
      { format: 'imagem', commentsN: 10, verdict: 'amostra_adequada' },
    ]
  );
  assert.match(
    renderMarkdown(commentsVerdictAudit),
    /\| Escopo \| n \| Média de comentários \| Mediana de comentários \| Veredito da amostra \| Com conversa \| Zero comentário \| Sem dado \|/
  );
});

test('renderiza vereditos de alcance por formato com n específico', () => {
  const withReach = (media, reach) => {
    const insights = { ...media.insights };
    if (reach === null) {
      delete insights.reach;
    } else {
      insights.reach = reach;
    }
    return { ...media, insights };
  };
  const media = [
    withReach(groupedMedia({ id: 'reach-no-data', mediaType: 'VIDEO', reels: true }), null),
    ...Array.from({ length: 4 }, (_, index) => withReach(groupedMedia({
      id: `reach-small-${index + 1}`,
      mediaType: 'CAROUSEL_ALBUM',
    }), 100)),
    ...Array.from({ length: 5 }, (_, index) => withReach(groupedMedia({
      id: `reach-descriptive-${index + 1}`,
      mediaType: 'IMAGE',
    }), 100)),
    ...Array.from({ length: 10 }, (_, index) => withReach(groupedMedia({
      id: `reach-adequate-${index + 1}`,
      mediaType: 'VIDEO',
    }), 100)),
  ];
  const reachAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media,
  });

  assert.deepEqual(
    reachAudit.distribution.slice(1).map((row) => ({
      format: row.format,
      reachN: row.reach.n,
      verdict: row.reach.sample_verdict,
    })),
    [
      { format: 'reel', reachN: 0, verdict: 'sem_dado_disponivel' },
      { format: 'carrossel', reachN: 4, verdict: 'amostra_insuficiente' },
      { format: 'imagem', reachN: 5, verdict: 'sinal_descritivo' },
      { format: 'video', reachN: 10, verdict: 'amostra_adequada' },
    ]
  );

  const reachMarkdown = renderMarkdown(reachAudit);
  const lines = reachMarkdown.split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith('| Formato |'));
  const header = lines[headerIndex];
  const separator = lines[headerIndex + 1];
  const columnCount = (line) => line.split('|').length - 2;
  assert.equal(columnCount(header), 10);
  assert.equal(columnCount(separator), 10);
  assert.match(header, /\| Alcance médio \| Veredito de alcance \| Taxa de engajamento média \|/);
  assert.match(lines.find((line) => line.startsWith('| Reels |')), /\| sem dado disponível \(n=0\) \| sem_dado_disponivel \|/);
  assert.match(lines.find((line) => line.startsWith('| Carrossel |')), /\| 100 \(n=4\) \| amostra_insuficiente \|/);
  assert.match(lines.find((line) => line.startsWith('| Imagem |')), /\| 100 \(n=5\) \| sinal_descritivo \|/);
  assert.match(lines.find((line) => line.startsWith('| Vídeo |')), /\| 100 \(n=10\) \| amostra_adequada \|/);
});

test('renderiza post singular em limitações de métricas ausentes', () => {
  const singularAudit = buildAudit({
    handle: 'acme.co',
    fetched_at: '2026-04-01T00:00:00.000Z',
    media: [groupedMedia({ id: 'single-missing-view', views: null })],
  });
  const singularMarkdown = renderMarkdown(singularAudit);

  assert.match(singularMarkdown, /views: sem dado disponível para 1 post\./);
  assert.doesNotMatch(singularMarkdown, /1 posts/);
});

test('registra metadados reproduzíveis sem URL de mídia ou credencial', () => {
  const metadataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-metadata-'));
  try {
    const inputPath = path.join(metadataRoot, 'snapshot.json');
    const outputPath = path.join(metadataRoot, 'audit.md');
    const input = JSON.stringify({
      handle: 'acme.co',
      fetched_at: '2026-04-01T00:00:00.000Z',
      media: [{
        ...groupedMedia({ id: 'metadata-image' }),
        media_url: 'https://example.invalid/private-media.mp4',
      }],
    });
    fs.writeFileSync(inputPath, input, 'utf8');
    const expectedHash = crypto.createHash('sha256').update(input).digest('hex');

    const metadataRun = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'audit.cjs'),
        '--input', inputPath,
        '--output', outputPath,
        '--limit', '90',
      ],
      { cwd: metadataRoot, encoding: 'utf8' }
    );
    assert.equal(metadataRun.status, 0, metadataRun.stderr);
    const metadataMarkdown = fs.readFileSync(outputPath, 'utf8');

    assert.match(metadataMarkdown, /## Reprodutibilidade/);
    assert.match(metadataMarkdown, /Snapshot de entrada: `snapshot\.json`/);
    assert.match(metadataMarkdown, new RegExp(`SHA-256 da entrada: \`${expectedHash}\``));
    assert.match(metadataMarkdown, /Limite informado manualmente pelo operador \(`--limit`\): 90/);
    assert.match(metadataMarkdown, /O JSON de entrada não registra esse limite e a auditoria não o confere\./);
    assert.doesNotMatch(metadataMarkdown, /limite\s+(?:aplicado|inferido)/i);
    assert.match(metadataMarkdown, /Fuso horário editorial: `America\/Sao_Paulo`/);
    assert.match(metadataMarkdown, /Gerador estável: `ct-instagram-audit\/v1`/);
    assert.match(metadataMarkdown, /Revisão do código não é incorporada/);
    assert.doesNotMatch(metadataMarkdown, /example\.invalid/);
  } finally {
    fs.rmSync(metadataRoot, { recursive: true, force: true });
  }
});

test('aceita um fuso horário explícito pela linha de comando', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-time-zone-'));
  try {
    const inputPath = path.join(temporaryRoot, 'input.json');
    const outputPath = path.join(temporaryRoot, 'audit.md');
    fs.writeFileSync(inputPath, JSON.stringify({
      handle: 'acme.co',
      fetched_at: '2026-02-01T02:00:00.000Z',
      media: [{
        id: 'cli-time-zone',
        media_type: 'IMAGE',
        caption: 'Fuso explícito.',
        timestamp: '2026-02-01T01:30:00.000Z',
        like_count: 10,
        comments_count: 1,
        insights: { reach: 100, views: 100, saved: 1, shares: 1 },
      }],
    }), 'utf8');

    const cliRun = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'audit.cjs'),
        '--input', inputPath,
        '--output', outputPath,
        '--time-zone', 'UTC',
      ],
      { cwd: temporaryRoot, encoding: 'utf8' }
    );
    assert.equal(cliRun.status, 0, cliRun.stderr);
    assert.match(
      fs.readFileSync(outputPath, 'utf8'),
      /## Views por dia e hora \(UTC\)/
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

function sanitizedEvidenceFixture() {
  const raw = {
    handle: 'acme.co',
    fetched_at: '2026-08-20T19:57:32.002Z',
    media: [
      {
        id: 'offline-video-measured',
        media_type: 'VIDEO',
        media_product_type: 'REELS',
        timestamp: '2026-08-01T15:00:00.000Z',
        caption: '- Diagnóstico\n- Plano\n- Execução',
        like_count: 10,
        comments_count: 1,
        insights: { views: 100, reach: 200, saved: 2, shares: 1 },
      },
      {
        id: 'offline-video-missing',
        media_type: 'VIDEO',
        media_product_type: 'REELS',
        timestamp: '2026-08-02T15:00:00.000Z',
        caption: 'Uma linha privada.',
        like_count: 12,
        comments_count: 2,
        insights: { views: 200, reach: 250, saved: 3, shares: 2 },
      },
      {
        id: 'offline-image',
        media_type: 'IMAGE',
        timestamp: '2026-08-03T15:00:00.000Z',
        caption: 'Imagem de apoio.',
        like_count: 8,
        comments_count: 0,
        insights: { reach: 150, saved: 1, shares: 0 },
      },
    ],
  };
  const chain = {
    rawSnapshotBasename: 'acme.co-2026-08-20.json',
    rawSnapshotSha256: 'b'.repeat(64),
    measuredAt: '2026-08-20T20:00:00.000Z',
    durationsById: {
      'offline-video-measured': 18.25,
      'offline-video-missing': null,
    },
  };
  return { raw, chain, evidence: createSanitizedEvidence(raw, chain) };
}

test('reproduz as seções quantitativas do bruto com a evidência sanitizada', () => {
  const { raw, chain, evidence } = sanitizedEvidenceFixture();
  const rawMarkdown = renderMarkdown(buildAudit(raw, {
    durationsById: chain.durationsById,
  }));
  const evidenceMarkdown = renderMarkdown(buildAudit(evidence));
  const quantitativeStart = '## Distribuição por formato';

  assert.equal(
    evidenceMarkdown.slice(evidenceMarkdown.indexOf(quantitativeStart)),
    rawMarkdown.slice(rawMarkdown.indexOf(quantitativeStart))
  );
});

test('rejeita evidência sanitizada malformada antes do cálculo', () => {
  const { evidence } = sanitizedEvidenceFixture();
  evidence.duration_measurement.durations_by_id['offline-video-measured'] = -0.5;

  assert.throws(() => buildAudit(evidence), /duraç/i);
});

test('executa a evidência offline sem ffprobe e alinha hashes no relatório', async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-offline-evidence-'));
  try {
    const { evidence } = sanitizedEvidenceFixture();
    const inputRelativePath = path.join('content', 'research', 'evidence', 'evidence.json');
    const outputRelativePath = path.join('content', 'research', 'report.md');
    const inputPath = path.join(temporaryRoot, inputRelativePath);
    const outputPath = path.join(temporaryRoot, outputRelativePath);
    const serializedEvidence = `${JSON.stringify(evidence, null, 2)}\n`;
    fs.mkdirSync(path.dirname(inputPath), { recursive: true });
    fs.writeFileSync(inputPath, serializedEvidence, 'utf8');
    let ffprobeCalls = 0;

    await run([
      'node',
      'audit.cjs',
      '--input', inputRelativePath,
      '--output', outputRelativePath,
      '--limit', '90',
    ], temporaryRoot, {
      execFile: async () => {
        ffprobeCalls += 1;
        throw new Error('ffprobe não deveria ser chamado para evidência incorporada.');
      },
    });

    const markdown = fs.readFileSync(outputPath, 'utf8');
    const evidenceHash = crypto.createHash('sha256').update(serializedEvidence).digest('hex');
    assert.equal(ffprobeCalls, 0);
    assert.match(markdown, /Evidência sanitizada: `evidence\.json`/);
    assert.match(markdown, new RegExp(`SHA-256 da evidência sanitizada: \`${evidenceHash}\``));
    assert.match(markdown, /Snapshot bruto de origem: `acme.co-2026-08-20.json`/);
    assert.match(markdown, new RegExp(`SHA-256 do snapshot bruto: \`${'b'.repeat(64)}\``));
    assert.match(markdown, /Durações incorporadas: `ffprobe`, medidas em `2026-08-20T20:00:00\.000Z`/);
    assert.match(markdown, /Cobertura das durações incorporadas: 1 de 2 medidas, 1 sem dado disponível\./);
    assert.match(
      markdown,
      /Reprodução offline: `node skills\/ct-instagram-audit\/audit\.cjs --input content\/research\/evidence\/evidence\.json --output content\/research\/report\.md --limit 90 --time-zone America\/Sao_Paulo`/
    );
    assert.doesNotMatch(markdown, /Uma linha privada|:\/\//);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-audit-'));
try {
  const inputPath = path.join(temporaryRoot, 'input.json');
  const outputPath = path.join(temporaryRoot, 'explicit-audit.md');
  fs.writeFileSync(inputPath, JSON.stringify(dataset), 'utf8');

  const auditPath = path.join(__dirname, 'audit.cjs');
  const explicitRun = spawnSync(
    process.execPath,
    [auditPath, '--input', inputPath, '--output', outputPath],
    { cwd: temporaryRoot, encoding: 'utf8' }
  );
  assert.equal(explicitRun.status, 0, explicitRun.stderr);
  assert.match(fs.readFileSync(outputPath, 'utf8'), /Auditoria executável do Instagram/);

  const thirdPartyInputPath = path.join(temporaryRoot, 'third-party-input.json');
  const rejectedOutputPath = path.join(temporaryRoot, 'rejected-audit.md');
  fs.writeFileSync(
    thirdPartyInputPath,
    JSON.stringify({ ...dataset, handle: '' }),
    'utf8'
  );
  const rejectedRun = spawnSync(
    process.execPath,
    [auditPath, '--input', thirdPartyInputPath, '--output', rejectedOutputPath],
    { cwd: temporaryRoot, encoding: 'utf8' }
  );
  assert.equal(rejectedRun.status, 1);
  assert.match(rejectedRun.stderr, /exige um snapshot com "handle"/);
  assert.equal(fs.existsSync(rejectedOutputPath), false);

  const analyzerOutput = path.join(temporaryRoot, 'output', 'instagram-analyzer');
  fs.mkdirSync(analyzerOutput, { recursive: true });
  fs.writeFileSync(
    path.join(analyzerOutput, 'acme.co-2026-03-01.json'),
    JSON.stringify({ ...dataset, fetched_at: '2026-03-01T00:00:00.000Z' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(analyzerOutput, 'acme.co-2026-04-01.json'),
    JSON.stringify(dataset),
    'utf8'
  );

  const defaultRun = spawnSync(process.execPath, [auditPath], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
  assert.equal(defaultRun.status, 0, defaultRun.stderr);

  const today = new Date().toISOString().slice(0, 10);
  const defaultOutput = path.join(
    temporaryRoot,
    'content',
    'research',
    `${today}-instagram-audit.md`
  );
  assert.match(fs.readFileSync(defaultOutput, 'utf8'), /2026-04-01T00:00:00.000Z/);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log('ct-instagram-audit/audit: OK');
