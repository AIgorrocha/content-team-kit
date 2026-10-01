const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { enrichDurations } = require('./duration.cjs');
const {
  isSanitizedEvidence,
  validateSanitizedEvidence,
  evidenceToAuditDataset,
  evidenceCaptionClassesById,
  evidenceDurationsById,
} = require('./evidence.cjs');
const {
  mean,
  median,
  sampleStdDev,
  pearson,
  iqrOutliers,
  sampleVerdict,
  classifyCaption,
  durationBucket,
} = require('./statistics.cjs');

const FORMAT_ORDER = ['reel', 'carrossel', 'imagem', 'video', 'outro'];
const CAPTION_TYPE_ORDER = ['curta_uma_linha', 'longa_em_lista', 'outra'];
const DURATION_BUCKET_ORDER = ['0_10s', '10_30s', '30_60s', '60s_mais'];
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const GENERATOR_ID = 'ct-instagram-audit/v1';
const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function assertDataset(dataset) {
  if (
    !dataset ||
    typeof dataset !== 'object' ||
    Array.isArray(dataset) ||
    typeof dataset.handle !== 'string' ||
    !dataset.handle
  ) {
    throw new Error('A auditoria exige um snapshot com "handle" (conta do cliente ativo) preenchido.');
  }
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function groupedSampleVerdict(n) {
  if (!Number.isFinite(n) || n <= 0) return 'sem_dado_disponivel';
  if (n < 5) return 'amostra_insuficiente';
  if (n < 10) return 'sinal_descritivo';
  return 'amostra_adequada';
}

function postFormat(media = {}) {
  if (media.media_product_type === 'REELS' || media.media_type === 'REELS') return 'reel';
  if (media.media_type === 'CAROUSEL_ALBUM') return 'carrossel';
  if (media.media_type === 'IMAGE') return 'imagem';
  if (media.media_type === 'VIDEO') return 'video';
  return 'outro';
}

function resolveTimeZone(value) {
  const timeZone = typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
  } catch {
    throw new Error(`Fuso horário inválido: ${timeZone}`);
  }
  return timeZone;
}

function dateParts(timestamp, timeZone) {
  if (typeof timestamp !== 'string') {
    return { month: null, weekday: null, weekday_index: null, hour: null };
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return { month: null, weekday: null, weekday_index: null, hour: null };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((values, part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
    return values;
  }, {});
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    month: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    weekday: WEEKDAYS[weekdayIndex],
    weekday_index: weekdayIndex,
    hour,
  };
}

