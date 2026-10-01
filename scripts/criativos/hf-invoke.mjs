#!/usr/bin/env node
/**
 * hf-invoke.mjs - ponte generica entre generate-batch (.mjs/node) e a CLI OAuth do
 * Higgsfield (`higgsfield`, alias `hf`). NAO usa mais o wrapper REST
 * src/lib/higgsfield (chaves retornavam 401 — caminho abandonado).
 *
 * Roda a CLI via execFileSync com `--wait --json`, le o result_url e baixa
 * o asset. NAO faz fallback: qualquer erro da CLI/API sobe (exit != 0).
 * So e chamado quando HIGGSFIELD_ENABLED=true (caminho PAGO).
 *
 * Modelos:
 *   imagem -> nano_banana (bom texto PT-in-image, barato). Sai 768x1344 (9:16);
 *             reescalado pra 1080x1920 via ffmpeg.
 *   video  -> kling2_6 i2v (input_image = still local). Sai 1080x1920.
 *
 * Uso:
 *   node scripts/criativos/hf-invoke.mjs <jobFile.json>
 * jobFile:
 *   { mode:"image", imagePrompt, imageOut, aspectRatio? }
 *   { mode:"video", imageFile, videoActionPrompt, duration?, videoOut }
 *
 * Saida: ultima linha do stdout = "HFRESULT:" + JSON
 *   image -> { imageUrl, imageFile, bytes, credits }
 *   video -> { videoUrl, videoFile, bytes, credits }
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HF_BIN = process.env.HIGGSFIELD_BIN || "higgsfield";
const FFMPEG =
  process.env.FFMPEG_BIN ||
  "ffmpeg";
const IMG_MODEL = process.env.HIGGSFIELD_IMG_MODEL || "nano_banana";
const VID_MODEL = process.env.HIGGSFIELD_VID_MODEL || "kling2_6";
const WAIT_TIMEOUT = process.env.HIGGSFIELD_WAIT_TIMEOUT || "12m";

// Chama a CLI (auto .cmd no Windows via shell:true) e devolve o job JSON.
function hfCreate(model, params) {
  const args = ["generate", "create", model];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    args.push(`--${k}`, String(v));
  }
  args.push("--wait", "--wait-timeout", WAIT_TIMEOUT, "--json");
  const out = execFileSync(HF_BIN, args, {
    stdio: ["ignore", "pipe", "inherit"],
    shell: true,
    maxBuffer: 1 << 26,
  }).toString();
  // A CLI pode emitir logs antes do JSON; pega o ultimo bloco [ ... ].
  const start = out.indexOf("[");
  const end = out.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("CLI nao retornou JSON: " + out.slice(0, 400));
  const jobs = JSON.parse(out.slice(start, end + 1));
  const done = jobs[0];
  if (!done || done.status !== "completed" || !done.result_url) {
    throw new Error("job Higgsfield sem result_url/completed: " + JSON.stringify(done).slice(0, 300));
  }
  return done;
}

async function download(url, out) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download falhou ${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(out, buf);
  return buf.length;
}

// Reescala imagem 9:16 pra 1080x1920 exatos (nano sai 768x1344).
function scaleTo1080(src, dst) {
  execFileSync(FFMPEG, ["-y", "-i", src, "-vf", "scale=1080:1920:flags=lanczos", dst], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

const jobFile = process.argv[2];
if (!jobFile) {
  console.error("uso: node hf-invoke.mjs <jobFile.json>");
  process.exit(1);
}
const job = JSON.parse(readFileSync(jobFile, "utf8"));

if (job.mode === "image") {
  const r = hfCreate(IMG_MODEL, {
    prompt: job.imagePrompt,
    aspect_ratio: job.aspectRatio || "9:16",
  });
  const raw = job.imageOut.replace(/\.png$/i, ".raw.png");
  await download(r.result_url, raw);
  scaleTo1080(raw, job.imageOut);
  const bytes = readFileSync(job.imageOut).length;
  console.log(
    `HFRESULT:${JSON.stringify({ imageUrl: r.result_url, imageFile: job.imageOut, bytes, credits: 1 })}`
  );
} else if (job.mode === "video") {
  if (!job.imageFile) throw new Error("video job exige imageFile (still local pro i2v)");
  const r = hfCreate(VID_MODEL, {
    prompt: job.videoActionPrompt,
    aspect_ratio: "9:16",
    duration: job.duration || 10,
    sound: false,
    image: job.imageFile,
  });
  const bytes = await download(r.result_url, job.videoOut);
  // Custo real observado no plano plus ~ 11 total (list ~21). Aprox pra log.
  const credits = (job.duration || 10) >= 10 ? 20 : 10;
  console.log(
    `HFRESULT:${JSON.stringify({ videoUrl: r.result_url, videoFile: job.videoOut, bytes, credits })}`
  );
} else {
  console.error(`mode desconhecido: ${job.mode}`);
  process.exit(1);
}
