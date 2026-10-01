#!/usr/bin/env node
// post.js: le JSON adaptado e publica no Twitter via Playwright usando
// o perfil Chrome persistente da marca ativa (~/.playwright-x-{slug}, o mesmo do ct-twitter-research).
// Flags:
//   --dry-run       nao publica, so imprime o que faria
//   --limit N       quantos items processa (default 1 pra seguranca)
//   --file path     caminho explicito pro JSON adaptado (default: mais recente)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'output', 'republicar-twitter');
const { playwrightDir } = require('../_shared/playwright-profile.cjs');
const PROFILE_DIR = playwrightDir('x');
const HISTORY_PATH = path.join(OUT_DIR, 'posted-history.json');
// Handle da conta X do cliente ativo (sem @). Sem ele, o permalink nao e capturado automaticamente.
const X_HANDLE = (process.env.X_HANDLE || '').replace(/^@/, '');

function parseArgs(argv) {
  const args = { dryRun: false, limit: 1, file: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--dry-run') args.dryRun = true;
    else if (k === '--limit') args.limit = parseInt(rest[++i], 10);
    else if (k === '--file') args.file = rest[++i];
  }
  return args;
}

function findLatestAdapted() {
  if (!fs.existsSync(OUT_DIR)) throw new Error(`Pasta nao encontrada: ${OUT_DIR}`);
  const files = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.startsWith('adapted-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) throw new Error('Nenhum adapted-*.json. Rode node adapt.js primeiro.');
  return path.join(OUT_DIR, files[0]);
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return { posted_urns: [], entries: [] };
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return { posted_urns: [], entries: [] };
  }
}

function saveHistory(h) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(h, null, 2), 'utf8');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

async function detectBlock(page) {
  const url = page.url();
  if (/\/login|\/i\/flow\/login|\/account\/access/.test(url)) {
    throw new Error(`Bloqueio/login detectado (url=${url}). Refaca o login no ct-twitter-research.`);
  }
  const captcha = await page.$('iframe[src*="captcha"], iframe[title*="challenge"]');
  if (captcha) throw new Error('Captcha detectado. Parando.');
}

async function publishThread(page, thread, { dryRun }) {
  if (dryRun) {
    console.log(`  [DRY-RUN] publicaria thread de ${thread.length} tweet(s):`);
    thread.forEach((t, i) => {
      console.log(`    [${i + 1}/${thread.length}] ${t}`);
    });
    return { ok: true, dryRun: true };
  }

  // Navega pro composer
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await detectBlock(page);
  await sleep(2000);

  // Localiza textarea do primeiro tweet
  const firstBox = page.locator('[data-testid="tweetTextarea_0"]').first();
  await firstBox.waitFor({ timeout: 15000 });
  await fillDraft(page, firstBox, thread[0]);
  await sleep(800);

  // Pra cada tweet extra, clica no botao "Add" pra criar proximo campo e preenche
  for (let i = 1; i < thread.length; i++) {
    const addBtn = page
      .locator('[data-testid="addButton"], button[aria-label*="Add post" i], button[aria-label*="Adicionar post" i]')
      .first();
    await addBtn.waitFor({ timeout: 10000 });
    await addBtn.click();
    await sleep(600);
    const nextBox = page.locator(`[data-testid="tweetTextarea_${i}"]`).first();
    await nextBox.waitFor({ timeout: 10000 });
    await fillDraft(page, nextBox, thread[i]);
    await sleep(600);
  }

  // Clica no botao de publicar ("Post all" pra thread, "Post" pra single)
  const publishBtn = page
    .locator(
      '[data-testid="tweetButton"], button[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
    )
    .first();
  await publishBtn.waitFor({ timeout: 10000 });
  await publishBtn.click();

  // Aguarda feedback de publicacao
  await sleep(4000);
  await detectBlock(page);

  const permalink = await capturePermalink(page, thread[0]);
  if (permalink) console.log(`  PERMALINK: ${permalink}`);
  else console.warn('  AVISO: publicado, mas permalink nao apareceu no perfil. Pegar na mao.');

  return { ok: true, dryRun: false, permalink };
}