function engagementRate({ likes, comments, saves, shares, reach }) {
  const interactions = [likes, comments, saves, shares];
  if (
    !Number.isFinite(reach) ||
    reach <= 0 ||
    interactions.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  return interactions.reduce((total, value) => total + value, 0) / reach;
}

function normalizeMedia(media, durationsById = {}, timeZone, captionClassesById = {}) {
  const insights = media && typeof media.insights === 'object' && media.insights !== null
    ? media.insights
    : {};
  const views = finiteNumber(insights.views) ?? finiteNumber(insights.plays);
  const duration = nonNegativeNumber(durationsById[media.id]);
  const parts = dateParts(media.timestamp, timeZone);
  const likes = finiteNumber(media.like_count);
  const comments = finiteNumber(media.comments_count);
  const saves = finiteNumber(insights.saved);
  const shares = finiteNumber(insights.shares);
  const reach = finiteNumber(insights.reach);

  return {
    id: typeof media.id === 'string' ? media.id : null,
    permalink: typeof media.permalink === 'string' ? media.permalink : null,
    format: postFormat(media),
    caption_type: typeof captionClassesById[media.id] === 'string'
      ? captionClassesById[media.id]
      : classifyCaption(media.caption),
    timestamp: typeof media.timestamp === 'string' ? media.timestamp : null,
    ...parts,
    likes,
    comments,
    saves,
    shares,
    reach,
    views,
    engagement_rate: engagementRate({ likes, comments, saves, shares, reach }),
    duration,
    duration_bucket: durationBucket(duration),
  };
}

function summary(items, key) {
  const values = items.map((item) => item[key]);
  const n = values.filter(Number.isFinite).length;
  return {
    n,
    mean: mean(values),
    median: median(values),
    sample_std_dev: sampleStdDev(values),
    sample_verdict: groupedSampleVerdict(n),
  };
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (key === null || key === undefined) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function orderByKnownValues(rows, key, knownValues) {
  return rows.sort((left, right) => {
    const leftIndex = knownValues.indexOf(left[key]);
    const rightIndex = knownValues.indexOf(right[key]);
    const safeLeftIndex = leftIndex === -1 ? knownValues.length : leftIndex;
    const safeRightIndex = rightIndex === -1 ? knownValues.length : rightIndex;
    if (safeLeftIndex !== safeRightIndex) return safeLeftIndex - safeRightIndex;
    return String(left[key]).localeCompare(String(right[key]));
  });
}

function distributionRows(posts) {
  const rows = [{
    format: 'todos',
    n: posts.length,
    views: summary(posts, 'views'),
    reach: summary(posts, 'reach'),
    engagement_rate: summary(posts, 'engagement_rate'),
  }];
  for (const [format, group] of groupBy(posts, (post) => post.format)) {
    rows.push({
      format,
      n: group.length,
      views: summary(group, 'views'),
      reach: summary(group, 'reach'),
      engagement_rate: summary(group, 'engagement_rate'),
    });
  }
  return [rows[0], ...orderByKnownValues(rows.slice(1), 'format', FORMAT_ORDER)];
}

function durationBucketRows(posts) {
  const rows = [];
  for (const [bucket, group] of groupBy(posts, (post) => post.duration_bucket)) {
    rows.push({
      bucket,
      n: group.length,
      views: summary(group, 'views'),
      engagement_rate: summary(group, 'engagement_rate'),
    });
  }
  return orderByKnownValues(rows, 'bucket', DURATION_BUCKET_ORDER);
}

function captionTypeRows(posts) {
  const rows = [];
  for (const [captionType, group] of groupBy(posts, (post) => post.caption_type)) {
    rows.push({
      caption_type: captionType,
      n: group.length,
      views: summary(group, 'views'),
      engagement_rate: summary(group, 'engagement_rate'),
    });
  }
  return orderByKnownValues(rows, 'caption_type', CAPTION_TYPE_ORDER);
}

function weekdayHourRows(posts) {
  const groups = groupBy(posts, (post) => (
    post.weekday_index === null || post.hour === null
      ? null
      : `${post.weekday_index}:${post.hour}`
  ));
  const rows = [];
  for (const [key, group] of groups) {
    const [weekdayIndex, hour] = key.split(':').map(Number);
    rows.push({
      weekday: WEEKDAYS[weekdayIndex],
      weekday_index: weekdayIndex,
      hour,
      n: group.length,
      views: summary(group, 'views'),
      engagement_rate: summary(group, 'engagement_rate'),
    });
  }
  return rows.sort(
    (left, right) => left.weekday_index - right.weekday_index || left.hour - right.hour
  );
}

function qualifyingMonthsAreContiguous(rows) {
  if (rows.length < 2) return null;
  const months = rows.map((row) => row.month).sort();
  return months.every((month, index) => {
    if (index === 0) return true;
    const previous = new Date(`${months[index - 1]}-01T00:00:00.000Z`);
    previous.setUTCMonth(previous.getUTCMonth() + 1);
    return month === previous.toISOString().slice(0, 7);
  });
}

function monthlyTrend(posts) {
  const groups = groupBy(
    posts.filter((post) => post.month !== null),
    (post) => post.month
  );
  const allRows = [];
  for (const [month, group] of groups) {
    const postsWithViews = group.filter((post) => Number.isFinite(post.views));
    const views = summary(postsWithViews, 'views');
    allRows.push({
      month,
      n: views.n,
      views,
      engagement_rate: summary(postsWithViews, 'engagement_rate'),
    });
  }
  allRows.sort((left, right) => left.month.localeCompare(right.month));

  const qualifiedRows = allRows.filter((row) => row.n >= 5);
  const omittedRows = allRows.filter((row) => row.n < 5);
  const available = qualifiedRows.length >= 3;
  const qualifyingMonthsContiguous = qualifyingMonthsAreContiguous(qualifiedRows);
  const monthsWithViews = allRows.filter((row) => row.views.n > 0).length;
  const sampleVerdict = monthsWithViews === 0
    ? 'sem_dado_disponivel'
    : qualifiedRows.length < 3
      ? 'amostra_insuficiente'
      : qualifyingMonthsContiguous === false
        ? 'amostra_mensal_nao_contigua'
        : 'amostra_mensal_adequada';
  return {
    available,
    required_months: 3,
    required_posts_per_month: 5,
    qualifying_months: qualifiedRows.length,
    qualifying_months_contiguous: qualifyingMonthsContiguous,
    sample_verdict: sampleVerdict,
    rows: available ? qualifiedRows : [],
    omitted_rows: omittedRows,
  };
}

function commentsSummary(posts) {
  const overall = summary(posts, 'comments');
  const withComments = posts.filter((post) => Number.isFinite(post.comments));
  const byFormat = [];

  for (const [format, group] of groupBy(posts, (post) => post.format)) {
    const groupComments = group.filter((post) => Number.isFinite(post.comments));
    byFormat.push({
      format,
      n: group.length,
      comments: summary(group, 'comments'),
      conversation_n: groupComments.filter((post) => post.comments > 0).length,
      zero_comments_n: groupComments.filter((post) => post.comments === 0).length,
      missing_comments_n: group.length - groupComments.length,
    });
  }

  return {
    overall: {
      ...overall,
      conversation_n: withComments.filter((post) => post.comments > 0).length,
      zero_comments_n: withComments.filter((post) => post.comments === 0).length,
      missing_comments_n: posts.length - withComments.length,
    },
    by_format: orderByKnownValues(byFormat, 'format', FORMAT_ORDER),
  };
}

function outlierSummary(posts, metric) {
  const knownPosts = posts.filter((post) => Number.isFinite(post[metric]));
  const values = iqrOutliers(knownPosts.map((post) => post[metric]));
  const outlierValues = values === null ? null : new Set(values);

  return {
    n: knownPosts.length,
    values,
    posts: values === null
      ? []
      : knownPosts
        .filter((post) => outlierValues.has(post[metric]))
        .map((post) => ({ id: post.id, permalink: post.permalink, value: post[metric] })),
  };
}

function missingMetricLimitations(posts) {
  const labels = {
    likes: 'curtidas',
    comments: 'comentários',
    saves: 'salvamentos',
    shares: 'compartilhamentos',
    reach: 'alcance',
    views: 'views',
    engagement_rate: 'taxa de engajamento',
    duration: 'duração',
  };

  return Object.keys(labels).flatMap((metric) => {
    const applicablePosts = metric === 'duration'
      ? posts.filter((post) => post.format === 'reel' || post.format === 'video')
      : posts;
    const n = applicablePosts.filter((post) => post[metric] === null).length;
    return n === 0
      ? []
      : [{
        type: 'sem_dado_disponivel',
        metric,
        n,
        message: `${labels[metric]}: sem dado disponível para ${n} ${n === 1 ? 'post' : 'posts'}.`,
      }];
  });
}

function normalizedReproducibilityMetadata(options, timeZone, evidence = null) {
  const metadata = options && typeof options.reproducibility === 'object' && options.reproducibility !== null
    ? options.reproducibility
    : {};
  const inputBasename = typeof metadata.inputBasename === 'string' && metadata.inputBasename.trim() !== ''
    ? path.basename(metadata.inputBasename.trim())
    : null;
  const inputSha256 = typeof metadata.inputSha256 === 'string' && /^[a-f0-9]{64}$/i.test(metadata.inputSha256)
    ? metadata.inputSha256.toLowerCase()
    : null;
  const manuallyInformedLimit = Number.isSafeInteger(metadata.manualLimit) && metadata.manualLimit > 0
    ? metadata.manualLimit
    : null;
  const evidenceBasename = typeof metadata.evidenceBasename === 'string' && metadata.evidenceBasename.trim() !== ''
    ? path.basename(metadata.evidenceBasename.trim())
    : null;
  const evidenceSha256 = typeof metadata.evidenceSha256 === 'string' && /^[a-f0-9]{64}$/i.test(metadata.evidenceSha256)
    ? metadata.evidenceSha256.toLowerCase()
    : null;
  const reproductionCommand = typeof metadata.reproductionCommand === 'string'
    && metadata.reproductionCommand.trim() !== ''
    ? metadata.reproductionCommand.trim()
    : null;
  return {
    input_basename: inputBasename,
    input_sha256: inputSha256,
    manually_informed_limit: manuallyInformedLimit,
    time_zone: timeZone,
    generator_id: GENERATOR_ID,
    evidence_schema: evidence ? evidence.schema : null,
    evidence_basename: evidenceBasename,
    evidence_sha256: evidenceSha256,
    original_snapshot_basename: evidence ? evidence.source.raw_snapshot_basename : null,
    original_snapshot_sha256: evidence ? evidence.source.raw_snapshot_sha256 : null,
    duration_measurement_source: evidence ? evidence.duration_measurement.source : null,
    duration_measured_at: evidence ? evidence.duration_measurement.measured_at : null,
    duration_applicable_count: evidence ? evidence.duration_measurement.applicable_count : null,
    duration_measured_count: evidence ? evidence.duration_measurement.measured_count : null,
    duration_missing_count: evidence ? evidence.duration_measurement.missing_count : null,
    reproduction_command: reproductionCommand,
  };
}

function buildAudit(input = {}, options = {}) {
  const auditOptions = options && typeof options === 'object' ? options : {};
  const sanitizedEvidence = isSanitizedEvidence(input) ? validateSanitizedEvidence(input) : null;
  const dataset = sanitizedEvidence ? evidenceToAuditDataset(sanitizedEvidence) : input;
  assertDataset(dataset);
  const sourceMedia = Array.isArray(dataset.media) ? dataset.media : [];
  const durationsById = sanitizedEvidence
    ? evidenceDurationsById(sanitizedEvidence)
    : auditOptions && typeof auditOptions.durationsById === 'object' && auditOptions.durationsById !== null
      ? auditOptions.durationsById
      : {};
  const captionClassesById = sanitizedEvidence
    ? evidenceCaptionClassesById(sanitizedEvidence)
    : {};
  const timeZone = resolveTimeZone(auditOptions.timeZone);
  const normalizedMedia = sourceMedia.map((media) => (
    normalizeMedia(media || {}, durationsById, timeZone, captionClassesById)
  ));
  const durationCorrelations = ['views', 'engagement_rate'].map((metric) => {
    const correlation = pearson(
      normalizedMedia.map((post) => post.duration),
      normalizedMedia.map((post) => post[metric])
    );
    return {
      metric,
      ...correlation,
      verdict: sampleVerdict(correlation),
    };
  });
  const trend = monthlyTrend(normalizedMedia);
  const outliers = {
    views: outlierSummary(normalizedMedia, 'views'),
    engagement_rate: outlierSummary(normalizedMedia, 'engagement_rate'),
  };
  const limitations = missingMetricLimitations(normalizedMedia);
  const weekdayHour = weekdayHourRows(normalizedMedia);

  if (normalizedMedia.length === 0) {
    limitations.push({
      type: 'amostra_vazia',
      metric: 'posts',
      n: 0,
      message: 'Posts: sem dado disponível porque o snapshot não contém mídia.',
    });
  }
  if (!trend.available) {
    limitations.push({
      type: 'tendencia_mensal_insuficiente',
      metric: 'monthly_trend',
      n: trend.qualifying_months,
      message: `Amostra mensal qualificada: sem dado disponível, exige ${trend.required_months} meses com ${trend.required_posts_per_month} posts com views por mês.`,
    });
  }
  const smallEditorialGroups = weekdayHour.filter((row) => row.n < 5);
  if (smallEditorialGroups.length > 0) {
    limitations.push({
      type: 'horario_editorial_n_pequeno',
      metric: 'weekday_hour',
      n: smallEditorialGroups.length,
      message: `Horário editorial: ${smallEditorialGroups.length} agrupamentos com n menor que 5 não são recomendação de agenda.`,
    });
  }
  for (const [metric, result] of Object.entries(outliers)) {
    if (result.values === null) {
      limitations.push({
        type: 'outliers_insuficientes',
        metric,
        n: result.n,
        message: `Outliers de ${metric}: sem dado disponível com menos de quatro valores válidos.`,
      });
    }
  }

  return {
    handle: typeof dataset.handle === 'string' ? dataset.handle : null,
    fetched_at: typeof dataset.fetched_at === 'string' ? dataset.fetched_at : null,
    time_zone: timeZone,
    reproducibility: normalizedReproducibilityMetadata(auditOptions, timeZone, sanitizedEvidence),
    normalized_media: normalizedMedia,
    distribution: distributionRows(normalizedMedia),
    duration_correlations: durationCorrelations,
    duration_buckets: durationBucketRows(normalizedMedia),
    caption_types: captionTypeRows(normalizedMedia),
    weekday_hour: weekdayHour,
    monthly_trend: trend,
    comments: commentsSummary(normalizedMedia),
    outliers,
    limitations,
  };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return 'sem dado disponível';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatRate(value) {
  if (!Number.isFinite(value)) return 'sem dado disponível';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value * 100)}%`;
}

function formatCorrelation(value) {
  if (!Number.isFinite(value)) return 'sem dado disponível';
  return value.toFixed(3);
}

function metricCell(metric, formatter = formatNumber) {
  return `${formatter(metric.mean)} (n=${metric.n})`;
}

function metricVerdict(metric) {
  return typeof metric?.sample_verdict === 'string'
    ? metric.sample_verdict
    : 'sem_dado_disponivel';
}

function formatLabel(format) {
  const labels = {
    todos: 'Todos',
    reel: 'Reels',
    carrossel: 'Carrossel',
    imagem: 'Imagem',
    video: 'Vídeo',
    outro: 'Outro',
  };
  return labels[format] || format;
}

function captionLabel(captionType) {
  const labels = {
    curta_uma_linha: 'Curta, uma linha',
    longa_em_lista: 'Longa, em lista',
    outra: 'Outra',
  };
  return labels[captionType] || captionType;
}

function renderRows(lines, rows, renderRow) {
  if (rows.length === 0) {
    lines.push('sem dado disponível');
    return;
  }
  for (const row of rows) lines.push(renderRow(row));
}

function renderMarkdown(audit) {
  const reproducibility = audit.reproducibility;
  const reproducibilityLines = reproducibility.evidence_schema
    ? [
      `- Schema da evidência sanitizada: \`${reproducibility.evidence_schema}\``,
      `- Evidência sanitizada: \`${reproducibility.evidence_basename || 'sem dado disponível'}\``,
      `- SHA-256 da evidência sanitizada: \`${reproducibility.evidence_sha256 || 'sem dado disponível'}\``,
      `- Snapshot bruto de origem: \`${reproducibility.original_snapshot_basename || 'sem dado disponível'}\``,
      `- SHA-256 do snapshot bruto: \`${reproducibility.original_snapshot_sha256 || 'sem dado disponível'}\``,
      `- Durações incorporadas: \`${reproducibility.duration_measurement_source || 'sem dado disponível'}\`, medidas em \`${reproducibility.duration_measured_at || 'sem dado disponível'}\`.`,
      `- Cobertura das durações incorporadas: ${reproducibility.duration_measured_count ?? 'sem dado disponível'} de ${reproducibility.duration_applicable_count ?? 'sem dado disponível'} medidas, ${reproducibility.duration_missing_count ?? 'sem dado disponível'} sem dado disponível.`,
      `- Limite informado manualmente pelo operador (\`--limit\`): ${reproducibility.manually_informed_limit || 'sem dado disponível'}`,
      '- O JSON de evidência não registra esse limite e a auditoria não o confere.',
      `- Fuso horário editorial: \`${reproducibility.time_zone}\``,
      `- Gerador estável: \`${reproducibility.generator_id}\``,
      ...(reproducibility.reproduction_command
        ? [
          `- Reprodução offline: \`${reproducibility.reproduction_command}\``,
          '- O comando usa somente caminhos versionados e não chama rede nem ffprobe.',
        ]
        : []),
    ]
    : [
      `- Snapshot de entrada: \`${reproducibility.input_basename || 'sem dado disponível'}\``,
      `- SHA-256 da entrada: \`${reproducibility.input_sha256 || 'sem dado disponível'}\``,
      `- Limite informado manualmente pelo operador (\`--limit\`): ${reproducibility.manually_informed_limit || 'sem dado disponível'}`,
      '- O JSON de entrada não registra esse limite e a auditoria não o confere.',
      `- Fuso horário editorial: \`${reproducibility.time_zone}\``,
      `- Gerador estável: \`${reproducibility.generator_id}\``,
      '- Revisão do código não é incorporada porque o comando pode executar em uma árvore de trabalho sem commit correspondente. O identificador estável do gerador é a referência reproduzível desta saída.',
    ];
  const lines = [
    `# Auditoria executável do Instagram @${audit.handle || 'sem dado disponível'}`,
    '',
    `Dados coletados: ${audit.fetched_at || 'sem dado disponível'}`,
    `Posts normalizados: ${audit.normalized_media.length}`,
    '',
    '## Reprodutibilidade',
    '',
    ...reproducibilityLines,
    '',
    '## Distribuição por formato',
    '',
    '| Formato | n | Views média | Veredito de views | Views mediana | Desvio padrão amostral de views | Alcance médio | Veredito de alcance | Taxa de engajamento média | Veredito de engajamento |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |',
  ];
  renderRows(lines, audit.distribution, (row) => (
    `| ${formatLabel(row.format)} | ${row.n} | ${metricCell(row.views)} | ${metricVerdict(row.views)} | ${formatNumber(row.views.median)} (n=${row.views.n}) | ${formatNumber(row.views.sample_std_dev)} (n=${row.views.n}) | ${metricCell(row.reach)} | ${metricVerdict(row.reach)} | ${metricCell(row.engagement_rate, formatRate)} | ${metricVerdict(row.engagement_rate)} |`
  ));

  lines.push(
    '',
    '## Duração e métricas',
    '',
    '| Métrica | n | r | Veredito da amostra | Aviso |',
    '| --- | ---: | ---: | --- | --- |'
  );
  renderRows(lines, audit.duration_correlations, (row) => (
    `| ${row.metric === 'engagement_rate' ? 'Taxa de engajamento' : 'Views'} | ${row.n} | ${formatCorrelation(row.r)} | ${row.verdict} | Correlação não prova causalidade. |`
  ));

  lines.push(
    '',
    '## Views por faixa de duração',
    '',
    '| Faixa | n | Views média | Veredito de views | Taxa de engajamento média | Veredito de engajamento |',
    '| --- | ---: | ---: | --- | ---: | --- |'
  );
  renderRows(lines, audit.duration_buckets, (row) => (
    `| ${row.bucket} | ${row.n} | ${metricCell(row.views)} | ${metricVerdict(row.views)} | ${metricCell(row.engagement_rate, formatRate)} | ${metricVerdict(row.engagement_rate)} |`
  ));

  lines.push(
    '',
    '## Views por estrutura de legenda',
    '',
    '| Estrutura | n | Views média | Veredito de views | Taxa de engajamento média | Veredito de engajamento |',
    '| --- | ---: | ---: | --- | ---: | --- |'
  );
  renderRows(lines, audit.caption_types, (row) => (
    `| ${captionLabel(row.caption_type)} | ${row.n} | ${metricCell(row.views)} | ${metricVerdict(row.views)} | ${metricCell(row.engagement_rate, formatRate)} | ${metricVerdict(row.engagement_rate)} |`
  ));

  lines.push(
    '',
    `## Views por dia e hora (${audit.time_zone})`,
    '',
    `| Dia (${audit.time_zone}) | Hora (${audit.time_zone}) | n | Views média | Veredito de views | Taxa de engajamento média | Veredito de engajamento |`,
    '| --- | ---: | ---: | ---: | --- | ---: | --- |'
  );
  renderRows(lines, audit.weekday_hour, (row) => (
    `| ${row.weekday} | ${row.hour}:00 | ${row.n} | ${metricCell(row.views)} | ${metricVerdict(row.views)} | ${metricCell(row.engagement_rate, formatRate)} | ${metricVerdict(row.engagement_rate)} |`
  ));

  lines.push(
    '',
    '## Amostra mensal qualificada',
    '',
    `Critério: meses com pelo menos ${audit.monthly_trend.required_posts_per_month} posts com views disponíveis.`,
    `Veredito da amostra mensal: ${audit.monthly_trend.sample_verdict} (n=${audit.monthly_trend.qualifying_months} meses qualificados).`
  );
  if (!audit.monthly_trend.available) {
    lines.push('sem dado disponível');
  } else {
    lines.push(
      '| Mês | n | Views média | Veredito de views | Taxa de engajamento média | Veredito de engajamento |',
      '| --- | ---: | ---: | --- | ---: | --- |'
    );
    renderRows(lines, audit.monthly_trend.rows, (row) => (
      `| ${row.month} | ${row.n} | ${metricCell(row.views)} | ${metricVerdict(row.views)} | ${metricCell(row.engagement_rate, formatRate)} | ${metricVerdict(row.engagement_rate)} |`
    ));
  }
  lines.push('', '### Meses observados omitidos por n insuficiente', '');
  if (audit.monthly_trend.omitted_rows.length === 0) {
    lines.push('Nenhum mês observado foi omitido por n insuficiente.');
  } else {
    lines.push('| Mês | n de views | Veredito de views | Motivo |', '| --- | ---: | --- | --- |');
    renderRows(lines, audit.monthly_trend.omitted_rows, (row) => (
      `| ${row.month} | ${row.views.n} | ${metricVerdict(row.views)} | n insuficiente |`
    ));
  }
  if (audit.monthly_trend.qualifying_months_contiguous === false) {
    lines.push(
      '',
      'Meses não contíguos não sustentam conclusão de alta, queda ou tendência contínua.'
    );
  }

  lines.push(
    '',
    '## Comentários',
    '',
    '| Escopo | n | Média de comentários | Mediana de comentários | Veredito da amostra | Com conversa | Zero comentário | Sem dado |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
    `| Todos os formatos | ${audit.comments.overall.n} | ${formatNumber(audit.comments.overall.mean)} | ${formatNumber(audit.comments.overall.median)} | ${metricVerdict(audit.comments.overall)} | ${audit.comments.overall.conversation_n} | ${audit.comments.overall.zero_comments_n} | ${audit.comments.overall.missing_comments_n} |`
  );
  renderRows(lines, audit.comments.by_format, (row) => (
    `| ${formatLabel(row.format)} | ${row.comments.n} | ${formatNumber(row.comments.mean)} | ${formatNumber(row.comments.median)} | ${metricVerdict(row.comments)} | ${row.conversation_n} | ${row.zero_comments_n} | ${row.missing_comments_n} |`
  ));

  lines.push(
    '',
    '## Outliers por IQR',
    '',
    '| Métrica | n | Outliers |',
    '| --- | ---: | --- |'
  );
  for (const [metric, result] of Object.entries(audit.outliers)) {
    const valueFormatter = metric === 'engagement_rate' ? formatRate : formatNumber;
    const postList = result.values === null
      ? 'sem dado disponível'
      : result.posts.length === 0
        ? 'Nenhum'
        : result.posts.map((post) => `${post.id} (${valueFormatter(post.value)})`).join(', ');
    const label = metric === 'engagement_rate' ? 'Taxa de engajamento' : 'Views';
    lines.push(`| ${label} | ${result.n} | ${postList} |`);
  }

  lines.push('', '## Limitações', '');
  if (audit.limitations.length === 0) {
    lines.push('Nenhuma limitação detectada nos campos analisados.');
  } else {
    for (const limitation of audit.limitations) {
      lines.push(`- ${limitation.message} (n=${limitation.n})`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = { input: null, output: null, timeZone: DEFAULT_TIME_ZONE, limit: null };
  const argumentKeys = {
    '--input': 'input',
    '--output': 'output',
    '--time-zone': 'timeZone',
    '--limit': 'limit',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    const key = argumentKeys[argument];
    if (!key) {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Valor ausente para ${argument}`);
    }
    if (key === 'limit') {
      const limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new Error(`Limite inválido: ${value}`);
      }
      args.limit = limit;
    } else {
      args[key] = value;
    }
    index += 1;
  }
  return args;
}

function latestInputPath(rootDirectory) {
  const directory = path.join(rootDirectory, 'output', 'instagram-analyzer');
  const candidates = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[^/\\]+-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (candidates.length === 0) {
    throw new Error(`Nenhum snapshot de conta do cliente ativo encontrado em ${directory}.`);
  }
  return path.join(directory, candidates[candidates.length - 1]);
}

function committedRelativePath(rootDirectory, targetPath) {
  const relativePath = path.relative(rootDirectory, targetPath);
  if (
    relativePath === ''
    || path.isAbsolute(relativePath)
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
  ) {
    return null;
  }
  return relativePath.split(path.sep).join('/');
}

function offlineReproductionCommand(rootDirectory, inputPath, outputPath, args) {
  const inputRelativePath = committedRelativePath(rootDirectory, inputPath);
  const outputRelativePath = committedRelativePath(rootDirectory, outputPath);
  if (!inputRelativePath || !outputRelativePath || !Number.isSafeInteger(args.limit)) {
    return null;
  }
  return `node skills/ct-instagram-audit/audit.cjs --input ${inputRelativePath} --output ${outputRelativePath} --limit ${args.limit} --time-zone ${args.timeZone}`;
}

async function run(argv = process.argv, rootDirectory = process.cwd(), options = {}) {
  const args = parseArgs(argv);
  const inputPath = args.input
    ? path.resolve(rootDirectory, args.input)
    : latestInputPath(rootDirectory);
  const date = new Date().toISOString().slice(0, 10);
  const outputPath = args.output
    ? path.resolve(rootDirectory, args.output)
    : path.join(rootDirectory, 'content', 'research', `${date}-instagram-audit.md`);
  const inputBuffer = fs.readFileSync(inputPath);
  const input = JSON.parse(inputBuffer.toString('utf8'));
  const sanitizedEvidence = isSanitizedEvidence(input) ? validateSanitizedEvidence(input) : null;
  let markdown;
  if (sanitizedEvidence) {
    markdown = renderMarkdown(buildAudit(sanitizedEvidence, {
      timeZone: args.timeZone,
      reproducibility: {
        evidenceBasename: path.basename(inputPath),
        evidenceSha256: crypto.createHash('sha256').update(inputBuffer).digest('hex'),
        manualLimit: args.limit,
        reproductionCommand: offlineReproductionCommand(rootDirectory, inputPath, outputPath, args),
      },
    }));
  } else {
    assertDataset(input);
    const durationsById = await enrichDurations(input.media, options);
    markdown = renderMarkdown(buildAudit(input, {
      durationsById,
      timeZone: args.timeZone,
      reproducibility: {
        inputBasename: path.basename(inputPath),
        inputSha256: crypto.createHash('sha256').update(inputBuffer).digest('hex'),
        manualLimit: args.limit,
      },
    }));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Auditoria salva em ${outputPath}`);
  return { inputPath, outputPath, limit: args.limit, sanitizedEvidence: Boolean(sanitizedEvidence) };
}

module.exports = {
  buildAudit,
  renderMarkdown,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error(`Falha na auditoria do Instagram: ${error.message}`);
    process.exitCode = 1;
  });
}
