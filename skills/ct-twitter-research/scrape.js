#!/usr/bin/env node
// scrape.js: scraper X/Twitter com sessao persistente.
// Uso:
//   node scrape.js timeline [--limit 50] [--out path.json] [--debug]
//   node scrape.js bookmarks [--limit 100] [--out path.json] [--debug]
//   node scrape.js search --keywords "termo1,termo2,termo3" [--limit 50] [--out path.json] [--debug]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, 'storageState.json');
// Perfil do navegador por marca (~/.playwright-x-{slug}); o mesmo do publicador scripts/publishing/publish-x.mjs.
const { playwrightDir } = require('../_shared/playwright-profile.cjs');
const PROFILE_DIR = playwrightDir('x');

const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  likes: '[data-testid="like"]',
  reposts: '[data-testid="retweet"]',
  replies: '[data-testid="reply"]',
  timestamp: 'time',
  link: 'a[role="link"]',
};

function parseArgs(argv) {
  const [, , cmd, ...rest] = argv;
  const args = { cmd, limit: 50, out: null, keywords: '', debug: false };
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--limit') args.limit = parseInt(rest[++i], 10);
    else if (k === '--out') args.out = rest[++i];
    else if (k === '--keywords') args.keywords = rest[++i];
    else if (k === '--debug') args.debug = true;
  }
  return args;
}

function parseCount(txt) {
  if (!txt) return 0;
  txt = txt.replace(/\s/g, '').toLowerCase();
  const m = txt.match(/([\d.,]+)([kmb])?/);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(',', '.'));
  if (m[2] === 'k') n *= 1e3;
  else if (m[2] === 'm') n *= 1e6;
  else if (m[2] === 'b') n *= 1e9;
  return Math.round(n);
}

async function extractTweets(page, limit) {
  const tweets = [];
  const seen = new Set();
  let stagnant = 0;

  while (tweets.length < limit && stagnant < 5) {
    const before = tweets.length;

    const nodes = await page.$$(SELECTORS.tweet);
    for (const node of nodes) {
      if (tweets.length >= limit) break;
      try {
        const data = await node.evaluate((el, SEL) => {
          const q = (sel) => el.querySelector(sel);
          const qa = (sel) => Array.from(el.querySelectorAll(sel));

          const textEl = q(SEL.tweetText);
          const text = textEl ? textEl.innerText : '';

          const userEl = q(SEL.userName);
          let authorName = '';
          let authorHandle = '';
          if (userEl) {
            const spans = userEl.innerText.split('\n').filter(Boolean);
            authorName = spans[0] || '';
            authorHandle = spans.find((s) => s.startsWith('@')) || '';
          }

          const time = q(SEL.timestamp);
          const createdAt = time ? time.getAttribute('datetime') : null;

          const permalink = time && time.closest('a') ? time.closest('a').href : null;

          const extractMetric = (sel) => {
            const b = q(sel);
            if (!b) return 0;
            return b.getAttribute('aria-label') || b.innerText || '';
          };

          const likes = extractMetric(SEL.likes);
          const reposts = extractMetric(SEL.reposts);
          const replies = extractMetric(SEL.replies);

          const externalLinks = qa('a[href^="http"]')
            .map((a) => a.href)
            .filter((h) => !h.includes('x.com') && !h.includes('twitter.com'));

          const media = qa('img[src*="media"], video').map((m) => ({
            type: m.tagName.toLowerCase() === 'video' ? 'video' : 'image',
            url: m.src || m.getAttribute('poster') || '',
          }));

          return {
            permalink,
            text,
            authorName,
            authorHandle,
            createdAt,
            likesRaw: likes,
            repostsRaw: reposts,
            repliesRaw: replies,
            externalLinks: [...new Set(externalLinks)],
            media,
          };
        }, SELECTORS);

        if (!data.permalink || seen.has(data.permalink)) continue;
        seen.add(data.permalink);

        const tweetId = (data.permalink.match(/status\/(\d+)/) || [])[1] || null;
        const githubRepos = [
          ...new Set(
            (data.externalLinks || [])
              .map((u) => (u.match(/github\.com\/([^\/]+\/[^\/?#]+)/) || [])[1])
              .filter(Boolean)
          ),
        ];

        tweets.push({
          tweet_id: tweetId,
          url: data.permalink,
          author_name: data.authorName,
          author_handle: data.authorHandle,
          text: data.text,
          created_at: data.createdAt,
          likes: parseCount(data.likesRaw),
          reposts: parseCount(data.repostsRaw),
          replies: parseCount(data.repliesRaw),
          views: 0,
          media: data.media,
          external_links: data.externalLinks,
          github_repos: githubRepos,
          is_bookmark: false,
          is_repost: false,
        });
      } catch (e) {
        // pula tweets que falharam na extracao
      }
    }

    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(2000 + Math.random() * 2000);

    if (tweets.length === before) stagnant++;
    else stagnant = 0;
  }

  return tweets.slice(0, limit);
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.cmd || !['timeline', 'bookmarks', 'search'].includes(args.cmd)) {
    console.error('Uso: node scrape.js {timeline|bookmarks|search} [--limit N] [--out path] [--keywords "a,b"] [--debug]');
    process.exit(1);
  }
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error(`Perfil Chrome nao encontrado em ${PROFILE_DIR}. Rode: node login-setup.js`);
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !args.debug,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || (await context.newPage());

  const outputs = [];

  if (args.cmd === 'timeline') {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SELECTORS.tweet, { timeout: 15000 });
    const tweets = await extractTweets(page, args.limit);
    outputs.push(...tweets);
  } else if (args.cmd === 'bookmarks') {
    await page.goto('https://x.com/i/bookmarks', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SELECTORS.tweet, { timeout: 15000 });
    const tweets = await extractTweets(page, args.limit);
    tweets.forEach((t) => (t.is_bookmark = true));
    outputs.push(...tweets);
  } else if (args.cmd === 'search') {
    const kws = (args.keywords || process.env.X_KEYWORDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!kws.length) throw new Error('Informe --keywords "a,b,c" (ou a variavel X_KEYWORDS) com os termos do nicho do cliente.');
    const perKw = Math.max(5, Math.floor(args.limit / kws.length));
    for (const kw of kws) {
      const q = encodeURIComponent(`${kw} min_faves:10 lang:pt -filter:replies`);
      await page.goto(`https://x.com/search?q=${q}&src=typed_query&f=top`, {
        waitUntil: 'domcontentloaded',
      });
      try {
        await page.waitForSelector(SELECTORS.tweet, { timeout: 12000 });
      } catch {
        continue;
      }
      const tweets = await extractTweets(page, perKw);
      tweets.forEach((t) => (t.search_keyword = kw));
      outputs.push(...tweets);
    }
  }

  const outPath =
    args.out || path.join(__dirname, `../../output/twitter-research/${args.cmd}-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(outputs, null, 2), 'utf8');

  console.log(`OK: ${outputs.length} tweets -> ${outPath}`);
  await context.close();
}

run().catch((e) => {
  console.error('Falha:', e.message);
  process.exit(1);
});
