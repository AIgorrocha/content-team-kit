#!/usr/bin/env node
// login-auto.mjs - abre Chrome, espera o usuario logar no Instagram da conta indicada, detecta sozinho.
// Uso: node login-auto.mjs <conta>
// Exit 0 = logou, 2 = timeout.

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');
const ACCOUNTS = Object.fromEntries(
  Object.entries(CLIENT_ACCOUNTS).map(([key, acc]) => (
    [key, { profile: `.ig-profile-${key}`, handle: acc.handle }]
  ))
);
const acc = ACCOUNTS[process.argv[2]];
if (!acc) {
  console.error('Uso: node login-auto.mjs <conta>');
  process.exit(1);
}
const PROFILE_DIR = path.join(__dirname, acc.profile);
const TIMEOUT_MS = 5 * 60 * 1000;

(async () => {
  console.log(`Instagram (@${acc.handle}): logue nesta conta. Detecto sozinho.`);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });

  const start = Date.now();
  let ok = false;
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const loggedIn = await page.evaluate(() => {
        // logado = tem link de perfil / criar; sem botao "Entrar" / campo senha
        const hasNav = !!document.querySelector('a[href*="/direct/"], svg[aria-label="Nova publicação"], svg[aria-label="New post"], a[href$="/saved/"]');
        const hasLogin = !!document.querySelector('input[name="password"]') ||
          Array.from(document.querySelectorAll('button')).some((b) => /^(entrar|log in)$/i.test((b.textContent || '').trim()));
        return hasNav && !hasLogin;
      });
      if (loggedIn) { ok = true; break; }
    } catch { /* ignore */ }
    await page.waitForTimeout(2500);
  }
  console.log(ok ? `Instagram @${acc.handle} LOGIN OK.` : 'Instagram TIMEOUT (5min).');
  await page.waitForTimeout(1200);
  await context.close();
  process.exit(ok ? 0 : 2);
})();
