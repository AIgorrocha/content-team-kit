#!/usr/bin/env node
/**
 * trends-snapshot.js - Agrega achados do ct-twitter-research (research, clientes com Twitter/X no brand-profile)
 * em tendencias acionaveis pro cockpit: repos GitHub em alta, top tweets, temas.
 *
 * Twitter aqui NAO e metrica propria — e fonte de PESQUISA (assuntos, repos, inspiracao)
 * so pra conta "principal" do cliente ativo (ver CLAUDE.md). Le os JSON em
 * output/twitter-research/ e grava em ct_social_insights (client=conta "principal",
 * platform=twitter, kind=trends).
 *
 * Uso: node skills/ct-social-cockpit/trends-snapshot.js [--days 30]
 */

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../_shared/metrics-writer.cjs');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

const DIR = path.join(__dirname, '../../output/twitter-research');

function parseArgs(argv) {
  const a = { days: 30 };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) if (r[i] === '--days') a.days = parseInt(r[++i], 10);
  return a;
}

function loadTweets(days) {
  if (!fs.existsSync(DIR)) return [];
  const cutoff = Date.now() - days * 86400000;
  const out = [];
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = f.match(/(\d{4}-\d{2}-\d{2})/);
    if (m && new Date(m[1]).getTime() < cutoff) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      if (Array.isArray(arr)) out.push(...arr);
    } catch { /* skip */ }
  }
  return out;
}

function eng(t) {
  return (t.likes || 0) + (t.reposts || 0) + (t.replies || 0);
}

async function upsert(payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${url}/rest/v1/ct_social_insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      client_slug: CLIENT_ACCOUNTS.principal.clientSlug, platform: 'twitter', kind: 'trends',
      sample_size: payload.sample_size, payload,
    }),
  });
}

function run() {
  const args = parseArgs(process.argv);
  loadEnv();
  const tweets = loadTweets(args.days);
  if (!tweets.length) { console.log('Sem JSON em output/twitter-research/. Rode ct-twitter-research antes.'); return; }

  // dedup por tweet_id
  const seen = {};
  for (const t of tweets) if (t.tweet_id && !seen[t.tweet_id]) seen[t.tweet_id] = t;
  const uniq = Object.values(seen);

  // repos GitHub em alta (freq + engajamento somado)
  const repoMap = {};
  for (const t of uniq) {
    for (const repo of t.github_repos || []) {
      const k = repo.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/$/, '');
      (repoMap[k] ||= { repo: k, mentions: 0, eng: 0 });
      repoMap[k].mentions++; repoMap[k].eng += eng(t);
    }
  }
  const top_repos = Object.values(repoMap).sort((a, b) => b.mentions - a.mentions || b.eng - a.eng).slice(0, 10);

  // top tweets por engajamento
  const top_tweets = [...uniq].sort((a, b) => eng(b) - eng(a)).slice(0, 8).map((t) => ({
    handle: t.author_handle, text: (t.text || '').replace(/\n/g, ' ').slice(0, 160),
    eng: eng(t), views: t.views || null, url: t.url, keyword: t.search_keyword || null,
  }));

  // temas (por search_keyword)
  const kwMap = {};
  for (const t of uniq) {
    const k = t.search_keyword;
    if (!k) continue;
    (kwMap[k] ||= { keyword: k, n: 0, eng: 0 });
    kwMap[k].n++; kwMap[k].eng += eng(t);
  }
  const by_keyword = Object.values(kwMap).sort((a, b) => b.eng - a.eng);

  const payload = { sample_size: uniq.length, window_days: args.days, top_repos, top_tweets, by_keyword };
  return upsert(payload).then(() => {
    console.log(`Tendencias: ${uniq.length} tweets, ${top_repos.length} repos, ${by_keyword.length} temas -> ct_social_insights(trends)`);
  });
}

Promise.resolve(run()).catch((e) => { console.error('Falha:', e.message); process.exit(1); });
