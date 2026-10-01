#!/usr/bin/env node
// login-setup.js - abre Chrome pro usuario logar manualmente no LinkedIn.
// Salva perfil persistente em .linkedin-profile/ (gitignored).

const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

const PROFILE_DIR = path.join(__dirname, '.linkedin-profile');

(async () => {
  console.log('\n=== ct-linkedin-analyzer :: login-setup ===');
  console.log('Abrindo Chrome real com perfil persistente.');
  console.log('IMPORTANTE: logue com email + senha do LinkedIn (NAO use "Sign in with Apple/Google").');
  console.log('Depois que estiver logado e vendo o feed, volte aqui e pressione ENTER.\n');

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
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question('Pressione ENTER quando estiver logado no feed do LinkedIn... ', () => {
      rl.close();
      resolve();
    })
  );

  console.log(`\nPerfil Chrome persistente em: ${PROFILE_DIR}`);
  console.log('Agora voce pode rodar: node scrape.js personal | company --org {org-id}');
  await context.close();
})();
