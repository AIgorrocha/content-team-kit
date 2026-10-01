#!/usr/bin/env node
/**
 * collect-story-insights.mjs - Coleta insight de STORY das contas IG do cliente ativo
 * (uma conta por entrada em skills/_shared/ig-accounts.cjs#CLIENT_ACCOUNTS).
 *
 * POR QUE ESTE SCRIPT EXISTE (leia antes de mexer):
 * Insight de Story do Instagram EXPIRA. A story some em 24h e o insight vai junto.
 * Diferente de post de feed, nao da pra buscar depois: dado nao coletado e dado
 * perdido pra sempre. Antes deste script o framework tinha ZERO dado proprio de Story,
 * e por isso toda regra de Story em references/stories-playbook.md e
 * references/instagram-stories-algorithm.md era [HIPOTESE] importada de terceiro.
 * Este script e o que produz o primeiro [MEDIDO] de Story.
 *
 * Roda de 4 em 4 horas via cron (ou agendador da maquina). Cada rodada:
 *   1. lista stories ATIVAS das 2 contas (GET /{ig-user-id}/stories)
 *   2. pega insight de cada uma (GET /{story-id}/insights)
 *   3. faz UPSERT em ct_metrics_snapshots (post_type='story')
 * Rodar varias vezes no mesmo dia e seguro: o writer faz upsert por
 * (platform, post_id, snapshot_date), entao a ultima leitura (mais completa,
 * perto do vencimento) sobrescreve as anteriores.
 *
 * DESCOBERTA DE METRICA: a Meta renomeou metrica de Story mais de uma vez
 * (impressions -> views; taps_forward/taps_back/exits -> navigation com breakdown).
 * Em vez de chutar a lista certa, o script TENTA um catalogo e degrada: se a API
 * recusa uma metrica, ele remove e tenta de novo, e registra no fim o que a API
 * aceitou de fato. Assim ele nao quebra calado quando a Meta mudar de novo.
 *
 * Uso:
 *   node scripts/analytics/collect-story-insights.mjs             # as 2 contas
 *   node scripts/analytics/collect-story-insights.mjs --account principal
 *   node scripts/analytics/collect-story-insights.mjs --dry-run   # nao grava
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');

const { writeMetrics } = require(path.join(REPO, 'skills', '_shared', 'metrics-writer.cjs'));
const { isIgDirectToken, CLIENT_ACCOUNTS } = require(path.join(REPO, 'skills', '_shared', 'ig-accounts.cjs'));

const apiBase = (t) => (isIgDirectToken(t) ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v21.0');
const accountNode = (acc) => (isIgDirectToken(acc.token) ? 'me' : acc.userId);

// Catalogo de metricas de Story. O script testa e remove o que a API recusar.
// Ordem importa so pra legibilidade do log.
const STORY_METRICS = [
  'reach',
  'views',          // substituiu impressions a partir da v22; em v21 pode nao existir
  'impressions',    // legado; sai sozinho quando a Meta remover
  'replies',
  'total_interactions',
  'navigation',     // agregado; breakdown traz tap_forward/tap_back/exit/swipe_forward
  'taps_forward',   // legado
  'taps_back',      // legado
  'exits',          // legado
  'profile_visits',
  'follows',
  'shares',
];

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
  return {
    key,
    client_slug: acc.clientSlug,
    handle: acc.handle,
    token: creds.token,
    userId: creds.userId,
  };
});

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(json?.error?.message || `HTTP ${res.status}`);
    err.code = json?.error?.code;
    err.subcode = json?.error?.error_subcode;
    err.body = json;
    throw err;
  }
  return json;
}

/** Lista as stories ativas (ultimas 24h). Array vazio e resultado legitimo, nao erro. */
async function listActiveStories(acc) {
  const fields = 'id,media_type,media_url,permalink,timestamp,caption';
  const url = `${apiBase(acc.token)}/${accountNode(acc)}/stories?fields=${fields}&access_token=${encodeURIComponent(acc.token)}`;
  const json = await get(url);
  return json.data || [];
}

/**
 * Pega insight de uma story degradando o catalogo de metricas.
 * A API recusa a requisicao INTEIRA se UMA metrica for invalida, entao a cada
 * recusa a gente identifica a culpada pela mensagem, remove e tenta de novo.
 */
async function fetchInsights(acc, storyId, metrics) {
  let current = [...metrics];
  const rejected = [];

  for (let attempt = 0; attempt < metrics.length; attempt++) {
    if (current.length === 0) return { data: {}, accepted: [], rejected };
    try {
      const url = `${apiBase(acc.token)}/${storyId}/insights?metric=${current.join(',')}&access_token=${encodeURIComponent(acc.token)}`;
      const json = await get(url);
      const data = {};
      for (const m of json.data || []) {
        const v = m.total_value?.value ?? m.values?.[0]?.value;
        if (v !== undefined) data[m.name] = v;
        // navigation vem com breakdown (tap_forward, tap_back, exit, swipe_forward)
        const bd = m.total_value?.breakdowns?.[0]?.results;
        if (Array.isArray(bd)) {
          for (const r of bd) {
            const label = r.dimension_values?.[0];
            if (label) data[`navigation_${label}`] = r.value;
          }
        }
      }
      return { data, accepted: current, rejected };
    } catch (e) {
      // Mensagem tipica: "(#100) metric[0] must be one of the following values: ..."
      const msg = e.message || '';
      // A mensagem LISTA as metricas validas, entao procurar nome no texto acha uma valida.
      // O indice em "metric[N]" aponta a recusada.
      const idx = msg.match(/metric\[(\d+)\]/);
      const culprit = idx ? current[Number(idx[1])] : current.find((m) => msg.includes(m));
      if (!culprit) throw e; // erro que nao e de metrica invalida (token, permissao, rate limit)
      rejected.push({ metric: culprit, reason: msg.slice(0, 120) });
      current = current.filter((m) => m !== culprit);
    }
  }
  return { data: {}, accepted: [], rejected };
}

