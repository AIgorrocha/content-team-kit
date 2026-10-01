const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseInstagramRun } = require('./social-intel-status.cjs');

const requiredHandle = '@acme.eng';

const successOutput = `
== @acme.eng ==
30 posts obtidos.
Snapshot: 30 posts -> ct_metrics_snapshots

== @beta.io ==
18 posts obtidos.
Snapshot: 18 posts -> ct_metrics_snapshots
`;

const expiredTokenOutput = `
== @acme.eng ==
Falha em @acme.eng: OAuthException: Error validating access token: The session has been invalidated.
`;

const zeroPostsOutput = `
== @acme.eng ==
0 posts obtidos.
Snapshot: 0 posts -> ct_metrics_snapshots
`;

const otherAccountOnlyOutput = `
== @beta.io ==
18 posts obtidos.
Snapshot: 18 posts -> ct_metrics_snapshots
`;

{
  const result = parseInstagramRun({
    exitCode: 0,
    output: successOutput,
    requiredHandle,
  });

  assert.equal(result.ok, true);
  assert.equal(result.snapshots, 2);
  assert.equal(result.requiredPostCount, 30);
  assert.equal(result.requiredHandleOk, true);
  assert.deepEqual(result.alerts, []);
  assert.deepEqual(result.failures, []);
}

{
  const result = parseInstagramRun({
    exitCode: 0,
    output: zeroPostsOutput,
    requiredHandle,
  });

  assert.equal(result.ok, false);
  assert.equal(result.snapshots, 0);
  assert.equal(result.requiredPostCount, 0);
  assert.equal(result.requiredHandleOk, false);
  assert.ok(result.failures.length > 0);
}

{
  const result = parseInstagramRun({
    exitCode: 0,
    output: expiredTokenOutput,
    requiredHandle,
  });

  assert.equal(result.ok, false);
  assert.equal(result.snapshots, 0);
  assert.equal(result.requiredPostCount, null);
  assert.equal(result.requiredHandleOk, false);
  assert.ok(result.alerts.some((alert) => alert.includes('@acme.eng')));
  assert.ok(result.failures.length > 0);
}

{
  const result = parseInstagramRun({
    exitCode: 0,
    output: otherAccountOnlyOutput,
    requiredHandle,
  });

  assert.equal(result.ok, false);
  assert.equal(result.snapshots, 1);
  assert.equal(result.requiredPostCount, null);
  assert.equal(result.requiredHandleOk, false);
  assert.ok(result.failures.length > 0);
}

async function loadLocalPipelineForTest() {
  return import(`${pathToFileURL(path.join(__dirname, 'social-intel-local.mjs')).href}?test=${Date.now()}`);
}

function pipelineSteps(instagram, aggregate) {
  return {
    instagram,
    youtube: () => {},
    linkedIn: () => {},
    tikTok: () => {},
    savedInspiration: () => {},
    driveMiner: () => {},
    aggregate,
  };
}

async function captureTelegramMessage(telegram, {
  instagramGatePassed,
  artifactsUpdated,
  summaryLines,
  failureLines,
}) {
  let request;
  await telegram({
    instagramGatePassed,
    artifactsUpdated,
    summaryLines,
    failureLines,
    alertLines: [],
    token: 'test-token',
    chat: 'test-chat',
    send: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      };
    },
    outputLog: () => {},
  });

  assert.ok(request);
  return new URLSearchParams(request.options.body).get('text');
}

async function testProcessExitCodeReset(runPipeline) {
  const initialExitCode = process.exitCode;
  try {
    process.exitCode = 0;
    await runPipeline({
      log: () => {},
      errorLog: () => {},
      telegram: async () => ({ state: 'sent', sent: true }),
      steps: pipelineSteps(() => ({ requiredHandleOk: false }), () => {}),
    });
    assert.equal(process.exitCode, 1);

    await runPipeline({
      log: () => {},
      errorLog: () => {},
      telegram: async () => ({ state: 'sent', sent: true }),
      steps: pipelineSteps(() => ({ requiredHandleOk: true }), () => true),
    });
    assert.equal(process.exitCode, 0);

    await runPipeline({
      log: () => {},
      errorLog: () => {},
      telegram: async () => ({ state: 'sent', sent: true }),
      steps: pipelineSteps(() => ({ requiredHandleOk: false }), () => {}),
    });
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = initialExitCode;
  }
}

