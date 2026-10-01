#!/usr/bin/env node
// analyze.js — Analise do canal YouTube via Data API v3 (refresh token).
// Uso: node analyze.js [--limit 20] [--channel-id UC...]

const fs = require('fs');
const path = require('path');
const https = require('https');
const { writeMetrics } = require('../_shared/metrics-writer.cjs');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

require('dotenv').config({ path: path.join(__dirname, '../../.env.local'), override: true });

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Faltam YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN no .env.local');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { limit: 20, channelId: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--limit') args.limit = parseInt(rest[++i], 10);
    else if (rest[i] === '--channel-id') args.channelId = rest[++i];
  }
  return args;
}

function httpsJson(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Parse error ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }).toString();
  const res = await httpsJson(
    {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
  return res.access_token;
}

async function ytGet(pathAndQuery, token) {
  return httpsJson({
    hostname: 'www.googleapis.com',
    path: `/youtube/v3${pathAndQuery}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

async function getChannel(token, channelId) {
  const part = 'snippet,statistics,contentDetails';
  const q = channelId ? `id=${channelId}` : 'mine=true';
  const res = await ytGet(`/channels?part=${part}&${q}`, token);
  if (!res.items || !res.items.length) throw new Error('Canal nao encontrado');
  return res.items[0];
}

async function getUploads(token, uploadsPlaylistId, limit) {
  const videoIds = [];
  let pageToken = '';
  while (videoIds.length < limit) {
    const q = `part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50${
      pageToken ? `&pageToken=${pageToken}` : ''
    }`;
    const res = await ytGet(`/playlistItems?${q}`, token);
    for (const it of res.items || []) {
      if (it.contentDetails && it.contentDetails.videoId) videoIds.push(it.contentDetails.videoId);
      if (videoIds.length >= limit) break;
    }
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return videoIds.slice(0, limit);
}

async function getVideos(token, videoIds) {
  const out = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const res = await ytGet(
      `/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}`,
      token
    );
    for (const v of res.items || []) {
      out.push({
        videoId: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        tags: v.snippet.tags || [],
        categoryId: v.snippet.categoryId,
        defaultLanguage: v.snippet.defaultLanguage || v.snippet.defaultAudioLanguage || null,
        thumbnails: v.snippet.thumbnails,
        duration: v.contentDetails.duration,
        viewCount: parseInt(v.statistics.viewCount || '0', 10),
        likeCount: parseInt(v.statistics.likeCount || '0', 10),
        commentCount: parseInt(v.statistics.commentCount || '0', 10),
      });
    }
  }
  return out;
}

function iso8601ToSec(d) {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
}

function engagementRate(v) {
  if (!v.viewCount) return 0;
  return (v.likeCount + v.commentCount) / v.viewCount;
}

function analyze(channel, videos) {
  const byViews = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
  const byEngagement = [...videos]
    .filter((v) => v.viewCount > 0)
    .sort((a, b) => engagementRate(b) - engagementRate(a))
    .slice(0, 5);

  const tagFreq = {};
  videos.forEach((v) =>
    (v.tags || []).forEach((t) => {
      const k = t.toLowerCase();
      tagFreq[k] = (tagFreq[k] || 0) + 1;
    })
  );
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  const hourFreq = {};
  const weekdayFreq = {};
  videos.forEach((v) => {
    const d = new Date(v.publishedAt);
    const h = d.getUTCHours() - 3; // BRT approx
    const hBrt = ((h % 24) + 24) % 24;
    hourFreq[hBrt] = (hourFreq[hBrt] || 0) + 1;
    const wd = d.getUTCDay();
    weekdayFreq[wd] = (weekdayFreq[wd] || 0) + 1;
  });

  const durations = videos.map((v) => iso8601ToSec(v.duration));
  const avgDurationSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  return {
    channel: {
      id: channel.id,
      title: channel.snippet.title,
      customUrl: channel.snippet.customUrl,
      subscriberCount: parseInt(channel.statistics.subscriberCount || '0', 10),
      videoCount: parseInt(channel.statistics.videoCount || '0', 10),
      viewCount: parseInt(channel.statistics.viewCount || '0', 10),
    },
    sample_size: videos.length,
    summary: {
      total_views_sample: videos.reduce((s, v) => s + v.viewCount, 0),
      total_likes_sample: videos.reduce((s, v) => s + v.likeCount, 0),
      total_comments_sample: videos.reduce((s, v) => s + v.commentCount, 0),
      avg_duration_sec: avgDurationSec,
      avg_engagement_rate: videos.length
        ? videos.reduce((s, v) => s + engagementRate(v), 0) / videos.length
        : 0,
    },
    top_by_views: byViews,
    top_by_engagement: byEngagement,
    top_tags: topTags,
    posting_pattern: {
      by_hour_brt: hourFreq,
      by_weekday: weekdayFreq,
    },
  };
}

function toMarkdown(a) {
  const lines = [];
  const fmtN = (n) => n.toLocaleString('pt-BR');
  const fmtPct = (p) => (p * 100).toFixed(2) + '%';
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  lines.push(`# YouTube Analysis — ${a.channel.title}`);
  lines.push('');
  lines.push(`- Canal: ${a.channel.title} (${a.channel.customUrl || a.channel.id})`);
  lines.push(`- Inscritos: ${fmtN(a.channel.subscriberCount)}`);
  lines.push(`- Total de videos: ${fmtN(a.channel.videoCount)}`);
  lines.push(`- Views totais (canal): ${fmtN(a.channel.viewCount)}`);
  lines.push(`- Amostra analisada: ${a.sample_size} videos mais recentes`);
  lines.push('');
  lines.push('## Resumo da amostra');
  lines.push(`- Views: ${fmtN(a.summary.total_views_sample)}`);
  lines.push(`- Likes: ${fmtN(a.summary.total_likes_sample)}`);
  lines.push(`- Comments: ${fmtN(a.summary.total_comments_sample)}`);
  lines.push(`- Duracao media: ${Math.round(a.summary.avg_duration_sec / 60)}m${a.summary.avg_duration_sec % 60}s`);
  lines.push(`- Engagement medio: ${fmtPct(a.summary.avg_engagement_rate)}`);
  lines.push('');
  lines.push('## Top 5 por views');
  a.top_by_views.forEach((v, i) =>
    lines.push(`${i + 1}. **${v.title}** — ${fmtN(v.viewCount)} views | ${fmtN(v.likeCount)} likes | ${fmtN(v.commentCount)} comments`)
  );
  lines.push('');
  lines.push('## Top 5 por engajamento');
  a.top_by_engagement.forEach((v, i) =>
    lines.push(`${i + 1}. **${v.title}** — ${fmtPct(engagementRate(v))} | ${fmtN(v.viewCount)} views`)
  );
  lines.push('');
  lines.push('## Tags mais usadas');
  a.top_tags.forEach((t) => lines.push(`- ${t.tag} (${t.count}x)`));
  lines.push('');
  lines.push('## Padrao de publicacao');
  lines.push('**Por dia da semana:**');
  Object.entries(a.posting_pattern.by_weekday)
    .sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => lines.push(`- ${wd[d]}: ${n}`));
  lines.push('');
  lines.push('**Por hora (BRT):**');
  Object.entries(a.posting_pattern.by_hour_brt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([h, n]) => lines.push(`- ${h}h: ${n}`));
  lines.push('');
  return lines.join('\n');
}

async function run() {
  const args = parseArgs(process.argv);
  console.log('Obtendo access token...');
  const token = await getAccessToken();
  console.log('Token obtido (mascarado: ***)');

  console.log('Buscando canal...');
  const channel = await getChannel(token, args.channelId);
  const uploads = channel.contentDetails.relatedPlaylists.uploads;
  console.log(`Canal: ${channel.snippet.title} (${channel.statistics.subscriberCount} inscritos)`);

  console.log(`Buscando ultimos ${args.limit} videos...`);
  const videoIds = await getUploads(token, uploads, args.limit);
  const videos = await getVideos(token, videoIds);
  console.log(`${videos.length} videos obtidos.`);

  const analysis = analyze(channel, videos);
  const today = new Date().toISOString().slice(0, 10);
  const handle = (channel.snippet.customUrl || channel.id).replace(/^@/, '');

  const jsonDir = path.join(__dirname, '../../output/youtube-analyzer');
  fs.mkdirSync(jsonDir, { recursive: true });
  const jsonPath = path.join(jsonDir, `${handle}-${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ analysis, videos }, null, 2), 'utf8');

  const mdDir = path.join(__dirname, '../../content/research');
  fs.mkdirSync(mdDir, { recursive: true });
  const mdPath = path.join(mdDir, `${today}-youtube-analysis.md`);
  fs.writeFileSync(mdPath, toMarkdown(analysis), 'utf8');

  console.log(`JSON: ${jsonPath}`);
  console.log(`MD:   ${mdPath}`);

  // Memoria de metricas (clientes com YouTube no brand-profile). Nunca quebra o fluxo.
  try {
    const posts = videos.map((v) => ({
      post_id: v.videoId,
      post_url: `https://youtu.be/${v.videoId}`,
      post_type: iso8601ToSec(v.duration) <= 60 ? 'short' : 'video',
      published_at: v.publishedAt || null,
      views: v.viewCount,
      likes: v.likeCount,
      comments: v.commentCount,
      metrics: { tags: v.tags, duration: v.duration, categoryId: v.categoryId },
    }));
    const r = await writeMetrics({
      // YouTube e exclusivo da conta "principal" do cliente ativo (ver CLAUDE.md).
      client_slug: CLIENT_ACCOUNTS.principal.clientSlug,
      platform: 'youtube',
      account_handle: handle,
      source: 'ct-youtube-analyzer',
      account: { followers: analysis.channel.subscriberCount, metrics: analysis.channel },
      posts,
    });
    console.log(`Snapshot: ${r.posts} videos + conta -> ct_metrics_snapshots`);
  } catch (e) {
    console.warn(`[metrics] snapshot ignorado: ${e.message}`);
  }
}

run().catch((e) => {
  console.error('Falha:', e.message);
  process.exit(1);
});
