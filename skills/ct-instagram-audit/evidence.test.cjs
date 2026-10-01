const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  EVIDENCE_SCHEMA,
  createSanitizedEvidence,
  validateSanitizedEvidence,
  run: runEvidence,
} = require('./evidence.cjs');

const rawSnapshot = {
  handle: 'acme.co',
  fetched_at: '2026-08-20T19:57:32.002Z',
  paging: { next: 'opaque-page-value?private=query' },
  access_token: 'access-token-interno',
  media: [
    {
      id: 'video-measured',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      timestamp: '2026-08-01T15:00:00.000Z',
      caption: '- Diagnóstico\n- Plano\n- Execução',
      permalink: 'opaque-permalink-value',
      media_url: `https:${'//'}media.invalid/opaque-media-source`,
      like_count: 11,
      comments_count: 2,
      insights: { views: 100, reach: 200, saved: 3, shares: 4, unrelated: 'drop-me' },
    },
    {
      id: 'video-unavailable',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
      timestamp: '2026-08-02T15:00:00.000Z',
      caption: 'Legenda privada de uma linha.',
      permalink: 'opaque-permalink-value-2',
      media_url: `https:${'//'}media.invalid/opaque-media-source-2`,
      like_count: 7,
      comments_count: 1,
      insights: { plays: 200, reach: 300, saved: 1, shares: 2 },
    },
    {
      id: 'image-no-views',
      media_type: 'IMAGE',
      timestamp: '2026-08-03T15:00:00.000Z',
      caption: 'Texto confidencial sem métrica de view.',
      permalink: 'opaque-permalink-value-3',
      like_count: 4,
      comments_count: 0,
      insights: { reach: 120, saved: 0, shares: 1 },
    },
  ],
};

const chainOfCustody = {
  rawSnapshotBasename: 'acme.co-2026-08-20.json',
  rawSnapshotSha256: 'a'.repeat(64),
  measuredAt: '2026-08-20T20:00:00.000Z',
  durationsById: {
    'video-measured': 18.25,
    'video-unavailable': null,
  },
};

function clonedEvidence() {
  return JSON.parse(JSON.stringify(createSanitizedEvidence(rawSnapshot, chainOfCustody)));
}

test('sanitiza o snapshot em uma allowlist auditável sem texto, URLs ou segredo', () => {
  const evidence = createSanitizedEvidence(rawSnapshot, chainOfCustody);
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.schema, EVIDENCE_SCHEMA);
  assert.deepEqual(Object.keys(evidence).sort(), [
    'counts',
    'duration_measurement',
    'fetched_at',
    'handle',
    'media',
    'schema',
    'source',
  ]);
  assert.deepEqual(evidence.source, {
    raw_snapshot_basename: 'acme.co-2026-08-20.json',
    raw_snapshot_sha256: 'a'.repeat(64),
  });
  assert.deepEqual(evidence.counts, {
    posts: 3,
    views_available: 2,
    video_posts: 2,
    duration_applicable: 2,
    duration_measured: 1,
    duration_missing: 1,
  });
  assert.deepEqual(evidence.duration_measurement, {
    source: 'ffprobe',
    measured_at: '2026-08-20T20:00:00.000Z',
    applicable_count: 2,
    measured_count: 1,
    missing_count: 1,
    durations_by_id: {
      'video-measured': 18.25,
      'video-unavailable': null,
    },
  });
  assert.deepEqual(evidence.media[0], {
    id: 'video-measured',
    media_type: 'VIDEO',
    media_product_type: 'REELS',
    timestamp: '2026-08-01T15:00:00.000Z',
    like_count: 11,
    comments_count: 2,
    insights: { views: 100, plays: null, reach: 200, saved: 3, shares: 4 },
    caption_class: 'longa_em_lista',
  });
  assert.equal(evidence.media[1].caption_class, 'curta_uma_linha');
  assert.equal(evidence.media[2].caption_class, 'curta_uma_linha');
  assert.doesNotMatch(serialized, /opaque-|confidencial|access-token-interno|drop-me|:\/\//i);
  assert.doesNotMatch(serialized, /"caption"|"permalink"|"media_url"|"paging"|"access_token"/);
});

test('produz bytes determinísticos quando a coleta e a medição são fixas', () => {
  const first = createSanitizedEvidence(rawSnapshot, chainOfCustody);
  const second = createSanitizedEvidence(rawSnapshot, chainOfCustody);

  assert.equal(JSON.stringify(first, null, 2), JSON.stringify(second, null, 2));
});

test('rejeita evidência com duração inválida ou IDs inconsistentes', () => {
  const negativeDuration = clonedEvidence();
  negativeDuration.duration_measurement.durations_by_id['video-measured'] = -1;
  assert.throws(() => validateSanitizedEvidence(negativeDuration), /duraç/i);

  const nonFiniteDuration = clonedEvidence();
  nonFiniteDuration.duration_measurement.durations_by_id['video-measured'] = Number.NaN;
  assert.throws(() => validateSanitizedEvidence(nonFiniteDuration), /duraç/i);

  const missingDuration = clonedEvidence();
  delete missingDuration.duration_measurement.durations_by_id['video-unavailable'];
  assert.throws(() => validateSanitizedEvidence(missingDuration), /duraç/i);

  const unknownDuration = clonedEvidence();
  unknownDuration.duration_measurement.durations_by_id['unknown-video'] = 20;
  assert.throws(() => validateSanitizedEvidence(unknownDuration), /duraç/i);

  const duplicateId = clonedEvidence();
  duplicateId.media[1].id = duplicateId.media[0].id;
  assert.throws(() => validateSanitizedEvidence(duplicateId), /ID/i);

  const extraRawField = clonedEvidence();
  extraRawField.media[0].media_url = `https:${'//'}media.invalid/should-not-be-accepted`;
  assert.throws(() => validateSanitizedEvidence(extraRawField), /campos não permitidos/i);
});

test('escreve a evidência sanitizada sem persistir a entrada sensível', async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-evidence-'));
  try {
    const inputPath = path.join(temporaryRoot, 'raw.json');
    const outputPath = path.join(temporaryRoot, 'evidence.json');
    fs.writeFileSync(inputPath, JSON.stringify(rawSnapshot), 'utf8');
    let ffprobeCalls = 0;

    const result = await runEvidence([
      'node',
      'evidence.cjs',
      '--input', 'raw.json',
      '--output', 'evidence.json',
      '--measured-at', '2026-08-20T20:00:00.000Z',
    ], temporaryRoot, {
      execFile: async () => {
        ffprobeCalls += 1;
        return { stdout: '{"format":{"duration":"18.25"}}' };
      },
    });

    const persisted = fs.readFileSync(outputPath, 'utf8');
    assert.equal(ffprobeCalls, 2);
    assert.equal(result.outputPath, outputPath);
    assert.doesNotMatch(persisted, /opaque-|confidencial|access-token-interno|drop-me|:\/\//i);
    assert.deepEqual(JSON.parse(persisted).duration_measurement.durations_by_id, {
      'video-measured': 18.25,
      'video-unavailable': 18.25,
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