async function run() {
  loadEnv();
  const args = process.argv.slice(2);
  const only = args.includes('--account') ? args[args.indexOf('--account') + 1] : null;
  const dryRun = args.includes('--dry-run');

  const stamp = new Date().toISOString();
  console.log(`\n=== collect-story-insights @ ${stamp} ===`);
  if (dryRun) console.log('(dry-run: nao grava no banco)\n');

  const report = [];

  for (const acc of ACCOUNTS()) {
    if (only && acc.key !== only) continue;
    // userId so e necessario no modo Facebook Login. Token IGAA resolve a conta
    // pelo proprio token (/me), e nesse caso o INSTAGRAM_USER_ID pode nem existir.
    const precisaUserId = !isIgDirectToken(acc.token);
    if (!acc.token || (precisaUserId && !acc.userId)) {
      console.log(`SKIP ${acc.handle}: ${!acc.token ? 'sem token' : 'sem userId (token nao-IGAA exige)'} no env`);
      report.push({ handle: acc.handle, status: 'sem-credencial' });
      continue;
    }

    let stories;
    try {
      stories = await listActiveStories(acc);
    } catch (e) {
      // Falha aqui e barulho que importa: token expirado mata a coleta silenciosamente.
      console.error(`ERRO ${acc.handle}: ${e.message} (code=${e.code} subcode=${e.subcode})`);
      report.push({ handle: acc.handle, status: 'erro', error: e.message, code: e.code });
      continue;
    }

    if (stories.length === 0) {
      console.log(`${acc.handle}: nenhuma story ativa agora`);
      report.push({ handle: acc.handle, status: 'ok', stories: 0 });
      continue;
    }

    const posts = [];
    let acceptedMetrics = null;
    let rejectedMetrics = [];

    for (const s of stories) {
      try {
        const { data, accepted, rejected } = await fetchInsights(acc, s.id, STORY_METRICS);
        if (!acceptedMetrics) { acceptedMetrics = accepted; rejectedMetrics = rejected; }

        const reach = data.reach ?? null;
        const views = data.views ?? data.impressions ?? null;
        const replies = data.replies ?? null;
        const fwd = data.navigation_tap_forward ?? data.taps_forward ?? null;
        const back = data.navigation_tap_back ?? data.taps_back ?? null;
        const exits = data.navigation_exit ?? data.exits ?? null;

        posts.push({
          post_id: s.id,
          post_url: s.permalink || null,
          post_type: 'story',
          published_at: s.timestamp || null,
          reach,
          impressions: data.impressions ?? null,
          views,
          likes: null,
          comments: replies,          // reply de story e o "comentario" do formato
          shares: data.shares ?? null,
          saves: null,
          // taxas derivadas: e isso que responde "sequencia de 3 ou de 5 telas?"
          engagement_rate: reach && replies != null ? +((replies / reach) * 100).toFixed(3) : null,
          metrics: {
            ...data,
            media_type: s.media_type,
            caption: s.caption || null,
            collected_at: stamp,
            derived: {
              exit_rate: reach && exits != null ? +((exits / reach) * 100).toFixed(3) : null,
              tap_back_rate: reach && back != null ? +((back / reach) * 100).toFixed(3) : null,
              tap_forward_rate: reach && fwd != null ? +((fwd / reach) * 100).toFixed(3) : null,
              reply_rate: reach && replies != null ? +((replies / reach) * 100).toFixed(3) : null,
              // % da base alcancada precisa de followers; o cockpit cruza depois
            },
          },
        });
        console.log(`  ${acc.handle} ${s.id}: reach=${reach} views=${views} replies=${replies} fwd=${fwd} back=${back} exit=${exits}`);
      } catch (e) {
        console.error(`  ERRO insight ${s.id}: ${e.message}`);
      }
    }

    if (acceptedMetrics) {
      console.log(`  metricas aceitas pela API: ${acceptedMetrics.join(', ')}`);
      if (rejectedMetrics.length) {
        console.log(`  recusadas: ${rejectedMetrics.map((r) => r.metric).join(', ')}`);
      }
    }

    if (!dryRun && posts.length) {
      await writeMetrics({
        client_slug: acc.client_slug,
        platform: 'instagram',
        account_handle: acc.handle,
        source: 'collect-story-insights',
        posts,
      });
      console.log(`  gravado: ${posts.length} story(s) em ct_metrics_snapshots`);
    }

    report.push({
      handle: acc.handle,
      status: 'ok',
      stories: stories.length,
      gravadas: dryRun ? 0 : posts.length,
      metricas_aceitas: acceptedMetrics,
    });
  }

  console.log('\n=== RESUMO ===');
  console.table(report);
  const falhou = report.some((r) => r.status === 'erro' || r.status === 'sem-credencial');
  process.exit(falhou ? 1 : 0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
