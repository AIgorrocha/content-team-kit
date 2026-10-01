#!/usr/bin/env node
/**
 * backfill-story-daily.mjs - Recupera o historico AGREGADO DIARIO de Story das 2 contas.
 *
 * O QUE ISTO E, E O QUE NAO E (importante, leia antes de usar o dado):
 * Insight de story INDIVIDUAL do passado esta perdido pra sempre. Foi verificado com
 * controle positivo e negativo: /me/media nunca devolve STORY (centenas de itens
 * de feed, zero STORY); as edges /me/highlights e /me/story_highlights
 * devolvem o mesmo erro de uma edge inventada; e media-id de tela de destaque devolve o
 * mesmo erro de um id falso, enquanto media-id de feed no mesmo token retorna reach.
 *
 * O que SOBREVIVE e o agregado por DIA, via insights de CONTA com breakdown por
 * media_product_type:
 *   GET /me/insights?metric=views&period=day&metric_type=total_value
 *       &breakdown=media_product_type
 * Retroativo ate ~21/ago/2025 (a API declara 2 anos e entrega ~11 meses).
 * Metricas que aceitam o breakdown: views, reach, total_interactions, likes.
 * Recusam: replies, profile_views, accounts_engaged.
 *
 * ISTO NAO E PROXY DE RETENCAO. Repetindo, porque a tentacao e obvia:
 * NAO divida views do dia pelo numero de telas daquele dia pra estimar retencao por
 * tela. O agregado nao sabe quantas telas foram postadas, nem em que ordem, nem quem
 * saiu na tela 3. Retencao por tela retroativa NAO EXISTE e nunca vai existir: so a
 * coleta continua (scripts/analytics/collect-story-insights.mjs, cron de 4/4h) produz
 * isso, e so daqui pra frente.
 *
 * Grava em ct_metrics_snapshots com grao de CONTA e post_id sintetico
 * `__story__:{client}:{handle}`, um por dia, pra nao colidir com o grao de post nem com
 * o agregado de conta que o analyzer ja grava.
 *
 * Uso:
 *   node scripts/analytics/backfill-story-daily.mjs --dry-run
 *   node scripts/analytics/backfill-story-daily.mjs
 *   node scripts/analytics/backfill-story-daily.mjs --account principal --days 90
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { writeMetrics } = require(path.join(REPO, 'skills', '_shared', 'metrics-writer.cjs'));
const { isIgDirectToken, CLIENT_ACCOUNTS } = require(path.join(REPO, 'skills', '_shared', 'ig-accounts.cjs'));

const apiBase = (t) => (isIgDirectToken(t) ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v21.0');
const accountNode = (acc) => (isIgDirectToken(acc.token) ? 'me' : acc.userId);

// Metricas que aceitam breakdown=media_product_type (verificado na Graph API).
const METRICS = ['views', 'reach', 'total_interactions', 'likes'];
// A API recusa janela > 30 dias por chamada, entao o backfill anda em blocos.
// Com breakdown, a API devolve SO o total da janela (nao serie por dia), entao a
// granularidade do historico e o tamanho do bloco: bloco de 7 dias = ponto semanal.
// Semanal e o meio-termo: 11 meses viram ~49 pontos por metrica, sem estourar rate limit
// (diario seria ~1.360 chamadas por conta).
const CHUNK_DAYS = 7;

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const ACCOUNTS = () => Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => {
  const creds = acc.creds();
  return { key, client_slug: acc.clientSlug, handle: acc.handle, token: creds.token, userId: creds.userId };
});

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = new Error(json?.error?.message || `HTTP ${res.status}`);
    e.code = json?.error?.code;
    throw e;
  }
  return json;
}

const day = (d) => d.toISOString().slice(0, 10);

/** Busca 1 metrica num intervalo, ja filtrando a fatia STORY do breakdown. */
async function fetchMetric(acc, metric, since, until) {
  const url = `${apiBase(acc.token)}/${accountNode(acc)}/insights`
    + `?metric=${metric}&period=day&metric_type=total_value&breakdown=media_product_type`
    + `&since=${Math.floor(since.getTime() / 1000)}&until=${Math.floor(until.getTime() / 1000)}`
    + `&access_token=${encodeURIComponent(acc.token)}`;
  const json = await get(url);
  const out = {};
  for (const m of json.data || []) {
    const results = m.total_value?.breakdowns?.[0]?.results || [];
    for (const r of results) {
      if ((r.dimension_values || []).includes('STORY')) {
        // total_value com breakdown nao vem por dia: e o total da janela.
        out.__window_total__ = r.value;
      }
    }
    // Quando a API devolve serie por dia (values[]), preservamos dia a dia.
    for (const v of m.values || []) {
      if (v.end_time) out[v.end_time.slice(0, 10)] = v.value;
    }
  }
  return out;
}