async function fillDraft(page, locator, text) {
  await locator.click();
  await sleep(250);
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
}

async function capturePermalink(page, firstTweet) {
  if (!X_HANDLE) return null;
  const needle = String(firstTweet).replace(/\s+/g, ' ').slice(0, 28);
  await page.goto(`https://x.com/${X_HANDLE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3500);
  const articles = page.locator('article');
  const n = await articles.count();
  for (let i = 0; i < Math.min(n, 8); i++) {
    const text = ((await articles.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    if (!text.includes(needle)) continue;
    const href = await articles.nth(i).locator('a[href*="/status/"]').first().getAttribute('href');
    const m = href && href.match(/status\/(\d+)/);
    if (m) return `https://x.com/${X_HANDLE}/status/${m[1]}`;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const adaptedPath = args.file || findLatestAdapted();
  console.log(`[post] Lendo adaptado: ${adaptedPath}`);
  console.log(`[post] Modo: ${args.dryRun ? 'DRY-RUN (nao publica)' : 'PUBLICANDO DE VERDADE'}`);
  console.log(`[post] Limit: ${args.limit}`);

  const data = JSON.parse(fs.readFileSync(adaptedPath, 'utf8'));
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    console.log('[post] Nenhum item pra publicar. Saindo.');
    return;
  }

  const history = loadHistory();
  const posted = new Set(history.posted_urns || []);

  const toProcess = items.filter((it) => !it.original_urn || !posted.has(it.original_urn)).slice(0, args.limit);
  console.log(`[post] Vou processar ${toProcess.length} item(s).`);

  if (!toProcess.length) {
    console.log('[post] Nada novo pra publicar (todos ja no historico).');
    return;
  }

  // Dry-run nao precisa de browser
  if (args.dryRun) {
    for (let i = 0; i < toProcess.length; i++) {
      const it = toProcess[i];
      console.log(`\n[item ${i + 1}/${toProcess.length}] URN=${it.original_urn} (reactions=${it.original_reactions})`);
      await publishThread(null, it.thread, { dryRun: true });
    }
    console.log('\n[post] DRY-RUN completo. Nada foi publicado.');
    return;
  }

  // Publicacao real: abre browser com perfil persistente
  if (!fs.existsSync(PROFILE_DIR)) {
    throw new Error(`Perfil Chrome nao encontrado: ${PROFILE_DIR}\nRode setup do ct-twitter-research primeiro.`);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    for (let i = 0; i < toProcess.length; i++) {
      const it = toProcess[i];
      console.log(`\n[item ${i + 1}/${toProcess.length}] URN=${it.original_urn} (thread=${it.thread.length})`);
      try {
        const res = await publishThread(page, it.thread, { dryRun: false });
        if (res.ok) {
          if (it.original_urn) {
            posted.add(it.original_urn);
            history.posted_urns = Array.from(posted);
            history.entries = history.entries || [];
            history.entries.push({
              urn: it.original_urn,
              posted_at: new Date().toISOString(),
              thread_len: it.thread.length,
              permalink: res.permalink || null,
              first_tweet_preview: it.thread[0].slice(0, 80),
            });
            saveHistory(history);
          }
          console.log(`  OK: publicado`);
        }
      } catch (e) {
        console.error(`  FALHA: ${e.message}`);
        break;
      }

      if (i < toProcess.length - 1) {
        const d = randomDelay(5000, 10000);
        console.log(`  aguardando ${d}ms antes do proximo...`);
        await sleep(d);
      }
    }
  } finally {
    await sleep(2000);
    await context.close();
  }

  console.log('\n[post] Concluido.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[post] ERRO:', e.message);
    process.exit(1);
  });
}
