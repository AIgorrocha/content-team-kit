#!/usr/bin/env node
// ct-motion-code / engine / render.mjs
//
// Playwright (Chromium headless) chama window.seek(t) quadro a quadro (ou
// subquadro a subquadro pra motion blur), tira screenshot PNG e manda pro
// ffmpeg por pipe. Saida H.264 yuv420p CRF 16, pensada pra ser
// DETERMINISTICA (mesmo input -> mesmo hash sha256 em duas rodadas).
//
// Uso:
//   node render.mjs --html cena.html --out saida.mp4 --format 9:16 \
//     --fps 30 --duration 6 [--sub 1] [--seed 1] [--brand brand.json] [--audio trilha.wav]
//
// --format aceita 9:16 (1080x1920) | 1:1 (1080x1080) | 16:9 (1920x1080) |
// 4:5 (1080x1350). Ou passe --width/--height direto.
// --sub N > 1 ativa motion blur: N subquadros por quadro de saida,
// misturados com o filtro tmix do ffmpeg (ver runFfmpeg). Custa N vezes
// mais screenshot, so usar quando a peca tiver movimento rapido de verdade.
//
// playwright: tenta resolver do node_modules local; se este worktree nao
// tiver o pacote instalado (comum em worktree git separado do checkout
// principal), cai pro checkout principal fixo ou pra CT_MOTION_PLAYWRIGHT_PATH.
// ponytail: caminho fixo do checkout principal como ultimo fallback -- se o
// checkout mudar de lugar, exportar CT_MOTION_PLAYWRIGHT_PATH em vez de
// editar aqui.

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);

const FORMATS = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
  "4:5": [1080, 1350],
};

function loadPlaywright() {
  const candidates = ["playwright", process.env.CT_MOTION_PLAYWRIGHT_PATH].filter(
    Boolean
  );
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error(
    "playwright nao encontrado. Rode a partir de uma pasta com node_modules " +
      "(ex: checkout principal), defina CT_MOTION_PLAYWRIGHT_PATH, ou use " +
      "'npx -y playwright@<versao do package.json>' com este script."
  );
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      html: { type: "string" },
      out: { type: "string" },
      format: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      fps: { type: "string", default: "30" },
      duration: { type: "string" },
      sub: { type: "string", default: "1" },
      seed: { type: "string", default: "1" },
      brand: { type: "string" },
      audio: { type: "string" },
    },
  });
  if (!values.html || !values.out || !values.duration) {
    throw new Error("obrigatorios: --html --out --duration (segundos). Ver header do arquivo pro resto das flags.");
  }
  let width = values.width ? Number(values.width) : undefined;
  let height = values.height ? Number(values.height) : undefined;
  if ((!width || !height) && values.format) {
    const f = FORMATS[values.format];
    if (!f) throw new Error(`--format invalido: ${values.format}. Use ${Object.keys(FORMATS).join(", ")}.`);
    [width, height] = f;
  }
  if (!width || !height) throw new Error("informe --format 9:16|1:1|16:9|4:5 ou --width/--height.");
  return {
    html: resolve(values.html),
    out: resolve(values.out),
    width,
    height,
    fps: Number(values.fps),
    duration: Number(values.duration),
    sub: Number(values.sub),
    seed: Number(values.seed),
    brand: values.brand ? JSON.parse(readFileSync(resolve(values.brand), "utf8")) : undefined,
    audio: values.audio ? resolve(values.audio) : undefined,
  };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function captureFrames({ chromium, html, width, height, fps, duration, sub, seed, brand }, onFrame) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--hide-scrollbars",
    ],
  });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(
      ({ brand, config }) => {
        if (brand) window.BRAND = brand;
        window.CONFIG = config;
      },
      { brand, config: { width, height, fps, duration, seed } }
    );
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.__ready === true);
    await page.evaluate(() => document.fonts.ready);

    const totalFrames = Math.round(fps * duration);
    for (let i = 0; i < totalFrames; i++) {
      for (let k = 0; k < sub; k++) {
        const t = (i * sub + k + 0.5) / (fps * sub);
        await page.evaluate((t) => window.seek(t), t);
        const buf = await page.screenshot({ type: "png" });
        await onFrame(buf);
      }
    }
    return totalFrames;
  } finally {
    await browser.close();
  }
}

function runFfmpeg({ out, fps, sub, audio }) {
  const args = ["-y", "-f", "image2pipe", "-framerate", String(fps * sub), "-i", "-"];
  if (sub > 1) {
    // subquadros -> tmix (media dos ultimos `sub` quadros) -> pega 1 a cada
    // `sub` -> renumera timestamps. Motion blur simples e deterministico
    // (tmix e media aritmetica, sem aleatoriedade).
    const weights = Array(sub).fill(1).join(" ");
    args.push("-vf", `tmix=frames=${sub}:weights=${weights},select=not(mod(n\\,${sub})),setpts=N/FRAME_RATE/TB`);
  }
  args.push("-r", String(fps));
  if (audio) {
    args.push("-i", audio, "-shortest", "-c:a", "aac", "-b:a", "192k");
  }
  args.push(
    "-c:v",
    "libx264",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "1", // determinismo > velocidade: x264 multi-thread ainda e bit-exact
    // em teoria, mas -threads 1 tira essa variavel da equacao sem custo
    // relevante num clipe curto de reel/story.
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-movflags",
    "+faststart",
    "-map_metadata",
    "-1",
    out
  );
  mkdirSync(dirname(out), { recursive: true });
  return spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
}

async function main() {
  const cfg = parseCliArgs();
  const { chromium } = loadPlaywright();
  const ff = runFfmpeg(cfg);

  let frameCount = 0;
  const onFrame = async (buf) => {
    frameCount++;
    if (!ff.stdin.write(buf)) {
      await new Promise((r) => ff.stdin.once("drain", r));
    }
  };

  const ffDone = new Promise((res, rej) => {
    ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg saiu com codigo ${code}`))));
    ff.on("error", rej);
  });

  const t0 = Date.now();
  await captureFrames({ chromium, ...cfg }, onFrame);
  ff.stdin.end();
  await ffDone;
  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`OK: ${cfg.out}`);
  console.log(`frames capturados: ${frameCount} (${cfg.width}x${cfg.height} @ ${cfg.fps}fps, sub=${cfg.sub})`);
  console.log(`tempo total: ${elapsedS}s`);
  console.log(`sha256: ${sha256File(cfg.out)}`);
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
