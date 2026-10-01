#!/usr/bin/env node
// login-auto.js - abre Chrome, espera o usuario logar no LinkedIn, detecta sozinho (sem ENTER).
// Sessao = cookie li_at no perfil persistente. Exit 0 = logou, 2 = timeout.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { CLIENT_ACCOUNTS } = require('../_shared/ig-accounts.cjs');

const PROFILE_DIR = path.join(__dirname, '.linkedin-profile');
const STATE_PATH = path.join(__dirname, 'storageState.json');
const TIMEOUT_MS = 10 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const lock of ['Default/LOCK', 'SingletonLock', 'lockfile']) {
  const p = path.join(PROFILE_DIR, lock);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* chrome still holding */ }
}

const EXPECTED = new RegExp(`linkedin\\.com/in/${CLIENT_ACCOUNTS.principal.linkedin.handle}/?`, 'i');

async function whoami(page) {
  await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(2500);
  const url = page.url();
  return { url, ok: EXPECTED.test(url) };
}

async function loggedIn(page, context) {
  const cookies = await context.cookies('https://www.linkedin.com').catch(() => []);
  if (cookies.some((c) => c.name === 'li_at' && c.value)) return true;

  const url = page.url();
  if (/\/login|\/uas\/login|\/authwall/.test(url)) return false;
  if (/\/checkpoint\/(lg|challenge)/.test(url)) return false;

  const n = await page.locator([
    '#global-nav',
    'nav.global-nav',
    '.global-nav__me',
    'input.search-global-typeahead__input',
    '.search-global-typeahead__input',
    'div.feed-identity-module',
    'div.share-box-feed-entry__closed-share-box',
    'a[href*="/feed/"]',
    'button[aria-label="Eu"]',
    'button[aria-label="Me"]',
  ].join(', ')).count();
  return n > 0;
}

(async () => {
  console.log('LinkedIn: se nao estiver logado, email + senha (nao Google/Apple).');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false, channel: 'chrome', viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2500);

  if (await loggedIn(page, context)) {
    const who = await whoami(page);
    if (!who.ok) {
      console.error('CONTA ERRADA:', who.url, `Precisa ser linkedin.com/in/${CLIENT_ACCOUNTS.principal.linkedin.handle}`);
      await context.close();
      process.exit(3);
    }
    await context.storageState({ path: STATE_PATH });
    console.log('LinkedIn LOGIN OK (sessao ja existia).', who.url);
    await context.close();
    process.exit(0);
  }

  console.log('Nao detectei sessao. Espero ate 10 min o feed...');
  const deadline = Date.now() + TIMEOUT_MS;
  let ok = false;
  while (Date.now() < deadline) {
    if (await loggedIn(page, context)) { ok = true; break; }
    const left = Math.ceil((deadline - Date.now()) / 1000);
    console.log(`ainda esperando login... ${left}s  url=${page.url()}`);
    await sleep(8000);
  }

  if (ok) {
    const who = await whoami(page);
    if (!who.ok) {
      console.error('CONTA ERRADA:', who.url, `Precisa ser linkedin.com/in/${CLIENT_ACCOUNTS.principal.linkedin.handle}`);
      await context.close();
      process.exit(3);
    }
    await context.storageState({ path: STATE_PATH });
    console.log('LinkedIn LOGIN OK.', who.url);
  } else {
    console.log('LinkedIn TIMEOUT. url=' + page.url());
  }
  await sleep(800);
  await context.close();
  process.exit(ok ? 0 : 2);
})();
