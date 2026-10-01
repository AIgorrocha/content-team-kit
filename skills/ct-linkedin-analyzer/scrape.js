#!/usr/bin/env node
// scrape.js - scraper LinkedIn via Playwright logado (feed + posts pessoais + posts de company).
// Uso:
//   node scrape.js personal [--handle {handle-do-cliente}] [--limit 30]
//   node scrape.js company --org {org-id-do-cliente} [--limit 30]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

const PROFILE_DIR = path.join(__dirname, '.linkedin-profile');

// Converte label relativo do LinkedIn ("4 d", "3 h", "1 sem", "2 mês", "1 ano") em ISO.
// Hora-do-dia nao e exposta no scrape -> fixa 12:00 UTC (best-time de hora fica fraco,
// mas dia-da-semana + engajamento + formato continuam validos). Limitacao documentada.
function relativeLabelToISO(label) {
  if (!label) return null;
  const m = String(label).toLowerCase().match(/(\d+)\s*(s|min|h|d|sem|m[eê]s|ano|w|mo|y)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2];
  const ms = { s: 1e3, min: 6e4, h: 36e5, d: 864e5, sem: 6048e5, w: 6048e5,
    'mes': 2592e6, 'mês': 2592e6, mo: 2592e6, ano: 31536e6, y: 31536e6 }[u] || 0;
  const d = new Date(Date.now() - n * ms);
  return `${d.toISOString().slice(0, 10)}T12:00:00Z`;
}

function parseArgs(argv) {
  const [, , cmd, ...rest] = argv;
  const args = { cmd, handle: CLIENT_ACCOUNTS.principal.linkedin.handle, org: null, keywords: '', limit: 30, debug: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--handle') args.handle = rest[++i];
    else if (rest[i] === '--org') args.org = rest[++i];
    else if (rest[i] === '--keywords') args.keywords = rest[++i];
    else if (rest[i] === '--limit') args.limit = parseInt(rest[++i], 10);
    else if (rest[i] === '--debug') args.debug = true;
  }
  return args;
}

function parseCount(txt) {
  if (!txt) return 0;
  txt = String(txt).toLowerCase().trim();
  // Suporta: "1234", "1,234", "1.234" (PT-BR milhar), "1,2 mil", "1.5k", "3.4m"
  const m = txt.match(/([\d.,]+)\s*(mil|mi|k|m|b)?/);
  if (!m) return 0;
  let numStr = m[1];
  const suffix = m[2];
  let n;
  if (suffix) {
    // com sufixo: virgula vira ponto decimal
    n = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    if (suffix === 'k' || suffix === 'mil') n *= 1e3;
    else if (suffix === 'm' || suffix === 'mi') n *= 1e6;
    else if (suffix === 'b') n *= 1e9;
  } else {
    // sem sufixo: se tem ponto/virgula como separador de milhar (PT-BR/EN), remove
    // heuristica: se tem 3+ digitos apos o separador, e milhar; se 1-2 digitos, e decimal
    const parts = numStr.split(/[.,]/);
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      n = parseFloat(parts.join(''));
    } else {
      n = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    }
  }
  return isNaN(n) ? 0 : Math.round(n);
}

