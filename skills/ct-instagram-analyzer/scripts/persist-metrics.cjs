#!/usr/bin/env node
/**
 * persist-metrics.cjs - Persiste métricas Instagram no Supabase via pg direto.
 *
 * Uso:
 *   node skills/ct-instagram-analyzer/scripts/persist-metrics.cjs [--date YYYY-MM-DD]
 *
 * Por que existe:
 *   O metrics-writer embutido no analyze.js falha com PGRST205 (schema cache stale
 *   do PostgREST). Este script é o workaround verificado: conecta direto no PostgreSQL
 *   via DATABASE_URL/POSTGRES_URL, faz DELETE idempotente do snapshot_date e reinsere.
 *
 * Pré-requisitos:
 *   - node_modules/pg disponível (rodar da raiz do repo)
 *   - .env com DATABASE_URL ou POSTGRES_URL
 *   - JSONs do analyzer em output/instagram-analyzer/{handle}-{date}.json
 *
 * Padrão followers:
 *   O JSON do analyzer NÃO contém followers. Este script busca followers_count
 *   direto da Graph API para cada conta e grava em todos os rows do snapshot.
 */

const fs = require('fs');
const path = require('path');

// ─── Env loader ──────────────────────────────────────────────────────────────
const ENV_PATHS = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../.env.local'),
];
for (const p of ENV_PATHS) {
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (!m) return;
    const key = m[1].trim();
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  });
}

const { Client } = require('pg');

// ─── Config ──────────────────────────────────────────────────────────────────
// Contas da marca ativa (.workspace ou CT_CLIENT): 'principal' (INSTAGRAM_*) e 'business'
// (INSTAGRAM_BUSINESS_*). Vem de skills/_shared/ig-accounts.cjs. Conta sem handle e ignorada,
// porque o JSON do analyzer e nomeado pelo handle.
const { CLIENT_ACCOUNTS } = require('../../_shared/ig-accounts.cjs');
const ACCOUNTS = Object.entries(CLIENT_ACCOUNTS)
  .filter(([, a]) => a.handle)
  .map(([key, a]) => ({
    handle: a.handle,
    clientSlug: a.clientSlug,
    jsonFile: handle => `output/instagram-analyzer/${handle}-{DATE}.json`,
    // principal: IGAA token, graph.instagram.com /me. business: EAAN system user, graph.facebook.com /{user-id}
    isIgAccount: key === 'principal',
    creds: a.creds,
  }));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resolveCreds(account) {
  return {
    ...account.creds(),
    base: account.isIgAccount ? 'https://graph.instagram.com' : 'https://graph.facebook.com',
  };
}

async function fetchFollowers(account) {
  const creds = resolveCreds(account);
  if (!creds.token) return 0;
  const url = account.isIgAccount
    ? `${creds.base}/me?fields=followers_count&access_token=${creds.token}`
    : `${creds.base}/${creds.userId}?fields=followers_count&access_token=${creds.token}`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    return j.followers_count || 0;
  } catch {
    return 0;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function persistAccount(pg, account, snapshotDate) {
  const jsonPath = path.resolve(
    __dirname, '..', '..', '..',
    account.jsonFile(account.handle).replace('{DATE}', snapshotDate)
  );
  if (!fs.existsSync(jsonPath)) {
    console.warn(`[skip] ${account.handle}: JSON não encontrado em ${jsonPath}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const media = data.media || data.posts || [];
  const followers = await fetchFollowers(account);

  // Idempotent delete
  await pg.query(
    `DELETE FROM ct_metrics_snapshots
     WHERE snapshot_date = $1 AND platform = 'instagram' AND account_handle = $2`,
    [snapshotDate, account.handle]
  );

  // Per-post rows
  for (const post of media) {
    const ins = post.insights || {};
    const reach = ins.reach || 0;
    const likes = post.like_count || 0;
    const comments = post.comments_count || 0;
    const er = reach > 0
      ? parseFloat(((likes + comments) / reach * 100).toFixed(2))
      : 0;

    await pg.query(`
      INSERT INTO ct_metrics_snapshots
        (client_slug, platform, account_handle, grain, post_id, post_url, post_type,
         published_at, snapshot_date, followers, reach, impressions, likes, comments,
         shares, saves, views, engagement_rate, metrics, source, created_at)
      VALUES ($1,'instagram',$2,'post',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'graph_api',NOW())
      ON CONFLICT (platform, post_id, snapshot_date) DO UPDATE SET
        reach=EXCLUDED.reach, impressions=EXCLUDED.impressions,
        likes=EXCLUDED.likes, comments=EXCLUDED.comments,
        shares=EXCLUDED.shares, saves=EXCLUDED.saves,
        views=EXCLUDED.views, engagement_rate=EXCLUDED.engagement_rate,
        metrics=EXCLUDED.metrics
    `, [
      account.clientSlug, account.handle, post.id, post.permalink, post.media_type,
      post.timestamp, snapshotDate, followers,
      reach, ins.impressions || 0, likes, comments,
      ins.shares || 0, ins.saved || 0, ins.plays || 0,
      er, JSON.stringify(post),
    ]);
  }

  // Account-level summary
  const totals = media.reduce((acc, p) => {
    const i = p.insights || {};
    acc.reach += i.reach || 0;
    acc.impressions += i.impressions || 0;
    acc.likes += p.like_count || 0;
    acc.comments += p.comments_count || 0;
    acc.shares += i.shares || 0;
    acc.saves += i.saved || 0;
    acc.views += i.plays || 0;
    return acc;
  }, { reach:0, impressions:0, likes:0, comments:0, shares:0, saves:0, views:0 });

  const accountER = totals.reach > 0
    ? parseFloat(((totals.likes + totals.comments) / totals.reach * 100).toFixed(2))
    : 0;
  const accountPostId = `ACCOUNT-${account.handle}-${snapshotDate}`;
  const reels = media.filter(m => m.media_type === 'VIDEO').length;
  const carousels = media.filter(m => m.media_type === 'CAROUSEL_ALBUM').length;
  const images = media.filter(m => m.media_type === 'IMAGE').length;

  await pg.query(`
    INSERT INTO ct_metrics_snapshots
      (client_slug, platform, account_handle, grain, post_id, snapshot_date,
       followers, reach, impressions, likes, comments, shares, saves, views,
       engagement_rate, metrics, source, created_at)
    VALUES ($1,'instagram',$2,'account',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'graph_api',NOW())
  `, [
    account.clientSlug, account.handle, accountPostId, snapshotDate, followers,
    totals.reach, totals.impressions, totals.likes, totals.comments,
    totals.shares, totals.saves, totals.views, accountER,
    JSON.stringify({ posts_count: media.length, reels, carousels, images }),
  ]);

  return { posts: media.length, followers, totals };
}

async function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');
  const snapshotDate = dateIdx > -1
    ? args[dateIdx + 1]
    : new Date().toISOString().slice(0, 10);

  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error('[erro] DATABASE_URL/POSTGRES_URL não encontrado no .env');
    process.exit(1);
  }

  const pg = new Client({ connectionString: connStr });
  await pg.connect();

  if (!ACCOUNTS.length) {
    console.error('[erro] nenhuma conta com handle. Defina IG_HANDLE (e INSTAGRAM_BUSINESS_HANDLE, se houver) no .env.local e o cliente ativo em .workspace.');
    await pg.end();
    process.exit(1);
  }
  const results = {};
  for (const account of ACCOUNTS) {
    const r = await persistAccount(pg, account, snapshotDate);
    if (r) results[account.handle] = r;
  }

  await pg.end();
  console.log(JSON.stringify({ snapshotDate, results }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
