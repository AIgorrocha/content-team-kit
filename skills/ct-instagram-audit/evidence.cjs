const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { enrichDurations } = require('./duration.cjs');
const { classifyCaption } = require('./statistics.cjs');

const EVIDENCE_SCHEMA = 'ct-instagram-audit-evidence/v1';
const CAPTION_CLASSES = new Set(['curta_uma_linha', 'longa_em_lista', 'outra']);
const INSIGHT_FIELDS = ['views', 'plays', 'reach', 'saved', 'shares'];
const MEDIA_FIELDS = [
  'id',
  'media_type',
  'media_product_type',
  'timestamp',
  'like_count',
  'comments_count',
  'insights',
  'caption_class',
];

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expectedKeys, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} deve ser um objeto simples.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contém campos não permitidos ou ausentes.`);
  }
}

function assertSafeString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} deve ser uma string não vazia.`);
  }
  if (/(?:[a-z][a-z0-9+.-]*:\/\/|[?&](?:access_token|token|key)=)/i.test(value)) {
    throw new Error(`${label} não pode conter URL ou credencial.`);
  }
  return value;
}

function assertNullableFiniteNonNegative(value, label) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} deve ser número finito não negativo ou nulo.`);
  }
  return value;
}

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} deve ser inteiro seguro não negativo.`);
  }
  return value;
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} deve ser SHA-256 hexadecimal.`);
  }
  return value.toLowerCase();
}

function assertTimestamp(value, label) {
  assertSafeString(value, label);
  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} deve ser uma data válida.`);
  }
  return value;
}

function assertRawSnapshot(snapshot) {
  if (!isPlainObject(snapshot) || typeof snapshot.handle !== 'string' || !snapshot.handle || !Array.isArray(snapshot.media)) {
    throw new Error('A evidência aceita somente snapshot bruto com "handle" (conta do cliente ativo) e mídia em lista.');
  }
  if (typeof snapshot.fetched_at !== 'string' || snapshot.fetched_at.trim() === '') {
    throw new Error('O snapshot bruto precisa de fetched_at.');
  }
  return snapshot;
}

function nullableRawMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function sanitizedMedia(rawMedia, index) {
  if (!isPlainObject(rawMedia)) {
    throw new Error(`Mídia bruta na posição ${index} deve ser objeto.`);
  }
  const id = assertSafeString(rawMedia.id, `ID da mídia na posição ${index}`);
  const mediaType = assertSafeString(rawMedia.media_type, `Tipo da mídia ${id}`);
  const timestamp = assertTimestamp(rawMedia.timestamp, `Timestamp da mídia ${id}`);
  const insights = isPlainObject(rawMedia.insights) ? rawMedia.insights : {};

  return {
    id,
    media_type: mediaType,
    media_product_type: typeof rawMedia.media_product_type === 'string'
      ? assertSafeString(rawMedia.media_product_type, `Produto da mídia ${id}`)
      : null,
    timestamp,
    like_count: nullableRawMetric(rawMedia.like_count),
    comments_count: nullableRawMetric(rawMedia.comments_count),
    insights: Object.fromEntries(INSIGHT_FIELDS.map((field) => [
      field,
      nullableRawMetric(insights[field]),
    ])),
    caption_class: classifyCaption(rawMedia.caption),
  };
}

function normalizedSourceMetadata(options = {}) {
  const rawSnapshotBasename = assertSafeString(options.rawSnapshotBasename, 'Nome-base do snapshot bruto');
  if (
    rawSnapshotBasename !== path.basename(rawSnapshotBasename)
    || rawSnapshotBasename.includes('/')
    || rawSnapshotBasename.includes('\\')
  ) {
    throw new Error('Nome-base do snapshot bruto não pode conter caminho.');
  }
  return {
    raw_snapshot_basename: rawSnapshotBasename,
    raw_snapshot_sha256: assertSha256(options.rawSnapshotSha256, 'Hash do snapshot bruto'),
  };
}

