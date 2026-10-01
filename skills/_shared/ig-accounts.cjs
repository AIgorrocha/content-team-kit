/**
 * ig-accounts.cjs - Credenciais IG das 2 contas do cliente ativo (dono unico da escolha
 * de token da conta "b"). Fonte unica de client_slug/handle por conta: quem consome
 * credencial de conta importa de CLIENT_ACCOUNTS abaixo em vez de hardcodar de novo.
 *
 * Conta "a" (ex: cliente pessoa fisica): Instagram Login IGAA, graph.instagram.com, node /me.
 * Conta "b" (ex: cliente empresa): system user EAAN (META_ACCESS_TOKEN), graph.facebook.com,
 * node fixo em INSTAGRAM_BUSINESS_USER_ID. Se o token direto (IGAA) expirar e nao voltar por
 * refresh, INSTAGRAM_BUSINESS_ACCESS_TOKEN pode ficar obsoleto: ignora e usa META.
 *
 * client_slug/handle/linkedin de cada conta vem de skills/_shared/client-defaults/
 * (fora do kit exportavel); este arquivo fica generico.
 *
 * Self-check: node skills/_shared/ig-accounts.cjs
 */
const { getClientDefaults, listClientSlugs } = require('./client-defaults/index.cjs');

const BUSINESS_FB_IG_USER_ID = '';

function isIgDirectToken(token) {
  return !!(token && String(token).startsWith('IGAA'));
}

function businessCreds(env = process.env) {
  const business = env.INSTAGRAM_BUSINESS_ACCESS_TOKEN || '';
  const meta = env.META_ACCESS_TOKEN || '';
  const token = business.startsWith('EAAN') ? business : (meta.startsWith('EAAN') ? meta : business);
  const userId = env.INSTAGRAM_BUSINESS_USER_ID || BUSINESS_FB_IG_USER_ID;
  return { token, userId };
}

function principalCreds(env = process.env) {
  return {
    token: env.INSTAGRAM_ACCESS_TOKEN || '',
    userId: env.INSTAGRAM_USER_ID || '',
  };
}

// Monta CLIENT_ACCOUNTS varrendo skills/_shared/client-defaults/*.cjs: cada arquivo que
// declarar accountKey ('principal' ou 'business') vira uma entrada, com o par de credenciais
// correspondente. Sem arquivo pro cliente ativo, a conta simplesmente nao existe aqui.
const CREDS_BY_ACCOUNT_KEY = { principal: principalCreds, business: businessCreds };
const CLIENT_ACCOUNTS = {};
for (const slug of listClientSlugs()) {
  const d = getClientDefaults(slug);
  const creds = CREDS_BY_ACCOUNT_KEY[d.accountKey];
  if (!creds) continue;
  CLIENT_ACCOUNTS[d.accountKey] = {
    clientSlug: d.clientSlug || slug,
    handle: d.handle,
    linkedin: d.linkedin,
    creds,
  };
}

// Sem arquivo em client-defaults (caso normal numa instalacao nova), as contas saem da marca
// ativa (CT_CLIENT ou .workspace) e dos handles do .env.local. A conta business so existe se
// alguma credencial dela estiver configurada.
function activeClientSlug(env = process.env) {
  if (env.CT_CLIENT) return env.CT_CLIENT;
  // Mesma ordem de scripts/_lib/workspace-client.mjs: CT_CLIENT > .workspace > clients/active-client.md
  const root = require('path').join(__dirname, '..', '..');
  for (const f of ['.workspace', 'clients/active-client.md']) {
    try {
      const m = require('fs').readFileSync(require('path').join(root, f), 'utf8').match(/^\s*client:\s*([a-z0-9-]+)\s*$/m);
      if (m) return m[1];
    } catch {}
  }
  return '';
}
function fallbackAccounts(accounts, env = process.env) {
  const slug = activeClientSlug(env);
  if (!slug) return accounts;
  if (!accounts.principal) {
    accounts.principal = { clientSlug: slug, handle: env.IG_HANDLE || '', linkedin: { handle: env.LINKEDIN_HANDLE || '' }, creds: principalCreds };
  }
  if (!accounts.business && (env.INSTAGRAM_BUSINESS_USER_ID || env.LINKEDIN_ORG_ID)) {
    accounts.business = { clientSlug: slug, handle: env.INSTAGRAM_BUSINESS_HANDLE || '', linkedin: { handle: env.LINKEDIN_COMPANY_HANDLE || '' }, creds: businessCreds };
  }
  return accounts;
}
fallbackAccounts(CLIENT_ACCOUNTS);

module.exports = { BUSINESS_FB_IG_USER_ID, isIgDirectToken, businessCreds, principalCreds, CLIENT_ACCOUNTS };

if (require.main === module) {
  const a = businessCreds({ INSTAGRAM_BUSINESS_ACCESS_TOKEN: 'IGAAexpired', META_ACCESS_TOKEN: 'EAANok', INSTAGRAM_BUSINESS_USER_ID: '' });
  const b = businessCreds({ INSTAGRAM_BUSINESS_ACCESS_TOKEN: 'EAANbusiness', META_ACCESS_TOKEN: 'EAANmeta' });
  const c = businessCreds({ INSTAGRAM_BUSINESS_ACCESS_TOKEN: 'IGAAonly' });
  console.assert(a.token === 'EAANok' && a.userId === BUSINESS_FB_IG_USER_ID, 'IGAA business cai no META + user id padrao');
  console.assert(b.token === 'EAANbusiness', 'EAAN da business ganha do META');
  console.assert(c.token === 'IGAAonly', 'sem META, devolve o que tem');
  console.assert(isIgDirectToken('IGAAxx') && !isIgDirectToken('EAANxx'), 'deteccao IGAA');
  for (const key of Object.keys(CLIENT_ACCOUNTS)) {
    console.assert(typeof CLIENT_ACCOUNTS[key].clientSlug === 'string' && CLIENT_ACCOUNTS[key].clientSlug, `CLIENT_ACCOUNTS.${key} tem clientSlug (vem de client-defaults)`);
  }
  const assert = require('assert');
  const f1 = fallbackAccounts({}, { CT_CLIENT: 'minha-marca', IG_HANDLE: 'minhamarca' });
  assert.strictEqual(f1.principal.clientSlug, 'minha-marca');
  assert.strictEqual(f1.principal.handle, 'minhamarca');
  assert.strictEqual(f1.principal.linkedin.handle, '');
  assert.strictEqual(f1.business, undefined, 'business so existe com credencial');
  const f2 = fallbackAccounts({}, { CT_CLIENT: 'minha-marca', LINKEDIN_ORG_ID: '123' });
  assert.strictEqual(f2.business.clientSlug, 'minha-marca');
  console.log('ig-accounts.cjs ok');
}