async function testTelegramDelivery(telegram, runPipeline) {
  let successRequest;
  const successLogs = [];
  const success = await telegram({
    instagramGatePassed: true,
    artifactsUpdated: true,
    summaryLines: [],
    failureLines: [],
    alertLines: [],
    token: 'test-token',
    chat: 'test-chat',
    send: async (url, options) => {
      successRequest = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      };
    },
    outputLog: (message) => successLogs.push(message),
  });

  assert.ok(successRequest);
  assert.equal(success.sent, true);
  assert.equal(success.state, 'sent');
  assert.deepEqual(successLogs, ['Telegram enviado.']);

  const apiFailureLogs = [];
  await assert.rejects(
    () => telegram({
      instagramGatePassed: true,
      artifactsUpdated: true,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, description: 'segredo simulado' }),
      }),
      outputLog: (message) => apiFailureLogs.push(message),
    }),
    (error) => error.message === 'Telegram entrega falhou (HTTP 200)'
      && !error.message.includes('segredo simulado'),
  );
  assert.deepEqual(apiFailureLogs, []);

  const malformedPayloads = [
    { ok: true },
    { ok: true, result: { message_id: 0 } },
    { ok: true, result: { message_id: Infinity } },
    'corpo invalido',
  ];
  for (const payload of malformedPayloads) {
    await assert.rejects(
      () => telegram({
        instagramGatePassed: true,
        artifactsUpdated: true,
        summaryLines: [],
        failureLines: [],
        alertLines: [],
        token: 'test-token',
        chat: 'test-chat',
        send: async () => ({ ok: true, status: 200, json: async () => payload }),
        outputLog: () => {},
      }),
      (error) => error.message === 'Telegram entrega falhou (HTTP 200)',
    );
  }

  await assert.rejects(
    () => telegram({
      instagramGatePassed: true,
      artifactsUpdated: true,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('json invalido'); },
      }),
      outputLog: () => {},
    }),
    (error) => error.message === 'Telegram entrega falhou (HTTP 200)',
  );

  const jsonRejectionLogs = [];
  await assert.rejects(
    () => telegram({
      instagramGatePassed: true,
      artifactsUpdated: true,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => ({
        ok: true,
        status: 200,
        json: async () => Promise.reject(new Error('segredo simulado')),
      }),
      outputLog: (message) => jsonRejectionLogs.push(message),
    }),
    (error) => error.message === 'Telegram entrega falhou (HTTP 200)'
      && !error.message.includes('segredo simulado'),
  );
  assert.deepEqual(jsonRejectionLogs, []);

  const nonOkLogs = [];
  await assert.rejects(
    () => telegram({
      instagramGatePassed: true,
      artifactsUpdated: true,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => ({ ok: false, status: 500 }),
      outputLog: (message) => nonOkLogs.push(message),
    }),
    (error) => error.message === 'Telegram entrega falhou (HTTP 500)',
  );
  assert.deepEqual(nonOkLogs, []);

  const rejectionLogs = [];
  await assert.rejects(
    () => telegram({
      instagramGatePassed: true,
      artifactsUpdated: true,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => { throw new Error('test-token must remain hidden'); },
      outputLog: (message) => rejectionLogs.push(message),
    }),
    (error) => error.message === 'Telegram entrega falhou',
  );
  assert.deepEqual(rejectionLogs, []);

  let skippedSendCalls = 0;
  const skipped = await telegram({
    instagramGatePassed: true,
    artifactsUpdated: true,
    summaryLines: [],
    failureLines: [],
    alertLines: [],
    token: '',
    send: async () => {
      skippedSendCalls += 1;
      return { ok: true, status: 200 };
    },
    outputLog: () => {},
  });

  assert.equal(skippedSendCalls, 0);
  assert.equal(skipped.sent, false);
  assert.equal(skipped.state, 'skipped_no_credential');

  const notificationExitCodes = [];
  const notificationFailure = await runPipeline({
    log: () => {},
    errorLog: () => {},
    setExitCode: (code) => notificationExitCodes.push(code),
    telegram: (state) => telegram({
      ...state,
      summaryLines: [],
      failureLines: [],
      alertLines: [],
      token: 'test-token',
      chat: 'test-chat',
      send: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, description: 'segredo simulado' }),
      }),
      outputLog: () => {},
    }),
    steps: pipelineSteps(() => ({ requiredHandleOk: true }), () => true),
  });

  assert.deepEqual(notificationFailure.notification, { state: 'failed', sent: false });
  assert.ok(notificationFailure.failures.includes('Telegram: entrega nao confirmada'));
  assert.ok(notificationFailure.failures.every((failure) => !failure.includes('test-token')));
  assert.ok(notificationFailure.failures.every((failure) => !failure.includes('segredo simulado')));
  assert.ok(notificationFailure.summary.every((line) => !line.includes('segredo simulado')));
  assert.deepEqual(notificationExitCodes, [1]);
}