function normalizedMeasurementMetadata(media, options = {}) {
  const durationInput = options.durationsById;
  if (!isPlainObject(durationInput)) {
    throw new Error('Durações medidas devem ser um objeto por ID.');
  }
  const videoIds = media.filter((item) => item.media_type === 'VIDEO').map((item) => item.id);
  const durationIds = Object.keys(durationInput);
  if (
    durationIds.length !== videoIds.length
    || videoIds.some((id) => !Object.prototype.hasOwnProperty.call(durationInput, id))
    || durationIds.some((id) => !videoIds.includes(id))
  ) {
    throw new Error('Durações medidas precisam cobrir exatamente os IDs de vídeo.');
  }

  const durationsById = {};
  for (const id of videoIds) {
    durationsById[id] = assertNullableFiniteNonNegative(durationInput[id], `Duração da mídia ${id}`);
  }
  const measuredCount = Object.values(durationsById).filter((value) => value !== null).length;
  const measuredAt = assertTimestamp(options.measuredAt, 'Data da medição de duração');
  const source = options.measurementSource === undefined ? 'ffprobe' : options.measurementSource;
  if (source !== 'ffprobe') {
    throw new Error('A fonte de medição de duração deve ser ffprobe.');
  }

  return {
    source,
    measured_at: measuredAt,
    applicable_count: videoIds.length,
    measured_count: measuredCount,
    missing_count: videoIds.length - measuredCount,
    durations_by_id: durationsById,
  };
}

function availableViews(media) {
  return media.filter((item) => (
    item.insights.views !== null || item.insights.plays !== null
  )).length;
}

function createSanitizedEvidence(snapshot, options = {}) {
  const raw = assertRawSnapshot(snapshot);
  const media = raw.media.map(sanitizedMedia);
  const ids = new Set();
  for (const item of media) {
    if (ids.has(item.id)) {
      throw new Error(`ID de mídia duplicado: ${item.id}.`);
    }
    ids.add(item.id);
  }
  const durationMeasurement = normalizedMeasurementMetadata(media, options);
  const evidence = {
    schema: EVIDENCE_SCHEMA,
    handle: raw.handle,
    fetched_at: raw.fetched_at,
    source: normalizedSourceMetadata(options),
    duration_measurement: durationMeasurement,
    counts: {
      posts: media.length,
      views_available: availableViews(media),
      video_posts: durationMeasurement.applicable_count,
      duration_applicable: durationMeasurement.applicable_count,
      duration_measured: durationMeasurement.measured_count,
      duration_missing: durationMeasurement.missing_count,
    },
    media,
  };
  validateSanitizedEvidence(evidence);
  return evidence;
}

function validateSanitizedEvidence(evidence) {
  assertExactKeys(evidence, [
    'schema',
    'handle',
    'fetched_at',
    'source',
    'duration_measurement',
    'counts',
    'media',
  ], 'Evidência sanitizada');
  if (evidence.schema !== EVIDENCE_SCHEMA) {
    throw new Error(`Schema de evidência inválido: ${evidence.schema}.`);
  }
  if (typeof evidence.handle !== 'string' || !evidence.handle) {
    throw new Error('A evidência exige "handle" (conta do cliente ativo) preenchido.');
  }
  assertTimestamp(evidence.fetched_at, 'fetched_at da evidência');

  assertExactKeys(evidence.source, ['raw_snapshot_basename', 'raw_snapshot_sha256'], 'Fonte da evidência');
  normalizedSourceMetadata({
    rawSnapshotBasename: evidence.source.raw_snapshot_basename,
    rawSnapshotSha256: evidence.source.raw_snapshot_sha256,
  });

  assertExactKeys(evidence.duration_measurement, [
    'source',
    'measured_at',
    'applicable_count',
    'measured_count',
    'missing_count',
    'durations_by_id',
  ], 'Medição de duração');
  if (evidence.duration_measurement.source !== 'ffprobe') {
    throw new Error('A fonte de medição de duração deve ser ffprobe.');
  }
  assertTimestamp(evidence.duration_measurement.measured_at, 'Data da medição de duração');
  if (!Array.isArray(evidence.media)) {
    throw new Error('Mídia da evidência deve ser uma lista.');
  }

  const ids = new Set();
  for (const item of evidence.media) {
    assertExactKeys(item, MEDIA_FIELDS, 'Mídia sanitizada');
    const id = assertSafeString(item.id, 'ID da mídia sanitizada');
    if (ids.has(id)) throw new Error(`ID de mídia duplicado: ${id}.`);
    ids.add(id);
    assertSafeString(item.media_type, `Tipo da mídia ${id}`);
    if (item.media_product_type !== null) {
      assertSafeString(item.media_product_type, `Produto da mídia ${id}`);
    }
    assertTimestamp(item.timestamp, `Timestamp da mídia ${id}`);
    assertNullableFiniteNonNegative(item.like_count, `Curtidas da mídia ${id}`);
    assertNullableFiniteNonNegative(item.comments_count, `Comentários da mídia ${id}`);
    assertExactKeys(item.insights, INSIGHT_FIELDS, `Insights da mídia ${id}`);
    for (const field of INSIGHT_FIELDS) {
      assertNullableFiniteNonNegative(item.insights[field], `${field} da mídia ${id}`);
    }
    if (!CAPTION_CLASSES.has(item.caption_class)) {
      throw new Error(`Classe de legenda inválida para a mídia ${id}.`);
    }
  }

  const measurement = normalizedMeasurementMetadata(evidence.media, {
    durationsById: evidence.duration_measurement.durations_by_id,
    measuredAt: evidence.duration_measurement.measured_at,
    measurementSource: evidence.duration_measurement.source,
  });
  if (
    measurement.applicable_count !== evidence.duration_measurement.applicable_count
    || measurement.measured_count !== evidence.duration_measurement.measured_count
    || measurement.missing_count !== evidence.duration_measurement.missing_count
  ) {
    throw new Error('Contagens de duração inconsistentes na evidência.');
  }

  assertExactKeys(evidence.counts, [
    'posts',
    'views_available',
    'video_posts',
    'duration_applicable',
    'duration_measured',
    'duration_missing',
  ], 'Contagens da evidência');
  for (const [field, value] of Object.entries(evidence.counts)) {
    assertSafeInteger(value, `Contagem ${field}`);
  }
  const expectedCounts = {
    posts: evidence.media.length,
    views_available: availableViews(evidence.media),
    video_posts: measurement.applicable_count,
    duration_applicable: measurement.applicable_count,
    duration_measured: measurement.measured_count,
    duration_missing: measurement.missing_count,
  };
  for (const [field, value] of Object.entries(expectedCounts)) {
    if (evidence.counts[field] !== value) {
      throw new Error(`Contagem ${field} inconsistente na evidência.`);
    }
  }
  return evidence;
}

