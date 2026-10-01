// Rodar: node --test skills/ct-carrossel-gen/scripts/generate-slides.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build, tokensFromDesignSystem, parseBrand } = require('./generate-slides.js');

function tempBrand(designSystem) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-carrossel-'));
  const dir = path.join(root, 'clients', 'marca-teste');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'brand-profile.md'), '# Brand Profile - Padaria Sol\n\n- **Instagram**: @padariasol\n');
  if (designSystem) fs.writeFileSync(path.join(dir, 'design-system.md'), designSystem);
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

test('usa cor, nome e handle da marca e nao tem valores fixos do dono', () => {
  const root = tempBrand(DS);
  const r = build({ root, slug: 'marca-teste', nome: 'teste', slides });
  assert.match(r.htmls[0], /#E4572E/);
  assert.match(r.htmls[0], /Padaria Sol/);
  assert.match(r.htmls[0], /@padariasol/);
  assert.doesNotMatch(r.htmls[0], /4A90D9|3897F0|via\.placeholder|sua-marca/);
  assert.strictEqual(r.origemTokens, 'derivado de design-system.md');
  assert.ok(r.outDir.endsWith(path.join('content', 'marca-teste', 'carousels', 'teste', 'slides')));
});

test('fundo claro recebe texto escuro (contraste) e HTML do usuario e escapado', () => {
  const root = tempBrand(DS);
  const css = tokensFromDesignSystem(DS);
  assert.match(css, /--text-primary: #16181D/); // #FFFFFF reprovado sobre #FFF8E7
  const r = build({ root, slug: 'marca-teste', nome: 'teste', slides });
  assert.match(r.htmls[1], /&lt;b&gt;/);
});

test('sem avatar: sem <img> de avatar e sem URL externa; ultimo slide sem seta', () => {
  const root = tempBrand('');
  const r = build({ root, slug: 'marca-teste', nome: 'teste', slides });
  assert.strictEqual(r.temAvatar, false);
  assert.doesNotMatch(r.htmls[0], /class="avatar"|https?:\/\/(?!fonts\.googleapis)/);
  assert.match(r.htmls[0], /class="swipe"/);
  assert.doesNotMatch(r.htmls[2], /class="swipe"/);
  assert.match(r.origemTokens, /modelo neutro/);
});

test('template de design-system nao preenchido cai no modelo neutro', () => {
  assert.strictEqual(tokensFromDesignSystem('| Destaque 1 | #000000 | Links |'), '');
  assert.deepStrictEqual(parseBrand('# Brand Profile - [NOME DA EMPRESA]', 'acme'), { name: 'acme', handle: '' });
});

test('slide sem titulo e recusado', () => {
  const root = tempBrand('');
  assert.throws(() => build({ root, slug: 'marca-teste', nome: 't', slides: [{ tag: 'X' }] }), /falta "titulo"/);
});
