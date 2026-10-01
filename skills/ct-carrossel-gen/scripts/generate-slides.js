// Gerador de carrossel: HTML + Playwright -> PNG 1080x1350.
// Le a marca ativa (clients/{slug}/), nunca usa cor, nome ou handle fixos: tudo vem de
// clients/{slug}/design-tokens.css (bloco CARROSSEL) por cima do modelo neutro do kit.
//
// Uso (na raiz do kit):
//   node skills/ct-carrossel-gen/scripts/generate-slides.js --nome meu-carrossel [--slug marca] [--slides slides.json] [--layout perfil-v2|perfil|chip] [--out pasta]
// Padrao de --slug: marca ativa (scripts/_lib/workspace-client.mjs).
// Padrao de --slides: content/{slug}/carousels/{nome}/slides.json
// Padrao de --out: content/{slug}/carousels/{nome}/slides/ (slide-01.png ...)
// Layout: --layout vence o --car-layout dos tokens (serve para comparar os 3 visuais). Padrao: perfil-v2.
//
// Formato do slides.json (lista de slides; titulo em todo slide):
//   { "tipo": "capa|conteudo|cta", "tag": "CATEGORIA (so no chip)", "titulo": "Texto do titulo",
//     "texto": ["linha 1", "1. passo numerado", "- marcador"], "itens": ["Acao | descricao"],
//     "codigo": "...", "imagem": "arquivo.png (em clients/{slug}/assets/)", "tom": "claro|escuro (chip)" }
//   ou { "html": "<div class=...>" } para a zona de midia escrita a mao (perfil-v2) ou o conteudo inteiro (perfil, chip).
// "hook" e "body" valem como apelidos de "capa" e "conteudo". Sem "tipo": o primeiro slide e capa, o ultimo cta, o resto conteudo.
// Marcacao no texto: **negrito** e ==destaque na cor da marca==. No titulo (perfil-v2) a quebra de linha vale.
// No perfil-v2 o cta usa as linhas "1. x" como passos e as demais como frase de chamada.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const W = 1080;
const H = 1350;
const SKILL = path.join(__dirname, '..');
const TPL = (f) => fs.readFileSync(path.join(SKILL, 'templates', f), 'utf8');
const LAYOUTS = ['perfil-v2', 'perfil', 'chip'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Le "--chave: valor;" do css. Valor entre aspas vira texto puro. Ultimo valor vence.
function parseTokens(css) {
  const t = {};
  for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:\s*("[^"]*"|[^;]+);/gm)) t[m[1]] = m[2].trim().replace(/^"(.*)"$/s, '$1');
  return t;
}

// ---------- marca ----------
function parseBrand(md, slug) {
  const real = (v) => (v && !/^\[.*\]$/.test(v.trim()) ? v.trim() : '');
  const h1 = (md.match(/^#\s*Brand Profile\s*[-:]\s*(.+)$/im) || md.match(/^#\s+(.+)$/m) || [])[1];
  const handle = (md.match(/\*\*Instagram\*\*\s*:\s*(@[\w.]+)/i) || [])[1];
  return { name: real(h1) || slug, handle: handle && handle !== '@handle' ? handle : '' }; // @handle = valor do modelo
}

function findAvatar(assetsDir) {
  if (!fs.existsSync(assetsDir)) return '';
  const f = fs.readdirSync(assetsDir).find((n) => /^(perfil|profile|avatar|foto|logo)[^/]*\.(jpe?g|png|webp)$/i.test(n));
  return f ? path.join(assetsDir, f) : '';
}

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg').replace('svg', 'svg+xml');
  return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
}

// Foto: arquivo do token em clients/{slug}/assets/, senao foto achada la (perfil, avatar, foto, logo),
// senao a imagem neutra do kit (skills/ct-carrossel-gen/assets/). Nunca URL externa.
function resolveAvatar(clientDir, name) {
  const assets = path.join(clientDir, 'assets');
  const own = name && path.join(assets, name);
  if (own && fs.existsSync(own)) return own;
  const found = findAvatar(assets);
  if (found) return found;
  if (!name) return '';
  const neutral = path.join(SKILL, 'assets', name);
  if (fs.existsSync(neutral)) return neutral;
  throw new Error(`foto da marca nao encontrada: ${own} (ou deixe --brand-avatar vazio)`);
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
  // O modelo vai sempre por baixo: token que a marca nao define cai no valor neutro do kit.
  const model = TPL('design-tokens.modelo.css');
  const ownFile = path.join(clientDir, 'design-tokens.css');
  if (fs.existsSync(ownFile)) {
    const own = fs.readFileSync(ownFile, 'utf8');
    return { css: `${model}\n${own}`, origem: 'design-tokens.css da marca', own: parseTokens(own) };
  }
  const ds = path.join(clientDir, 'design-system.md');
  const derived = fs.existsSync(ds) ? tokensFromDesignSystem(fs.readFileSync(ds, 'utf8')) : '';
  return derived
    ? { css: model + derived, origem: 'derivado de design-system.md', own: {} }
    : { css: model, origem: 'modelo neutro (marca sem cores preenchidas)', own: {} };
}

// ---------- slide ----------
const TIPO = { hook: 'capa', capa: 'capa', body: 'conteudo', conteudo: 'conteudo', list: 'conteudo', code: 'conteudo', cta: 'cta' };
function tipoOf(slide, i, total) {
  const tipo = TIPO[slide.tipo || (i === 0 ? 'capa' : i === total - 1 ? 'cta' : 'conteudo')];
  if (!tipo) throw new Error(`slide ${i + 1}: tipo invalido "${slide.tipo}" (use capa, conteudo ou cta)`);
  return tipo;
}
// "acao | descricao" -> [acao, descricao]
const splitItem = (it) => String(it).split('|').map((x) => x.trim());

const CHECK = (cor) => ` <svg class="check-selo" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="20" fill="${cor}"/><path d="M17.5 28.5L10 21l2.5-2.5 5 5 10-10L30 16z" fill="#fff"/></svg>`;

// ---------- layouts perfil e chip ----------
function renderContent(slide, tipo, ctx) {
  if (slide.html) return slide.html;
  const { chip, opt } = ctx;
  // ponytail: marcacao minima; sem parser de markdown completo.
  const inline = (s, hl) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, chip ? '<strong>$1</strong>' : '<span class="emphasis">$1</span>')
    .replace(/==(.+?)==/g, `<span class="${hl}">$1</span>`);
  const t = [].concat(slide.texto || [], (slide.itens || []).map((it) => {
    const [a, d] = splitItem(it);
    return (chip ? '' : '- ') + (d ? `${a}: ${d}` : a);
  }));
  const titulo = slide.titulo || '';

  if (chip) {
    const h = (cls) => (titulo ? `<div class="${cls}">${inline(titulo, 'ac')}</div>` : '');
    if (tipo === 'cta') {
      const [prov, sub] = t;
      return `<div class="content">${prov ? `<div class="body-bold">${inline(prov, 'hl')}</div>` : ''}
        <div class="final-cta"><div class="pill-cta">${inline(titulo, 'ac')}</div>${sub ? `<div class="cta-sub"><span class="arrow">&rarr;</span>${inline(sub, 'hl')}</div>` : ''}</div></div>`;
    }
    const [first, ...rest] = t;
    if (tipo === 'capa') return `<div class="content">${h('headline')}${first ? `<div class="subtitle">${inline(first, 'hl')}</div>` : ''}</div>`;
    return `<div class="content">${h('headline')}${first ? `<div class="body-bold" style="margin-top:28px">${inline(first, 'hl')}</div>` : ''}${rest.map((p) => `<div class="body-regular" style="margin-top:16px">${inline(p, 'hl')}</div>`).join('')}</div>`;
  }

  if (tipo === 'capa') {
    return `<div class="hook-text">${inline(titulo, 'highlight')}</div>
      ${t[0] ? `<div class="hook-sub">${inline(t[0], 'highlight')}</div>` : ''}
      ${t[1] ? `<div class="hook-thread">${inline(t[1], 'highlight')}</div>` : ''}`;
  }
  if (tipo === 'cta') {
    return `<div class="cta-text">${inline(titulo, 'highlight')}</div>
      ${t[0] ? `<div class="cta-action">${inline(t[0], 'highlight')}</div>` : ''}
      ${opt.handle ? `<div class="cta-handle">${esc(opt.handle)}</div>` : ''}`;
  }
  const body = t.map((p) => (/^[-•]\s/.test(p) ? `<div class="bullet">${inline(p.slice(2), 'highlight')}</div>` : `<p>${inline(p, 'highlight')}</p>`)).join('');
  return `${opt.titles ? `<div class="slide-title">${inline(titulo, 'highlight')}</div>` : ''}<div class="slide-body">${body}</div>`;
}

// ---------- layout perfil-v2 ----------
function renderV2(slide, tipo, i, total, ctx) {
  const { opt, tokens } = ctx;
  const mark = (s, hl) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/==(.+?)==/g, hl);
  const kw = '<span class="kw">$1</span>';
  const titulo = slide.titulo ? mark(slide.titulo, '<em>$1</em>').replace(/\r?\n/g, '<br>') : '';
  const titleCls = { capa: 'display-cover', conteudo: 'headline-slide', cta: 'headline-cta' }[tipo];
  // agrupa linhas consecutivas: passos "1. x", marcadores "- x", paragrafos
  let body = '';
  const lines = [].concat(slide.texto || []);
  for (let k = 0; k < lines.length; ) {
    const step = (l) => /^\d+[.)]\s+/.test(l);
    const bul = (l) => /^[-•]\s/.test(l);
    if (step(lines[k])) {
      let n = 0, h = '';
      for (; k < lines.length && step(lines[k]); k++) h += `<div class="step"><div class="step-num">${String(++n).padStart(2, '0')}</div><div class="step-txt">${mark(lines[k].replace(/^\d+[.)]\s+/, ''), kw)}</div></div>`;
      body += `<div class="steps">${h}</div>`;
    } else if (bul(lines[k])) {
      body += `<div class="bullet">${mark(lines[k].slice(2), kw)}</div>`; k++;
    } else {
      body += `<div class="${tipo === 'cta' ? 'cta-line' : 'para'}">${mark(lines[k], kw)}</div>`; k++;
    }
  }
  if (slide.itens && slide.itens.length) {
    body += `<div class="steps">${slide.itens.map((it, n) => {
      const [a, d] = splitItem(it);
      return `<div class="step"><div class="step-num">${String(n + 1).padStart(2, '0')}</div><div class="step-txt">${mark(a, kw)}${d ? `<span class="step-desc">${mark(d, kw)}</span>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  if (slide.codigo) body += `<div class="code">${esc(slide.codigo)}</div>`;
  if (slide.imagem) body += `<div class="shot"><img src="${ctx.image(slide.imagem)}" alt=""></div>`;
  const dots = Array.from({ length: total }, (_, d) => `<div class="dot${d === i ? ' on' : ''}"></div>`).join('');
  const pad = (n) => String(n).padStart(2, '0');
  return {
    SLIDE_CLASS: tipo,
    TITLE: titulo ? `<div class="${titleCls}">${titulo}</div>` : '',
    BODY: slide.html || body,
    FOOTER: opt.numbering ? `<div class="footer"><div class="counter">${pad(i + 1)}/${pad(total)}</div><div class="dots">${dots}</div></div>` : '',
    AVATAR: ctx.avatar ? `<div class="avatar"><img src="${ctx.avatar}" alt="${esc(opt.name)}"></div>` : '',
    BRAND_NAME: esc(opt.headerName),
    BADGE: opt.verified ? CHECK(tokens['--car-verified-color']) : '',
    HANDLE: opt.handle ? `<div class="header-handle">${esc(opt.handle)}</div>` : '',
  };
}

// ---------- slide completo ----------
function renderSlide(slide, i, total, ctx) {
  const { chip, opt, tokens } = ctx;
  if (!slide.titulo && !slide.html) throw new Error(`slide ${i + 1}: falta "titulo" (todo slide tem titulo)`);
  const tipo = tipoOf(slide, i, total);
  const vars = {
    FONT_IMPORT: tokens['--font-import'] ? `@import url("${tokens['--font-import']}");` : '',
    TOKENS: ctx.tokensCss,
  };
  if (ctx.v2) {
    Object.assign(vars, renderV2(slide, tipo, i, total, ctx));
  } else if (chip) {
    const alt = slide.tom ? slide.tom === 'escuro' : opt.alternate && i % 2 === 1;
    Object.assign(vars, {
      CONTENT: renderContent(slide, tipo, ctx),
      SLIDE_CLASS: alt ? 'slide-alt' : 'slide-base',
      TAG: esc(slide.tag || ''),
      HANDLE_TEXT: esc(opt.handle),
      FOOTER: esc(opt.footer),
      LOGO_CSS: ctx.avatar ? `url('${ctx.avatar}')` : 'none',
    });
  } else {
    Object.assign(vars, {
      CONTENT: renderContent(slide, tipo, ctx),
      AVATAR: ctx.avatar ? `<div class="avatar"><img src="${ctx.avatar}" alt="${esc(opt.name)}"></div>` : '',
      BRAND_NAME: esc(opt.name),
      BADGE: opt.verified ? CHECK(tokens['--car-verified-color']) : '',
      HANDLE: opt.handle ? `<div class="header-handle">${esc(opt.handle)}</div>` : '',
    });
  }
  // funcao no replace: "$&" ou "$1" dentro do conteudo nao sao interpretados
  return ctx.template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k]);
}

// Monta tudo a partir de uma raiz (kit) e devolve { htmls, outDir, origemTokens, brand, layout, temAvatar }.
function build({ root, slug, nome, slides, layout: layoutArg }) {
  const clientDir = path.join(root, 'clients', slug);
  const { css, origem, own } = loadTokens(clientDir);
  const tokens = parseTokens(css);
  const model = parseTokens(TPL('design-tokens.modelo.css'));
  const layout = layoutArg || tokens['--car-layout'];
  if (!LAYOUTS.includes(layout)) throw new Error(`layout invalido em ${slug}: ${layout} (use ${LAYOUTS.join(', ')})`);
  // Nome e @: o design-tokens.css da marca manda; se ainda estiver igual ao modelo, vale o brand-profile.md.
  const profileFile = path.join(clientDir, 'brand-profile.md');
  const profile = parseBrand(fs.existsSync(profileFile) ? fs.readFileSync(profileFile, 'utf8') : '', slug);
  const pick = (k, fromProfile) => (own[k] && own[k] !== model[k] ? own[k] : fromProfile || tokens[k]);
  const footer = tokens['--car-footer-text'] || '';
  const opt = {
    name: pick('--brand-name', profile.name === slug ? '' : profile.name),
    handle: pick('--brand-handle', profile.handle),
    footer: /^\[.*\]$/.test(footer) ? '' : footer, // [entre colchetes] = ainda nao preenchido, nao vai para a imagem
    verified: tokens['--car-verified'] === 'on',
    titles: tokens['--car-titles'] !== 'off',
    alternate: tokens['--car-alternate'] === 'on',
    numbering: tokens['--car-numbering'] !== 'off',
  };
  opt.headerName = tokens['--car-header-name'] || opt.name;
  const avatarFile = resolveAvatar(clientDir, tokens['--brand-avatar']);
  const assets = path.join(clientDir, 'assets');
  const ctx = {
    slug, tokens, tokensCss: css, opt, chip: layout === 'chip', v2: layout === 'perfil-v2',
    template: TPL(`carrossel-${layout}.html`),
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
    brand: { name: opt.name, handle: opt.handle },
    layout,
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
  const { htmls, outDir: defaultOut, origemTokens, brand, layout, temAvatar } = build({ root, slug, nome: a.nome, slides, layout: a.layout });
  const outDir = a.out ? path.resolve(a.out) : defaultOut;
  console.log(`Marca: ${slug} (${brand.name} ${brand.handle}). Layout: ${layout}. Tokens: ${origemTokens}. Foto: ${temAvatar ? 'sim' : 'nao'}`);

  const { chromium } = require('playwright');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const ctxBrowser = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctxBrowser.newPage();
    for (let i = 0; i < htmls.length; i++) {
      await page.setContent(htmls[i], { waitUntil: 'load' });
      await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 4000))]);
      if (layout === 'perfil-v2' && await page.evaluate(() => { const m = document.querySelector('.media-zone'); return m.scrollHeight > m.clientHeight + 1; })) {
        console.warn(`aviso: slide ${i + 1} passa da zona de midia (invade o rodape). Encurte o texto ou divida o slide.`);
      }
      const out = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      console.log(`Slide ${i + 1}/${htmls.length}: ${out}`);
    }
  } finally {
    await browser.close();
  }
}

module.exports = { parseTokens, parseBrand, tokensFromDesignSystem, loadTokens, build, renderSlide };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
