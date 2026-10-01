// Rodar: node --test skills/ct-carrossel-gen/scripts/generate-slides.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, parseTokens, tokensFromDesignSystem, parseBrand } = require('./generate-slides.js');

// tokens: texto do design-tokens.css da marca (omitido = marca sem o arquivo)
function tempBrand(designSystem, tokens) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-carrossel-'));
  const dir = path.join(root, 'clients', 'marca-teste');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'brand-profile.md'), '# Brand Profile - Padaria Sol\n\n- **Instagram**: @padariasol\n');
  if (designSystem) fs.writeFileSync(path.join(dir, 'design-system.md'), designSystem);
  if (tokens) fs.writeFileSync(path.join(dir, 'design-tokens.css'), tokens);
  return root;
}

const DS = `## Cores
| Nome | Hex | Uso |
|------|-----|-----|
| Background | #FFF8E7 | Fundo |
| Texto | #FFFFFF | Texto |
| Destaque 1 | #E4572E | Links |
## Fontes
| Tipo | Fonte | Uso |
|------|-------|-----|
| Primaria | Nunito | Textos |
| Secundaria | Lora | Headlines |
`;

const slides = [
  { tag: 'DICA', titulo: 'Tres erros de ==preco==' },
  { tag: 'ERRO 1', titulo: 'Copiar o vizinho', texto: ['Texto com **negrito** <b>.'] },
  { tag: 'FIM', titulo: 'Fale com a gente' },
];

test('parseTokens aceita ";" dentro de valor entre aspas', () => {
  const t = parseTokens('--a: "x;y";\n  --b: #FFF; /* c */');
  assert.strictEqual(t['--a'], 'x;y');
  assert.strictEqual(t['--b'], '#FFF');
});

