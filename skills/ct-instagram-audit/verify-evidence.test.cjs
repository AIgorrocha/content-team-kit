const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { run: runAudit } = require('./audit.cjs');
const { createSanitizedEvidence, serializeSanitizedEvidence } = require('./evidence.cjs');
const { verifyEvidenceReport } = require('./verify-evidence.cjs');

function fixtureEvidence() {
  const raw = {
    handle: 'acme.co',
    fetched_at: '2026-08-20T19:57:32.002Z',
    media: [
      {
        id: 'verify-video-measured',
        media_type: 'VIDEO',
        media_product_type: 'REELS',
        timestamp: '2026-08-01T15:00:00.000Z',
        caption: 'Uma linha.',
        like_count: 10,
        comments_count: 1,
        insights: { views: 100, reach: 100, saved: 1, shares: 1 },
      },
      {
        id: 'verify-video-missing',
        media_type: 'VIDEO',
        media_product_type: 'REELS',
        timestamp: '2026-08-02T15:00:00.000Z',
        caption: 'Outra linha.',
        like_count: 8,
        comments_count: 0,
        insights: { views: 200, reach: 100, saved: 1, shares: 1 },
      },
      {
        id: 'verify-image',
        media_type: 'IMAGE',
        timestamp: '2026-08-03T15:00:00.000Z',
        caption: 'Imagem.',
        like_count: 4,
        comments_count: 0,
        insights: { reach: 100, saved: 0, shares: 0 },
      },
    ],
  };
  return createSanitizedEvidence(raw, {
    rawSnapshotBasename: 'acme.co-2026-08-20.json',
    rawSnapshotSha256: 'c'.repeat(64),
    measuredAt: '2026-08-20T20:00:00.000Z',
    durationsById: {
      'verify-video-measured': 20,
      'verify-video-missing': null,
    },
  });
}

async function writeVerifiedFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-verify-evidence-'));
  const input = path.join('content', 'research', 'evidence', 'fixture.json');
  const report = path.join('content', 'research', 'fixture-report.md');
  const inputPath = path.join(root, input);
  fs.mkdirSync(path.dirname(inputPath), { recursive: true });
  fs.writeFileSync(inputPath, serializeSanitizedEvidence(fixtureEvidence()), 'utf8');
  await runAudit([
    'node',
    'audit.cjs',
    '--input', input,
    '--output', report,
    '--limit', '90',
  ], root, {
    execFile: async () => {
      throw new Error('ffprobe não deve ser chamado para evidência sanitizada.');
    },
  });
  return { root, input, report };
}

const expectedFixtureCounts = {
  posts: 3,
  views_available: 2,
  duration_applicable: 2,
  duration_measured: 1,
  duration_missing: 1,
};

test('verifica hash, contagens, relatório determinístico e zero ffprobe', async () => {
  const fixture = await writeVerifiedFixture();
  try {
    const result = await verifyEvidenceReport({
      rootDirectory: fixture.root,
      input: fixture.input,
      report: fixture.report,
      limit: 90,
      expectedCounts: expectedFixtureCounts,
    });

    assert.deepEqual(result.counts, expectedFixtureCounts);
    assert.equal(result.ffprobe_calls, 0);
    assert.match(result.evidence_sha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejeita relatório que não corresponde à evidência sanitizada', async () => {
  const fixture = await writeVerifiedFixture();
  try {
    const reportPath = path.join(fixture.root, fixture.report);
    fs.writeFileSync(
      reportPath,
      fs.readFileSync(reportPath, 'utf8').replace('Posts normalizados: 3', 'Posts normalizados: 4'),
      'utf8'
    );

    await assert.rejects(
      verifyEvidenceReport({
        rootDirectory: fixture.root,
        input: fixture.input,
        report: fixture.report,
        limit: 90,
        expectedCounts: expectedFixtureCounts,
      }),
      /não corresponde à evidência/i
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
