// Gerador de carrossel: HTML + Playwright -> PNG 1080x1350.
// Le a marca ativa (clients/{slug}/), nunca usa cor, nome ou handle fixos.
//
// Uso (na raiz do kit):
//   node skills/ct-carrossel-gen/scripts/generate-slides.js --nome meu-carrossel [--slug marca] [--slides slides.json]
// Padrao de --slug: marca ativa (scripts/_lib/workspace-client.mjs).
// Padrao de --slides: content/{slug}/carousels/{nome}/slides.json
// Saida: content/{slug}/carousels/{nome}/slides/slide-01.png ...
//
// Formato do slides.json (lista de slides; tag e titulo em todo slide):
//   { "tipo": "hook|body|list|code|cta", "tag": "CATEGORIA", "titulo": "Texto do titulo",
//     "texto": ["paragrafo 1", "paragrafo 2"], "itens": ["Acao | descricao"], "codigo": "...",
//     "imagem": "arquivo.png (em clients/{slug}/assets/)", "claro": false }
// Marcacao no texto: **negrito** e ==destaque na cor da marca==.
// Sem "tipo": o primeiro slide e hook, o ultimo e cta, os demais body.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const W = 1080;
const H = 1350;
const TPL = (f) => fs.readFileSync(path.join(__dirname, '..', 'templates', f), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// ponytail: marcacao minima (**negrito**, ==destaque==); sem parser de markdown completo.
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<span class="emphasis">$1</span>')
  .replace(/==(.+?)==/g, '<span class="highlight">$1</span>');

// ---------- marca ----------
function parseBrand(md, slug) {
  const real = (v) => (v && !/^\[.*\]$/.test(v.trim()) ? v.trim() : '');
  const h1 = (md.match(/^#\s*Brand Profile\s*[-:]\s*(.+)$/im) || md.match(/^#\s+(.+)$/m) || [])[1];
  const handle = (md.match(/\*\*Instagram\*\*\s*:\s*(@[\w.]+)/i) || [])[1];
  return { name: real(h1) || slug, handle: handle || '' };
}

function findAvatar(assetsDir) {
  if (!fs.existsSync(assetsDir)) return '';
  const f = fs.readdirSync(assetsDir).find((n) => /^(perfil|profile|avatar|foto|logo)[^/]*\.(jpe?g|png|webp)$/i.test(n));
  return f ? path.join(assetsDir, f) : '';
}

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
}

// ---------- tokens ----------
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Deriva tokens do design-system.md (tabelas Cores e Fontes). Devolve '' se a marca ainda
// nao preencheu (destaque ausente ou #000000 de placeholder): ai vale o modelo neutro.
function tokensFromDesignSystem(md) {
  const hexOf = (re) => {
    const m = md.match(new RegExp(`^\\|\\s*(?:${re})\\s*\\|\\s*(#[0-9a-fA-F]{6})\\s*\\|`, 'im'));
    return m ? m[1].toUpperCase() : '';
  };
  const accent = hexOf('Destaque 1|Accent|Prim[aá]ria');
  if (!accent || accent === '#000000') return '';
  const bg = hexOf('Background|Fundo') || '#111418';
  const light = lum(bg) > 0.5;
  const pick = (v, fallback) => (v && v !== '#000000' && contrast(v, bg) >= 4.5 ? v : fallback);
  const primary = pick(hexOf('Texto|Texto principal'), light ? '#16181D' : '#FFFFFF');
  const secondary = pick(hexOf('Texto secundario|Texto secundário'), light ? '#3A3F47' : '#D6D9DE');
  const t = {
    '--bg': bg, '--accent': accent, '--text-primary': primary, '--text-secondary': secondary,
    '--text-muted': secondary, '--text-meta': secondary,
  };
  const surface = hexOf('Surface|Superf[ií]cie');
  if (surface && surface !== '#000000') t['--surface'] = surface;
  else if (light) t['--surface'] = '#FFFFFF';
  if (light) t['--border'] = 'rgba(0,0,0,0.10)';
  t['--accent-dark'] = contrast(accent, '#F4F2EE') >= 4.5 ? accent : `color-mix(in oklab, ${accent}, black 35%)`;
  t['--accent-on'] = contrast('#FFFFFF', accent) >= 4.5 ? '#FFFFFF' : '#16181D';
  const fontOf = (re) => {
    const m = md.match(new RegExp(`^\\|\\s*(?:${re})\\s*\\|\\s*([^|]+?)\\s*\\|`, 'im'));
    return m && !m[1].startsWith('[') ? m[1].trim() : '';
  };
  const body = fontOf('Prim[aá]ria');
  const display = fontOf('Secund[aá]ria') || body;
  const stack = (f) => `'${f}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
  const fams = [...new Set([body, display].filter(Boolean))];
  if (body) t['--font-body'] = stack(body);
  if (display) t['--font-display'] = stack(display);
  if (fams.length) {
    t['--font-import'] = `"https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap"`;
  }
  const lines = Object.entries(t).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `\n/* derivado de design-system.md (crie design-tokens.css para fixar e ajustar) */\n:root {\n${lines}\n}\n`;
}

function loadTokens(clientDir) {
  const own = path.join(clientDir, 'design-tokens.css');
  if (fs.existsSync(own)) return { css: fs.readFileSync(own, 'utf8'), origem: 'design-tokens.css da marca' };
  const model = TPL('design-tokens.modelo.css');
  const ds = path.join(clientDir, 'design-system.md');
  const derived = fs.existsSync(ds) ? tokensFromDesignSystem(fs.readFileSync(ds, 'utf8')) : '';
  return derived
    ? { css: model + derived, origem: 'derivado de design-system.md' }
    : { css: model, origem: 'modelo neutro (marca sem cores preenchidas)' };
}

// ---------- slide ----------
function renderSlide(slide, i, total, ctx) {
  const tipo = slide.tipo || (i === 0 ? 'hook' : i === total - 1 ? 'cta' : 'body');
  if (!slide.titulo) throw new Error(`slide ${i + 1}: falta "titulo" (todo slide tem tag e titulo)`);
  const cls = { hook: 'hook', cta: 'headline-cta' }[tipo] || 'headline';
  const paras = [].concat(slide.texto || []).map((p) => `<p>${inline(p)}</p>`).join('');
  const itens = (slide.itens || []).map((it, n) => {
    const [acao, desc] = String(it).split('|').map((s) => s.trim());
    return `<li><span class="step-num">${String(n + 1).padStart(2, '0')}</span><span><span class="step-action">${inline(acao)}</span>${desc ? '<span class="step-desc">' + inline(desc) + '</span>' : ''}</span></li>`;
  }).join('');
  const body = (paras ? `<div class="body">${paras}</div>` : '')
    + (itens ? `<ul class="step-list">${itens}</ul>` : '')
    + (slide.codigo ? `<div class="code-block">${esc(slide.codigo)}</div>` : '')
    + (slide.imagem ? `<div class="media"><img src="${ctx.image(slide.imagem)}" alt=""></div>` : '');
  const last = i === total - 1;
  const swipe = '<div class="swipe"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></div>';
  const vars = {
    FONT_IMPORT: ctx.fontImport,
    TOKENS: ctx.tokens,
    BASE_STYLE: ctx.baseStyle,
    SLIDE_CLASS: [tipo === 'hook' ? 'cover' : tipo === 'cta' ? 'cta' : '', slide.claro ? 'light' : ''].join(' ').trim(),
    AVATAR: ctx.avatar ? `<div class="avatar"><img src="${ctx.avatar}" alt=""></div>` : '',
    BRAND_NAME: esc(ctx.brand.name),
    HANDLE: ctx.brand.handle ? `<div class="header-handle">${esc(ctx.brand.handle)}</div>` : '',
    TAG: slide.tag ? `<div class="tag">${esc(slide.tag)}</div>` : '',
    HEADING_CLASS: cls,
    HEADING: inline(slide.titulo),
    BODY: body,
    PCT: Math.round(((i + 1) / total) * 100),
    NUM: String(i + 1).padStart(2, '0'),
    TOTAL: String(total).padStart(2, '0'),
    SWIPE: last ? '' : swipe,
  };
  // funcao no replace: evita que "$&" ou "$1" dentro do conteudo sejam interpretados
  return TPL('base-slide.html').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]);
}

// Monta tudo a partir de uma raiz (kit) e devolve { htmls, outDir, origemTokens }.
function build({ root, slug, nome, slides }) {
  const clientDir = path.join(root, 'clients', slug);
  const brand = parseBrand(fs.readFileSync(path.join(clientDir, 'brand-profile.md'), 'utf8'), slug);
  const { css, origem } = loadTokens(clientDir);
  const imp = (css.match(/--font-import:\s*"([^"]+)"/) || [])[1];
  const assets = path.join(clientDir, 'assets');
  const avatarFile = findAvatar(assets);
  const ctx = {
    brand,
    tokens: css,
    baseStyle: TPL('base-style.css'),
    fontImport: imp ? `@import url("${imp}");` : '',
    avatar: avatarFile ? dataUri(avatarFile) : '',
    image: (f) => {
      const p = path.isAbsolute(f) ? f : path.join(assets, f);
      if (!fs.existsSync(p)) throw new Error(`imagem nao encontrada: ${p}`);
      return dataUri(p);
    },
  };
  return {
    htmls: slides.map((s, i) => renderSlide(s, i, slides.length, ctx)),
    outDir: path.join(root, 'content', slug, 'carousels', nome, 'slides'),
    origemTokens: origem,
    brand,
    temAvatar: !!avatarFile,
  };
}

async function main() {
  const a = {};
  process.argv.slice(2).forEach((v, i, arr) => { if (v.startsWith('--')) a[v.slice(2)] = arr[i + 1]; });
  const root = path.resolve(a.root || process.cwd());
  if (!a.nome || !/^[a-z0-9-]+$/.test(a.nome)) throw new Error('use --nome em kebab-case (ex: --nome tres-erros-de-preco)');
  const wcPath = path.join(__dirname, '..', '..', '..', 'scripts', '_lib', 'workspace-client.mjs');
  const wc = await import(pathToFileURL(wcPath).href);
  const slug = a.slug ? wc.assertClient(a.slug, root) : wc.resolveClient(root);
  const slidesFile = a.slides || path.join(root, 'content', slug, 'carousels', a.nome, 'slides.json');
  const raw = JSON.parse(fs.readFileSync(slidesFile, 'utf8'));
  const slides = Array.isArray(raw) ? raw : raw.slides;
  const { htmls, outDir, origemTokens, brand, temAvatar } = build({ root, slug, nome: a.nome, slides });
  const av = temAvatar ? 'sim' : `nao (sem foto em clients/${slug}/assets/)`;
  console.log(`Marca: ${slug} (${brand.name} ${brand.handle}). Tokens: ${origemTokens}. Avatar: ${av}`);

  const { chromium } = require('playwright');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const ctxBrowser = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctxBrowser.newPage();
    for (let i = 0; i < htmls.length; i++) {
      await page.setContent(htmls[i], { waitUntil: 'load' });
      await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 4000))]);
      const out = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      console.log(`Slide ${i + 1}/${htmls.length}: ${out}`);
    }
  } finally {
    await browser.close();
  }
}

module.exports = { parseBrand, tokensFromDesignSystem, loadTokens, build, renderSlide };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
