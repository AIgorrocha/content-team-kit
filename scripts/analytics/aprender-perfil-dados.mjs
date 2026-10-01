#!/usr/bin/env node
/**
 * aprender-perfil-dados.mjs - FATOS do dia para o aprendizado do perfil (sem IA, somente leitura).
 *
 * Alimenta a skill ct-aprender-perfil (aprendizado diario do perfil). Junta, por marca:
 *   - posts do dia (feed/reel/carrossel) com legenda, tipo, horario, metricas [MEDIDO] e
 *     comparacao com a mediana do mesmo formato nos ultimos 30 dias;
 *   - se o post foi feito a mao (nao existe em ct_content_items);
 *   - stories do dia (leitura editorial do verify-daily-stories + engajamento);
 *   - top 5 e piores 5 dos 30 dias (relativos a mediana do formato);
 *   - reels de teste (trial reels, publicados so para nao seguidores): grupo proprio, fora das
 *     medianas e rankings do feed normal, com a comparacao de cada par normal x teste;
 *   - legendas dos ultimos 14 dias com fatos objetivos (tamanho, emojis, hashtags, pergunta).
 *
 * De onde vem cada dado (esquema real, 01/out/2026):
 *   - metricas de post: ct_metrics_snapshots (grain=post, platform=instagram), 1 linha por
 *     post por dia de coleta (ig-daily-snapshot). Aqui vale a ULTIMA coleta de cada post_id.
 *   - legenda: NAO fica em ct_metrics_snapshots (so nas linhas legadas VIDEO e nos stories).
 *     Vem da Graph API (/media, somente leitura) ou, sem token, de ct_content_items.caption.
 *   - peca feita pelo time: ct_content_items.publish_url / published_at. Post fora dali = a mao.
 *   - reel de teste (trial): metadata.trial do ct_content_items; is_shared_to_feed=false da Graph API;
 *     por ultimo, par de reels com a mesma legenda em ate 24h (o de menor alcance e o teste).
 *   - story: linha `__storyverify__:ID` (editorial) + linha crua ID (metrica de collect-story-insights).
 *
 * Somente leitura: so GET no Supabase REST e na Graph API. Nunca grava, nunca publica, nunca
 * manda Telegram. Credencial ausente NUNCA e erro fatal: a parte fica vazia e entra em AVISOS.
 * Nunca imprime token.
 *
 * Contas: skills/_shared/ig-accounts.cjs (slot principal e slot business da marca ativa).
 *
 * Uso:
 *   node scripts/analytics/aprender-perfil-dados.mjs [--cliente slug-da-marca|todos]
 *     [--dias 1] [--base 30] [--legendas 14] [--json]
 */

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveClient } from '../_lib/workspace-client.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

const DIA_MS = 86400000;
const MATURIDADE_DIAS = 2; // post com menos de 2 dias tem alcance parcial: fora de base/ranking

// ---------------------------------------------------------------------------
// Puras (testadas em aprender-perfil-dados.test.mjs, sem rede)
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const a = { cliente: 'todos', dias: 1, base: 30, legendas: 14, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cliente') a.cliente = argv[++i];
    else if (argv[i] === '--dias') a.dias = Number(argv[++i]);
    else if (argv[i] === '--base') a.base = Number(argv[++i]);
    else if (argv[i] === '--legendas') a.legendas = Number(argv[++i]);
    else if (argv[i] === '--json') a.json = true;
  }
  for (const k of ['dias', 'base', 'legendas']) if (!Number.isFinite(a[k]) || a[k] < 1) a[k] = { dias: 1, base: 30, legendas: 14 }[k];
  return a;
}

