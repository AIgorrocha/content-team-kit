// Teste do snapshot de concorrentes com rede falsa: nao chama RapidAPI nem Supabase de verdade.
// Uso: node skills/ct-social-cockpit/competitor-snapshot.test.cjs
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'http://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.RAPIDAPI_KEY = 'test-only';

const json = (status, body = []) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; },
  async text() { return JSON.stringify(body); },
});

const node = (shortcode, likes, comments) => ({
  node: { shortcode, edge_media_preview_like: { count: likes }, edge_media_to_comment: { count: comments } },
});
const profile = {
  full_name: 'Perfil de teste',
  biography: 'bio',
  edge_followed_by: { count: 100 },
  edge_owner_to_timeline_media: { edges: [node('baixo', 1, 1), node('alto', 50, 10), node('medio', 10, 5)] },
};

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;
const calls = [];
global.setTimeout = (callback) => { queueMicrotask(callback); return 0; }; // sem esperar o intervalo entre perfis
global.fetch = async (url, options = {}) => {
  const address = String(url);
  const method = options.method || 'GET';
  if (address.includes('instagram-looter2.p.rapidapi.com')) return json(200, profile);
  calls.push({ method, path: address.replace('http://supabase.test/rest/v1/', ''), body: options.body ? JSON.parse(options.body) : null });
  if (method === 'GET') return json(200, []);
  if (method === 'POST' && address.includes('/ct_competitors')) return json(201, [{ id: 'cid-1' }]);
  return json(201, []);
};

const { snapshotClient } = require('./competitor-snapshot.js');

(async () => {
  try {
    const total = await snapshotClient('acme', 2, ['concorrente_a']);
    assert.equal(total, 2, 'grava so os 2 melhores (limit)');

    const deleteIndex = calls.findIndex((c) => c.method === 'DELETE');
    const insertIndex = calls.findIndex((c) => c.method === 'POST' && c.path.startsWith('ct_competitor_posts'));
    assert.ok(deleteIndex >= 0 && insertIndex > deleteIndex, 'apaga o snapshot antigo do concorrente antes de gravar o novo');
    assert.match(calls[deleteIndex].path, /competitor_id=eq\.cid-1&external_id=like\.snap:\*/);

    const rows = calls[insertIndex].body;
    assert.deepEqual(rows.map((r) => r.external_id), ['snap:alto', 'snap:medio'], 'ordem por score (curtidas + comentarios)');
    assert.equal(rows[0].engagement.score, 60);
    assert.equal(rows[0].competitor_id, 'cid-1');

    const competitorWrite = calls.find((c) => c.method === 'POST' && c.path === 'ct_competitors');
    assert.equal(competitorWrite.body.handle, 'concorrente_a');
    assert.deepEqual(competitorWrite.body.metadata, { client_slug: 'acme' }, 'concorrente fica ligado a marca');

    assert.equal(await snapshotClient('acme', 2, []), 0, 'sem concorrentes nao grava nada');
    console.log('competitor-snapshot: OK');
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
