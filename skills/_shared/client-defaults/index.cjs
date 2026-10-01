/**
 * client-defaults/index.cjs - defaults reais por cliente, fora do kit generico.
 *
 * getClientDefaults(slug) tenta require(`./${slug}.cjs`); sem arquivo, devolve {} (o
 * chamador cai no default neutro que ja tem no proprio codigo). Isso mantem o
 * comportamento de hoje (clientes ja cadastrados aqui) identico sem env nova, e uma empresa
 * nova que nao tenha arquivo aqui cai direto no neutro.
 *
 * listClientSlugs() escaneia esta pasta (fora index.cjs) pra quem monta um mapa
 * account-key -> defaults sem hardcodar slug (ex: skills/_shared/ig-accounts.cjs).
 *
 * Self-check: node skills/_shared/client-defaults/index.cjs
 */
const fs = require('fs');
const path = require('path');

function getClientDefaults(slug) {
  if (!slug) return {};
  try {
    return require(`./${slug}.cjs`);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') return {};
    throw e;
  }
}

function listClientSlugs() {
  return fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.cjs') && f !== 'index.cjs')
    .map((f) => path.basename(f, '.cjs'));
}

module.exports = { getClientDefaults, listClientSlugs };

if (require.main === module) {
  console.assert(Object.keys(getClientDefaults('acme-inexistente')).length === 0, 'slug sem arquivo -> {}');
  console.assert(getClientDefaults().handle === undefined, 'sem slug -> {}');
  const slugs = listClientSlugs(); // lista vazia e normal numa instalacao nova
  console.assert(Array.isArray(slugs), 'scan devolve lista');
  console.log('client-defaults/index.cjs ok:', slugs);
}
