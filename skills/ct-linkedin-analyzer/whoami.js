#!/usr/bin/env node
// Imprime quem esta logado no perfil Playwright. Sem token, sem senha.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const PROFILE_DIR = path.join(__dirname, '.linkedin-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(PROFILE_DIR)) { console.log('sem perfil'); process.exit(2); }
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(3500);
  const url = page.url();
  const h1 = (await page.locator('h1').first().innerText().catch(() => '')).trim();
  console.log('url', url);
  console.log('nome', h1 || '(nao li)');
  await context.close();
  process.exit(/\/login|\/authwall/.test(url) ? 2 : 0);
})();
