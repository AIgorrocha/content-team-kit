#!/usr/bin/env node
// login-setup.js: abre Chrome com perfil persistente pro usuario logar em TikTok.

const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

const PROFILE_DIR = path.join(__dirname, '.tiktok-profile');

(async () => {
  console.log('\n=== ct-tiktok-analyzer :: login-setup ===');
  console.log('Abrindo Chrome com perfil persistente.');
  console.log('Loga em tiktok.com (prefira login com email + senha, nao Google).');
  console.log('Quando estiver logado no feed, volte aqui e aperte ENTER.\n');

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
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question('Pressione ENTER quando estiver logado no TikTok... ', () => {
      rl.close();
      resolve();
    })
  );

  console.log(`\nPerfil persistente em: ${PROFILE_DIR}`);
  console.log('Agora voce pode rodar: node scrape.js profile --handle @{handle-do-cliente}');
  await context.close();
})();
