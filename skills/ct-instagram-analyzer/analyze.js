#!/usr/bin/env node
// analyze.js - Analisa contas Instagram via Graph API.
// Uso: node analyze.js [--account <chave>|all]  (chave = conta em _shared/ig-accounts.cjs) [--limit 30]

const fs = require('fs');
const path = require('path');
const https = require('https');
const { writeMetrics } = require('../_shared/metrics-writer.cjs');

require('dotenv').config({ quiet: true, path: path.join(__dirname, '../../.env') });
require('dotenv').config({ quiet: true, path: path.join(__dirname, '../../.env.local'), override: true });

const { isIgDirectToken, CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

// handle -> client_slug (memoria de metricas), fonte unica em ig-accounts.cjs
const CLIENT_BY_KEY = Object.fromEntries(
  Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => [key, acc.clientSlug])
);

const ACCOUNTS = Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => {
  const creds = acc.creds();
  return { key, handle: acc.handle, token: creds.token, userId: creds.userId };
});

function parseArgs(argv) {
  const args = { account: 'all', limit: 30 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--account') args.account = rest[++i];
    else if (rest[i] === '--limit') args.limit = parseInt(rest[++i], 10);
  }
  return args;
}

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              return reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 300)}`));
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Parse ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchMedia(account, limit) {
  const base = isIgDirectToken(account.token)
    ? 'https://graph.instagram.com'
    : 'https://graph.facebook.com/v21.0';

  // Pra IG direct token: /me/media com access_token
  // Pra FB Graph: /{ig-user-id}/media
  const fields = 'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count';
  const id = isIgDirectToken(account.token) ? 'me' : account.userId;

  const items = [];
  let next = `${base}/${id}/media?fields=${fields}&limit=50&access_token=${encodeURIComponent(account.token)}`;
  while (next && items.length < limit) {
    const res = await httpsJson(next);
    for (const m of res.data || []) {
      items.push(m);
      if (items.length >= limit) break;
    }
    next = res.paging && res.paging.next ? res.paging.next : null;
  }
  return items.slice(0, limit);
}

// Metricas pedidas por tipo de media.
//
// POR QUE ESTA LISTA E EXPLICITA (leia antes de mexer):
// Ate 05/ago/2026 REELS e VIDEO pediam `plays`, que a Media Insights API JA NAO ACEITA
// (foi substituida por `views`). A API rejeita a REQUISICAO INTEIRA quando UM nome de
// metrica e invalido, e o catch abaixo engolia o erro. Resultado: linhas de reel em
// ct_metrics_snapshots com reach, views, shares e saves ZERADOS, sendo que a API devolve
// HTTP 200 pra todas elas em REELS (probe de 15/jul/2026). O formato principal das
// contas ficou cego por meses e ninguem viu, porque a falha era silenciosa.
// Duas travas contra a repeticao: (1) fallback metrica a metrica quando o lote falha,
// (2) check executavel em skills/ct-instagram-analyzer/metrics.test.js.
// `impressions` NAO entra: foi removida da API e volta erro.
const METRICS_BY_TYPE = {
  IMAGE: ['reach', 'saved', 'shares'],
  VIDEO: ['reach', 'views', 'saved', 'shares'],
  CAROUSEL_ALBUM: ['reach', 'saved', 'shares'],
  REELS: ['reach', 'views', 'saved', 'shares', 'ig_reels_avg_watch_time'],
};

function metricsFor(media) {
  const mt = media.media_product_type === 'REELS' ? 'REELS' : media.media_type;
  return METRICS_BY_TYPE[mt] || ['reach'];
}

async function fetchInsights(account, media) {
  const base = isIgDirectToken(account.token)
    ? 'https://graph.instagram.com'
    : 'https://graph.facebook.com/v21.0';

  const wanted = metricsFor(media);
  const out = {};

  const ask = async (list) => {
    const url = `${base}/${media.id}/insights?metric=${list.join(',')}&access_token=${encodeURIComponent(account.token)}`;
    const res = await httpsJson(url);
    for (const m of res.data || []) {
      const v = m.values && m.values[0] ? m.values[0].value : 0;
      out[m.name] = v;
    }
  };

  try {
    await ask(wanted);
  } catch (e) {
    // Uma metrica invalida derruba o lote inteiro. Refaz uma a uma pra salvar o resto,
    // e RECLAMA ALTO: metrica que sumiu da API tem que aparecer no log, nunca em silencio.
    for (const m of wanted) {
      try {
        await ask([m]);
      } catch (e2) {
        console.warn(`[insights] ${media.id} (${media.media_product_type || media.media_type}) sem "${m}": ${e2.message.slice(0, 120)}`);
      }
    }
  }
  return out;
}

function engagementScore(m) {
  return (m.like_count || 0) + (m.comments_count || 0);
}

// Info de CONTA (seguidores etc). Sem isso, ct_metrics_snapshots grain='account' fica
// vazio pra sempre: o writer (_shared/metrics-writer.cjs) ja sabe gravar esse grao,
// mas so grava se alguem passar `account:` pro writeMetrics - e ate 10/set/2026 nenhum
// caller passava. Resultado: zero historico de seguidor, zero tendencia de crescimento.
// Bug achado por outro agente auditando o Supabase (10/set/2026): so a foto de AGORA
// existia (1.876 seguidores), sem serie temporal.
async function fetchAccountInfo(account) {
  const base = isIgDirectToken(account.token)
    ? 'https://graph.instagram.com'
    : 'https://graph.facebook.com/v21.0';
  const id = isIgDirectToken(account.token) ? 'me' : account.userId;
  const fields = 'followers_count,follows_count,media_count';
  try {
    return await httpsJson(`${base}/${id}?fields=${fields}&access_token=${encodeURIComponent(account.token)}`);
  } catch (e) {
    console.warn(`[account] ${account.handle} sem info de conta: ${e.message.slice(0, 150)}`);
    return null;
  }
}

function toMarkdown(perAccount) {
  const lines = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`# Instagram Analysis - ${today}`);
  lines.push('');
  for (const acc of perAccount) {
    lines.push(`## @${acc.handle}`);
    lines.push('');
    if (acc.error) {
      lines.push(`> ERRO: ${acc.error}`);
      lines.push('');
      continue;
    }
    lines.push(`- Total posts analisados: ${acc.media.length}`);
    const byType = {};
    acc.media.forEach((m) => {
      const k = m.media_product_type === 'REELS' ? 'REELS' : m.media_type;
      byType[k] = (byType[k] || 0) + 1;
    });
    lines.push(`- Distribuicao: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    lines.push('');
    lines.push('### Top 5 por engajamento (likes+comments)');
    const top = [...acc.media].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 5);
    top.forEach((m, i) => {
      const cap = (m.caption || '').replace(/\n/g, ' ').slice(0, 120);
      const date = (m.timestamp || '').slice(0, 10);
      lines.push(`${i + 1}. [${m.media_product_type || m.media_type}] ${date} - ${m.like_count || 0} likes, ${m.comments_count || 0} comments`);
      lines.push(`   ${m.permalink}`);
      lines.push(`   "${cap}"`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

async function run() {
  const args = parseArgs(process.argv);
  const targets = ACCOUNTS.filter(
    (a) => (args.account === 'all' || args.account === a.key) && a.token && (a.userId || isIgDirectToken(a.token))
  );

  const missing = ACCOUNTS.filter((a) => !a.token || (!a.userId && !isIgDirectToken(a.token))).map((a) => a.key);
  if (missing.length) {
    console.warn(`[warn] Contas sem credencial configurada (pulando): ${missing.join(', ')}`);
  }
  if (!targets.length) {
    console.error('Nenhuma conta configurada. Adicione tokens em .env.local.');
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, '../../output/instagram-analyzer');
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const acc of targets) {
    console.log(`\n== @${acc.handle} ==`);
    try {
      const media = await fetchMedia(acc, args.limit);
      console.log(`${media.length} posts obtidos.`);
      for (const m of media) {
        m.insights = await fetchInsights(acc, m);
      }
      const jsonPath = path.join(outDir, `${acc.handle}-${today}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify({ handle: acc.handle, fetched_at: new Date().toISOString(), media }, null, 2), 'utf8');
      console.log(`JSON: ${jsonPath}`);
      results.push({ handle: acc.handle, media });

      // Memoria de metricas (best-time + cockpit). Nunca quebra o fluxo.
      try {
        const info = await fetchAccountInfo(acc);
        const accountParam = info && info.followers_count != null
          ? { followers: info.followers_count, metrics: { follows_count: info.follows_count, media_count: info.media_count } }
          : null;
        if (accountParam) console.log(`Conta: ${accountParam.followers} seguidores`);
        const posts = media.map((m) => {
          const ins = m.insights || {};
          const isReel = m.media_product_type === 'REELS';
          return {
            post_id: m.id,
            post_url: m.permalink,
            post_type: isReel ? 'reel' : (m.media_type || '').toLowerCase(),
            published_at: m.timestamp || null,
            reach: ins.reach,
            likes: m.like_count,
            comments: m.comments_count,
            saves: ins.saved,
            shares: ins.shares,
            // `views` e o nome atual; `plays` so sobrevive aqui pra media antiga que ainda devolva.
            views: ins.views ?? ins.plays,
            metrics: { ...ins, media_type: m.media_type, media_product_type: m.media_product_type },
          };
        });
        const r = await writeMetrics({
          client_slug: CLIENT_BY_KEY[acc.key] || acc.key,
          platform: 'instagram',
          account_handle: acc.handle,
          source: 'ct-instagram-analyzer',
          account: accountParam,
          posts,
        });
        console.log(`Snapshot: ${r.posts} posts -> ct_metrics_snapshots`);
      } catch (e) {
        console.warn(`[metrics] snapshot ignorado: ${e.message}`);
      }
    } catch (e) {
      console.error(`Falha em @${acc.handle}: ${e.message}`);
      results.push({ handle: acc.handle, error: e.message, media: [] });
    }
  }

  const mdDir = path.join(__dirname, '../../content/research');
  fs.mkdirSync(mdDir, { recursive: true });
  const mdPath = path.join(mdDir, `${today}-instagram-analysis.md`);
  fs.writeFileSync(mdPath, toMarkdown(results), 'utf8');
  console.log(`\nMD: ${mdPath}`);
}

module.exports = { METRICS_BY_TYPE, metricsFor };

if (require.main === module) {
  run().catch((e) => {
    console.error('Falha geral:', e.message);
    process.exit(1);
  });
}
