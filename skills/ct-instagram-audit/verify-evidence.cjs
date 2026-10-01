const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAudit, renderMarkdown, run: runAudit } = require('./audit.cjs');
const { validateSanitizedEvidence } = require('./evidence.cjs');

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const RELEASE_COUNTS = {
  posts: 90,
  views_available: 52,
  duration_applicable: 54,
  duration_measured: 51,
  duration_missing: 3,
};

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function relativeCommittedPath(rootDirectory, targetPath) {
  const relativePath = path.relative(rootDirectory, targetPath);
  if (
    relativePath === ''
    || path.isAbsolute(relativePath)
    || relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error('A verificação exige caminhos dentro do checkout.');
  }
  return relativePath.split(path.sep).join('/');
}

function reproductionCommand(rootDirectory, inputPath, reportPath, limit) {
  return `node skills/ct-instagram-audit/audit.cjs --input ${relativeCommittedPath(rootDirectory, inputPath)} --output ${relativeCommittedPath(rootDirectory, reportPath)} --limit ${limit} --time-zone ${DEFAULT_TIME_ZONE}`;
}

function assertExpectedCounts(counts, expectedCounts) {
  for (const [field, expected] of Object.entries(expectedCounts)) {
    if (counts[field] !== expected) {
      throw new Error(`Contagem ${field} não corresponde à evidência da release.`);
    }
  }
}

async function confirmNoFfprobe(inputPath, rootDirectory, limit) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-instagram-evidence-verify-'));
  try {
    const temporaryOutput = path.join(temporaryDirectory, 'audit.md');
    let ffprobeCalls = 0;
    await runAudit([
      'node',
      'audit.cjs',
      '--input', inputPath,
      '--output', temporaryOutput,
      '--limit', String(limit),
      '--time-zone', DEFAULT_TIME_ZONE,
    ], rootDirectory, {
      execFile: async () => {
        ffprobeCalls += 1;
        throw new Error('ffprobe não deve ser chamado para evidência sanitizada.');
      },
    });
    return ffprobeCalls;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function verifyEvidenceReport({
  rootDirectory = process.cwd(),
  input,
  report,
  limit = 90,
  expectedCounts = RELEASE_COUNTS,
} = {}) {
  if (typeof input !== 'string' || input.trim() === '' || typeof report !== 'string' || report.trim() === '') {
    throw new Error('Informe os caminhos de evidência e relatório.');
  }
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error('O limite de reprodução deve ser inteiro positivo.');
  }
  const inputPath = path.resolve(rootDirectory, input);
  const reportPath = path.resolve(rootDirectory, report);
  const evidenceBuffer = fs.readFileSync(inputPath);
  const evidence = validateSanitizedEvidence(JSON.parse(evidenceBuffer.toString('utf8')));
  assertExpectedCounts(evidence.counts, expectedCounts);
  const evidenceSha256 = sha256(evidenceBuffer);
  const expectedMarkdown = renderMarkdown(buildAudit(evidence, {
    timeZone: DEFAULT_TIME_ZONE,
    reproducibility: {
      evidenceBasename: path.basename(inputPath),
      evidenceSha256,
      manualLimit: limit,
      reproductionCommand: reproductionCommand(rootDirectory, inputPath, reportPath, limit),
    },
  }));
  const actualMarkdown = fs.readFileSync(reportPath, 'utf8');
  if (actualMarkdown !== expectedMarkdown) {
    throw new Error('O relatório não corresponde à evidência sanitizada.');
  }
  if (/(?:[a-z][a-z0-9+.-]*):\/\/|[\u2013\u2014]/i.test(actualMarkdown)) {
    throw new Error('O relatório contém URL ou travessão não permitido.');
  }
  const ffprobeCalls = await confirmNoFfprobe(inputPath, rootDirectory, limit);
  if (ffprobeCalls !== 0) {
    throw new Error(`A auditoria de evidência chamou ffprobe ${ffprobeCalls} vez(es).`);
  }
  return {
    evidence_sha256: evidenceSha256,
    counts: { ...expectedCounts },
    ffprobe_calls: ffprobeCalls,
  };
}

function parseArgs(argv) {
  const args = { input: null, report: null, limit: 90 };
  const keys = { '--input': 'input', '--report': 'report', '--limit': 'limit' };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    const key = keys[argument];
    if (!key) throw new Error(`Argumento desconhecido: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Valor ausente para ${argument}`);
    args[key] = key === 'limit' ? Number(value) : value;
    index += 1;
  }
  if (!args.input || !args.report) {
    throw new Error('Use --input e --report para verificar a evidência sanitizada.');
  }
  if (!Number.isSafeInteger(args.limit) || args.limit <= 0) {
    throw new Error(`Limite inválido: ${args.limit}`);
  }
  return args;
}

module.exports = {
  RELEASE_COUNTS,
  verifyEvidenceReport,
};

if (require.main === module) {
  const args = parseArgs(process.argv);
  verifyEvidenceReport({
    rootDirectory: process.cwd(),
    input: args.input,
    report: args.report,
    limit: args.limit,
  }).then((result) => {
    console.log(`Evidência e relatório verificados: ${JSON.stringify(result)}`);
  }).catch((error) => {
    console.error(`Falha na verificação de evidência: ${error.message}`);
    process.exitCode = 1;
  });
}
