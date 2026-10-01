#!/usr/bin/env node
/**
 * ct-plano-semanal: gera plano editorial semanal por cliente.
 *
 * Fluxo:
 *   1. Lê clients/{slug}/brand-profile.md + design-system.md (pilares + cadência)
 *   2. Consulta top posts de ct_research_posts no Supabase (últimos 14d, por plataforma)
 *   3. Cadência: secao "Preferências de formato" (linha "Ritmo:") do brand-profile; sem ela, o default neutro
 *   4. Gera markdown em content/{slug}/planejamento/{YYYY}-semana-{NN}.md
 *
 * Uso:
 *   node gerar.js --cliente {slug-do-cliente} --semana 18
 *   node gerar.js --cliente {slug-do-cliente} --dry-run
 */

const fs = require('fs');
const path = require('path');
// .env.local (privado) primeiro; .env depois (dotenv nao sobrescreve o que ja foi carregado)
require('dotenv').config({ quiet: true, path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ quiet: true, path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');
const { getClientDefaults } = require('../_shared/client-defaults/index.cjs');

// ---------- CLI parsing ----------
const args = process.argv.slice(2);
function arg(flag, def = null) {
  const i = args.indexOf(flag);
  if (i === -1) return def;
  return args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
}

const ROOT = path.resolve(__dirname, '../..');

// ---------- Clientes disponiveis (scan de clients/*, generico) ----------
function scanClients() {
  const dir = path.join(ROOT, 'clients');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_template')
    .filter((d) => fs.existsSync(path.join(dir, d.name, 'brand-profile.md')))
    .map((d) => d.name);
}
const CLIENT_SLUGS = scanClients();

const clienteArg = arg('--cliente', CLIENT_SLUGS[0] || null);
const semanaArg = arg('--semana');
const dryRun = !!arg('--dry-run');
const force = !!arg('--force');

// ---------- Config por cliente ----------
// Cadencia: brand-profile ("Ritmo:", ver parseCadencia) > skills/_shared/client-defaults/{slug}.cjs#planoSemanal
// (opcional, se existir) > default neutro (Instagram unico, cadencia conservadora, slots gerados
// por defaultSlots, pilares vindos de extractPilares(brandMd), ja usado abaixo em gerarPlano).
function defaultClientConfig(slug) {
  const defaults = getClientDefaults(slug);
  const d = defaults.planoSemanal || {};
  return {
    nome: defaults.displayName || slug,
    plataformas: d.plataformas || ['instagram'],
    cadencia: d.cadencia || { feeds: 2, stories: 3, reels: 1 },
    slots: d.slots || [],
    pilares_default: d.pilares_default || [],
  };
}
const CLIENT_CONFIG = Object.fromEntries(CLIENT_SLUGS.map((slug) => [slug, defaultClientConfig(slug)]));

// ---------- Helpers ----------
function getIsoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function weekDates(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const isoMon = new Date(simple);
  if (dow <= 4) isoMon.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else isoMon.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  const sat = new Date(isoMon);
  sat.setUTCDate(isoMon.getUTCDate() + 5);
  return { start: isoMon, end: sat };
}

function fmt(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Le a linha "Ritmo:" do brand-profile (secao "Preferências de formato"). Exemplos:
//   "Ritmo: 3 peças por semana; quem aprova: ..."  -> feeds 3, reels 0
//   "Ritmo: 2 carrosséis, 1 reel, 4 stories"      -> feeds 2, reels 1, stories 4
// Sem a linha, ou com o modelo ainda nao preenchido ("[N]"), devolve null (o chamador usa o default).
function parseCadencia(md) {
  const linha = ((md || '').match(/^[-*\s]*Ritmo\s*:(.*)$/im) || [])[1];
  if (!linha) return null;
  const n = (re) => { const m = linha.match(re); return m ? parseInt(m[1], 10) : null; };
  const feeds = n(/(\d+)\s*(?:feeds?|posts?|carross[eé]is|carrossel)/i);
  const stories = n(/(\d+)\s*stor(?:y|ies)/i);
  const reels = n(/(\d+)\s*reels?/i);
  const total = n(/(\d+)\s*pe[çc]as?/i);
  if (feeds === null && stories === null && reels === null && total === null) return null;
  return {
    feeds: feeds ?? total ?? 2,
    stories: stories ?? 3,
    reels: reels ?? (total !== null ? 0 : 1),
  };
}

// Sem slots definidos, gera uma linha por peça do feed/reel; dia e horario vem do cockpit/ct-social-intel.
function defaultSlots(c) {
  const mk = (qtd, formato) => Array.from({ length: qtd || 0 }, () => ({ dia: 'a definir', horario: 'ver cockpit', plataforma: 'instagram', formato }));
  return [...mk(c.feeds, 'carrossel'), ...mk(c.reels, 'reel')];
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function extractPilares(brandMd) {
  if (!brandMd) return null;
  const m = brandMd.match(/pilares?[^\n]*\n([\s\S]*?)(?:\n##|$)/i);
  if (!m) return null;
  return m[1].split('\n').filter(l => l.trim().match(/^[-*\d]/)).map(l => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5);
}

// ---------- Supabase ----------
async function topPosts(supabase, plataforma, slugCliente, limite = 5) {
  const { data, error } = await supabase
    .from('ct_research_posts')
    .select('platform, author_name, author_handle, text, metrics, url, posted_at, run_id')
    .eq('platform', plataforma)
    .limit(200);
  if (error) { console.error(`[${plataforma}]`, error.message); return []; }

  const score = (p) => {
    const m = p.metrics || {};
    return (m.reactions || m.likes || m.favorites || 0) + (m.comments || m.replies || 0) * 2;
  };
  return (data || []).sort((a, b) => score(b) - score(a)).slice(0, limite).map(p => ({
    autor: p.author_name || p.author_handle,
    texto: (p.text || '').slice(0, 180).replace(/\n/g, ' '),
    score: score(p),
    url: p.url,
  }));
}

// ---------- Gerador ----------
async function gerarPlano(slug) {
  const cfg = CLIENT_CONFIG[slug];
  if (!cfg) throw new Error(`Cliente '${slug}' não configurado. Disponíveis: ${Object.keys(CLIENT_CONFIG).join(', ')}`);

  // 1. Brand
  const brandMd = readFileSafe(path.join(ROOT, 'clients', slug, 'brand-profile.md'));
  const pilares = extractPilares(brandMd) || cfg.pilares_default;
  const cadencia = parseCadencia(brandMd) || cfg.cadencia;
  const slots = cfg.slots.length ? cfg.slots : defaultSlots(cadencia);

  // 2. Semana
  const now = new Date();
  const autoWeek = getIsoWeek(new Date(now.getTime() + 7 * 24 * 3600 * 1000)); // próxima
  const year = autoWeek.year;
  const week = semanaArg ? parseInt(semanaArg, 10) : autoWeek.week;
  const { start, end } = weekDates(year, week);

  // 3. Top posts
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let insights = { mensagem: 'Supabase não configurado, pulou consulta.' };
  if (SUPABASE_URL && SUPABASE_KEY) {
    const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    insights = {};
    for (const plat of cfg.plataformas) {
      insights[plat] = await topPosts(supa, plat, slug, 5);
    }
  }

  // 4. Markdown
  let md = `# Plano Semana ${week}, ${cfg.nome} (${fmt(start)} a ${fmt(end)})\n\n`;
  md += `**Gerado em:** ${now.toISOString().slice(0, 10)}\n`;
  md += `**Cadência alvo:** ${cadencia.feeds} feeds + ${cadencia.stories} stories`;
  if (cadencia.reels) md += ` + ${cadencia.reels} reels`;
  if (cadencia.youtube) md += ` + ${cadencia.youtube} YT`;
  md += `\n\n## Pilares ativos\n`;
  pilares.forEach(p => md += `- ${p}\n`);

  md += `\n## Insights top posts (base ct_research_posts)\n`;
  if (insights.mensagem) {
    md += `> ${insights.mensagem}\n`;
  } else {
    for (const [plat, posts] of Object.entries(insights)) {
      md += `\n### ${plat}\n`;
      if (!posts.length) { md += `_sem dados_\n`; continue; }
      posts.forEach((p, i) => {
        md += `${i + 1}. **${p.autor}** (score ${p.score}): ${p.texto}...\n`;
      });
    }
  }

  md += `\n## Calendário\n\n| Dia | Horário | Plataforma | Formato | Tema sugerido | Hook | Agente |\n|-----|---------|------------|---------|---------------|------|--------|\n`;
  slots.forEach((s, i) => {
    const pilar = pilares[i % pilares.length] || 'a definir';
    md += `| ${s.dia} | ${s.horario} | ${s.plataforma} | ${s.formato} | ${pilar} | _preencher via ct-redator_ | ct-${s.formato === 'carrossel' ? 'carrossel' : s.formato === 'reel' ? 'video' : 'redator'} |\n`;
  });

  md += `\n## Ordem de produção recomendada\n\n`;
  slots.forEach((s, i) => md += `${i + 1}. Segunda manhã: produzir ${s.formato} de ${s.dia}\n`);

  md += `\n## Métricas a acompanhar\n\n- Reactions/likes por post (comparar com semana anterior)\n- Comments/saves (engajamento qualitativo)\n- Reach stories (base de audiência)\n- CTR quando houver link em bio/legenda\n\n---\n\n_Gerado por \`skills/ct-plano-semanal/gerar.js\`. Editar livremente antes de enviar pra ct-agenda/ct-redator._\n`;

  // 5. Gravar
  const outDir = path.join(ROOT, 'content', slug, 'planejamento');
  const outFile = path.join(outDir, `${year}-semana-${String(week).padStart(2, '0')}.md`);

  if (dryRun) {
    console.log(`\n===== DRY RUN: ${outFile} =====\n`);
    console.log(md);
    return { dry: true, slug, week, outFile };
  }

  if (fs.existsSync(outFile) && !force) {
    console.warn(`[${slug}] arquivo já existe: ${outFile}. Use --force pra sobrescrever.`);
    return { skipped: true, slug, week, outFile };
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, md, 'utf8');
  console.log(`[${slug}] plano gerado: ${outFile}`);
  return { slug, week, outFile };
}

// ---------- Main ----------
if (require.main === module) {
  (async () => {
    try {
      await gerarPlano(clienteArg);
    } catch (e) {
      console.error(`[${clienteArg}] erro:`, e.message);
      process.exitCode = 1;
    }
  })();
}

module.exports = { parseCadencia, defaultSlots };
