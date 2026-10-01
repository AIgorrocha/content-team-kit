#!/usr/bin/env node
/**
 * social-intel-local.mjs - Pipeline semanal COMPLETO de inteligencia social, na sua maquina.
 *
 * Roda, para a marca ativa (.workspace ou CT_CLIENT): Instagram, YouTube, LinkedIn, TikTok,
 * posts salvos do Instagram, melhor horario, concorrentes, tendencias, cockpit e briefing.
 * Sessao ou token caido: abre o login para reconectar e tenta de novo (LinkedIn, TikTok,
 * YouTube, salvos). Instagram tem token manual: vira alerta.
 *
 * Regra de ouro: se o Instagram da marca nao gerou snapshot novo, a agregacao NAO roda e o
 * aviso diz para nao usar cockpit ou briefing antigos.
 *
 * Telegram e opcional: sem TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID o resumo so sai no terminal.
 * Agendar: Agendador de Tarefas do Windows (social-intel-local.cmd) ou cron (social-intel-weekly.sh).
 * Veja skills/ct-social-intel/SKILL.md.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const { parseInstagramRun } = require('./social-intel-status.cjs');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = path.join(REPO, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

function run(cmd, args, { timeout = 240000 } = {}) {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', timeout, shell: false });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
// options vem como ultimo argumento objeto (ex.: { timeout })
const node = (script, ...a) => {
  const opts = a.length && typeof a[a.length - 1] === 'object' ? a.pop() : {};
  return run('node', [script, ...a], opts);
};

// ---- marca ativa (.workspace > CT_CLIENT > active-client.md), via a mesma fonte das outras skills ----
function activeBrand() {
  const { CLIENT_ACCOUNTS } = require('../../skills/_shared/ig-accounts.cjs');
  const principal = CLIENT_ACCOUNTS.principal || CLIENT_ACCOUNTS.business || null;
  return {
    slug: principal ? principal.clientSlug : '',
    handle: principal ? principal.handle : '',
    accounts: CLIENT_ACCOUNTS,
  };
}

// ---- funcoes puras (testadas em social-intel-status.test.cjs) ----

export function formatInstagramSummary(parsed) {
  return `IG: ${parsed.snapshots} conta(s) com snapshot valido`;
}

export function competitorSnapshotArgs(client) {
  return ['--client', client, '--limit', '5'];
}

// nodeFn injetavel para teste. Coleta concorrentes so da marca ativa.
export function runCompetitorSnapshot(nodeFn = node, client = activeBrand().slug) {
  return nodeFn('skills/ct-social-cockpit/competitor-snapshot.js', ...competitorSnapshotArgs(client), { timeout: 300000 });
}

// Envio do resumo. Nunca imprime token nem texto de erro da API (pode conter segredo).
export async function telegram({
  instagramGatePassed,
  artifactsUpdated,
  summaryLines = [],
  failureLines = [],
  alertLines = [],
  token = process.env.TELEGRAM_BOT_TOKEN,
  chat = process.env.TELEGRAM_CHAT_ID,
  send = fetch,
  outputLog = console.log,
} = {}) {
  if (!token || !chat) return { state: 'skipped_no_credential', sent: false };

  let msg = `Social Intel (semanal)\n\n${summaryLines.join('\n')}`;
  if (failureLines.length) msg += `\n\nFALHOU:\n- ${failureLines.join('\n- ')}`;
  if (alertLines.length) msg += `\n\nRECONECTAR:\n- ${alertLines.join('\n- ')}`;
  if (instagramGatePassed && artifactsUpdated) {
    msg += '\n\nPainel atualizado: content/{cliente}/cockpit.md';
    msg += '\nBriefing atualizado: content/{cliente}/briefing-semanal.md (diga "desenvolve pauta N")';
  } else {
    msg += '\n\nNao use os arquivos anteriores de cockpit ou briefing.';
  }

  let res;
  try {
    res = await send(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ chat_id: chat, text: msg }),
    });
  } catch {
    throw new Error('Telegram entrega falhou');
  }
  const fail = () => new Error(`Telegram entrega falhou (HTTP ${res.status})`);
  if (!res.ok) throw fail();
  let payload;
  try { payload = await res.json(); } catch { throw fail(); }
  const id = payload && payload.result && payload.result.message_id;
  if (!payload || payload.ok !== true || !Number.isFinite(id) || id <= 0) throw fail();
  outputLog('Telegram enviado.');
  return { state: 'sent', sent: true };
}

// Orquestra os passos. `steps` e injetavel (teste). Cada passo e protegido: falha de um nao
// derruba os outros. A agregacao so roda se o Instagram da marca gerou snapshot novo.
export async function runPipeline({
  log = console.log,
  errorLog = console.error,
  setExitCode = (code) => { process.exitCode = code; },
  telegram: notifyOverride,
  steps,
  requiredHandle = activeBrand().handle,
} = {}) {
  const summary = [];
  const failures = [];
  const alerts = [];
  // Sem notificador injetado, manda o resumo real (as listas acima entram por referencia).
  const notify = notifyOverride || ((state) => telegram({ ...state, summaryLines: summary, failureLines: failures, alertLines: alerts }));
  const guarded = async (name, fn) => {
    try { return await fn({ summary, alerts, log }); } catch (e) {
      failures.push(`${name}: ${e.message}`);
      summary.push(`${name}: FALHOU (${e.message})`);
      return undefined;
    }
  };

  log(`== Social Intel LOCAL == ${new Date().toISOString()}`);
  const ig = await guarded('IG', (ctx) => steps.instagram({ ...ctx, requiredHandle }));
  for (const name of ['youtube', 'linkedIn', 'tikTok', 'savedInspiration', 'driveMiner']) {
    if (steps[name]) await guarded(name, steps[name]);
  }

  const instagramGatePassed = !!(ig && ig.requiredHandleOk);
  if (ig && ig.summary) summary.unshift(ig.summary);
  if (ig && ig.alerts) alerts.push(...ig.alerts);
  if (!instagramGatePassed) {
    failures.push(`IG @${String(requiredHandle).replace(/^@/, '')} nao produziu snapshot atualizado: agregacao (cockpit, briefing) nao rodou`);
  }

  let aggregationRan = false;
  let artifactsUpdated = false;
  if (instagramGatePassed) {
    aggregationRan = true;
    try {
      artifactsUpdated = (await steps.aggregate({ summary, failures, log })) === true;
      if (!artifactsUpdated) failures.push('Agregacao: artefatos nao foram atualizados');
    } catch (e) {
      failures.push(`Agregacao: ${e.message}`);
      summary.push(`Agregacao: FALHOU (${e.message})`);
    }
  }

  let notification;
  try {
    notification = await notify({ instagramGatePassed, artifactsUpdated });
  } catch {
    notification = { state: 'failed', sent: false };
  }
  if (notification.state === 'failed') failures.push('Telegram: entrega nao confirmada');

  log('\nResumo:\n' + summary.join('\n'));
  if (alerts.length) log('\nReconectar:\n- ' + alerts.join('\n- '));
  if (failures.length) errorLog('\nFALHAS:\n- ' + failures.join('\n- '));
  setExitCode(failures.length ? 1 : 0); // o Agendador de Tarefas mostra LastTaskResult != 0
  return { instagramGatePassed, aggregationRan, artifactsUpdated, failures, summary, alerts, notification };
}

// ---- passos reais (chamam os scripts das skills, para a marca ativa) ----

function realSteps() {
  const brand = activeBrand();
  const slug = brand.slug;

  const instagram = ({ requiredHandle }) => {
    const r = node('skills/ct-instagram-analyzer/analyze.js', '--account', 'all', '--limit', '30');
    const parsed = parseInstagramRun({ exitCode: r.code, output: r.out, requiredHandle });
    return { ...parsed, summary: formatInstagramSummary(parsed) };
  };

  const youtube = ({ summary, alerts, log }) => {
    if (!process.env.YOUTUBE_REFRESH_TOKEN) { summary.push('YouTube: sem credencial (pulado)'); return; }
    let r = node('skills/ct-youtube-analyzer/analyze.js', '--limit', '25');
    if (/invalid_grant/i.test(r.out)) {
      log('YouTube token caiu: abrindo o login no navegador...');
      const a = run('node', ['scripts/publishing/youtube-auth.mjs'], { timeout: 6 * 60000 });
      if (/TOKENS RECEBIDOS/i.test(a.out)) r = node('skills/ct-youtube-analyzer/analyze.js', '--limit', '25');
      else alerts.push('YouTube: reconexao falhou. Rode: node scripts/publishing/youtube-auth.mjs');
    }
    summary.push(`YouTube: ${/Snapshot: \d+ videos/i.test(r.out) ? 'ok' : 'falhou'}`);
  };

  const linkedIn = ({ summary, alerts, log }) => {
    const personal = brand.accounts.principal && brand.accounts.principal.linkedin && brand.accounts.principal.linkedin.handle;
    const org = process.env.LINKEDIN_ORG_ID;
    if (!personal && !org) { summary.push('LinkedIn: sem handle nem LINKEDIN_ORG_ID (pulado)'); return; }
    const count = (r) => parseInt((r.out.match(/\((\d+) posts\)/) || [])[1] || '0', 10);
    const scrape = () => ({
      p: personal ? count(node('skills/ct-linkedin-analyzer/scrape.js', 'personal', '--handle', personal, '--limit', '25')) : 0,
      c: org ? count(node('skills/ct-linkedin-analyzer/scrape.js', 'company', '--org', org, '--limit', '25')) : 0,
    });
    let { p, c } = scrape();
    if (p === 0 && c === 0) {
      log('LinkedIn sessao caiu: abrindo o login...');
      const lg = run('node', ['skills/ct-linkedin-analyzer/login-auto.js'], { timeout: 6 * 60000 });
      if (/LOGIN OK/i.test(lg.out)) ({ p, c } = scrape());
      else alerts.push('LinkedIn: login nao detectado. Rode: node skills/ct-linkedin-analyzer/login-auto.js');
    }
    summary.push(`LinkedIn: pessoal ${p} / pagina ${c}`);
  };

  const tikTok = ({ summary, alerts, log }) => {
    const handle = process.env.TIKTOK_HANDLE;
    if (!handle) { summary.push('TikTok: sem TIKTOK_HANDLE (pulado)'); return; }
    const scrape = () => node('skills/ct-tiktok-analyzer/scrape.js', 'profile', '--handle', handle, '--limit', '20', { timeout: 180000 });
    let r = scrape();
    let ok = /\(\d+ videos\)/.test(r.out) && !/Grid de videos nao carregou/i.test(r.out);
    if (!ok) {
      log('TikTok sessao caiu: abrindo o login...');
      const lg = run('node', ['skills/ct-tiktok-analyzer/login-auto.js'], { timeout: 6 * 60000 });
      if (/LOGIN OK/i.test(lg.out)) { r = scrape(); ok = /\(\d+ videos\)/.test(r.out); }
      else alerts.push('TikTok: login nao detectado. Rode: node skills/ct-tiktok-analyzer/login-auto.js');
    }
    const f = (r.out.match(/output[\\/]+tiktok-analyzer[\\/]+[^\s]+\.json/) || [])[0];
    if (ok && f) node('skills/ct-tiktok-analyzer/enrich.js', f.replace(/\\/g, '/'), { timeout: 180000 });
    summary.push(`TikTok: ${ok ? 'ok' : 'falhou'}`);
  };

  const savedInspiration = ({ summary, alerts, log }) => {
    for (const acc of Object.keys(brand.accounts)) {
      let r = node('skills/ct-ig-saved-inspiration/scrape.mjs', acc, '--limit', '60', '--watch-videos', { timeout: 420000 });
      if (/SESSION_EXPIRED/i.test(r.out) || r.code === 2) {
        log(`IG salvos (${acc}): sessao caiu, abrindo o login...`);
        const lg = run('node', ['skills/ct-ig-saved-inspiration/login-auto.mjs', acc], { timeout: 6 * 60000 });
        if (/LOGIN OK/i.test(lg.out)) r = node('skills/ct-ig-saved-inspiration/scrape.mjs', acc, '--limit', '60', '--watch-videos', { timeout: 420000 });
        else alerts.push(`IG salvos (${acc}): login nao detectado. Rode: node skills/ct-ig-saved-inspiration/login-auto.mjs ${acc}`);
      }
      const n = parseInt((r.out.match(/(\d+) novos salvos gravados/) || [])[1] || '0', 10);
      summary.push(`IG salvos (${acc}): ${n} novos`);
    }
    summary.push('Salvos: diga "analisa salvos" para o ct-pesquisador gerar insight e ideia');
  };

  // Retorna true so se cockpit e briefing de hoje existem.
  const aggregate = ({ summary, failures }) => {
    const before = failures.length;
    const must = (label, r) => {
      if (r.code !== 0) failures.push(`${label} saiu com exit ${r.code}: ${r.out.trim().split('\n').slice(-3).join(' | ')}`);
      return r;
    };
    must('compute.js', node('skills/ct-social-intel/compute.js', '--client', slug, '--platform', 'all', '--days', '90'));
    if (process.env.RAPIDAPI_KEY) runCompetitorSnapshot(node, slug);
    node('skills/ct-social-cockpit/trends-snapshot.js', '--days', '30');
    must('build.js', node('skills/ct-social-cockpit/build.js', '--client', slug));
    const j = must('join-check', node('scripts/checks/join-check.mjs', '--days', '30'));
    for (const m of j.out.matchAll(/^ - (\[.+)$/gm)) summary.push(`Join: ${m[1].split(' Se foi')[0]}`);
    const b = must('briefing.js', node('skills/ct-social-cockpit/briefing.js', '--client', slug));
    for (const m of b.out.matchAll(/\[([^\]]+)\] briefing-semanal\.md \((\d+) pend, (\d+) ideias, (\d+) pautas\)/g)) {
      summary.push(`Briefing ${m[1]}: ${m[2]} pend, ${m[3]} ideias, ${m[4]} pautas`);
    }
    for (const f of [`content/${slug}/cockpit.md`, `content/${slug}/briefing-semanal.md`]) {
      const p = path.join(REPO, f);
      if (!existsSync(p) || Date.now() - statSync(p).mtimeMs > 12 * 3600 * 1000) failures.push(`${f} nao foi regravado`);
    }
    return failures.length === before;
  };

  return { instagram, youtube, linkedIn, tikTok, savedInspiration, aggregate };
}

// So roda quando chamado direto (node scripts/infra/social-intel-local.mjs), nao ao ser importado.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  loadEnv();
  if (!activeBrand().slug) {
    console.error('Nao achei a marca ativa. Crie o arquivo .workspace com "client: {slug}" (veja clients/_template/).');
    process.exit(1);
  }
  if (!activeBrand().handle) {
    console.error('Falta o @ do Instagram da marca: defina IG_HANDLE no .env.local.');
    process.exit(1);
  }
  runPipeline({ steps: realSteps() });
}