async function testAggregationGate() {
  const { runPipeline: rawRunPipeline, telegram, formatInstagramSummary, competitorSnapshotArgs, runCompetitorSnapshot } = await loadLocalPipelineForTest();
  // a marca vem do teste, nao do .workspace da maquina
  const runPipeline = (options) => rawRunPipeline({ requiredHandle, ...options });

  assert.equal(typeof runPipeline, 'function');
  assert.equal(typeof telegram, 'function');
  assert.equal(typeof formatInstagramSummary, 'function');
  assert.deepEqual(
    competitorSnapshotArgs('acme'),
    ['--client', 'acme', '--limit', '5'],
    'o pipeline local coleta concorrentes somente da marca ativa'
  );
  const snapshotCalls = [];
  const snapshotResult = runCompetitorSnapshot((script, ...args) => {
    snapshotCalls.push({ script, args });
    return { code: 0, out: '' };
  }, 'acme');
  assert.deepEqual(snapshotResult, { code: 0, out: '' });
  assert.deepEqual(snapshotCalls, [{
    script: 'skills/ct-social-cockpit/competitor-snapshot.js',
    args: ['--client', 'acme', '--limit', '5', { timeout: 300000 }],
  }]);
  assert.equal(
    formatInstagramSummary(parseInstagramRun({
      exitCode: 0,
      output: zeroPostsOutput,
      requiredHandle,
    })),
    'IG: 0 conta(s) com snapshot valido',
  );

  let blockedAggregationCalls = 0;
  const blockedExitCodes = [];
  const blockedTelegramStates = [];
  const blocked = await runPipeline({
    log: () => {},
    errorLog: () => {},
    telegram: async (state) => {
      blockedTelegramStates.push(state);
      return { state: 'sent', sent: true };
    },
    setExitCode: (code) => blockedExitCodes.push(code),
    steps: pipelineSteps(
      () => ({ requiredHandleOk: false }),
      () => { blockedAggregationCalls += 1; },
    ),
  });

  assert.equal(blockedAggregationCalls, 0);
  assert.equal(blocked.aggregationRan, false);
  assert.equal(blocked.artifactsUpdated, false);
  assert.ok(blocked.failures.some((failure) => failure.includes('@acme.eng')));
  assert.deepEqual(blockedExitCodes, [1]);
  assert.deepEqual(blockedTelegramStates, [{ instagramGatePassed: false, artifactsUpdated: false }]);

  let successfulAggregationCalls = 0;
  const successfulExitCodes = [];
  const successfulTelegramStates = [];
  const successful = await runPipeline({
    log: () => {},
    errorLog: () => {},
    telegram: async (state) => {
      successfulTelegramStates.push(state);
      return { state: 'sent', sent: true };
    },
    setExitCode: (code) => successfulExitCodes.push(code),
    steps: pipelineSteps(
      () => ({ requiredHandleOk: true }),
      () => { successfulAggregationCalls += 1; return true; },
    ),
  });

  assert.equal(successfulAggregationCalls, 1);
  assert.equal(successful.aggregationRan, true);
  assert.equal(successful.artifactsUpdated, true);
  assert.deepEqual(successfulExitCodes, [0]);
  assert.deepEqual(successfulTelegramStates, [{ instagramGatePassed: true, artifactsUpdated: true }]);

  let aggregationFailureCalls = 0;
  const aggregationFailureExitCodes = [];
  const aggregationFailureTelegramStates = [];
  const aggregationFailure = await runPipeline({
    log: () => {},
    errorLog: () => {},
    telegram: async (state) => {
      aggregationFailureTelegramStates.push(state);
      return { state: 'sent', sent: true };
    },
    setExitCode: (code) => aggregationFailureExitCodes.push(code),
    steps: pipelineSteps(
      () => ({ requiredHandleOk: true }),
      () => { aggregationFailureCalls += 1; return false; },
    ),
  });

  assert.equal(aggregationFailureCalls, 1);
  assert.equal(aggregationFailure.instagramGatePassed, true);
  assert.equal(aggregationFailure.aggregationRan, true);
  assert.equal(aggregationFailure.artifactsUpdated, false);
  assert.ok(aggregationFailure.failures.some((failure) => failure.includes('artefatos')));
  assert.deepEqual(aggregationFailureExitCodes, [1]);
  assert.deepEqual(aggregationFailureTelegramStates, [{ instagramGatePassed: true, artifactsUpdated: false }]);

  let aggregationExceptionCalls = 0;
  const aggregationExceptionExitCodes = [];
  const aggregationExceptionTelegramStates = [];
  const aggregationException = await runPipeline({
    log: () => {},
    errorLog: () => {},
    telegram: async (state) => {
      aggregationExceptionTelegramStates.push(state);
      return { state: 'sent', sent: true };
    },
    setExitCode: (code) => aggregationExceptionExitCodes.push(code),
    steps: pipelineSteps(
      () => ({ requiredHandleOk: true }),
      () => { aggregationExceptionCalls += 1; throw new Error('briefing indisponivel'); },
    ),
  });

  assert.equal(aggregationExceptionCalls, 1);
  assert.equal(aggregationException.instagramGatePassed, true);
  assert.equal(aggregationException.aggregationRan, true);
  assert.equal(aggregationException.artifactsUpdated, false);
  assert.ok(aggregationException.failures.some((failure) => failure.includes('briefing indisponivel')));
  assert.deepEqual(aggregationExceptionExitCodes, [1]);
  assert.deepEqual(aggregationExceptionTelegramStates, [{ instagramGatePassed: true, artifactsUpdated: false }]);

  const blockedMessage = await captureTelegramMessage(telegram, {
    instagramGatePassed: false,
    artifactsUpdated: false,
    summaryLines: ['IG: 0 conta(s) com snapshot valido'],
    failureLines: ['IG @acme.eng nao produziu snapshot atualizado'],
  });
  assert.ok(blockedMessage.includes('Nao use os arquivos anteriores de cockpit ou briefing.'));
  assert.ok(!blockedMessage.includes('content/{cliente}/cockpit.md'));
  assert.ok(!blockedMessage.includes('content/{cliente}/briefing-semanal.md'));
  assert.ok(!blockedMessage.includes('diga "desenvolve pauta N"'));

  const successfulMessage = await captureTelegramMessage(telegram, {
    instagramGatePassed: true,
    artifactsUpdated: true,
    summaryLines: ['IG: 2 conta(s) com snapshot valido'],
    failureLines: [],
  });
  assert.ok(successfulMessage.includes('Painel atualizado: content/{cliente}/cockpit.md'));
  assert.ok(successfulMessage.includes('Briefing atualizado: content/{cliente}/briefing-semanal.md'));
  assert.ok(successfulMessage.includes('diga "desenvolve pauta N"'));

  const aggregationFailureMessage = await captureTelegramMessage(telegram, {
    instagramGatePassed: true,
    artifactsUpdated: false,
    summaryLines: ['IG: 2 conta(s) com snapshot valido', 'Agregacao: FALHOU'],
    failureLines: ['Agregacao: artefatos nao foram atualizados'],
  });
  assert.ok(aggregationFailureMessage.includes('Nao use os arquivos anteriores de cockpit ou briefing.'));
  assert.ok(!aggregationFailureMessage.includes('content/{cliente}/cockpit.md'));
  assert.ok(!aggregationFailureMessage.includes('content/{cliente}/briefing-semanal.md'));
  assert.ok(!aggregationFailureMessage.includes('diga "desenvolve pauta N"'));

  await testTelegramDelivery(telegram, runPipeline);
  await testProcessExitCodeReset(runPipeline);
}

testAggregationGate()
  .then(() => console.log('social-intel-status: OK'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
