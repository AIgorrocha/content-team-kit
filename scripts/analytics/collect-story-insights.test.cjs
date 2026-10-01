const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function logger() {
  return {
    log() {},
    error() {},
    table() {},
  };
}

function processTrap() {
  let exitCalls = 0;
  return {
    processObj: {
      exitCode: undefined,
      exit() {
        exitCalls += 1;
      },
    },
    exitCalls: () => exitCalls,
  };
}

function account(overrides = {}) {
  return {
    key: 'principal',
    client_slug: 'acme',
    handle: 'acme.co',
    token: 'test-token',
    userId: 'test-user',
    ...overrides,
  };
}

function response(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

function story(id) {
  return {
    id,
    media_type: 'IMAGE',
    permalink: `https://example.test/${id}`,
    timestamp: '2026-08-20T12:00:00.000Z',
    caption: `Story ${id}`,
  };
}

function validInsights({ reach = 100, views = 120, replies = 2 } = {}) {
  return response({
    data: [
      { name: 'reach', total_value: { value: reach } },
      { name: 'views', total_value: { value: views } },
      { name: 'replies', total_value: { value: replies } },
    ],
  });
}

function http500() {
  return response({ error: { message: 'falha temporaria do servidor' } }, { ok: false, status: 500 });
}

function invalidJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('JSON invalido'); },
  };
}

function rejectedMetricsResponse() {
  return response({
    error: {
      message: 'metricas invalidas: reach views impressions replies total_interactions navigation taps_forward taps_back exits profile_visits follows shares',
    },
  }, { ok: false, status: 400 });
}

function graphPage(path) {
  return `https://graph.instagram.com/${path}`;
}

async function execute(main, run, options = {}) {
  const trap = processTrap();
  const report = await main({
    processObj: trap.processObj,
    logger: logger(),
    runFn: () => run({
      argv: ['node', 'collect-story-insights.mjs', '--account', 'principal', ...(options.dryRun ? ['--dry-run'] : [])],
      accounts: [account(options.account)],
      loadEnvironment: () => {},
      fetch: options.fetch,
      writeMetrics: options.writeMetrics,
      logger: logger(),
    }),
  });
  return { ...trap, report };
}

