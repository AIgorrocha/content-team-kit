#!/usr/bin/env node
/**
 * competitor-snapshot.js - Snapshot de concorrentes (igual get_network_competitors do Metricool).
 *
 * Le @handles de clients/{slug}/competitors.md, busca perfil + ultimos posts via RapidAPI
 * instagram-looter2, faz UPSERT em ct_competitors e grava posts em ct_competitor_posts
 * (ligados por competitor_id). Alimenta a secao "Concorrentes bombando" do cockpit.
 *
 * Schema real:
 *   ct_competitors: id, handle, platform, display_name, niche, followers_count, profile_url,
 *                   metadata(jsonb: {client_slug}), last_scraped_at, is_active
 *   ct_competitor_posts: competitor_id(FK), platform, platform_post_id, external_id, post_type,
 *                        caption, content_preview, engagement(jsonb), posted_at, scraped_at, is_viral
 *
 * Uso: node skills/ct-social-cockpit/competitor-snapshot.js [--client all|{slug-do-cliente}] [--limit 5]
 * Requer RAPIDAPI_KEY.
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../_shared/metrics-writer.cjs');

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
const HOST = 'instagram-looter2.p.rapidapi.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const a = { client: 'all', limit: 5 };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) {
    if (r[i] === '--client') a.client = r[++i];
    else if (r[i] === '--limit') a.limit = parseInt(r[++i], 10);
  }
  return a;
}

function readHandles(client) {
  const p = path.join(__dirname, '../../clients', client, 'competitors.md');
  if (!fs.existsSync(p)) return [];
  const set = new Set();
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/@([A-Za-z0-9._]+)/g)) set.add(m[1].toLowerCase());
  return [...set];
}

function sb(method, pathQ, body, extraHeaders) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(`${url}/rest/v1/${pathQ}`, {
    method,
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      ...(extraHeaders || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function upsertCompetitor(handle, platform, fields, client) {
  // procura existente
  const got = await sb('GET', `ct_competitors?handle=eq.${encodeURIComponent(handle)}&platform=eq.${platform}&select=id,metadata`);
  const rows = await got.json();
  const meta = { ...(rows[0]?.metadata || {}), client_slug: client };
  if (rows.length) {
    await sb('PATCH', `ct_competitors?id=eq.${rows[0].id}`,
      { ...fields, metadata: meta, last_scraped_at: new Date().toISOString() },
      { Prefer: 'return=minimal' });
    return rows[0].id;
  }
  const ins = await sb('POST', 'ct_competitors',
    { handle, platform, is_active: true, ...fields, metadata: meta, last_scraped_at: new Date().toISOString() },
    { Prefer: 'return=representation' });
  if (!ins.ok) throw new Error(`ct_competitors insert ${ins.status}: ${(await ins.text()).slice(0, 160)}`);
  return (await ins.json())[0].id;
}

async function fetchProfile(username) {
  const res = await fetch(`https://${HOST}/profile?username=${encodeURIComponent(username)}`, {
    headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': process.env.RAPIDAPI_KEY },
  });
  if (!res.ok) throw new Error(`looter ${res.status}`);
  return res.json();
}

async function snapshotClient(client, limit, handles = readHandles(client)) {
  if (!handles.length) { console.log(`[${client}] sem competitors.md`); return 0; }
  console.log(`[${client}] ${handles.length} concorrentes...`);
  let total = 0;

  for (const h of handles) {
    try {
      const p = await fetchProfile(h);
      const followers = p?.edge_followed_by?.count || 0;
      const edges = p?.edge_owner_to_timeline_media?.edges || [];
      const posts = edges.map((e) => {
        const n = e.node || {};
        const likes = n.edge_media_preview_like?.count || 0;
        const comments = n.edge_media_to_comment?.count || 0;
        return {
          shortcode: n.shortcode,
          likes, comments, score: likes + comments,
          caption: n.edge_media_to_caption?.edges?.[0]?.node?.text || '',
          type: n.__typename === 'GraphVideo' ? 'reel' : n.__typename === 'GraphSidecar' ? 'carousel' : 'image',
          posted_at: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
        };
      }).filter((x) => x.shortcode).sort((a, b) => b.score - a.score).slice(0, limit);

      const cid = await upsertCompetitor(h, 'instagram', {
        display_name: p?.full_name || h, followers_count: followers,
        profile_url: `https://www.instagram.com/${h}/`, bio: (p?.biography || '').slice(0, 500),
      }, client);

      // refresh: remove snapshots antigos desse concorrente
      await sb('DELETE', `ct_competitor_posts?competitor_id=eq.${cid}&external_id=like.snap:*`, null, { Prefer: 'return=minimal' });

      const rows = posts.map((post) => ({
        competitor_id: cid,
        platform: 'instagram',
        platform_post_id: post.shortcode,
        external_id: `snap:${post.shortcode}`,
        post_type: post.type,
        caption: post.caption.slice(0, 2000),
        content_preview: post.caption.replace(/\n/g, ' ').slice(0, 180),
        engagement: { likes: post.likes, comments: post.comments, score: post.score, followers },
        posted_at: post.posted_at,
        scraped_at: new Date().toISOString(),
        is_viral: followers > 0 && post.score / followers > 0.1,
      }));
      if (rows.length) {
        const r = await sb('POST', 'ct_competitor_posts', rows, { Prefer: 'return=minimal' });
        if (!r.ok) throw new Error(`posts insert ${r.status}: ${(await r.text()).slice(0, 160)}`);
        total += rows.length;
      }
      console.log(`  @${h}: ${followers} seg, ${rows.length} posts (top ${posts[0]?.score ?? 0})`);
    } catch (e) {
      console.warn(`  @${h}: falha (${e.message})`);
    }
    await sleep(1200);
  }
  console.log(`[${client}] ${total} posts -> ct_competitor_posts`);
  return total;
}

async function run() {
  const args = parseArgs(process.argv);
  loadEnv();
  if (!process.env.RAPIDAPI_KEY) { console.error('RAPIDAPI_KEY ausente'); process.exit(1); }
  const targets = args.client === 'all' ? CLIENTS : [args.client];
  for (const c of targets) await snapshotClient(c, args.limit);
  console.log('OK. Rode ct-social-cockpit/build.js pra atualizar o painel.');
}

// So roda quando chamado direto (node competitor-snapshot.js), nao ao ser importado pelos testes.
if (require.main === module) {
  run().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
}

module.exports = { snapshotClient, readHandles };