async function run() {
  loadEnv();
  const args = process.argv.slice(2);
  const only = args.includes('--account') ? args[args.indexOf('--account') + 1] : null;
  const dryRun = args.includes('--dry-run');
  const days = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1], 10) : 340;

  console.log(`=== backfill-story-daily (janela ${days}d) ===`);
  if (dryRun) console.log('(dry-run: nao grava)\n');

  for (const acc of ACCOUNTS()) {
    if (only && acc.key !== only) continue;
    const precisaUserId = !isIgDirectToken(acc.token);
    if (!acc.token || (precisaUserId && !acc.userId)) {
      console.log(`SKIP ${acc.handle}: sem credencial`);
      continue;
    }

    console.log(`\n--- ${acc.handle} ---`);
    const now = new Date();
    const janelas = [];
    for (let off = 0; off < days; off += CHUNK_DAYS) {
      const until = new Date(now.getTime() - off * 86400000);
      const since = new Date(until.getTime() - Math.min(CHUNK_DAYS, days - off) * 86400000);
      janelas.push({ since, until });
    }

    let primeiroErro = null;
    const posts = [];

    for (const { since, until } of janelas) {
      const linha = { since: day(since), until: day(until) };
      for (const metric of METRICS) {
        try {
          const r = await fetchMetric(acc, metric, since, until);
          const tot = r.__window_total__;
          if (tot !== undefined) linha[metric] = tot;
        } catch (e) {
          // Guardamos o primeiro erro: normalmente e o limite retroativo real da API,
          // e ele e a informacao (ate onde da pra voltar), nao um bug.
          if (!primeiroErro) primeiroErro = `${day(since)}..${day(until)} ${metric}: ${e.message}`;
        }
      }
      const temDado = METRICS.some((m) => linha[m] !== undefined);
      if (!temDado) continue;

      // Grao de CONTA, uma linha por janela. post_id sintetico separado do
      // `__acct__:` que o analyzer usa, pra nao colidir com o agregado geral da conta.
      posts.push({
        post_id: `__story__:${acc.client_slug}:${acc.handle}`,
        post_url: null,
        post_type: 'story_daily_agg',
        published_at: null,
        snapshot_date: linha.until,   // fim da janela: e o que datita o ponto
        reach: linha.reach ?? null,
        impressions: null,
        views: linha.views ?? null,
        likes: linha.likes ?? null,
        comments: null,
        shares: null,
        saves: null,
        engagement_rate: linha.views && linha.total_interactions != null
          ? +((linha.total_interactions / linha.views) * 100).toFixed(3)
          : null,
        metrics: {
          ...linha,
          window_days: CHUNK_DAYS,
          source_endpoint: '/me/insights?breakdown=media_product_type (fatia STORY)',
          // Aviso que viaja junto do dado, porque a tentacao de dividir por telas e obvia:
          nao_e_retencao: 'Agregado por janela. Nao sabe quantas telas, nem ordem, nem quem saiu na tela 3. Retencao por tela so vem da coleta 4/4h daqui pra frente.',
        },
      });
      console.log(`  ${linha.since}..${linha.until}  views=${linha.views ?? '-'} reach=${linha.reach ?? '-'} inter=${linha.total_interactions ?? '-'} likes=${linha.likes ?? '-'}`);
    }

    console.log(`  janelas com dado: ${posts.length}/${janelas.length}`);
    if (primeiroErro) console.log(`  primeiro erro (provavel limite retroativo): ${primeiroErro}`);

    if (!dryRun && posts.length) {
      // ATENCAO: no metrics-writer, snapshot_date e por CHAMADA, nao por post. Mandar as
      // 49 janelas de uma vez colapsaria tudo num unico snapshot_date (hoje) e o upsert
      // por (platform, post_id, snapshot_date) deixaria SO A ULTIMA. Uma chamada por
      // janela e o que preserva a serie temporal.
      let gravados = 0;
      for (const p of posts) {
        const { snapshot_date, ...post } = p;
        await writeMetrics({
          client_slug: acc.client_slug,
          platform: 'instagram',
          account_handle: acc.handle,
          source: 'backfill-story-daily',
          snapshot_date,
          posts: [post],
        });
        gravados++;
      }
      console.log(`  gravado: ${gravados} pontos (1 chamada por janela) em ct_metrics_snapshots`);
    }
  }

  console.log('\nLembrete gravado no proprio script: isto e agregado por janela, NAO e retencao por tela.');
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
