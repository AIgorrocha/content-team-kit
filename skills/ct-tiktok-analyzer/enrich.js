#!/usr/bin/env node
// enrich.js — carrega JSON existente e visita cada video pra pegar metricas completas.
// Uso: node enrich.js <json_path>

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.tiktok-profile');

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

(async () => {
  const inputPath = process.argv[2];
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Uso: node enrich.js <json_path>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const videos = data.videos || [];
  console.log(`Enriquecendo ${videos.length} videos...`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || (await context.newPage());

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`\r  ${i + 1}/${videos.length}  `);
    try {
      await page.goto(v.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500 + Math.random() * 1500);

      const d = await page.evaluate(() => {
        try {
          const s = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
          if (s) {
            const p = JSON.parse(s.textContent);
            const detail = p?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
            if (detail) {
              return {
                caption: detail.desc || '',
                likes: detail.stats?.diggCount || 0,
                comments: detail.stats?.commentCount || 0,
                shares: detail.stats?.shareCount || 0,
                plays: detail.stats?.playCount || 0,
                music: detail.music?.title || '',
                created: detail.createTime ? new Date(detail.createTime * 1000).toISOString() : null,
              };
            }
          }
        } catch {}
        return null;
      });

      if (d) {
        v.caption = d.caption || v.caption;
        v.likes = d.likes;
        v.comments = d.comments;
        v.shares = d.shares;
        if (d.plays) v.views = d.plays;
        v.music = d.music;
        v.created_at = d.created;
        v.hashtags = extractHashtags(v.caption);
      }
    } catch (e) {
      // skip
    }
  }
  console.log('\n');
  fs.writeFileSync(inputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Atualizado: ${inputPath}`);
  await context.close();

  // Memoria de metricas (clientes com TikTok no brand-profile). Nunca quebra o fluxo.
  try {
    const { writeMetrics } = require('../_shared/metrics-writer.cjs');
    const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');
    const handle = (data.handle || data.profile?.handle || CLIENT_ACCOUNTS.principal.handle).replace(/^@/, '');
    const posts = videos
      .filter((v) => v.video_id || v.href)
      .map((v) => ({
        post_id: v.video_id || v.href,
        post_url: v.href,
        post_type: 'video',
        published_at: v.created_at || null,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        metrics: { music: v.music, hashtags: v.hashtags },
      }));
    const acct = data.profile
      ? { followers: data.profile.followers, metrics: data.profile }
      : null;
    const r = await writeMetrics({
      client_slug: CLIENT_ACCOUNTS.principal.clientSlug,
      platform: 'tiktok',
      account_handle: handle,
      source: 'ct-tiktok-analyzer',
      account: acct,
      posts,
    });
    console.log(`Snapshot: ${r.posts} videos -> ct_metrics_snapshots`);
  } catch (e) {
    console.warn(`[metrics] snapshot ignorado: ${e.message}`);
  }
})();
