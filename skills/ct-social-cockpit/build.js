#!/usr/bin/env node
/**
 * build.js - Cockpit unificado por cliente. O painel que o ct-diretor le ANTES
 * de produzir/publicar. Consolida num so lugar:
 *   - resumo de metricas atuais por rede (do ct_metrics_snapshots)
 *   - best-time + formato campeao (do ct_social_insights)
 *   - top posts proprios recentes
 *   - concorrente bombando (do ct_competitor_posts)
 *
 * Uso: node skills/ct-social-cockpit/build.js [--client {slug-do-cliente}|all]
 *
 * Saida:
 *   - content/{cliente}/cockpit.md  (humano + agente le)
 *   - upsert em ct_social_insights (kind=cockpit, payload jsonb)  pra leitura via SQL
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../_shared/metrics-writer.cjs');
const { bestTimeLines } = require('../_shared/best-time-gate.cjs');
const { joinPieces, piecesLines } = require('./pieces.cjs');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

// Clientes disponiveis: scan de clients/*, generico (qualquer pasta com brand-profile.md).
function scanClients() {
  const dir = path.join(__dirname, '../../clients');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_template')
    .filter((d) => fs.existsSync(path.join(dir, d.name, 'brand-profile.md')))
    .map((d) => d.name);
}
const CLIENTS = scanClients();
const PLATFORMS = ['instagram', 'linkedin', 'youtube', 'tiktok'];

function parseArgs(argv) {
  const a = { client: 'all' };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) if (r[i] === '--client') a.client = r[++i];
  return a;
}

async function rest(pathQ) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes');
  const res = await fetch(`${url}/rest/v1/${pathQ}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function upsertCockpit(client_slug, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${url}/rest/v1/ct_social_insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      client_slug, platform: 'all', kind: 'cockpit',
      sample_size: payload.total_posts || 0, payload,
    }),
  });
}

async function latestTrends(client) {
  const q = `ct_social_insights?client_slug=eq.${client}&platform=eq.twitter&kind=eq.trends` +
    `&order=computed_at.desc&limit=1&select=payload,computed_at`;
  try { const r = await rest(q); return r[0]?.payload || null; } catch { return null; }
}

async function latestInsight(client, platform) {
  const q = `ct_social_insights?client_slug=eq.${client}&platform=eq.${platform}` +
    `&kind=eq.best_time&order=computed_at.desc&limit=1&select=payload,computed_at`;
  const rows = await rest(q);
  return rows[0] || null;
}

async function platformSummary(client, platform, { rest: get = rest } = {}) {
  // ultimos 30 dias, posts unicos (snapshot mais recente)
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const q = `ct_metrics_snapshots?client_slug=eq.${client}&platform=eq.${platform}&grain=eq.post` +
    `&snapshot_date=gte.${since}` +
    `&select=post_id,snapshot_date,post_url,post_type,published_at,likes,comments,shares,saves,reach,views,engagement_rate&limit=5000`;
  const rows = await get(q);
  const latest = {};
  for (const r of rows) {
    const c = latest[r.post_id];
    if (!c || r.snapshot_date > c.snapshot_date) latest[r.post_id] = r;
  }
  const posts = Object.values(latest);
  if (!posts.length) return null;

  const inter = (p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
  const top = [...posts].sort((a, b) => inter(b) - inter(a)).slice(0, 3);
  const totalInter = posts.reduce((s, p) => s + inter(p), 0);
  const rates = posts.filter((p) => p.engagement_rate != null).map((p) => Number(p.engagement_rate));
  const avgRate = rates.length ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)) : null;

  return {
    posts_30d: posts.length,
    total_interactions_30d: totalInter,
    avg_engagement_rate: avgRate,
    top_posts: top.map((p) => ({
      post_type: p.post_type, url: p.post_url, published_at: p.published_at,
      likes: p.likes, comments: p.comments, interactions: inter(p),
      engagement_rate: p.engagement_rate != null ? Number(p.engagement_rate) : null,
    })),
  };
}

async function topCompetitors(client, { rest: get = rest } = {}) {
  try {
    // concorrentes desse cliente (metadata.client_slug)
    const comps = await get(`ct_competitors?metadata->>client_slug=eq.${client}&select=id,handle,platform,followers_count`);
    if (!comps.length) return [];
    const byId = {};
    comps.forEach((c) => (byId[c.id] = c));
    const ids = comps.map((c) => c.id).join(',');
    const posts = await get(
      `ct_competitor_posts?competitor_id=in.(${ids})&external_id=like.snap:*` +
      `&select=competitor_id,platform,content_preview,caption,engagement,posted_at&limit=200`
    );
    return posts
      .map((p) => {
        const c = byId[p.competitor_id] || {};
        return {
          competitor_name: c.handle,
          platform: p.platform || c.platform,
          post_text: p.content_preview || p.caption || '',
          engagement_score: p.engagement?.score ?? 0,
          post_url: null,
          followers: c.followers_count,
        };
      })
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 5);
  } catch { return []; }
}

function buildMarkdown(client, data) {
  const L = [];
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  L.push(`# Cockpit: ${client}`);
  L.push(`> Atualizado: ${now} UTC · painel lido pelo ct-diretor antes de produzir/publicar`);
  L.push('');

  for (const platform of PLATFORMS) {
    const s = data.platforms[platform];
    const bt = data.best_time[platform];
    if (!s && !bt) continue;
    L.push(`## ${platform}`);
    if (s) {
      L.push(`- Posts (30d): ${s.posts_30d} · interacoes: ${s.total_interactions_30d}` +
        (s.avg_engagement_rate != null ? ` · engaj medio: ${s.avg_engagement_rate}%` : ''));
      if (s.top_posts.length) {
        L.push('- Top posts recentes:');
        s.top_posts.forEach((p, i) => {
          L.push(`  ${i + 1}. [${p.post_type}] ${(p.published_at || '').slice(0, 10)} - ` +
            `${p.interactions} interacoes${p.engagement_rate != null ? ` (${p.engagement_rate}%)` : ''} ${p.url || ''}`);
        });
      }
    }
    // Gate de amostra (n<20 nao e recomendacao): skills/_shared/best-time-gate.cjs
    if (bt && bt.payload) bestTimeLines(bt.payload).forEach((l) => L.push(l));
    L.push('');
  }

  // Desempenho das NOSSAS pecas (join publish_url x post_url). Ver pieces.cjs.
  if (data.pieces) piecesLines(data.pieces).forEach((l) => L.push(l));

  if (data.competitors && data.competitors.length) {
    L.push('## Concorrentes bombando');
    data.competitors.forEach((c) => {
      const txt = (c.post_text || '').replace(/\n/g, ' ').slice(0, 100);
      L.push(`- @${c.competitor_name} (${c.platform}) · score ${c.engagement_score ?? '?'} - "${txt}" ${c.post_url || ''}`);
    });
    L.push('');
  }

  if (data.trends) {
    const t = data.trends;
    L.push('## Tendencias / repos pra conteudo (Twitter research)');
    if (t.top_repos && t.top_repos.length) {
      L.push('- Repos GitHub em alta:');
      t.top_repos.slice(0, 6).forEach((r) => L.push(`  - ${r.repo} (${r.mentions}x · eng ${r.eng})`));
    }
    if (t.by_keyword && t.by_keyword.length) {
      L.push(`- Temas quentes: ${t.by_keyword.slice(0, 6).map((k) => `${k.keyword} (${k.n})`).join(' · ')}`);
    }
    if (t.top_tweets && t.top_tweets.length) {
      L.push('- Top tweets:');
      t.top_tweets.slice(0, 4).forEach((tw) => L.push(`  - ${tw.handle} (${tw.eng}) - "${tw.text}" ${tw.url || ''}`));
    }
    L.push('');
  }

  L.push('---');
  L.push('_Gerado por ct-social-cockpit. Fonte: ct_metrics_snapshots + ct_social_insights + ct_competitor_posts._');
  return L.join('\n');
}

async function buildClient(client) {
  const platforms = {};
  const best_time = {};
  let totalPosts = 0;
  for (const platform of PLATFORMS) {
    const s = await platformSummary(client, platform);
    if (s) { platforms[platform] = s; totalPosts += s.posts_30d; }
    const bt = await latestInsight(client, platform);
    if (bt) best_time[platform] = bt;
  }
  const competitors = await topCompetitors(client);
  // Twitter/tendencias so existe pra conta "principal" (ver trends-snapshot.js).
  const trends = client === CLIENT_ACCOUNTS.principal?.clientSlug ? await latestTrends(client) : null;
  const pieces = await joinPieces(rest, client);
  const data = { client, platforms, best_time, competitors, trends, pieces, total_posts: totalPosts };

  const md = buildMarkdown(client, data);
  const outDir = path.join(__dirname, '../../content', client);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'cockpit.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`[${client}] cockpit.md (${totalPosts} posts 30d, ${competitors.length} concorrentes) -> ${outPath}`);

  await upsertCockpit(client, data);
}

async function run() {
  const args = parseArgs(process.argv);
  loadEnv();
  const targets = args.client === 'all' ? CLIENTS : [args.client];
  for (const c of targets) await buildClient(c);
  console.log('OK -> cockpit.md + ct_social_insights(kind=cockpit)');
}

// So roda quando chamado direto (node build.js), nao ao ser importado pelos testes.
if (require.main === module) {
  run().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
}

module.exports = { platformSummary, topCompetitors, buildMarkdown };
