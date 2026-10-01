#!/usr/bin/env node
/**
 * Ingest research outputs (twitter/linkedin/tiktok/instagram/youtube) into
 * Supabase tables ct_research_runs + ct_research_posts.
 *
 * Idempotent: uses (platform, mode, client_slug, source_file) as run key,
 * and (run_id, platform, external_id) as post key.
 *
 * Usage: node scripts/ingest-research-to-supabase.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { CLIENT_ACCOUNTS } = require(path.join(__dirname, '..', 'skills', '_shared', 'ig-accounts.cjs'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars. Check .env.local');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const ROOT = path.join(__dirname, '..', 'output');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function arrValues(obj) {
  // Handle case where twitter outputs are saved as {0:{...},1:{...}} OR as arrays
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.every(k => /^\d+$/.test(k))) {
      return keys.map(k => obj[k]);
    }
  }
  return [];
}

// Infere client_slug a partir do handle bruto casando contra o handle configurado
// de cada conta em CLIENT_ACCOUNTS (skills/_shared/ig-accounts.cjs). Generico por
// design: casa qualquer conta cadastrada la, nao so as duas atuais.
function clientFromHandle(handle) {
  if (!handle) return null;
  const h = handle.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const acc of Object.values(CLIENT_ACCOUNTS)) {
    const needle = acc.handle.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (needle && h.includes(needle)) return acc.clientSlug;
  }
  return null;
}

async function upsertRun(run) {
  // Match existing by composite key
  const q = supa.from('ct_research_runs').select('id').eq('platform', run.platform).eq('mode', run.mode);
  if (run.client_slug) q.eq('client_slug', run.client_slug); else q.is('client_slug', null);
  if (run.source_file) q.eq('source_file', run.source_file); else q.is('source_file', null);
  const { data: existing } = await q.maybeSingle();
  if (existing?.id) {
    await supa.from('ct_research_runs').update({
      label: run.label,
      source_url: run.source_url,
      keywords: run.keywords || [],
      fetched_at: run.fetched_at,
      posts_count: run.posts_count,
      metadata: run.metadata || {},
    }).eq('id', existing.id);
    return existing.id;
  }
  const { data, error } = await supa.from('ct_research_runs').insert(run).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertPosts(runId, posts) {
  if (!posts.length) return 0;
  let inserted = 0;
  // Chunk in batches of 100
  for (let i = 0; i < posts.length; i += 100) {
    const chunk = posts.slice(i, i + 100).map(p => ({ ...p, run_id: runId }));
    const { error, count } = await supa
      .from('ct_research_posts')
      .upsert(chunk, { onConflict: 'run_id,platform,external_id', ignoreDuplicates: false, count: 'exact' });
    if (error) {
      // Fallback: insert one by one, skipping duplicates
      for (const row of chunk) {
        const { error: e2 } = await supa.from('ct_research_posts').insert(row);
        if (!e2) inserted++;
      }
    } else {
      inserted += count || chunk.length;
    }
  }
  return inserted;
}

// ---------- Mappers ----------
function mapTwitter(p) {
  const metrics = {
    likes: p.likes || 0,
    reposts: p.reposts || 0,
    replies: p.replies || 0,
    views: p.views || 0,
  };
  return {
    platform: 'twitter',
    external_id: p.tweet_id || p.url,
    author_name: p.author_name,
    author_handle: p.author_handle,
    url: p.url,
    text: p.text,
    media: p.media || [],
    metrics,
    tags: p.search_keyword ? [p.search_keyword] : [],
    external_links: p.external_links || [],
    raw: p,
    posted_at: p.created_at || null,
  };
}

function mapLinkedin(p) {
  const metrics = {
    reactions: p.reactions || 0,
    comments: p.comments || 0,
    reposts: p.reposts || 0,
  };
  return {
    platform: 'linkedin',
    external_id: p.urn || p.author_url,
    author_name: p.author_name,
    author_handle: p.author_url,
    url: p.author_url,
    text: p.text,
    media: p.media || [],
    metrics,
    tags: p.search_keyword ? [p.search_keyword] : [],
    external_links: [],
    raw: p,
    posted_at: null,
  };
}

function mapInstagram(p) {
  const ins = p.insights || {};
  const metrics = {
    likes: p.like_count || 0,
    comments: p.comments_count || 0,
    views: ins.reach || ins.impressions || 0,
    reach: ins.reach || 0,
    saves: ins.saved || 0,
    shares: ins.shares || 0,
    plays: ins.plays || 0,
  };
  return {
    platform: 'instagram',
    external_id: p.id,
    author_name: null,
    author_handle: null,
    url: p.permalink,
    text: p.caption || '',
    media: p.media_url ? [{ url: p.media_url, type: p.media_type, thumbnail: p.thumbnail_url }] : [],
    metrics,
    tags: [],
    external_links: [],
    raw: p,
    posted_at: p.timestamp || null,
  };
}

function mapTiktok(p) {
  const metrics = {
    views: p.views || 0,
    likes: p.likes || 0,
    comments: p.comments || 0,
    shares: p.shares || 0,
  };
  return {
    platform: 'tiktok',
    external_id: p.video_id || p.href,
    author_name: null,
    author_handle: null,
    url: p.href,
    text: p.caption || '',
    media: [],
    metrics,
    tags: p.hashtags || [],
    external_links: [],
    raw: p,
    posted_at: p.created_at || null,
  };
}

function mapYoutube(p) {
  const metrics = {
    views: Number(p.viewCount) || 0,
    likes: Number(p.likeCount) || 0,
    comments: Number(p.commentCount) || 0,
  };
  return {
    platform: 'youtube',
    external_id: p.videoId,
    author_name: null,
    author_handle: null,
    url: `https://www.youtube.com/watch?v=${p.videoId}`,
    text: [p.title, p.description].filter(Boolean).join('\n\n'),
    media: p.thumbnails ? [{ thumbnails: p.thumbnails, duration: p.duration }] : [],
    metrics,
    tags: p.tags || [],
    external_links: [],
    raw: p,
    posted_at: p.publishedAt || null,
  };
}

// ---------- Per-source ingest ----------
async function ingestFile(file, cfg) {
  const raw = readJson(file);
  const items = cfg.extract(raw);
  const run = {
    platform: cfg.platform,
    mode: cfg.mode,
    client_slug: cfg.client_slug || null,
    label: cfg.label || null,
    source_url: raw.url || null,
    keywords: cfg.keywords || [],
    source_file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'),
    fetched_at: raw.fetched_at || null,
    posts_count: items.length,
    metadata: cfg.metadata || {},
  };
  const runId = await upsertRun(run);
  const mapped = items.map(cfg.mapper).filter(p => p.external_id);
  const inserted = await upsertPosts(runId, mapped);
  console.log(`  [${cfg.platform}/${cfg.mode}] ${path.basename(file)} run=${runId.slice(0,8)} posts=${items.length} upserted=${inserted}`);
  return { runId, items: items.length, inserted };
}

async function main() {
  const stats = { runs: 0, posts: 0 };

  // TWITTER
  const twDir = path.join(ROOT, 'twitter-research');
  if (fs.existsSync(twDir)) {
    for (const f of fs.readdirSync(twDir).filter(x => x.endsWith('.json'))) {
      const full = path.join(twDir, f);
      const mode = f.startsWith('search') ? 'search' : f.startsWith('timeline') ? 'timeline' : f.startsWith('bookmarks') ? 'bookmarks' : 'other';
      // Extract unique keywords from items if search
      const items = arrValues(readJson(full));
      const keywords = mode === 'search' ? [...new Set(items.map(i => i.search_keyword).filter(Boolean))] : [];
      const r = await ingestFile(full, {
        // Twitter e exclusivo da conta "principal" do cliente ativo (ver CLAUDE.md).
        platform: 'twitter', mode, client_slug: CLIENT_ACCOUNTS.principal.clientSlug,
        keywords,
        extract: (raw) => arrValues(raw),
        mapper: mapTwitter,
      });
      stats.runs++; stats.posts += r.inserted;
    }
  }

  // LINKEDIN
  const liDir = path.join(ROOT, 'linkedin-analyzer');
  if (fs.existsSync(liDir)) {
    for (const f of fs.readdirSync(liDir).filter(x => x.endsWith('.json'))) {
      const full = path.join(liDir, f);
      const raw = readJson(full);
      const mode = raw.kind || (f.startsWith('search') ? 'search' : f.startsWith('feed') ? 'feed' : f.startsWith('company') ? 'company' : 'profile');
      const items = raw.posts || [];
      const keywords = mode === 'search' ? [...new Set(items.map(i => i.search_keyword).filter(Boolean))] : [];
      // Infer client a partir do nome do arquivo, casando contra o handle de cada conta.
      // Pagina de empresa (company-{org-id}-...) nao carrega handle no nome: casa pelo
      // org id da pagina LinkedIn configurada como conta "business" no ig-accounts.cjs.
      const LINKEDIN_COMPANY_ORG_ID = process.env.LINKEDIN_ORG_ID || '';
      let client = clientFromHandle(f);
      if (!client && LINKEDIN_COMPANY_ORG_ID && f.includes(`company-${LINKEDIN_COMPANY_ORG_ID}`)) client = CLIENT_ACCOUNTS.business.clientSlug;
      const r = await ingestFile(full, {
        platform: 'linkedin', mode, client_slug: client, label: raw.label || null,
        keywords,
        extract: (raw) => raw.posts || [],
        mapper: mapLinkedin,
      });
      stats.runs++; stats.posts += r.inserted;
    }
  }

  // INSTAGRAM
  const igDir = path.join(ROOT, 'instagram-analyzer');
  if (fs.existsSync(igDir)) {
    for (const f of fs.readdirSync(igDir).filter(x => x.endsWith('.json'))) {
      const full = path.join(igDir, f);
      const raw = readJson(full);
      const client = clientFromHandle(raw.handle);
      const r = await ingestFile(full, {
        platform: 'instagram', mode: 'profile', client_slug: client, label: raw.handle,
        extract: (raw) => raw.media || [],
        mapper: mapInstagram,
      });
      stats.runs++; stats.posts += r.inserted;
    }
  }

  // TIKTOK
  const ttDir = path.join(ROOT, 'tiktok-analyzer');
  if (fs.existsSync(ttDir)) {
    for (const f of fs.readdirSync(ttDir).filter(x => x.endsWith('.json'))) {
      const full = path.join(ttDir, f);
      const raw = readJson(full);
      const client = clientFromHandle(raw.handle);
      const r = await ingestFile(full, {
        platform: 'tiktok', mode: 'profile', client_slug: client, label: raw.handle,
        extract: (raw) => raw.videos || [],
        mapper: mapTiktok,
      });
      stats.runs++; stats.posts += r.inserted;
    }
  }

  // YOUTUBE
  const ytDir = path.join(ROOT, 'youtube-analyzer');
  if (fs.existsSync(ytDir)) {
    for (const f of fs.readdirSync(ytDir).filter(x => x.endsWith('.json'))) {
      const full = path.join(ytDir, f);
      const raw = readJson(full);
      const r = await ingestFile(full, {
        // YouTube e exclusivo da conta "principal" do cliente ativo (ver CLAUDE.md).
        platform: 'youtube', mode: 'channel', client_slug: CLIENT_ACCOUNTS.principal.clientSlug,
        label: f.replace('.json', ''),
        extract: (raw) => raw.videos || [],
        mapper: mapYoutube,
        metadata: raw.analysis || {},
      });
      stats.runs++; stats.posts += r.inserted;
    }
  }

  console.log('\n=== INGEST DONE ===');
  console.log(`Runs processed: ${stats.runs}`);
  console.log(`Posts upserted:  ${stats.posts}`);
}

main().catch(err => { console.error(err); process.exit(1); });
