/**
 * metrics-writer.cjs - Writer compartilhado de metricas proprias.
 *
 * Grava snapshots em ct_metrics_snapshots (Supabase) via REST API + fetch nativo.
 * Sem dependencia de @supabase/supabase-js (analyzers sao CommonJS sem node_modules).
 *
 * Substitui o historico que o Metricool cobraria: cada vez que um analyzer roda,
 * persiste as metricas por post + conta, datadas. Alimenta best-time + cockpit.
 *
 * Uso:
 *   const { writeMetrics } = require('../_shared/metrics-writer.cjs');
 *   await writeMetrics({
 *     client_slug: 'acme',
 *     platform: 'instagram',
 *     account_handle: 'acme',
 *     source: 'ct-instagram-analyzer',
 *     account: { followers: 1752, ...metricas },   // opcional (grao 'account')
 *     posts: [ { post_id, post_url, post_type, published_at,
 *                reach, impressions, likes, comments, shares, saves, views,
 *                metrics: { ...catalogo completo } } ]
 *   });
 *
 * Idempotente: regravar no mesmo dia faz UPSERT (merge-duplicates) nos indices
 * unicos uq_ct_metrics_post_day e uq_ct_metrics_account_day.
 */

const TABLE = 'ct_metrics_snapshots';

function loadEnv() {
  // Carrega .env / .env.local se as vars nao estiverem no ambiente (analyzers rodam soltos).
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const fs = require('fs');
  const path = require('path');
  // sobe ate achar a raiz do repo (.env)
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    for (const f of ['.env.local', '.env']) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) {
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
          if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
          }
        }
      }
    }
    dir = path.dirname(dir);
  }
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function engagementRate(p) {
  if (p.engagement_rate != null) return Number(p.engagement_rate);
  const interactions =
    (num(p.likes) || 0) + (num(p.comments) || 0) +
    (num(p.shares) || 0) + (num(p.saves) || 0);
  const base = num(p.reach) || num(p.impressions) || num(p.views);
  if (!base) return null;
  return Number(((interactions / base) * 100).toFixed(2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function upsert(rows, onConflict) {
  if (!rows.length) return { count: 0 };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[metrics-writer] SUPABASE_URL/SERVICE_ROLE_KEY ausentes - snapshot ignorado');
    return { count: 0, skipped: true };
  }
  const endpoint = `${url}/rest/v1/${TABLE}?on_conflict=${onConflict}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[metrics-writer] upsert falhou ${res.status}: ${txt}`);
  }
  return { count: rows.length };
}

/**
 * Grava metricas de conta e/ou posts.
 * @returns {Promise<{posts:number, account:number}>}
 */
async function writeMetrics({
  client_slug,
  platform,
  account_handle = null,
  source = null,
  account = null,
  posts = [],
  snapshot_date = today(),
}) {
  if (!client_slug || !platform) {
    throw new Error('[metrics-writer] client_slug e platform sao obrigatorios');
  }
  loadEnv();

  const postRows = (posts || []).map((p) => ({
    client_slug,
    platform,
    account_handle,
    grain: 'post',
    post_id: p.post_id != null ? String(p.post_id) : null,
    post_url: p.post_url || null,
    post_type: p.post_type || null,
    published_at: p.published_at || null,
    snapshot_date,
    reach: num(p.reach),
    impressions: num(p.impressions),
    likes: num(p.likes),
    comments: num(p.comments),
    shares: num(p.shares),
    saves: num(p.saves),
    views: num(p.views),
    engagement_rate: engagementRate(p),
    metrics: p.metrics || {},
    source,
  })).filter((r) => r.post_id); // posts sem id nao entram (unique exige post_id)

  let accountRow = null;
  if (account) {
    accountRow = {
      client_slug,
      platform,
      account_handle,
      grain: 'account',
      // post_id sintetico: 1 linha de conta por (cliente, rede, handle, dia)
      post_id: `__acct__:${client_slug}:${account_handle || platform}`,
      snapshot_date,
      followers: num(account.followers),
      reach: num(account.reach),
      impressions: num(account.impressions),
      likes: num(account.likes),
      comments: num(account.comments),
      shares: num(account.shares),
      saves: num(account.saves),
      views: num(account.views),
      engagement_rate: account.engagement_rate != null ? Number(account.engagement_rate) : null,
      metrics: account.metrics || account || {},
      source,
    };
  }

  const out = { posts: 0, account: 0 };
  if (postRows.length) {
    const r = await upsert(postRows, 'platform,post_id,snapshot_date');
    out.posts = r.count;
  }
  if (accountRow) {
    const r = await upsert([accountRow], 'platform,post_id,snapshot_date');
    out.account = r.count;
  }
  return out;
}

module.exports = { writeMetrics, loadEnv };
