#!/usr/bin/env node
/**
 * briefing.js - Briefing semanal de conteudo por cliente (roda domingo no pipeline local).
 *
 * Cruza pendencias + drafts + ideias registradas + sinais do cockpit (best-time, formato
 * campeao, concorrente bombando, tendencia/repo) e sugere 3-5 PAUTAS na voz do cliente.
 * NAO produz o conteudo final (isso e on-demand via ct-diretor). Aqui = pauta pronta pra desenvolver.
 *
 * Fontes de ideia (as duas):
 *   - content/{cliente}/ideas.md   (uma ideia por linha, comeca com "- ")
 *   - ct_content_items status in (idea, draft)
 *   - content/content-schedule.json (pendentes nao publicados)
 *
 * Saida: content/{cliente}/briefing-semanal.md
 *
 * Uso: node skills/ct-social-cockpit/briefing.js [--client all|{slug-do-cliente}]
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { bestTimeRec } from '../_shared/best-time-gate.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');
const { getClientDefaults } = require('../_shared/client-defaults/index.cjs');

function scanClients() {
  const dir = path.join(REPO, 'clients');
  if (!existsSync(dir)) return [];
  return require('node:fs').readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_template')
    .filter((d) => existsSync(path.join(dir, d.name, 'brand-profile.md')))
    .map((d) => d.name);
}
const CLIENTS = scanClients();

// env
for (const f of ['.env', '.env.local']) {
  const p = path.join(REPO, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function parseArgs() {
  const a = { client: 'all' };
  const r = process.argv.slice(2);
  for (let i = 0; i < r.length; i++) if (r[i] === '--client') a.client = r[++i];
  return a;
}

// Falha aqui e RUIDOSA de proposito: antes retornava [] em qualquer erro e o briefing saia
// vazio sem ninguem perceber (podia ficar semanas congelado sem um unico erro visivel).
async function rest(pathQ) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY ausentes');
  const res = await fetch(`${url}/rest/v1/${pathQ}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function readIdeas(client) {
  const p = path.join(REPO, 'content', client, 'ideas.md');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter((l) => l && !l.startsWith('#'));
}

function readPending(client) {
  const p = path.join(REPO, 'content', 'content-schedule.json');
  if (!existsSync(p)) return [];
  try {
    const d = JSON.parse(readFileSync(p, 'utf8'));
    return (d.items || []).filter((x) => x.client === client && !x.published);
  } catch { return []; }
}

// Templates de pauta na VOZ do cliente (rotacionam por semana). Cada um vira angulo concreto.
// Pautas reais e proprias do cliente devem morar em clients/{slug}/brand-profile.md (secao
// "Pautas Semanais"); sem essa secao, cai no fallback generico abaixo.
function seedTemplates(client, weekIdx, signals) {
  const base = getClientDefaults(client).briefingTemplates || GENERIC_TEMPLATES;
  if (client === CLIENT_ACCOUNTS.principal?.clientSlug && signals.trends) {
    // Conta "principal": se houver sinal de tendencia do Twitter (trends-snapshot.js), a pauta
    // cruza com tema/repo em alta; completa com os templates da marca.
    const out = [];
    const repo = signals.trends?.top_repos?.[0];
    const theme = signals.trends?.by_keyword?.[0];
    if (theme) out.push({ title: `Pauta quente: ${theme.keyword}`, angle: `Tema bombando no Twitter (${theme.n} posts). Traduzir pro publico do cliente: o que e, por que importa, como usar sem ser tecnico.`, cta: 'Pergunta de operacao pro publico, ver regra de moderacao do cliente ativo.' });
    if (repo) out.push({ title: `Ferramenta em alta: ${repo.repo}`, angle: `Repo citado no Twitter. Mostrar caso pratico de uso pra automatizar algo do negocio. Reel demonstrativo.`, cta: 'Link na bio / salva esse.' });
    for (let i = 0; out.length < 3 && i < base.length; i++) out.push(base[(weekIdx + i) % base.length]);
    return out.slice(0, 3);
  }
  return [base[weekIdx % base.length], base[(weekIdx + 2) % base.length]];
}

const GENERIC_TEMPLATES = [
    { title: 'Entrega em destaque', angle: 'Mostrar um resultado entregue (antes/depois), traduzindo o ganho pro cliente final.', cta: 'Quer um resultado assim? Chama no direct.' },
    { title: 'Caso de sucesso / prova', angle: 'Numero real de um projeto ou cliente atendido: prova social concreta.', cta: 'Veja como aplicamos no seu caso.' },
    { title: 'Bastidor / situacao resolvida', angle: 'Um problema real que a equipe resolveu. Humaniza e mostra competencia.', cta: 'Tem esse problema? Conversa com a gente.' },
    { title: 'Conceito tecnico simplificado', angle: 'Explicar 1 conceito do setor do cliente em linguagem acessivel ao publico.', cta: 'Link na bio.' },
    { title: 'Solucao boa que aplicamos', angle: 'Uma decisao que economizou tempo/dinheiro do cliente final. Foco no resultado pratico.', cta: 'Quer esse tipo de ganho? Fala com a gente.' },
];

// Gate de amostra: n<20 devolve null e a pauta sai SEM sugestao de horario.
function bestFor(signals, platform) {
  return bestTimeRec(signals.best_time?.[platform]);
}

async function loadSignals(client, { rest: get = rest } = {}) {
  const bt = {};
  for (const pf of ['instagram', 'linkedin', 'youtube', 'tiktok']) {
    const r = await get(`ct_social_insights?client_slug=eq.${client}&platform=eq.${pf}&kind=eq.best_time&order=computed_at.desc&limit=1&select=payload`);
    if (r[0]) bt[pf] = r[0].payload;
  }
  const tr = await get(`ct_social_insights?client_slug=eq.${client}&platform=eq.twitter&kind=eq.trends&order=computed_at.desc&limit=1&select=payload`);
  const comps = await get(`ct_competitors?metadata->>client_slug=eq.${client}&select=id,handle`);
  let topComp = null;
  if (comps.length) {
    const ids = comps.map((c) => c.id).join(',');
    const posts = await get(`ct_competitor_posts?competitor_id=in.(${ids})&external_id=like.snap:*&select=competitor_id,content_preview,engagement&limit=100`);
    const byId = Object.fromEntries(comps.map((c) => [c.id, c.handle]));
    topComp = posts.map((p) => ({ handle: byId[p.competitor_id], text: p.content_preview, score: p.engagement?.score ?? 0 }))
      .sort((a, b) => b.score - a.score)[0] || null;
  }
  return { best_time: bt, trends: tr[0]?.payload || null, topComp };
}

async function buildClient(client) {
  const pending = readPending(client);
  const ideasFile = readIdeas(client);
  const items = await rest(`ct_content_items?client_slug=eq.${client}&status=in.(idea,draft)&select=title,content_type,status&limit=50`);
  const signals = await loadSignals(client);

  // semana do ano (rotaciona templates)
  const now = new Date();
  const weekIdx = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 6048e5);

  const L = [];
  L.push(`# Briefing semanal, ${client}`);
  L.push(`> ${now.toISOString().slice(0, 10)} · cruzado com o cockpit · pra desenvolver via ct-diretor ("desenvolve pauta N")`);
  L.push('');

  // 1. Pendencias
  L.push('## 1. Pendencias (terminar primeiro)');
  if (!pending.length && !items.length) L.push('- (nada pendente)');
  pending.forEach((p) => L.push(`- [ATRASADO ${p.date}] ${p.type}: ${p.title}`));
  items.forEach((it) => L.push(`- [${it.status}] ${it.content_type}: ${it.title}`));
  L.push('');

  // 2. Ideias registradas
  L.push('## 2. Ideias registradas (suas)');
  if (!ideasFile.length) L.push('- (vazio, registre em content/' + client + '/ideas.md, 1 por linha com "- ")');
  ideasFile.forEach((i) => L.push(`- ${i}`));
  L.push('');

  // 3. Pautas sugeridas
  L.push('## 3. Pautas sugeridas (cruzadas com dados)');
  const seeds = seedTemplates(client, weekIdx, signals);
  // Plataformas ativas do cliente: client-defaults/{slug}.cjs#planoSemanal.plataformas
  // (fora do kit); fallback neutro Instagram+LinkedIn quando o cliente nao tiver arquivo.
  const igPlat = (getClientDefaults(client).planoSemanal || {}).plataformas || ['instagram', 'linkedin'];
  seeds.forEach((s, i) => {
    // escolhe a rede com melhor formato/horario disponivel
    const recs = igPlat.map((pf) => ({ pf, b: bestFor(signals, pf) })).filter((x) => x.b);
    const rec = recs[0];
    L.push(`### Pauta ${i + 1}: ${s.title}`);
    L.push(`- Angulo: ${s.angle}`);
    if (rec) L.push(`- Sugestao: ${rec.pf} · formato ${rec.b.formato} · melhor ${rec.b.dia_hora} · base: ${rec.b.sample_size} posts`);
    else L.push('- Sugestao de horario: AMOSTRA INSUFICIENTE (n<20 em todas as redes). Nao ha melhor horario a recomendar.');
    L.push(`- CTA: ${s.cta}`);
    L.push(`- Desenvolver: diga "desenvolve pauta ${i + 1} do briefing ${client}" -> ct-diretor monta (carrossel/script/legenda).`);
    L.push('');
  });

  // 4. Concorrente / tendencia de apoio
  L.push('## 4. Sinais pra inspirar');
  if (signals.topComp) L.push(`- Concorrente bombando: @${signals.topComp.handle} (score ${signals.topComp.score}), "${(signals.topComp.text || '').slice(0, 90)}"`);
  if (signals.trends?.by_keyword?.length) L.push(`- Temas quentes (Twitter): ${signals.trends.by_keyword.slice(0, 5).map((k) => k.keyword).join(' · ')}`);
  if (signals.trends?.top_repos?.length) L.push(`- Repos: ${signals.trends.top_repos.slice(0, 4).map((r) => r.repo).join(' · ')}`);
  L.push('');
  L.push('---');
  L.push('_Gerado por ct-social-cockpit/briefing.js. Desenvolver = ct-diretor (com aprovacao)._');

  const dir = path.join(REPO, 'content', client);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'briefing-semanal.md'), L.join('\n'), 'utf8');
  console.log(`[${client}] briefing-semanal.md (${pending.length} pend, ${ideasFile.length + items.length} ideias, ${seeds.length} pautas)`);
  return { client, pendentes: pending.length, ideias: ideasFile.length + items.length, pautas: seeds.length };
}

export { loadSignals, seedTemplates };

// So roda quando chamado direto (node briefing.js), nao ao ser importado pelos testes.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  (async () => {
    const args = parseArgs();
    const targets = args.client === 'all' ? CLIENTS : [args.client];
    for (const c of targets) await buildClient(c);
    console.log('OK -> briefing-semanal.md');
  })().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
}
