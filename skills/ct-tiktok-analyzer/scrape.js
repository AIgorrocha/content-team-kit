#!/usr/bin/env node
// scrape.js — scraper TikTok via perfil persistente.
// Uso: node scrape.js profile --handle @user [--limit 30] [--debug]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.tiktok-profile');

const SELECTORS = {
  video: '[data-e2e="user-post-item"]',
  videoLink: 'a',
  videoCaption: '[data-e2e="user-post-item-desc"]',
  views: '[data-e2e="video-views"]',
  profileFollowers: '[data-e2e="followers-count"]',
  profileFollowing: '[data-e2e="following-count"]',
  profileLikes: '[data-e2e="likes-count"]',
  profileBio: '[data-e2e="user-bio"]',
};

function parseArgs(argv) {
  const [, , cmd, ...rest] = argv;
  const args = { cmd, handle: null, limit: 30, debug: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--handle') args.handle = rest[++i];
    else if (rest[i] === '--limit') args.limit = parseInt(rest[++i], 10);
    else if (rest[i] === '--debug') args.debug = true;
  }
  return args;
}

function parseCount(txt) {
  if (!txt) return 0;
  txt = String(txt).replace(/\s/g, '').toLowerCase();
  const m = txt.match(/([\d.,]+)([kmb])?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(',', '.'));
  if (m[2] === 'k') n *= 1e3;
  else if (m[2] === 'm') n *= 1e6;
  else if (m[2] === 'b') n *= 1e9;
  return Math.round(n);
}

function extractHashtags(text) {
  if (!text) return [];
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.slice(1).toLowerCase()))];
}