function isSanitizedEvidence(value) {
  return isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'schema');
}

function evidenceToAuditDataset(evidence) {
  validateSanitizedEvidence(evidence);
  return {
    handle: evidence.handle,
    fetched_at: evidence.fetched_at,
    media: evidence.media.map((item) => ({
      id: item.id,
      media_type: item.media_type,
      media_product_type: item.media_product_type,
      timestamp: item.timestamp,
      like_count: item.like_count,
      comments_count: item.comments_count,
      insights: { ...item.insights },
    })),
  };
}

function evidenceCaptionClassesById(evidence) {
  validateSanitizedEvidence(evidence);
  return Object.fromEntries(evidence.media.map((item) => [item.id, item.caption_class]));
}

function evidenceDurationsById(evidence) {
  validateSanitizedEvidence(evidence);
  return { ...evidence.duration_measurement.durations_by_id };
}

function serializeSanitizedEvidence(evidence) {
  validateSanitizedEvidence(evidence);
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

function parseArgs(argv) {
  const args = { input: null, output: null, measuredAt: null };
  const keys = {
    '--input': 'input',
    '--output': 'output',
    '--measured-at': 'measuredAt',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    const key = keys[argument];
    if (!key) throw new Error(`Argumento desconhecido: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valor ausente para ${argument}`);
    args[key] = value;
    index += 1;
  }
  if (!args.input || !args.output || !args.measuredAt) {
    throw new Error('Use --input, --output e --measured-at para gerar a evidência sanitizada.');
  }
  return args;
}

async function run(argv = process.argv, rootDirectory = process.cwd(), options = {}) {
  const args = parseArgs(argv);
  const inputPath = path.resolve(rootDirectory, args.input);
  const outputPath = path.resolve(rootDirectory, args.output);
  const rawBuffer = fs.readFileSync(inputPath);
  const snapshot = JSON.parse(rawBuffer.toString('utf8'));
  assertRawSnapshot(snapshot);
  const durationsById = await enrichDurations(snapshot.media, options);
  const evidence = createSanitizedEvidence(snapshot, {
    rawSnapshotBasename: path.basename(inputPath),
    rawSnapshotSha256: crypto.createHash('sha256').update(rawBuffer).digest('hex'),
    measuredAt: args.measuredAt,
    durationsById,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serializeSanitizedEvidence(evidence), 'utf8');
  console.log(`Evidência sanitizada salva em ${outputPath}`);
  return { inputPath, outputPath, evidence };
}

module.exports = {
  EVIDENCE_SCHEMA,
  createSanitizedEvidence,
  validateSanitizedEvidence,
  isSanitizedEvidence,
  evidenceToAuditDataset,
  evidenceCaptionClassesById,
  evidenceDurationsById,
  serializeSanitizedEvidence,
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error(`Falha ao gerar evidência sanitizada: ${error.message}`);
    process.exitCode = 1;
  });
}