export function mediana(valores) {
  const v = valores.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function dataBRT(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
export function horaBRT(iso) {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
  return p.replace(',', '');
}

/** Inicio (00:00 BRT, UTC-3 fixo) do dia que esta `dias-1` dias antes de hoje (BRT). */
export function inicioJanela(agora, dias) {
  const hoje = dataBRT(agora);
  const d = new Date(`${hoje}T12:00:00Z`).getTime() - (dias - 1) * DIA_MS;
  return new Date(`${new Date(d).toISOString().slice(0, 10)}T00:00:00-03:00`);
}

export function formato(postType, mediaProductType) {
  const t = String(postType || '').toLowerCase();
  const m = String(mediaProductType || '').toUpperCase();
  if (m === 'REELS' || t === 'reel') return 'reel';
  if (t.includes('carousel')) return 'carrossel';
  if (t === 'image') return 'imagem';
  if (t === 'video') return 'video';
  return t || 'outro';
}

export function shortcode(url) {
  const m = /instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(String(url || ''));
  return m ? m[1] : null;
}

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const maxNum = (...v) => { const n = v.map(num).filter((x) => x !== null); return n.length ? Math.max(...n) : null; };

/** Fatos objetivos de uma legenda (sem interpretar). */
export function fatosLegenda(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const semTags = t.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
  return {
    chars: t.length,
    linhas: linhas.length,
    hashtags: (t.match(/#[\p{L}\p{N}_]+/gu) || []).length,
    emojis: (t.match(/\p{Extended_Pictographic}/gu) || []).length,
    primeira_linha: (linhas[0] || '').slice(0, 140),
    fecha_com_pergunta: /\?\s*$/.test(semTags),
    ultima_linha: (semTags.split('\n').map((l) => l.trim()).filter(Boolean).pop() || '').slice(0, 140),
  };
}

/** Ultima coleta de cada post_id; campo nulo na ultima coleta herda da anterior (ex.: legenda). */
export function ultimoPorPost(linhas) {
  const ord = [...linhas].sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  const mapa = new Map();
  for (const l of ord) {
    const atual = mapa.get(l.post_id) || {};
    for (const [k, v] of Object.entries(l)) if (v !== null && v !== undefined) atual[k] = v;
    mapa.set(l.post_id, atual);
  }
  return [...mapa.values()];
}

/**
 * Monta a lista unica de posts. Fontes: snapshots (metricas), graph (legenda, horario real,
 * curtidas/comentarios do dia), itens (ct_content_items, pra saber se foi a mao).
 * itens === null significa "banco indisponivel": manual fica null (desconhecido), nunca chutado.
 */
export function montarPosts({ snapshots = [], graph = [], itens = null }) {
  const porId = new Map();
  for (const s of ultimoPorPost(snapshots)) {
    porId.set(String(s.post_id), {
      id: String(s.post_id), url: s.post_url || null, publicado_em: s.published_at || null,
      formato: formato(s.post_type, s.mpt), legenda: s.caption || null,
      alcance: num(s.reach), views: num(s.views), curtidas: num(s.likes), comentarios: num(s.comments),
      compart: num(s.shares), salvos: num(s.saves), fonte: 'snapshot',
    });
  }
  for (const g of graph) {
    const id = String(g.id);
    const base = porId.get(id) || { id, alcance: null, views: null, compart: null, salvos: null, fonte: 'graph' };
    porId.set(id, {
      ...base,
      url: g.permalink || base.url || null,
      publicado_em: g.timestamp || base.publicado_em || null,
      formato: formato(({ CAROUSEL_ALBUM: 'carousel', IMAGE: 'image', VIDEO: 'video' })[g.media_type] || g.media_type, g.media_product_type),
      legenda: g.caption ?? base.legenda ?? null,
      curtidas: base.curtidas ?? num(g.like_count),
      comentarios: base.comentarios ?? num(g.comments_count),
      trial_graph: g.is_shared_to_feed === false,
      alcance: base.alcance ?? num(g.reach),
      compart: base.compart ?? num(g.shares),
      salvos: base.salvos ?? num(g.saved),
    });
  }

  const codigosItens = itens ? new Set(itens.map((i) => shortcode(i.publish_url)).filter(Boolean)) : null;
  // Horario so vale para item SEM link (com link, o codigo do post decide).
  const temposItens = itens ? itens.filter((i) => !shortcode(i.publish_url)).map((i) => (i.published_at ? new Date(i.published_at).getTime() : null)).filter(Boolean) : null;
  const legendaPorCodigo = new Map();
  const trialPorCodigo = new Set();
  if (itens) for (const i of itens) { const c = shortcode(i.publish_url); if (c && i.caption) legendaPorCodigo.set(c, i.caption); if (c && i.metadata?.trial) trialPorCodigo.add(c); }

  const posts = [...porId.values()].map((p) => {
    const cod = shortcode(p.url);
    let manual = null;
    if (itens) {
      const t = p.publicado_em ? new Date(p.publicado_em).getTime() : null;
      const porTempo = t != null && temposItens.some((x) => Math.abs(x - t) <= 30 * 60000);
      manual = !((cod && codigosItens.has(cod)) || porTempo);
    }
    const legenda = p.legenda || (cod && legendaPorCodigo.get(cod)) || null;
    const inter = [p.curtidas, p.comentarios, p.compart, p.salvos].some((x) => x != null)
      ? (p.curtidas || 0) + (p.comentarios || 0) + (p.compart || 0) + (p.salvos || 0) : null;
    const taxa = inter != null && p.alcance ? Number(((inter / p.alcance) * 100).toFixed(2)) : null;
    const { trial_graph: viaGraph, ...resto } = p;
    const viaRegistro = !!(cod && trialPorCodigo.has(cod));
    const trial = viaRegistro || !!viaGraph;
    return { ...resto, legenda, manual, interacoes: inter, taxa, trial, trial_origem: trial ? (viaRegistro ? 'registro' : 'graph') : null };
  });
  return marcarTrials(posts.filter((p) => p.publicado_em).sort((a, b) => b.publicado_em.localeCompare(a.publicado_em)));
}

/**
 * Reel de teste (trial reel) e a copia do reel publicada so para nao seguidores. O fluxo padrao
 * publica todo reel duas vezes: o normal e o teste. Deteccao, nesta ordem: ja marcado (registro ou
 * Graph, ver montarPosts); por ultimo o par de reels com a mesma legenda em ate 24h, em que o de
 * menor alcance e o teste. Cada teste guarda `par_de` (o reel normal). Os testes saem de medianas e
 * rankings do feed normal e ganham grupo proprio em analisar().
 */
export function marcarTrials(posts) {
  const chave = (p) => String(p.legenda || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  const grupos = new Map();
  for (const p of posts) { const k = p.formato === 'reel' ? chave(p) : ''; if (k) (grupos.get(k) || grupos.set(k, []).get(k)).push(p); }
  for (const lista of grupos.values()) {
    const ord = [...lista].sort((x, y) => x.publicado_em.localeCompare(y.publicado_em));
    let cluster = [];
    const fecha = () => {
      const normais = cluster.filter((p) => !p.trial);
      if (cluster.length > 1 && normais.length) {
        const normal = normais.reduce((m, p) => ((p.alcance ?? -1) > (m.alcance ?? -1) ? p : m));
        for (const p of normais) if (p !== normal) { p.trial = true; p.trial_origem = 'legenda'; }
        for (const p of cluster) if (p.trial) p.par_de = normal.url || normal.id;
      }
      cluster = [];
    };
    for (const p of ord) {
      const ult = cluster[cluster.length - 1];
      if (ult && new Date(p.publicado_em) - new Date(ult.publicado_em) > DIA_MS) fecha();
      cluster.push(p);
    }
    fecha();
  }
  return posts;
}

/** Mediana de alcance e taxa por formato (e geral) so com posts maduros dentro da base. */
export function medianasBase(posts, { inicioBase, fimBase }) {
  const noBase = posts.filter((p) => {
    const t = new Date(p.publicado_em).getTime();
    return t >= inicioBase.getTime() && t < fimBase.getTime() && p.alcance != null;
  });
  const arred = (x) => (x == null ? null : Number(x.toFixed(2)));
  const por = (lista) => ({ n: lista.length, alcance: mediana(lista.map((p) => p.alcance)), taxa: arred(mediana(lista.map((p) => p.taxa))) });
  const resultado = { geral: por(noBase) };
  for (const f of new Set(noBase.map((p) => p.formato))) resultado[f] = por(noBase.filter((p) => p.formato === f));
  return resultado;
}

/** Referencia do formato (n>=3) ou, sem amostra, a geral. */
export function referencia(medianas, fmt) {
  const f = medianas[fmt];
  if (f && f.n >= 3 && f.alcance) return { ...f, escopo: fmt };
  return { ...medianas.geral, escopo: 'geral' };
}

export function comparar(post, medianas) {
  const ref = referencia(medianas, post.formato);
  const razao = post.alcance != null && ref.alcance ? Number((post.alcance / ref.alcance).toFixed(2)) : null;
  return { ref_escopo: ref.escopo, ref_n: ref.n, ref_alcance: ref.alcance, ref_taxa: ref.taxa, vs_mediana_alcance: razao };
}

export function resumirStories(linhasStory, linhasEditorial) {
  const mapa = new Map();
  const pega = (id) => { if (!mapa.has(id)) mapa.set(id, { id }); return mapa.get(id); };
  for (const e of ultimoPorPost(linhasEditorial)) {
    const id = String(e.post_id).replace('__storyverify__:', '');
    const m = e.metrics || {};
    Object.assign(pega(id), {
      publicado_em: e.published_at, url: e.post_url || null, tipo: m.tipo ?? null, tema: m.tema ?? null,
      gancho: m.gancho ?? null, overlay: m.overlay_text ?? null, midia: m.media_type ?? null,
      alcance: num(e.reach), views: num(e.views), respostas: num(e.comments), editorial: true,
    });
  }
  for (const r of ultimoPorPost(linhasStory)) {
    const s = pega(String(r.post_id));
    const m = r.metrics || {};
    s.publicado_em = s.publicado_em || r.published_at;
    s.midia = s.midia || m.media_type || null;
    s.alcance = maxNum(s.alcance, r.reach);
    s.views = maxNum(s.views, r.views);
    s.respostas = maxNum(s.respostas, m.replies, r.comments);
    s.legenda = m.caption || null;
  }
  return [...mapa.values()].filter((s) => s.publicado_em).sort((a, b) => a.publicado_em.localeCompare(b.publicado_em));
}

export function storiesPorTipo(stories) {
  const por = {};
  for (const s of stories) (por[s.tipo || 'sem-leitura'] ||= []).push(s);
  return Object.entries(por).map(([tipo, l]) => ({
    tipo, n: l.length, mediana_views: mediana(l.map((s) => s.views)), mediana_alcance: mediana(l.map((s) => s.alcance)),
    respostas: l.reduce((t, s) => t + (s.respostas || 0), 0),
  })).sort((a, b) => b.n - a.n);
}

export function analisar({ posts, stories = [], agora = new Date(), dias = 1, base = 30, legendas = 14 }) {
  const todos = posts;
  const trials = posts.filter((p) => p.trial);
  posts = posts.filter((p) => !p.trial); // medianas, rankings e legendas do feed normal so com post normal
  const iniJanela = inicioJanela(agora, dias);
  const iniBase = new Date(agora.getTime() - base * DIA_MS);
  const fimBase = new Date(Math.min(iniJanela.getTime(), agora.getTime() - MATURIDADE_DIAS * DIA_MS));
  const medianas = medianasBase(posts, { inicioBase: iniBase, fimBase });
  const t = (p) => new Date(p.publicado_em).getTime();

  const trialsBase = trials.filter((p) => t(p) >= iniBase.getTime() && t(p) <= agora.getTime() - MATURIDADE_DIAS * DIA_MS && p.alcance != null);
  const medTrial = { n: trialsBase.length, alcance: mediana(trialsBase.map((p) => p.alcance)), taxa: null };
  const comp = (p) => (p.trial ? { ...comparar(p, { geral: medTrial }), ref_escopo: 'trial' } : comparar(p, medianas));
  const porUrl = new Map(posts.map((p) => [p.url || p.id, p]));
  const pares = trialsBase.map((p) => ({ p, normal: porUrl.get(p.par_de) }))
    .filter((x) => x.normal && x.normal.alcance != null)
    .map(({ p, normal }) => ({ legenda: p.legenda, publicado_em: p.publicado_em, url: p.url, trial_alcance: p.alcance, normal_url: normal.url, normal_alcance: normal.alcance, razao_trial_normal: normal.alcance ? Number((p.alcance / normal.alcance).toFixed(2)) : null }));

  const doDia = todos.filter((p) => t(p) >= iniJanela.getTime() && t(p) <= agora.getTime())
    .map((p) => ({ ...p, ...comp(p), parcial: t(p) > agora.getTime() - MATURIDADE_DIAS * DIA_MS }));

  const maduros = posts.filter((p) => t(p) >= iniBase.getTime() && t(p) <= agora.getTime() - MATURIDADE_DIAS * DIA_MS && p.alcance != null)
    .map((p) => ({ ...p, ...comparar(p, medianas) })).filter((p) => p.vs_mediana_alcance != null);
  const ordenados = [...maduros].sort((a, b) => b.vs_mediana_alcance - a.vs_mediana_alcance);

  const iniLeg = agora.getTime() - legendas * DIA_MS;
  const legendas14 = posts.filter((p) => t(p) >= iniLeg && p.legenda)
    .map((p) => ({ ...p, ...comparar(p, medianas), fatos: fatosLegenda(p.legenda) }));

  const storiesJanela = stories.filter((s) => new Date(s.publicado_em).getTime() >= iniJanela.getTime());
  return {
    janela: { desde: iniJanela.toISOString(), ate: agora.toISOString(), dias, base },
    medianas,
    posts_do_dia: doDia,
    stories_do_dia: storiesJanela,
    stories_por_tipo_base: storiesPorTipo(stories),
    trials: { n: trialsBase.length, mediana_alcance: medTrial.alcance, pares },
    top5: ordenados.slice(0, 5),
    piores5: ordenados.slice(5).slice(-5).reverse(), // nunca repete quem ja esta no top 5
    legendas: legendas14,
    total_posts_base: maduros.length,
    trials_fora_do_feed: trials.length,
  };
}

const cort = (s, n) => { const x = String(s ?? '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}...` : x; };
const pct = (r) => (r == null ? 'sem mediana' : `${r >= 1 ? '+' : ''}${Math.round((r - 1) * 100)}% vs mediana`);

function linhaPost(p, comLegenda = true) {
  const met = [
    p.alcance != null ? `alcance ${p.alcance}` : 'alcance n/d',
    p.views != null ? `views ${p.views}` : null,
    p.curtidas != null ? `curtidas ${p.curtidas}` : null,
    p.comentarios != null ? `coment ${p.comentarios}` : null,
    p.compart != null ? `compart ${p.compart}` : null,
    p.salvos != null ? `salvos ${p.salvos}` : null,
    p.taxa != null ? `taxa ${p.taxa}%` : null,
  ].filter(Boolean).join(', ');
  const ref = p.ref_alcance != null ? ` (mediana ${p.ref_escopo} ${Math.round(p.ref_alcance)} em ${p.ref_n} posts: ${pct(p.vs_mediana_alcance)})` : '';
  const origem = p.manual === true ? 'A MAO' : p.manual === false ? 'time' : 'origem n/d';
  const parcial = (p.parcial ? ' [PARCIAL, post recente]' : '') + (p.trial ? ' [REEL DE TESTE (trial), so nao seguidores, fora das medianas do feed]' : '');
  return `- ${horaBRT(p.publicado_em)} ${p.formato} | ${origem} | ${met}${ref}${parcial}${comLegenda && p.legenda ? `\n    legenda: "${cort(p.legenda, 220)}"` : ''}${p.url ? `\n    ${p.url}` : ''}`;
}

export function formatarTexto(marcas) {
  const out = [];
  for (const m of marcas) {
    const r = m.resultado;
    out.push(`=== ${m.slug} (${m.handle || 's/handle'}) | janela ${r ? `${dataBRT(r.janela.desde)} a ${dataBRT(r.janela.ate)}, base ${r.janela.base}d` : '-'} ===`);
    for (const a of m.avisos || []) out.push(`AVISO: ${a}`);
    if (!r) { out.push(''); continue; }
    out.push(`MEDIANAS [MEDIDO] (posts maduros, alcance/taxa): ${Object.entries(r.medianas).map(([k, v]) => `${k} n=${v.n} alc=${v.alcance ?? '-'} taxa=${v.taxa ?? '-'}%`).join(' | ')}`);
    if (r.trials_fora_do_feed) out.push(`NOTA: ${r.trials_fora_do_feed} reel(s) de teste (trial) fora das medianas, rankings e legendas do feed normal; tem grupo proprio abaixo`);
    out.push(`\nPOSTS DO DIA (${r.posts_do_dia.length})`);
    out.push(r.posts_do_dia.length ? r.posts_do_dia.map((p) => linhaPost(p)).join('\n') : '- nenhum post de feed/reel/carrossel na janela');
    out.push(`\nSTORIES DO DIA (${r.stories_do_dia.length})`);
    out.push(r.stories_do_dia.length ? r.stories_do_dia.map((s) => `- ${horaBRT(s.publicado_em)} ${s.midia || ''} | tipo ${s.tipo || 'sem leitura'} | tema "${cort(s.tema, 70)}" | gancho "${cort(s.gancho, 50)}" | alcance ${s.alcance ?? 'n/d'}, views ${s.views ?? 'n/d'}, respostas ${s.respostas ?? 'n/d'}`).join('\n') : '- nenhum story registrado na janela');
    if (r.stories_por_tipo_base.length) out.push(`STORIES por tipo na base [MEDIDO]: ${r.stories_por_tipo_base.map((t) => `${t.tipo} n=${t.n} views~${t.mediana_views ?? '-'} resp=${t.respostas}`).join(' | ')}`);
    out.push(`\nREELS DE TESTE (trial) na base [MEDIDO]: ${r.trials.n} com alcance medido, mediana de alcance ${r.trials.mediana_alcance ?? 'sem dado'} (so nao seguidores, nao se compara com o alcance do feed normal)`);
    out.push(r.trials.pares.length ? r.trials.pares.map((x) => `- par normal x teste: normal ${x.normal_alcance}, teste ${x.trial_alcance} (teste/normal ${x.razao_trial_normal ?? 'n/d'}) | "${cort(x.legenda, 80)}"${x.url ? `\n    ${x.url}` : ''}`).join('\n') : '- nenhum par normal x teste com alcance medido');
    out.push(`\nTOP 5 DOS ${r.janela.base} DIAS (relativo a mediana do formato, ${r.total_posts_base} posts maduros)`);
    out.push(r.top5.length ? r.top5.map((p) => linhaPost(p)).join('\n') : '- sem dado');
    out.push(`\nPIORES 5 DOS ${r.janela.base} DIAS`);
    out.push(r.piores5.length ? r.piores5.map((p) => linhaPost(p)).join('\n') : '- sem dado');
    out.push(`\nLEGENDAS (${r.legendas.length}), fatos objetivos`);
    out.push(r.legendas.length ? r.legendas.map((p) => {
      const f = p.fatos;
      return `- ${horaBRT(p.publicado_em)} ${p.formato} | ${p.manual === true ? 'A MAO' : p.manual === false ? 'time' : 'origem n/d'} | ${f.chars} chars, ${f.linhas} linhas, ${f.hashtags} hashtags, ${f.emojis} emojis, ${f.fecha_com_pergunta ? 'fecha com pergunta' : 'fecha sem pergunta'} | ${pct(p.vs_mediana_alcance)}\n    "${cort(p.legenda, 600)}"`;
    }).join('\n') : '- sem legenda disponivel');
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// IO (somente leitura). Cada coletor devolve { dados, aviso } e nunca joga.
// ---------------------------------------------------------------------------

function carregarEnv() {
  const dotenv = require('dotenv');
  const caminhos = [process.env.DOTENV_CONFIG_PATH, path.join(REPO, '.env.local'), path.join(REPO, '.env')].filter(Boolean);
  for (const p of caminhos) if (fs.existsSync(p)) dotenv.config({ path: p, quiet: true });
}

async function rest(tabela, params) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { dados: null, aviso: 'banco: SUPABASE_URL/SERVICE_ROLE_KEY ausentes' };
  const linhas = [];
  try {
    for (let pagina = 0; pagina < 8; pagina++) {
      const q = new URLSearchParams({ ...params, limit: '1000', offset: String(pagina * 1000) });
      const res = await fetch(`${url}/rest/v1/${tabela}?${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) return { dados: linhas.length ? linhas : null, aviso: `banco: ${tabela} respondeu HTTP ${res.status}` };
      const lote = await res.json();
      linhas.push(...lote);
      if (lote.length < 1000) break;
    }
    return { dados: linhas, aviso: null };
  } catch (e) {
    return { dados: null, aviso: `banco: ${tabela} indisponivel (${String(e.message).slice(0, 60)})` };
  }
}

const apiBase = (t) => (String(t).startsWith('IGAA') ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v21.0');

async function graphGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.code ? `Graph codigo ${j.error.code}` : `HTTP ${res.status}`);
  return j;
}

async function lerGraph(conta, desde) {
  const igDireto = String(conta.token).startsWith('IGAA');
  if (!conta.token || (!igDireto && !conta.userId)) return { dados: [], aviso: 'instagram: credencial ausente, legenda so do banco' };
  const base = apiBase(conta.token);
  const no = igDireto ? 'me' : conta.userId;
  const campos = 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,is_shared_to_feed';
  const itens = [];
  try {
    let prox = `${base}/${no}/media?fields=${campos}&limit=50`;
    for (let pagina = 0; prox && pagina < 6; pagina++) {
      if (new URL(prox).origin !== new URL(base).origin) break;
      const u = new URL(prox); u.searchParams.delete('access_token');
      const j = await graphGet(conta.token, u.href);
      for (const m of j.data || []) if (new Date(m.timestamp) >= desde) itens.push(m);
      const ult = j.data?.[j.data.length - 1]?.timestamp;
      prox = ult && new Date(ult) >= desde ? j.paging?.next || null : null;
    }
    return { dados: itens, aviso: null };
  } catch (e) {
    return { dados: itens, aviso: `instagram: Graph API falhou (${e.message})` };
  }
}

/** Alcance/salvos/compartilhamentos de post ainda sem coleta do snapshot (post de hoje). */
async function completarInsights(conta, graph, idsComSnapshot) {
  const base = apiBase(conta.token);
  for (const g of graph) {
    if (idsComSnapshot.has(String(g.id))) continue;
    try {
      const j = await graphGet(conta.token, `${base}/${g.id}/insights?metric=reach,saved,shares`);
      for (const m of j.data || []) {
        const v = m.values?.[0]?.value ?? m.total_value?.value;
        if (m.name === 'reach') g.reach = v; else if (m.name === 'saved') g.saved = v; else if (m.name === 'shares') g.shares = v;
      }
    } catch { /* sem insight ainda: o post entra com alcance n/d */ }
  }
}

async function coletarMarca(slug, contas, args, agora) {
  const avisos = [];
  const desde = new Date(agora.getTime() - Math.max(args.base, args.legendas) * DIA_MS);
  const desdeIso = desde.toISOString();

  const snap = await rest('ct_metrics_snapshots', {
    client_slug: `eq.${slug}`, platform: 'eq.instagram', grain: 'eq.post',
    post_type: 'not.in.(story,story_editorial)', published_at: `gte.${desdeIso}`,
    select: 'post_id,post_url,post_type,published_at,snapshot_date,reach,likes,comments,shares,saves,views,caption:metrics->>caption,mpt:metrics->>media_product_type',
  });
  if (snap.aviso) avisos.push(snap.aviso);

  const itens = await rest('ct_content_items', {
    client_slug: `eq.${slug}`, status: 'eq.published', published_at: `gte.${desdeIso}`,
    select: 'publish_url,published_at,caption,platform,metadata',
  });
  if (itens.aviso) avisos.push(itens.aviso);

  const st = await rest('ct_metrics_snapshots', {
    client_slug: `eq.${slug}`, platform: 'eq.instagram', grain: 'eq.post',
    post_type: 'in.(story,story_editorial)', published_at: `gte.${desdeIso}`,
    select: 'post_id,post_url,post_type,published_at,snapshot_date,reach,views,comments,metrics',
  });
  if (st.aviso) avisos.push(st.aviso);

  let graph = [];
  if (contas.length) {
    const ids = new Set((snap.dados || []).map((s) => String(s.post_id)));
    for (const conta of contas) {
      const g = await lerGraph(conta, desde);
      if (g.aviso) avisos.push(g.aviso);
      if (g.dados.length) await completarInsights(conta, g.dados, ids);
      graph.push(...g.dados);
    }
  } else {
    avisos.push('instagram: conta sem credencial configurada nesta instalacao');
  }

  // Instagram do ct_content_items: so o que foi pro Instagram (publish_url do instagram.com).
  const itensIg = itens.dados ? itens.dados.filter((i) => /instagram\.com/.test(i.publish_url || '')) : null;
  const posts = montarPosts({ snapshots: snap.dados || [], graph, itens: itensIg });
  const stories = st.dados
    ? resumirStories(st.dados.filter((r) => r.post_type === 'story'), st.dados.filter((r) => r.post_type === 'story_editorial'))
    : [];
  if (!snap.dados && !graph.length) avisos.push('sem dado de post nenhum (banco e Graph indisponiveis)');
  return { slug, handle: contas.map((c) => c.handle).filter(Boolean).join(' + ') || null, avisos: [...new Set(avisos)], resultado: analisar({ posts, stories, agora, dias: args.dias, base: args.base, legendas: args.legendas }) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  carregarEnv();
  let CLIENT_ACCOUNTS = {};
  try { ({ CLIENT_ACCOUNTS } = require(path.join(REPO, 'skills', '_shared', 'ig-accounts.cjs'))); } catch { /* sem client-defaults: marcas sem credencial */ }
  const contas = Object.values(CLIENT_ACCOUNTS).map((a) => ({ slug: a.clientSlug, handle: a.handle, ...a.creds() }));
  let ativa = null;
  try { ativa = resolveClient(); } catch { /* sem marca ativa */ }
  const slugs = args.cliente === 'todos' ? [...new Set(contas.length ? contas.map((c) => c.slug) : [ativa].filter(Boolean))] : [args.cliente];
  if (!slugs.length) { console.log('AVISO: nenhuma marca ativa (.workspace) nem conta do Instagram configurada'); return; }
  const agora = new Date();
  const marcas = [];
  for (const slug of slugs) {
    try { marcas.push(await coletarMarca(slug, contas.filter((c) => c.slug === slug), args, agora)); }
    catch (e) { marcas.push({ slug, handle: null, avisos: [`falha inesperada (${String(e.message).slice(0, 80)})`], resultado: null }); }
  }
  console.log(args.json ? JSON.stringify(marcas, null, 1) : formatarTexto(marcas));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('aprender-perfil-dados: falha', String(e.message).slice(0, 120)); process.exit(0); });
}
