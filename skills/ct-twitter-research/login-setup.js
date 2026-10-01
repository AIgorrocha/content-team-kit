#!/usr/bin/env node
// login-setup.js: abre Chromium pro usuario logar manualmente no X. Salva a sessao no perfil
// da marca ativa (~/.playwright-x-{slug}), fora do repositorio. Rodar 1x (e quando sessao expirar).

const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

const { playwrightDir } = require('../_shared/playwright-profile.cjs');
const PROFILE_DIR = playwrightDir('x');
const STATE_PATH = path.join(PROFILE_DIR, 'storageState.json');

(async () => {
  console.log('\n=== ct-twitter-research :: login-setup ===');
  console.log('Abrindo Chrome real com perfil persistente.');
  console.log('IMPORTANTE: logue com handle + senha do X (NAO use "Entrar com Google", Google bloqueia browser automatizado).');
  console.log('Depois que estiver logado e vendo seu feed, volte aqui e pressione ENTER.\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question('Pressione ENTER quando estiver logado no feed do X... ', () => {
      rl.close();
      resolve();
    })
  );

  await context.storageState({ path: STATE_PATH });
  console.log(`\nSessao salva em: ${STATE_PATH}`);
  console.log(`Perfil Chrome persistente em: ${PROFILE_DIR}`);
  console.log('Agora voce pode rodar: node scrape.js timeline|bookmarks|search');
  await context.close();
})();