// Extrai posts usando seletores antigos (ainda funcionam em perfis pessoais e paginas de company).
async function extractLegacy(page) {
  return await page.$$eval(
    'div.feed-shared-update-v2, div.occludable-update, div[data-urn*="urn:li:activity"]',
    (nodes) =>
      nodes.map((el) => {
        const q = (s) => el.querySelector(s);
        const urn = el.getAttribute('data-urn') || el.querySelector('[data-urn]')?.getAttribute('data-urn') || '';
        let text = '';
        const candidates = [
          '.feed-shared-update-v2__description .update-components-text',
          '.update-components-text',
          '.feed-shared-inline-show-more-text',
          '.feed-shared-text',
          '[data-testid="expandable-text-box"]',
        ];
        for (const sel of candidates) {
          const n = el.querySelector(sel);
          if (n && n.innerText && n.innerText.trim().length > 20) { text = n.innerText.trim(); break; }
        }
        const authorEl = el.querySelector('.update-components-actor__title, .update-components-actor__name');
        const authorName = authorEl ? authorEl.innerText.split('\n')[0].trim() : '';
        const authorSub = el.querySelector('.update-components-actor__description');
        const authorSubtitle = authorSub ? authorSub.innerText.trim() : '';
        const authorLink = el.querySelector('.update-components-actor__container a, a.update-components-actor__meta-link');
        const authorUrl = authorLink ? authorLink.href : '';
        const reactionsBtn = el.querySelector('button[aria-label*="reaction" i], button[aria-label*="gostou" i], .social-details-social-counts__reactions-count');
        const reactionsTxt = reactionsBtn ? (reactionsBtn.getAttribute('aria-label') || reactionsBtn.innerText || '') : '';
        const commentsBtn = el.querySelector('button[aria-label*="comment" i], button[aria-label*="comentári" i], li.social-details-social-counts__comments');
        const commentsTxt = commentsBtn ? (commentsBtn.getAttribute('aria-label') || commentsBtn.innerText || '') : '';
        const repostsBtn = el.querySelector('button[aria-label*="repost" i], button[aria-label*="compartilh" i]');
        const repostsTxt = repostsBtn ? (repostsBtn.getAttribute('aria-label') || repostsBtn.innerText || '') : '';
        const time = q('.update-components-actor__sub-description, time');
        const when = time ? time.innerText : '';
        const media = Array.from(el.querySelectorAll('img.update-components-image__image, video')).map((m) => ({
          type: m.tagName.toLowerCase() === 'video' ? 'video' : 'image',
          url: m.src || m.getAttribute('poster') || '',
        }));
        return { urn, text, authorName, authorSubtitle, authorUrl, reactionsTxt, commentsTxt, repostsTxt, when, media };
      })
  );
}

// Extrai posts usando o NOVO layout SDUI do LinkedIn (feed + search).
// Estrategia: cada post tem um botao "Abrir menu de controle da publicacao de X" (PT) ou
// "post control menu for X" (EN). Subimos do botao ate um ancestral que contem SO 1 desses,
// e esse e o container do post.
async function extractSDUI(page) {
  return await page.evaluate(() => {
    const CTRL_SEL = 'button[aria-label*="controle da publicação" i], button[aria-label*="control menu" i]';
    const anchors = Array.from(document.querySelectorAll(CTRL_SEL));
    const results = [];

    const findPostContainer = (btn) => {
      // Sobe ate achar um pai que contenha >1 botoes de controle; volta pro filho direto que contem o btn.
      let cur = btn.parentElement;
      while (cur && cur !== document.body) {
        if (cur.querySelectorAll(CTRL_SEL).length > 1) {
          let inner = btn;
          while (inner.parentElement && inner.parentElement !== cur) inner = inner.parentElement;
          return inner;
        }
        cur = cur.parentElement;
      }
      return null;
    };

    for (const btn of anchors) {
      const post = findPostContainer(btn);
      if (!post) continue;

      const label = btn.getAttribute('aria-label') || '';
      const authorName = label.replace(/^.*(controle da publicação de|control menu for)\s*/i, '').trim();

      // Primeiro link /in/ ou /company/ no container do autor (header do post, nao nos comentarios).
      // Heuristica: pega o primeiro link cujo texto seja o authorName OU o primeiro link no primeiro terco visual do post.
      let authorUrl = '';
      const allActorLinks = Array.from(post.querySelectorAll('a[href*="/in/"], a[href*="/company/"]'));
      for (const a of allActorLinks) {
        const t = (a.innerText || '').trim();
        if (t && authorName && t.includes(authorName.split(' ')[0])) { authorUrl = a.href.split('?')[0]; break; }
      }
      if (!authorUrl && allActorLinks[0]) authorUrl = allActorLinks[0].href.split('?')[0];

      // Texto do post
      let text = '';
      const expandable = post.querySelector('[data-testid="expandable-text-box"]');
      if (expandable) text = (expandable.innerText || '').trim();

      // URN do post (quando disponivel via commentList testid)
      let urn = '';
      const clEl = post.querySelector('[data-testid*="commentList"]');
      if (clEl) {
        const tid = clEl.getAttribute('data-testid') || '';
        const m = tid.match(/^([^-]+)-commentList/);
        if (m) urn = m[1];
      }

      // Reacoes / comentarios / reposts: extraidos do texto visivel usando regex tolerante
      const full = post.innerText || '';
      const reM = full.match(/([\d.,]+(?:\s*(?:mil|mi|k|m))?)\s*(?:reaç|reaction)/i);
      const coM = full.match(/([\d.,]+(?:\s*(?:mil|mi|k|m))?)\s*(?:coment|comment)/i);
      const rpM = full.match(/([\d.,]+(?:\s*(?:mil|mi|k|m))?)\s*(?:compartil|repost|share)/i);

      // Timestamp: texto tipo "4 d •", "3 h •", "1 sem •"
      const tsM = full.match(/(\d+\s*(?:s|min|h|d|sem|mes|ano|w|mo|y))\s*•/i);
      const posted = tsM ? tsM[1] : '';

      // Media
      const media = Array.from(post.querySelectorAll('img, video'))
        .filter((m) => {
          const src = m.src || m.getAttribute('poster') || '';
          if (!src) return false;
          if (/profile-displayphoto|company-logo/.test(src)) return false;
          return src.includes('licdn.com') || m.tagName.toLowerCase() === 'video';
        })
        .slice(0, 8)
        .map((m) => ({ type: m.tagName.toLowerCase() === 'video' ? 'video' : 'image', url: m.src || m.getAttribute('poster') || '' }));

      const isAd = /(promovido|promoted|anúncio|sponsored)/i.test(full.slice(0, 200));

      results.push({
        urn: urn || `synthetic-${authorName}-${(text || '').slice(0, 40)}`.replace(/\s+/g, '_'),
        text,
        authorName,
        authorSubtitle: '',
        authorUrl,
        reactionsTxt: reM ? reM[1] : '',
        commentsTxt: coM ? coM[1] : '',
        repostsTxt: rpM ? rpM[1] : '',
        when: posted,
        media,
        isAd,
      });
    }

    return results;
  });
}

