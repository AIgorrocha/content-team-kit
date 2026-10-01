#!/usr/bin/env node
/**
 * compute.js - Best-time + insights computados dos snapshots (ct_metrics_snapshots).
 *
 * Replica gratis o /besttimes do Metricool: heatmap 7x24 (dia x hora, BRT) com
 * media de engajamento real dos NOSSOS posts. Quanto mais historico, melhor.
 *
 * Uso:
 *   node compute.js [--client all|{slug-do-cliente}] [--platform all|instagram|...] [--days 90]
 *
 * Saida: grava 1 linha por (cliente, rede) em ct_social_insights (kind=best_time).
 * Cockpit (Fase 3) le a mais recente.
 */

const { loadEnv } = require('../_shared/metrics-writer.cjs');

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const MIN_BUCKET = 3; // amostra minima por celula pra confiar no rate

function parseArgs(argv) {
  const a = { client: 'all', platform: 'all', days: 90 };
  const r = argv.slice(2);
  for (let i = 0; i < r.length; i++) {
    if (r[i] === '--client') a.client = r[++i];
    else if (r[i] === '--platform') a.platform = r[++i];
    else if (r[i] === '--days') a.days = parseInt(r[++i], 10);
  }
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

function interactions(p) {
  return (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
}

// converte ISO UTC -> {weekday, hour} no fuso BRT (UTC-3)
function brtParts(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  let h = d.getUTCHours() - 3;
  let wd = d.getUTCDay();
  if (h < 0) { h += 24; wd = (wd + 6) % 7; }
  return { weekday: wd, hour: h };
}

function computeFor(posts, windowDays) {
  // celulas 7x24
  const cells = {}; // key "wd-h" -> {n, sumRate, nRate, sumInter}
  const byWeekday = {};
  const byHour = {};
  const byFormat = {};

  for (const p of posts) {
    if (!p.published_at) continue;
    const t = brtParts(p.published_at);
    if (!t) continue;
    const inter = interactions(p);
    const rate = p.engagement_rate != null ? Number(p.engagement_rate) : null;
    const key = `${t.weekday}-${t.hour}`;
    const c = (cells[key] ||= { weekday: t.weekday, hour: t.hour, n: 0, sumRate: 0, nRate: 0, sumInter: 0 });
    c.n++; c.sumInter += inter;
    if (rate != null) { c.sumRate += rate; c.nRate++; }

    (byWeekday[t.weekday] ||= { n: 0, sumInter: 0, sumRate: 0, nRate: 0 });
    byWeekday[t.weekday].n++; byWeekday[t.weekday].sumInter += inter;
    if (rate != null) { byWeekday[t.weekday].sumRate += rate; byWeekday[t.weekday].nRate++; }

    (byHour[t.hour] ||= { n: 0, sumInter: 0, sumRate: 0, nRate: 0 });
    byHour[t.hour].n++; byHour[t.hour].sumInter += inter;
    if (rate != null) { byHour[t.hour].sumRate += rate; byHour[t.hour].nRate++; }

    const fmt = p.post_type || 'unknown';
    (byFormat[fmt] ||= { n: 0, sumInter: 0, sumRate: 0, nRate: 0 });
    byFormat[fmt].n++; byFormat[fmt].sumInter += inter;
    if (rate != null) { byFormat[fmt].sumRate += rate; byFormat[fmt].nRate++; }
  }

  const cellList = Object.values(cells).map((c) => ({
    weekday: c.weekday,
    weekday_label: WD[c.weekday],
    hour: c.hour,
    n: c.n,
    avg_rate: c.nRate ? Number((c.sumRate / c.nRate).toFixed(2)) : null,
    avg_interactions: Number((c.sumInter / c.n).toFixed(1)),
  }));

  // ranking: prioriza avg_rate quando amostra suficiente, senao interactions
  const hasRate = cellList.some((c) => c.avg_rate != null && c.n >= MIN_BUCKET);
  const score = (c) => (hasRate && c.avg_rate != null ? c.avg_rate : c.avg_interactions / 100);
  const ranked = [...cellList].sort((a, b) => score(b) - score(a));
  const bestSlots = ranked.slice(0, 5).map((c) => ({
    weekday: c.weekday_label, hour: c.hour, n: c.n,
    avg_rate: c.avg_rate, avg_interactions: c.avg_interactions,
    confidence: c.n >= MIN_BUCKET ? 'alta' : 'baixa',
  }));

  const summarize = (obj, labelFn) => Object.entries(obj)
    .map(([k, v]) => ({
      key: labelFn ? labelFn(k) : k,
      n: v.n,
      avg_rate: v.nRate ? Number((v.sumRate / v.nRate).toFixed(2)) : null,
      avg_interactions: Number((v.sumInter / v.n).toFixed(1)),
    }))
    .sort((a, b) => (b.avg_rate ?? b.avg_interactions / 100) - (a.avg_rate ?? a.avg_interactions / 100));

  return {
    window_days: windowDays,
    sample_size: posts.filter((p) => p.published_at).length,
    metric_used: hasRate ? 'engagement_rate' : 'interactions',
    best_slots: bestSlots,
    by_weekday: summarize(byWeekday, (k) => WD[k]),
    by_hour: summarize(byHour, (k) => `${k}h`),
    by_format: summarize(byFormat),
    heatmap: cellList,
  };
}

async function upsertInsight(client_slug, platform, payload) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const row = {
    client_slug, platform, kind: 'best_time',
    window_days: payload.window_days, sample_size: payload.sample_size, payload,
  };
  const res = await fetch(`${url}/rest/v1/ct_social_insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert insight ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function run() {
  const args = parseArgs(process.argv);
  loadEnv();

  const since = new Date(Date.now() - args.days * 86400000).toISOString().slice(0, 10);
  let q = `ct_metrics_snapshots?grain=eq.post&published_at=gte.${since}T00:00:00`;
  if (args.client !== 'all') q += `&client_slug=eq.${args.client}`;
  if (args.platform !== 'all') q += `&platform=eq.${args.platform}`;
  q += '&select=client_slug,platform,post_id,snapshot_date,post_type,published_at,likes,comments,shares,saves,engagement_rate&limit=20000';

  const rows = await rest(q);

  // dedup: 1 linha por post_id (mantem snapshot_date mais recente = estado final)
  const latest = {};
  for (const r of rows) {
    const cur = latest[r.post_id];
    if (!cur || r.snapshot_date > cur.snapshot_date) latest[r.post_id] = r;
  }
  const deduped = Object.values(latest);
  console.log(`${rows.length} snapshots -> ${deduped.length} posts unicos (>= ${since}).`);

  // agrupa por (client, platform)
  const groups = {};
  for (const r of deduped) {
    const k = `${r.client_slug}|${r.platform}`;
    (groups[k] ||= []).push(r);
  }

  if (!Object.keys(groups).length) {
    console.log('Sem dados. Rode os analyzers primeiro pra popular ct_metrics_snapshots.');
    return;
  }

  for (const [k, posts] of Object.entries(groups)) {
    const [client_slug, platform] = k.split('|');
    // dedup: 1 metrica por post (snapshot mais recente ja e o estado; aqui basta o conjunto)
    const payload = computeFor(posts, args.days);
    await upsertInsight(client_slug, platform, payload);
    const top = payload.best_slots[0];
    console.log(
      `[${client_slug}/${platform}] n=${payload.sample_size} metric=${payload.metric_used} ` +
      `melhor=${top ? `${top.weekday} ${top.hour}h (${top.confidence})` : 'n/d'}`
    );
  }
  console.log('OK -> ct_social_insights');
}

run().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
