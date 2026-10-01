/**
 * playwright-profile.cjs - Pasta do perfil de navegador (Playwright) POR MARCA, para as skills em
 * CommonJS. Mesma regra e mesmo caminho de playwrightDir() em scripts/_lib/workspace-client.mjs:
 * ~/.playwright-{tipo}-{slug}. Assim o login feito por um script vale para os outros, e uma marca
 * nunca usa a sessao logada de outra.
 *
 * Marca ativa: CT_CLIENT, depois .workspace (linha "client: slug"), depois clients/active-client.md.
 * Self-check: node skills/_shared/playwright-profile.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function activeSlug(root = ROOT, env = process.env) {
  if (env.CT_CLIENT) return env.CT_CLIENT;
  for (const f of ['.workspace', path.join('clients', 'active-client.md')]) {
    try {
      const m = fs.readFileSync(path.join(root, f), 'utf8').match(/^\s*client:\s*([a-z0-9-]+)\s*$/m);
      if (m) return m[1];
    } catch { /* tenta o proximo */ }
  }
  throw new Error('sem marca ativa: crie o .workspace (copie .workspace.example) ou defina CT_CLIENT');
}

function playwrightDir(kind, root = ROOT, env = process.env) {
  const home = env.USERPROFILE || env.HOME || os.homedir();
  return path.resolve(home, `.playwright-${kind}-${activeSlug(root, env)}`);
}

module.exports = { playwrightDir, activeSlug };

if (require.main === module) {
  const assert = require('assert');
  assert.strictEqual(activeSlug(ROOT, { CT_CLIENT: 'acme' }), 'acme');
  assert.strictEqual(playwrightDir('x', ROOT, { CT_CLIENT: 'acme', HOME: '/h' }), path.resolve('/h', '.playwright-x-acme'));
  assert.throws(() => activeSlug(path.join(os.tmpdir(), 'nao-existe-ct'), {}), /sem marca ativa/);
  console.log('playwright-profile.cjs ok');
}