(async () => {
  const originalArgv = process.argv;
  let collector;
  try {
    process.argv = ['node', 'collect-story-insights.test.cjs', '--account', '__test__'];
    collector = await import(pathToFileURL(path.join(__dirname, 'collect-story-insights.mjs')).href);
  } finally {
    process.argv = originalArgv;
  }

  const { run, main } = collector;

  assert.equal(typeof run, 'function');
  assert.equal(typeof main, 'function');

  {
    // Uma unica pagina explicita vazia e o unico caso de zero Stories bem-sucedido.
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        return response({ data: [] });
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.deepEqual(result.report, [{
      handle: 'acme.co',
      status: 'ok',
      stories: 0,
      sucesso: 0,
      falhas: 0,
      gravadas: 0,
    }]);
    assert.equal(fetchCalls, 1);
    assert.equal(result.processObj.exitCode, 0);
    assert.equal(result.exitCalls(), 0);
  }

  // A lista agrega todas as paginas antes de buscar insights ou gravar.
  {
    const next = graphPage('stories-page-2');
    let fetchCalls = 0;
    const requestedUrls = [];
    const persisted = [];
    const result = await execute(main, run, {
      fetch: async (url) => {
        fetchCalls += 1;
        requestedUrls.push(url);
        if (fetchCalls === 1) return response({ data: [story('story-page-1')], paging: { next } });
        if (fetchCalls === 2) return response({ data: [story('story-page-2')], paging: {} });
        return validInsights();
      },
      writeMetrics: async ({ posts }) => {
        persisted.push(...posts.map((post) => post.post_id));
        return { posts: posts.length };
      },
    });

    assert.equal(requestedUrls[1], next);
    assert.equal(result.report[0].status, 'ok');
    assert.equal(result.report[0].stories, 2);
    assert.equal(result.report[0].sucesso, 2);
    assert.equal(result.report[0].falhas, 0);
    assert.equal(result.report[0].gravadas, 2);
    assert.deepEqual(persisted, ['story-page-1', 'story-page-2']);
    assert.equal(result.processObj.exitCode, 0);
  }

  // Falha na segunda pagina impede que uma lista parcial vire coleta parcial.
  {
    const next = graphPage('stories-page-500');
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [], paging: { next } });
        return http500();
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].stories, undefined);
    assert.equal(result.processObj.exitCode, 1);
  }

  // Toda pagina deve ter data array e paging bem formado antes da coleta de insights.
  {
    const next = graphPage('stories-page-malformed-data');
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [], paging: { next } });
        return response({});
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.processObj.exitCode, 1);
  }

  for (const listPayload of [
    response({ data: [], paging: null }),
    response({ data: [], paging: [] }),
    response({ data: [], paging: { next: null } }),
    response({ data: [], paging: { next: 7 } }),
    response({ data: [], paging: { next: 'not-a-valid-url' } }),
  ]) {
    const result = await execute(main, run, {
      fetch: async () => listPayload,
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.processObj.exitCode, 1);
  }

  // Uma proxima pagina que repete uma pagina anterior falha antes de um loop sem fim.
  {
    let firstUrl = null;
    const result = await execute(main, run, {
      fetch: async (url) => {
        firstUrl ||= url;
        return response({ data: [], paging: { next: firstUrl } });
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.processObj.exitCode, 1);
  }

  // A paginação tem teto, mesmo quando cada URL seguinte parece valida.
  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        return response({ data: [], paging: { next: graphPage(`stories-page-limit-${fetchCalls}`) } });
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(fetchCalls, 25);
  }

  // A primeira ocorrencia de uma Story vence, e o ID duplicado nao dobra contagens ou persistencia.
  {
    const next = graphPage('stories-page-duplicate');
    let fetchCalls = 0;
    const persisted = [];
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-duplicate')], paging: { next } });
        if (fetchCalls === 2) return response({ data: [story('story-duplicate'), story('story-unique')], paging: {} });
        return validInsights();
      },
      writeMetrics: async ({ posts }) => {
        persisted.push(...posts.map((post) => post.post_id));
        return { posts: posts.length };
      },
    });

    assert.equal(result.report[0].status, 'ok');
    assert.equal(result.report[0].stories, 2);
    assert.equal(result.report[0].sucesso, 2);
    assert.equal(result.report[0].falhas, 0);
    assert.equal(result.report[0].gravadas, 2);
    assert.deepEqual(persisted, ['story-duplicate', 'story-unique']);
    assert.equal(result.processObj.exitCode, 0);
  }

  // HTTP 200 sem uma lista explicita de Stories e falha da conta, nao lista vazia.
  for (const listPayload of [response({}), response({ data: null }), invalidJsonResponse()]) {
    const result = await execute(main, run, {
      fetch: async () => listPayload,
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(result.exitCalls(), 0);
  }

  {
    const result = await execute(main, run, {
      account: { token: null, userId: null },
      fetch: async () => { throw new Error('fetch nao deveria ser chamado'); },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.deepEqual(result.report, [{ handle: 'acme.co', status: 'sem-credencial' }]);
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(result.exitCalls(), 0);
  }

  {
    const trap = processTrap();
    const errors = [];
    await main({
      processObj: trap.processObj,
      logger: { ...logger(), error: (...args) => errors.push(args) },
      runFn: async () => { throw new Error('falha fatal simulada'); },
    });

    assert.equal(errors.length, 1);
    assert.equal(trap.processObj.exitCode, 1);
    assert.equal(trap.exitCalls(), 0);
  }

  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-500')] });
        return http500();
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].stories, 1);
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(result.exitCalls(), 0);
  }

  {
    let fetchCalls = 0;
    const persisted = [];
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-ok'), story('story-500')] });
        if (fetchCalls === 2) return validInsights();
        return http500();
      },
      writeMetrics: async ({ posts }) => {
        persisted.push(...posts.map((post) => post.post_id));
        return { posts: posts.length };
      },
    });

    assert.equal(result.report[0].status, 'parcial');
    assert.equal(result.report[0].stories, 2);
    assert.equal(result.report[0].sucesso, 1);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 1);
    assert.deepEqual(persisted, ['story-ok']);
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(result.exitCalls(), 0);
  }

  {
    let fetchCalls = 0;
    const persisted = [];
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-a'), story('story-b')] });
        return validInsights();
      },
      writeMetrics: async ({ posts }) => {
        persisted.push(...posts.map((post) => post.post_id));
        return { posts: posts.length };
      },
    });

    assert.equal(result.report[0].status, 'ok');
    assert.equal(result.report[0].stories, 2);
    assert.equal(result.report[0].sucesso, 2);
    assert.equal(result.report[0].falhas, 0);
    assert.equal(result.report[0].gravadas, 2);
    assert.deepEqual(persisted, ['story-a', 'story-b']);
    assert.equal(result.processObj.exitCode, 0);
    assert.equal(result.exitCalls(), 0);
  }

  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-sem-insight')] });
        return response({ data: [] });
      },
      writeMetrics: async () => { throw new Error('writeMetrics nao deveria ser chamado'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(result.processObj.exitCode, 1);
  }

  // Valores que nao sao metricas numericas finitas e nao negativas nao validam uma Story.
  for (const [name, value] of [
    ['reach', '100'],
    ['reach', Number.NaN],
    ['reach', Infinity],
    ['reach', -1],
    ['metrica_desconhecida', 1],
  ]) {
    let fetchCalls = 0;
    let writeCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story(`story-metrica-${name}`)] });
        return response({ data: [{ name, total_value: { value } }] });
      },
      writeMetrics: async () => { writeCalls += 1; return { posts: 1 }; },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(writeCalls, 0);
    assert.equal(result.processObj.exitCode, 1);
  }

  // Se todas as metricas candidatas forem recusadas, nao existe insight utilizavel.
  {
    let fetchCalls = 0;
    let writeCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-sem-metricas-aceitas')] });
        return rejectedMetricsResponse();
      },
      writeMetrics: async () => { writeCalls += 1; return { posts: 1 }; },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(writeCalls, 0);
    assert.equal(result.processObj.exitCode, 1);
  }

  {
    let fetchCalls = 0;
    let writeCalls = 0;
    const result = await execute(main, run, {
      dryRun: true,
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-dry-ok'), story('story-dry-500')] });
        if (fetchCalls === 2) return validInsights();
        return http500();
      },
      writeMetrics: async () => { writeCalls += 1; },
    });

    assert.equal(result.report[0].status, 'parcial');
    assert.equal(result.report[0].sucesso, 1);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(writeCalls, 0);
    assert.equal(result.processObj.exitCode, 1);
  }

  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-write-fail')] });
        return validInsights();
      },
      writeMetrics: async () => ({ posts: 0, skipped: true }),
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].stories, 1);
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(result.processObj.exitCode, 1);
    assert.equal(result.exitCalls(), 0);
  }

  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-write-throw')] });
        return validInsights();
      },
      writeMetrics: async () => { throw new Error('persistencia indisponivel'); },
    });

    assert.equal(result.report[0].status, 'erro');
    assert.equal(result.report[0].sucesso, 0);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 0);
    assert.equal(result.processObj.exitCode, 1);
  }

  // O writer confirma quantas linhas persistiu. Persistencia parcial preserva a contagem confirmada.
  {
    let fetchCalls = 0;
    const result = await execute(main, run, {
      fetch: async () => {
        fetchCalls += 1;
        if (fetchCalls === 1) return response({ data: [story('story-write-partial-a'), story('story-write-partial-b')] });
        return validInsights();
      },
      writeMetrics: async () => ({ posts: 1 }),
    });

    assert.equal(result.report[0].status, 'parcial');
    assert.equal(result.report[0].stories, 2);
    assert.equal(result.report[0].sucesso, 1);
    assert.equal(result.report[0].falhas, 1);
    assert.equal(result.report[0].gravadas, 1);
    assert.equal(result.processObj.exitCode, 1);
  }

  console.log('collect-story-insights: OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
