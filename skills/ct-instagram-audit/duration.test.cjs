const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probeDuration, enrichDurations } = require('./duration.cjs');
const { run } = require('./audit.cjs');

// These cases catch a probe that accepts malformed ffprobe output, turns an
// unavailable URL into a guessed value, or invokes ffprobe for non-video media.
async function main() {
  const probeCalls = [];
  const successfulExecFile = async (executable, args, options) => {
    probeCalls.push({ executable, args, options });
    return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
  };

  assert.equal(
    await probeDuration('https://cdn.example/video.mp4', { execFile: successfulExecFile }),
    29.04
  );
  assert.deepEqual(probeCalls, [{
    executable: 'ffprobe',
    args: [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      'https://cdn.example/video.mp4',
    ],
    options: {
      encoding: 'utf8',
      shell: false,
      timeout: 15_000,
    },
  }]);

  const timedOutProbeCalls = [];
  assert.equal(
    await probeDuration('https://cdn.example/slow.mp4', {
      execFile: async (executable, args, options) => {
        timedOutProbeCalls.push({ executable, args, options });
        const error = new Error('ffprobe timed out');
        error.code = 'ETIMEDOUT';
        error.killed = true;
        throw error;
      },
    }),
    null
  );
  assert.deepEqual(timedOutProbeCalls, [{
    executable: 'ffprobe',
    args: [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      'https://cdn.example/slow.mp4',
    ],
    options: {
      encoding: 'utf8',
      shell: false,
      timeout: 15_000,
    },
  }]);

  const customTimeoutCalls = [];
  assert.equal(
    await probeDuration('https://cdn.example/custom-timeout.mp4', {
      durationTimeoutMs: 4_500,
      execFile: async (executable, args, options) => {
        customTimeoutCalls.push({ executable, args, options });
        return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
      },
    }),
    29.04
  );
  assert.equal(customTimeoutCalls[0].options.timeout, 4_500);

  for (const durationTimeoutMs of [
    0,
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2_147_483_648,
    '4500',
  ]) {
    const invalidTimeoutCalls = [];
    assert.equal(
      await probeDuration('https://cdn.example/invalid-timeout.mp4', {
        durationTimeoutMs,
        execFile: async (executable, args, options) => {
          invalidTimeoutCalls.push({ executable, args, options });
          return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
        },
      }),
      29.04
    );
    assert.equal(invalidTimeoutCalls[0].options.timeout, 15_000);
  }

  assert.equal(
    await probeDuration('https://cdn.example/malformed.mp4', {
      execFile: async () => ({ stdout: '{not-json', stderr: '' }),
    }),
    null
  );
  assert.equal(
    await probeDuration('https://cdn.example/empty-duration.mp4', {
      execFile: async () => ({ stdout: '{"format":{"duration":""}}', stderr: '' }),
    }),
    null
  );
  assert.equal(
    await probeDuration('https://cdn.example/whitespace-duration.mp4', {
      execFile: async () => ({ stdout: '{"format":{"duration":"   "}}', stderr: '' }),
    }),
    null
  );
  assert.equal(
    await probeDuration('https://cdn.example/expired.mp4', {
      execFile: async () => {
        throw new Error('HTTP 403');
      },
    }),
    null
  );

  const enrichmentCalls = [];
  const durationsById = await enrichDurations([
    {
      id: 'explicit-video',
      media_type: 'VIDEO',
      media_url: 'https://cdn.example/explicit.mp4',
    },
    {
      id: 'measured-video',
      media_type: 'VIDEO',
      media_url: 'https://cdn.example/measured.mp4',
    },
    {
      id: 'expired-video',
      media_type: 'VIDEO',
      media_url: 'https://cdn.example/expired.mp4',
    },
    {
      id: 'image',
      media_type: 'IMAGE',
      media_url: 'https://cdn.example/image.jpg',
    },
  ], {
    durationsById: { 'explicit-video': 12 },
    execFile: async (executable, args) => {
      enrichmentCalls.push({ executable, args });
      if (args.at(-1) === 'https://cdn.example/expired.mp4') {
        throw new Error('HTTP 403');
      }
      return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
    },
  });

  assert.deepEqual(durationsById, {
    'explicit-video': 12,
    'measured-video': 29.04,
    'expired-video': null,
  });
  assert.deepEqual(
    enrichmentCalls.map(({ args }) => args.at(-1)),
    ['https://cdn.example/measured.mp4', 'https://cdn.example/expired.mp4']
  );

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-duration-'));
  try {
    fs.writeFileSync(path.join(temporaryRoot, 'input.json'), JSON.stringify({
      handle: 'acme.co',
      fetched_at: '2026-08-20T00:00:00.000Z',
      media: [
        {
          id: 'explicit-video',
          media_type: 'VIDEO',
          media_url: 'https://cdn.example/explicit.mp4',
          insights: {},
        },
        {
          id: 'measured-video',
          media_type: 'VIDEO',
          media_url: 'https://cdn.example/measured.mp4',
          insights: {},
        },
        {
          id: 'expired-video',
          media_type: 'VIDEO',
          media_url: 'https://cdn.example/expired.mp4',
          insights: {},
        },
        {
          id: 'image',
          media_type: 'IMAGE',
          media_url: 'https://cdn.example/image.jpg',
          insights: {},
        },
      ],
    }), 'utf8');

    const auditProbeCalls = [];
    const outputPath = path.join(temporaryRoot, 'audit.md');
    const auditRun = run(
      ['node', 'audit.cjs', '--input', 'input.json', '--output', 'audit.md'],
      temporaryRoot,
      {
        durationsById: { 'explicit-video': 5 },
        execFile: async (executable, args) => {
          auditProbeCalls.push({ executable, args });
          if (args.at(-1) === 'https://cdn.example/expired.mp4') {
            throw new Error('HTTP 403');
          }
          return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
        },
      }
    );
    assert.equal(auditRun instanceof Promise, true);
    await auditRun;

    assert.deepEqual(
      auditProbeCalls.map(({ args }) => args.at(-1)),
      ['https://cdn.example/measured.mp4', 'https://cdn.example/expired.mp4']
    );
    const markdown = fs.readFileSync(outputPath, 'utf8');
    assert.match(markdown, /\| 0_10s \| 1 \|/);
    assert.match(markdown, /\| 10_30s \| 1 \|/);
    assert.match(markdown, /duração: sem dado disponível para 1 post\./);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const semHandleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-duration-sem-handle-'));
  try {
    fs.writeFileSync(path.join(semHandleRoot, 'input.json'), JSON.stringify({
      media: [{
        id: 'sem-handle-video',
        media_type: 'VIDEO',
        media_url: 'https://cdn.example/sem-handle.mp4',
      }],
    }), 'utf8');

    const semHandleProbeCalls = [];
    await assert.rejects(
      () => run(
        ['node', 'audit.cjs', '--input', 'input.json', '--output', 'audit.md'],
        semHandleRoot,
        {
          execFile: async (executable, args) => {
            semHandleProbeCalls.push({ executable, args });
            return { stdout: '{"format":{"duration":"29.04"}}', stderr: '' };
          },
        }
      ),
      /exige um snapshot com "handle"/
    );
    assert.deepEqual(semHandleProbeCalls, []);
  } finally {
    fs.rmSync(semHandleRoot, { recursive: true, force: true });
  }

  console.log('ct-instagram-audit/duration: OK');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
