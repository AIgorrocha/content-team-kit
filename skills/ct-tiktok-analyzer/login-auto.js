#!/usr/bin/env node
// login-auto.js: abre Chrome, espera o usuario logar no TikTok, detecta sozinho (sem ENTER).
// Exit 0 = logou, 2 = timeout.

const { chromium } = require('playwright');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.tiktok-profile');
const TIMEOUT_MS = 5 * 60 * 1000;

(async () => {
  console.log('TikTok: logue (email+senha de preferencia). Detecto sozinho.');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });

  const start = Date.now();
  let ok = false;
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      // logado = existe icone de perfil / botao de upload; sem botao "Log in" visivel
      const loggedIn = await page.evaluate(() => {
        const hasProfile = !!document.querySelector('[data-e2e="profile-icon"], [data-e2e="nav-profile"], a[href*="/upload"]');
        const loginBtn = Array.from(document.querySelectorAll('button,a')).some((b) => /log in|entrar/i.test(b.textContent || ''));
        return hasProfile && !loginBtn;
      });
      if (loggedIn) { ok = true; break; }
    } catch { /* ignore */ }
    await page.waitForTimeout(2500);
  }
  console.log(ok ? 'TikTok LOGIN OK.' : 'TikTok TIMEOUT (5min).');
  await page.waitForTimeout(1200);
  await context.close();
  process.exit(ok ? 0 : 2);
})();