async function scrapeProfile(page, handle, limit) {
  const clean = handle.startsWith('@') ? handle : `@${handle}`;
  const url = `https://www.tiktok.com/${clean}`;
  console.log(`Navegando pra ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  try {
    await page.waitForSelector(SELECTORS.video, { timeout: 15000 });
  } catch {
    throw new Error('Grid de videos nao carregou. Perfil pode estar privado/inexistente ou login expirou.');
  }

  // Profile header
  const profile = await page.evaluate((SEL) => {
    const q = (s) => document.querySelector(s);
    const read = (s) => (q(s) ? q(s).innerText : '');
    return {
      followers: read(SEL.profileFollowers),
      following: read(SEL.profileFollowing),
      likes: read(SEL.profileLikes),
      bio: read(SEL.profileBio),
    };
  }, SELECTORS);

  // Scroll e coleta
  const seen = new Set();
  const videos = [];
  let stagnant = 0;
  while (videos.length < limit && stagnant < 5) {
    const before = videos.length;
    const items = await page.$$(SELECTORS.video);
    for (const item of items) {
      if (videos.length >= limit) break;
      try {
        const data = await item.evaluate((el, SEL) => {
          const q = (s) => el.querySelector(s);
          const link = q('a');
          const href = link ? link.href : null;
          const captionEl = q(SEL.videoCaption);
          const caption = captionEl ? captionEl.innerText : '';
          const viewsEl = q(SEL.views);
          const views = viewsEl ? viewsEl.innerText : '';
          return { href, caption, views };
        }, SELECTORS);

        if (!data.href || seen.has(data.href)) continue;
        seen.add(data.href);

        const id = (data.href.match(/video\/(\d+)/) || [])[1] || null;
        videos.push({
          href: data.href,
          video_id: id,
          caption: data.caption,
          views: parseCount(data.views),
          likes: 0,
          comments: 0,
          shares: 0,
          music: '',
          hashtags: extractHashtags(data.caption),
          date_label: '',
        });
      } catch {
        // skip
      }
    }

    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(1800 + Math.random() * 1500);
    if (videos.length === before) stagnant++;
    else stagnant = 0;
  }

  return {
    handle: clean,
    url,
    profile: {
      followers: parseCount(profile.followers),
      following: parseCount(profile.following),
      likes_total: parseCount(profile.likes),
      bio: profile.bio,
    },
    videos: videos.slice(0, limit),
  };
}

async function enrichVideo(page, video) {
  try {
    await page.goto(video.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);

    const data = await page.evaluate(() => {
      // Try to read from __UNIVERSAL_DATA_FOR_REHYDRATION__
      let sigi = null;
      try {
        const script = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (script) {
          const parsed = JSON.parse(script.textContent);
          const scope = parsed?.__DEFAULT_SCOPE__ || {};
          const detail = scope['webapp.video-detail']?.itemInfo?.itemStruct;
          if (detail) sigi = detail;
        }
      } catch {}

      if (sigi) {
        return {
          caption: sigi.desc || '',
          likes: sigi.stats?.diggCount || 0,
          comments: sigi.stats?.commentCount || 0,
          shares: sigi.stats?.shareCount || 0,
          plays: sigi.stats?.playCount || 0,
          music: sigi.music?.title || '',
          created: sigi.createTime ? new Date(sigi.createTime * 1000).toISOString() : null,
        };
      }

      // Fallback: visible DOM
      const q = (s) => document.querySelector(s);
      const read = (s) => (q(s) ? q(s).innerText : '');
      return {
        caption: read('[data-e2e="browse-video-desc"]') || read('[data-e2e="video-desc"]'),
        likes: read('[data-e2e="like-count"]') || read('[data-e2e="browse-like-count"]'),
        comments: read('[data-e2e="comment-count"]') || read('[data-e2e="browse-comment-count"]'),
        shares: read('[data-e2e="share-count"]') || read('[data-e2e="browse-share-count"]'),
        plays: 0,
        music: read('[data-e2e="browse-music"]'),
        created: null,
      };
    });

    if (data) {
      video.caption = data.caption || video.caption;
      video.likes = typeof data.likes === 'number' ? data.likes : parseCount(data.likes);
      video.comments = typeof data.comments === 'number' ? data.comments : parseCount(data.comments);
      video.shares = typeof data.shares === 'number' ? data.shares : parseCount(data.shares);
      if (data.plays) video.views = data.plays;
      video.music = data.music || '';
      video.created_at = data.created;
      video.hashtags = extractHashtags(video.caption);
    }
  } catch (e) {
    // keep grid-only data
  }
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.cmd !== 'profile' || !args.handle) {
    console.error('Uso: node scrape.js profile --handle @user [--limit 30] [--debug]');
    process.exit(1);
  }
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error(`Perfil nao encontrado em ${PROFILE_DIR}. Rode: node login-setup.js`);
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !args.debug,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    const data = await scrapeProfile(page, args.handle, args.limit);

    console.log(`Enriquecendo ${data.videos.length} videos (visita cada um)...`);
    for (let i = 0; i < data.videos.length; i++) {
      process.stdout.write(`\r  ${i + 1}/${data.videos.length}`);
      await enrichVideo(page, data.videos[i]);
    }
    console.log('\n');

    const today = new Date().toISOString().slice(0, 10);
    const cleanHandle = args.handle.replace(/^@/, '');

    const outDir = path.join(__dirname, '../../output/tiktok-analyzer');
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, `${cleanHandle}-${today}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`JSON: ${jsonPath} (${data.videos.length} videos)`);

    const lines = [];
    lines.push(`\n## TikTok @${cleanHandle} — ${today}\n`);
    lines.push(`- Seguidores: ${data.profile.followers.toLocaleString('pt-BR')}`);
    lines.push(`- Seguindo: ${data.profile.following}`);
    lines.push(`- Likes totais: ${data.profile.likes_total.toLocaleString('pt-BR')}`);
    lines.push(`- Videos analisados: ${data.videos.length}`);
    lines.push('');
    lines.push('### Top 5 por views');
    [...data.videos].sort((a, b) => b.views - a.views).slice(0, 5).forEach((v, i) => {
      const cap = (v.caption || '').replace(/\n/g, ' ').slice(0, 100);
      lines.push(`${i + 1}. ${v.views.toLocaleString('pt-BR')} views — "${cap}"`);
      lines.push(`   ${v.href}`);
    });
    lines.push('');

    const mdDir = path.join(__dirname, '../../content/research');
    fs.mkdirSync(mdDir, { recursive: true });
    const mdPath = path.join(mdDir, `${today}-tiktok-analysis.md`);
    let prev = '';
    if (fs.existsSync(mdPath)) prev = fs.readFileSync(mdPath, 'utf8');
    fs.writeFileSync(mdPath, prev + lines.join('\n'), 'utf8');
    console.log(`MD: ${mdPath}`);
  } finally {
    await context.close();
  }
}

// So roda o CLI quando chamado diretamente. sync-publicacoes-navegador.mjs (Batelada B11)
// importa PROFILE_DIR/scrapeProfile/enrichVideo/parseCount sem duplicar login nem scraping.
if (require.main === module) {
  run().catch((e) => {
    console.error('Falha:', e.message);
    process.exit(1);
  });
}

module.exports = { PROFILE_DIR, scrapeProfile, enrichVideo, parseCount, extractHashtags };
