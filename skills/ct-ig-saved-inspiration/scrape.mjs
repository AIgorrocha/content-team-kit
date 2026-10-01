#!/usr/bin/env node
/**
 * scrape.mjs - raspa a aba "Salvos" (todos, sem pasta) da conta IG logada,
 * salva os posts NOVOS em ct_saved_inspiration (diff por shortcode).
 *
 * Uso: node scrape.mjs <conta> [--limit 60] [--watch-videos] [--debug]
 *
 * Fluxo:
 *  1. Abre instagram.com/{handle}/saved/all-posts/ (perfil persistente logado)
 *  2. Scroll -> coleta shortcodes (/p/ e /reel/)
 *  3. Diff contra ct_saved_inspiration (client_slug+shortcode) -> so novos
 *  4. Por novo: abre post, pega caption + autor + media_type
 *     - se video/reel e --watch-videos: yt-dlp baixa + skill /watch (best-effort transcript)
 *  5. INSERT status='new'. NAO analisa (isso e dos agentes: ct-pesquisador/ct-diretor)
 *  6. Escreve digest content/{slug}/inspiracao-salvos.md e imprime contadores
 *
 * Requer no .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Sessao IG: perfil persistente local (nao versionar). Login: node login-auto.mjs <conta>
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

// ---- env ----
for (const f of ['.env', '.env.local']) {
  const p = path.join(REPO, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');
const ACCOUNTS = Object.fromEntries(
  Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => (
    [key, { profile: `.ig-profile-${key}`, handle: acc.handle, slug: acc.clientSlug }]
  ))
);

function parseArgs() {
  const [, , acc, ...rest] = process.argv;
  const a = { acc, limit: 60, watch: false, debug: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--limit') a.limit = parseInt(rest[++i], 10);
    else if (rest[i] === '--watch-videos') a.watch = true;
    else if (rest[i] === '--debug') a.debug = true;
  }
  return a;
}

async function collectShortcodes(page, handle, limit, debug) {
  const url = `https://www.instagram.com/${handle}/saved/all-posts/`;
  console.log(`Abrindo salvos: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // detecta login expirado
  const needsLogin = await page.evaluate(() =>
    !!document.querySelector('input[name="password"]') ||
    /\/accounts\/login/.test(location.pathname));
  if (needsLogin) throw new Error('SESSION_EXPIRED');

  const seen = new Set();
  let stagnant = 0;
  while (seen.size < limit && stagnant < 6) {
    const before = seen.size;
    const links = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (as) =>
      as.map((a) => a.getAttribute('href')).filter(Boolean));
    for (const href of links) {
      const m = href.match(/\/(p|reel)\/([^/]+)\//);
      if (m) seen.add(`${m[1]}:${m[2]}`);
    }
    if (debug) console.log(`  coletados ${seen.size}`);
    if (seen.size === before) stagnant++; else stagnant = 0;
    await page.mouse.wheel(0, 2600);
    await page.waitForTimeout(1800);
  }
  return [...seen].slice(0, limit).map((s) => {
    const [kind, shortcode] = s.split(':');
    return { shortcode, kind }; // kind: p | reel
  });
}

async function fetchPostMeta(page, shortcode, kind) {
  const base = kind === 'reel' ? 'reel' : 'p';
  const url = `https://www.instagram.com/${base}/${shortcode}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const meta = await page.evaluate(() => {
    const og = (p) => (document.querySelector(`meta[property="${p}"]`) || {}).content || '';
    // autor: primeiro link de perfil no header do post
    let author = '';
    const header = document.querySelector('header') || document.body;
    const a = header.querySelector('a[href^="/"][role="link"], header a[href^="/"]');
    if (a) author = (a.getAttribute('href') || '').replace(/\//g, '');
    const isVideo = !!document.querySelector('video') ||
      (og('og:type') || '').includes('video');
    return { caption: og('og:description'), title: og('og:title'), author, isVideo };
  });
  const mediaType = kind === 'reel' ? 'reel' : (meta.isVideo ? 'video' : 'image');
  // og:description = "N likes, M comments - {handle} on/no {data}: "..."" -> handle confiavel
  const fromDesc = (meta.caption || '').match(/comments?\s+-\s+([a-zA-Z0-9._]+)\s/);
  const author = fromDesc ? fromDesc[1] : (/^[a-zA-Z0-9._]+$/.test(meta.author) ? meta.author : null);
  return { url, caption: meta.caption, author, mediaType };
}

// best-effort: baixa video e roda skill /watch pra transcript + frames
function watchVideo(url, slug, shortcode) {
  const outDir = path.join(REPO, 'output', 'ig-saved', slug, shortcode);
  try {
    mkdirSync(outDir, { recursive: true });
    const watchPy = path.join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'watch', 'scripts', 'watch.py');
    if (!existsSync(watchPy)) return { transcript: null, framesPath: null };
    const r = spawnSync('python', [watchPy, url, '--out-dir', outDir, '--detail', 'transcript'], {
      encoding: 'utf8', timeout: 240000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, // sem isso o stdout sai em cp1252 e acento vira mojibake
    });
    const out = r.stdout || '';
    // watch.py imprime "## Transcript" e o texto dentro de um bloco ```
    const tMatch = out.match(/## Transcript[\s\S]*?```\r?\n([\s\S]*?)```/);
    return { transcript: tMatch ? tMatch[1].trim() : null, framesPath: existsSync(outDir) ? outDir : null };
  } catch {
    return { transcript: null, framesPath: outDir };
  }
}

function writeDigest(slug, novos) {
  if (!novos.length) return;
  const dir = path.join(REPO, 'content', slug);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'inspiracao-salvos.md');
  let body = existsSync(file) ? readFileSync(file, 'utf8') : `# Inspiracao - posts salvos no Instagram (@${slug})\n\nProximo passo: ct-diretor -> ct-pesquisador analisa e gera insight+ideia.\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  body += `\n## Rodada ${stamp} - ${novos.length} novos salvos\n`;
  for (const n of novos) {
    const cap = (n.caption || '').replace(/\s+/g, ' ').slice(0, 160);
    body += `- [${n.media_type}] @${n.author_handle || '?'} - ${n.url}\n  ${cap}\n`;
  }
  writeFileSync(file, body, 'utf8');
  return file;
}

(async () => {
  const args = parseArgs();
  const acc = ACCOUNTS[args.acc];
  if (!acc) { console.error('Uso: node scrape.mjs <conta> [--limit N] [--watch-videos]'); process.exit(1); }
  const PROFILE_DIR = path.join(__dirname, acc.profile);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, channel: 'chrome', viewport: { width: 1280, height: 1000 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  const page = context.pages()[0] || (await context.newPage());

  let codes = [];
  try {
    codes = await collectShortcodes(page, acc.handle, args.limit, args.debug);
  } catch (e) {
    await context.close();
    if (String(e.message).includes('SESSION_EXPIRED')) {
      console.log(`SESSION_EXPIRED @${acc.handle} -> rode: node skills/ct-ig-saved-inspiration/login-auto.mjs ${args.acc}`);
      process.exit(2);
    }
    throw e;
  }
  console.log(`Coletados ${codes.length} shortcodes de salvos (@${acc.handle}).`);

  // diff contra base
  const { data: known } = await sb
    .from('ct_saved_inspiration')
    .select('shortcode')
    .eq('client_slug', acc.slug);
  const knownSet = new Set((known || []).map((k) => k.shortcode));
  const fresh = codes.filter((c) => !knownSet.has(c.shortcode));
  console.log(`Novos (nao vistos): ${fresh.length}`);

  const novos = [];
  for (const c of fresh) {
    try {
      const meta = await fetchPostMeta(page, c.shortcode, c.kind);
      let transcript = null, framesPath = null;
      if (args.watch && (meta.mediaType === 'video' || meta.mediaType === 'reel')) {
        const w = watchVideo(meta.url, acc.slug, c.shortcode);
        transcript = w.transcript; framesPath = w.framesPath;
      }
      const row = {
        client_slug: acc.slug,
        shortcode: c.shortcode,
        author_handle: meta.author || null,
        url: meta.url,
        media_type: meta.mediaType,
        caption: meta.caption || null,
        transcript,
        frames_path: framesPath,
        status: 'new',
        saved_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      };
      const { error } = await sb.from('ct_saved_inspiration').insert(row);
      if (error && !/duplicate|unique/i.test(error.message)) console.log(`  erro insert ${c.shortcode}: ${error.message}`);
      else novos.push(row);
    } catch (e) {
      console.log(`  falha no post ${c.shortcode}: ${e.message}`);
    }
    await page.waitForTimeout(1200);
  }

  const digest = writeDigest(acc.slug, novos);
  await context.close();
  console.log(`OK @${acc.handle}: ${novos.length} novos salvos gravados (ct_saved_inspiration).`);
  if (digest) console.log(`Digest: ${digest}`);
})();
