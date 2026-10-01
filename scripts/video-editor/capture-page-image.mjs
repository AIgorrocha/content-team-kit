#!/usr/bin/env node
// capture-page-image.mjs
// Captura um screenshot FULL-PAGE (imagem alta) de uma pagina web, com anti-flicker
// e selectores escondidos. Essa imagem e rolada DENTRO do Remotion (pan deterministico),
// o que evita 100% do stutter/flicker de gravar video de scroll do Chrome.
//
// Uso:
//   node capture-page-image.mjs --url <URL> --out <saida.png> [--width 1080]
//        [--anon "X=>Y,..."] [--hide ".nav,footer.foot,.hero"]
// Imprime a ALTURA da imagem (px) na ultima linha: "HEIGHT=<n>".

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[++i];
}
const URL = args.url;
const OUT = args.out;
const WIDTH = Number(args.width || 1080);
const ANON = args.anon || "";
const HIDE = (args.hide || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!URL || !OUT) {
  console.error("uso: node capture-page-image.mjs --url <URL> --out <png> [--width] [--anon] [--hide]");
  process.exit(1);
}

const anonPairs = ANON.split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
  const [from, to] = p.split("=>");
  return { from: (from || "").trim(), to: (to || "").trim() };
}).filter((p) => p.from);

const main = async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await (await browser.newContext({
    viewport: { width: WIDTH, height: 1350 },
    deviceScaleFactor: 1,
  })).newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

  // desliga animacoes/reveal pra screenshot estavel
  await page.addStyleTag({
    content: `.rv{opacity:1!important;transform:none!important;transition:none!important}*{animation:none!important;transition:none!important}`,
  });
  // anonimiza textos
  if (anonPairs.length) {
    await page.evaluate((pairs) => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const ns = []; while (w.nextNode()) ns.push(w.currentNode);
      for (const n of ns) { let t = n.nodeValue; for (const { from, to } of pairs) if (from) t = t.split(from).join(to); n.nodeValue = t; }
    }, anonPairs);
  }
  // esconde selectores (nav, hero, footer/equipe)
  if (HIDE.length) {
    await page.evaluate((sels) => {
      for (const s of sels) document.querySelectorAll(s).forEach((el) => (el.style.display = "none"));
    }, HIDE);
  }
  await page.evaluate(() => document.querySelectorAll("video").forEach((v) => v.pause()));
  await page.waitForTimeout(500);

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log(`imagem salva: ${OUT}`);
  console.log(`HEIGHT=${height}`);
};

main().catch((e) => { console.error("ERRO capture:", e.message); process.exit(1); });