async function scrollAndCollect(page, limit, { strategy = 'auto' } = {}) {
  const seen = new Set();
  const posts = [];
  let stagnant = 0;

  while (posts.length < limit && stagnant < 6) {
    const before = posts.length;

    let batch = [];
    if (strategy === 'legacy' || strategy === 'auto') {
      try { batch = await extractLegacy(page); } catch { batch = []; }
    }
    if (batch.length === 0 && (strategy === 'sdui' || strategy === 'auto')) {
      try { batch = await extractSDUI(page); } catch { batch = []; }
    }

    for (const data of batch) {
      if (posts.length >= limit) break;
      if (!data.urn || seen.has(data.urn)) continue;
      // Ignorar anuncios
      if (data.isAd) continue;
      seen.add(data.urn);
      posts.push({
        urn: data.urn,
        text: data.text,
        author_name: data.authorName,
        author_subtitle: data.authorSubtitle || '',
        author_url: data.authorUrl,
        reactions: parseCount(data.reactionsTxt),
        comments: parseCount(data.commentsTxt),
        reposts: parseCount(data.repostsTxt),
        posted_label: data.when,
        media: data.media || [],
      });
    }

    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1800 + Math.random() * 1500);
    if (posts.length === before) stagnant++;
    else stagnant = 0;
  }

  return posts.slice(0, limit);
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.cmd || !['personal', 'company', 'feed', 'search'].includes(args.cmd)) {
    console.error('Uso: node scrape.js personal|company|feed|search [--handle X] [--org Y] [--keywords "a,b"] [--limit 30]');
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
    let url, label;
    const allPosts = [];

    if (args.cmd === 'personal') {
      url = `https://www.linkedin.com/in/${args.handle}/recent-activity/all/`;
      label = args.handle;
      console.log(`Navegando pra ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      allPosts.push(...(await scrollAndCollect(page, args.limit)));
    } else if (args.cmd === 'company') {
      if (!args.org) throw new Error('--org OBRIGATORIO pra company');
      url = `https://www.linkedin.com/company/${args.org}/posts/`;
      label = `company-${args.org}`;
      console.log(`Navegando pra ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      allPosts.push(...(await scrollAndCollect(page, args.limit)));
    } else if (args.cmd === 'feed') {
      url = 'https://www.linkedin.com/feed/';
      label = 'feed';
      console.log(`Navegando pra ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      allPosts.push(...(await scrollAndCollect(page, args.limit)));
    } else if (args.cmd === 'search') {
      const kws = (args.keywords || process.env.LINKEDIN_SEARCH_KEYWORDS || '')
        .split(',').map((s) => s.trim()).filter(Boolean);
      if (!kws.length) throw new Error('Informe --keywords ou a env LINKEDIN_SEARCH_KEYWORDS (lista separada por virgula)');
      const perKw = Math.max(5, Math.floor(args.limit / kws.length));
      label = 'search';
      for (const kw of kws) {
        const q = encodeURIComponent(kw);
        url = `https://www.linkedin.com/search/results/content/?keywords=${q}&sortBy=%22relevance%22`;
        console.log(`Buscando "${kw}"...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3500);
        const posts = await scrollAndCollect(page, perKw);
        posts.forEach((p) => (p.search_keyword = kw));
        allPosts.push(...posts);
      }
    }

    const posts = allPosts;
    const today = new Date().toISOString().slice(0, 10);

    const outDir = path.join(__dirname, '../../output/linkedin-analyzer');
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, `${label}-${today}.json`);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ kind: args.cmd, label, url, fetched_at: new Date().toISOString(), posts }, null, 2),
      'utf8'
    );
    console.log(`JSON: ${jsonPath} (${posts.length} posts)`);

    const top = [...posts].sort((a, b) => b.reactions - a.reactions).slice(0, 10);
    const lines = [];
    lines.push(`\n## LinkedIn ${args.cmd === 'personal' ? '@' + label : label} - ${today}\n`);
    lines.push(`Total posts: ${posts.length}\n`);
    lines.push('### Top 10 por reacoes');
    top.forEach((p, i) => {
      const t = (p.text || '').replace(/\n/g, ' ').slice(0, 150);
      lines.push(`${i + 1}. ${p.reactions}R ${p.comments}C ${p.reposts}S - "${t}"`);
    });

    const mdDir = path.join(__dirname, '../../content/research');
    fs.mkdirSync(mdDir, { recursive: true });
    const mdPath = path.join(mdDir, `${today}-linkedin-analysis.md`);
    let prev = '';
    if (fs.existsSync(mdPath)) prev = fs.readFileSync(mdPath, 'utf8');
    fs.writeFileSync(mdPath, prev + lines.join('\n'), 'utf8');
    console.log(`MD: ${mdPath}`);

    // Snapshot proprio: so personal e company. feed/search = concorrente, fora.
    if (args.cmd === 'personal' || args.cmd === 'company') {
      try {
        const { writeMetrics } = require('../_shared/metrics-writer.cjs');
        const isCompany = args.cmd === 'company';
        const client_slug = isCompany ? CLIENT_ACCOUNTS.business.clientSlug : CLIENT_ACCOUNTS.principal.clientSlug;
        const account_handle = isCompany ? CLIENT_ACCOUNTS.business.linkedin.handle : args.handle;
        const snapPosts = posts.map((p) => ({
          post_id: p.urn,
          // author_url e a URL do PERFIL, igual em todo post: nao identifica peca nenhuma e
          // por isso o join com ct_content_items dava 0 no LinkedIn. A URL da peca sai do urn.
          post_url: p.urn ? `https://www.linkedin.com/feed/update/${p.urn}` : null,
          post_type: 'post',
          published_at: relativeLabelToISO(p.posted_label),
          likes: p.reactions,
          comments: p.comments,
          shares: p.reposts,
          metrics: { posted_label: p.posted_label, source: 'playwright-scrape' },
        }));
        const r = await writeMetrics({
          client_slug, platform: 'linkedin', account_handle,
          source: 'ct-linkedin-analyzer:scrape', posts: snapPosts,
        });
        console.log(`Snapshot: ${r.posts} posts -> ct_metrics_snapshots`);
      } catch (e) {
        console.warn(`[metrics] snapshot ignorado: ${e.message}`);
      }
    }
  } finally {
    await context.close();
  }
}

// So roda o CLI quando chamado diretamente. sync-publicacoes-navegador.mjs (Batelada B11)
// importa PROFILE_DIR/scrollAndCollect/relativeLabelToISO/parseCount sem duplicar login
// nem scraping: exportar aqui e a forma de reaproveitar sem copiar codigo.
if (require.main === module) {
  run().catch((e) => {
    console.error('Falha:', e.message);
    process.exit(1);
  });
}

module.exports = { PROFILE_DIR, relativeLabelToISO, scrollAndCollect, parseCount };