test('marca sem tokens: layout padrao perfil-v2, cor, nome e @ da marca, nada fixo do dono', () => {
  const root = tempBrand(DS);
  const r = build({ root, slug: 'marca-teste', nome: 'teste', slides });
  assert.strictEqual(r.layout, 'perfil-v2');
  assert.match(r.htmls[0], /#E4572E/);
  assert.match(r.htmls[0], /header-name">Padaria Sol/);
  assert.match(r.htmls[0], /@padariasol/);
  assert.doesNotMatch(r.htmls[0], /via\.placeholder|sua-marca/);
  assert.strictEqual(r.origemTokens, 'derivado de design-system.md');
  assert.ok(r.outDir.endsWith(path.join('content', 'marca-teste', 'carousels', 'teste', 'slides')));
});

test('perfil-v2: tipos capa/conteudo/cta, titulo, N/TOTAL, pontos, sem selo por padrao', () => {
  const r = build({ root: tempBrand(DS), slug: 'marca-teste', nome: 't', slides });
  assert.match(r.htmls[0], /slide capa/);
  assert.match(r.htmls[0], /class="display-cover"/);
  assert.match(r.htmls[1], /slide conteudo/);
  assert.match(r.htmls[1], /class="headline-slide"/);
  assert.match(r.htmls[2], /slide cta/);
  assert.match(r.htmls[2], /class="headline-cta"/);
  assert.match(r.htmls[1], /02\/03/);
  assert.strictEqual((r.htmls[1].match(/class="dot( on)?"/g) || []).length, 3);
  assert.doesNotMatch(r.htmls[0], /class="check-selo"/);
});

test('perfil-v2: tipo explicito vence a posicao; passos numerados, itens e frase de cta', () => {
  const s = [
    { tipo: 'conteudo', titulo: 'A', itens: ['Acao | detalhe'] },
    { tipo: 'cta', titulo: 'B', texto: ['1. um', '2. dois', 'Comenta ==X==.'] },
  ];
  const r = build({ root: tempBrand(DS), slug: 'marca-teste', nome: 't', slides: s });
  assert.match(r.htmls[0], /slide conteudo/);
  assert.match(r.htmls[0], /class="step-desc">detalhe/);
  assert.match(r.htmls[1], /<div class="step-num">02</);
  assert.match(r.htmls[1], /class="cta-line">Comenta <span class="kw">X</);
  assert.throws(() => build({ root: tempBrand(DS), slug: 'marca-teste', nome: 't', slides: [{ tipo: 'xyz', titulo: 'A' }] }), /tipo invalido/);
});

test('--layout vence os tokens; chip alterna fundo e usa so frase de rodape preenchida; perfil mostra titulo', () => {
  const root = tempBrand(DS);
  const chip = build({ root, slug: 'marca-teste', nome: 't', slides, layout: 'chip' });
  assert.strictEqual(chip.layout, 'chip');
  assert.match(chip.htmls[0], /slide-base/);
  assert.match(chip.htmls[1], /slide-alt/);
  assert.match(chip.htmls[0], /class="tagline"><\/div>/); // rodape do modelo e [colchetes]: fica vazio
  const perfil = build({ root, slug: 'marca-teste', nome: 't', slides, layout: 'perfil' });
  assert.match(perfil.htmls[1], /class="slide-title">Copiar o vizinho/);
  assert.throws(() => build({ root, slug: 'marca-teste', nome: 't', slides, layout: 'xyz' }), /layout invalido/);
});

test('design-tokens.css da marca: layout, selo on, rodape, nome e @ proprios; falta de token cai no modelo', () => {
  const tokens = ':root {\n  --car-layout: chip;\n  --car-verified: on;\n  --car-footer-text: "Frase da casa";\n  --brand-name: "Marca X";\n  --brand-handle: "@marcax";\n  --brand-avatar: "";\n}\n';
  const root = tempBrand(DS, tokens);
  const r = build({ root, slug: 'marca-teste', nome: 't', slides });
  assert.strictEqual(r.layout, 'chip');
  assert.match(r.htmls[0], /Frase da casa/);
  assert.match(r.htmls[0], /@marcax/);
  assert.strictEqual(r.temAvatar, false); // token vazio e sem foto em assets: sem avatar
  assert.match(r.htmls[0], /--car-size-cover:\s*60px/); // veio do modelo
  const v2 = build({ root, slug: 'marca-teste', nome: 't', slides, layout: 'perfil-v2' });
  assert.match(v2.htmls[0], /class="check-selo"/);
  assert.match(v2.htmls[0], /header-name">Marca X/);
});

test('tokens ainda iguais ao modelo: nome e @ vem do brand-profile; avatar neutro do kit sem URL externa', () => {
  const model = fs.readFileSync(path.join(__dirname, '..', 'templates', 'design-tokens.modelo.css'), 'utf8');
  const r = build({ root: tempBrand('', model), slug: 'marca-teste', nome: 't', slides });
  assert.match(r.htmls[0], /header-name">Padaria Sol/);
  assert.match(r.htmls[0], /@padariasol/);
  assert.strictEqual(r.temAvatar, true);
  assert.match(r.htmls[0], /class="avatar"><img src="data:image\/svg\+xml/);
  assert.doesNotMatch(r.htmls[0], /https?:\/\/(?!fonts\.googleapis)/);
});

test('modelo do kit: sem nada preenchido, usa Sua Marca / @suamarca e valores neutros', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-carrossel-'));
  fs.mkdirSync(path.join(root, 'clients', 'nova'), { recursive: true });
  const r = build({ root, slug: 'nova', nome: 't', slides });
  assert.match(r.htmls[0], /header-name">Sua Marca/);
  assert.match(r.htmls[0], /@suamarca/);
  assert.match(r.origemTokens, /modelo neutro/);
});

test('fundo claro recebe texto escuro (contraste) e HTML do usuario e escapado', () => {
  const css = tokensFromDesignSystem(DS);
  assert.match(css, /--text-primary: #16181D/); // #FFFFFF reprovado sobre #FFF8E7
  const r = build({ root: tempBrand(DS), slug: 'marca-teste', nome: 't', slides });
  assert.match(r.htmls[1], /&lt;b&gt;/);
});

test('ultimo slide do perfil-v2 marca o ultimo ponto', () => {
  const r = build({ root: tempBrand(''), slug: 'marca-teste', nome: 't', slides });
  assert.match(r.htmls[2], /03\/03/);
  assert.match(r.htmls[2], /class="dot on"><\/div>\s*<\/div>/);
});

test('design-system nao preenchido cai no modelo neutro', () => {
  assert.strictEqual(tokensFromDesignSystem('| Destaque 1 | #000000 | Links |'), '');
  assert.deepStrictEqual(parseBrand('# Brand Profile - [NOME DA EMPRESA]', 'acme'), { name: 'acme', handle: '' });
});

test('slide sem titulo e recusado', () => {
  assert.throws(() => build({ root: tempBrand(''), slug: 'marca-teste', nome: 't', slides: [{ tag: 'X' }] }), /falta "titulo"/);
});
