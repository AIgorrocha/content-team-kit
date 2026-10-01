#!/usr/bin/env node
/**
 * verify-asset.mjs - verificador de criativo generico (video ou imagem).
 *
 * Video: selfEval (black/flicker) + ffprobe (duracao, 1080x1920, tem audio).
 * Imagem: ffprobe (1080x1920) + amostra de luma (nao-preto via signalstats).
 *
 * Uso CLI:  node scripts/criativos/verify-asset.mjs <arquivo> [b1,b2,...]
 * Programatico:  import { verifyAsset } from "./verify-asset.mjs"
 *
 * Retorna JSON { ok, type, checks:{...}, issues:[...], summary }.
 * Exit 0 se ok, 2 se falhou. Casa com self-eval.mjs do repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { selfEval } from "../video-editor/self-eval.mjs";

const FFMPEG =
  process.env.FFMPEG_BIN ||
  "ffmpeg";
const FFPROBE =
  process.env.FFPROBE_BIN ||
  "ffprobe";

const W = Number(process.env.EXPECT_W || 1080);
const H = Number(process.env.EXPECT_H || 1920);
const BLACK_LUMA = 20; // media de luma abaixo disso = imagem preta/vazia

function probe(file) {
  const out = execFileSync(
    FFPROBE,
    [
      "-v", "error",
      "-show_entries", "stream=codec_type,width,height",
      "-show_entries", "format=duration",
      "-of", "json",
      file,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  ).toString();
  return JSON.parse(out);
}

function meanLuma(file) {
  // Le YAVG medio via signalstats (funciona pra imagem e video).
  const out = execFileSync(
    FFMPEG,
    ["-i", file, "-vf", "signalstats,metadata=print:file=-", "-frames:v", "1", "-an", "-f", "null", "-"],
    { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }
  ).toString();
  const m = out.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
  return m ? Number(m[1]) : 0;
}

export function verifyAsset(file, boundaries = []) {
  if (!existsSync(file)) {
    return { ok: false, type: "unknown", checks: {}, issues: [{ type: "missing" }], summary: "arquivo nao existe" };
  }
  const ext = extname(file).toLowerCase();
  const isVideo = [".mp4", ".mov", ".webm", ".mkv"].includes(ext);
  const meta = probe(file);
  const vstream = (meta.streams || []).find((s) => s.codec_type === "video");
  const hasAudio = (meta.streams || []).some((s) => s.codec_type === "audio");
  const width = vstream?.width;
  const height = vstream?.height;
  const dims = width === W && height === H;
  const issues = [];
  const warnings = [];
  const checks = { dimensions: dims, width, height };

  if (!dims) issues.push({ type: "dimensions", got: `${width}x${height}`, want: `${W}x${H}` });

  if (isVideo) {
    const duration = Number(meta.format?.duration || 0);
    checks.duration = +duration.toFixed(2);
    checks.hasAudio = hasAudio;
    // Audio e AVISO (nao bloqueia): render Remotion do modo gratis e mudo de
    // proposito (legenda queimada). Trilha entra no caminho Higgsfield ou na edicao.
    if (!hasAudio) warnings.push({ type: "no-audio" });
    if (duration < 3 || duration > 90) issues.push({ type: "duration-range", got: duration });
    const ev = selfEval(file, boundaries, { FFMPEG });
    checks.selfEval = { ok: ev.ok, frames: ev.frames, summary: ev.summary };
    if (!ev.ok) issues.push(...ev.issues.map((i) => ({ type: `frame-${i.type}`, atSec: i.atSec })));
    const ok = issues.length === 0;
    return { ok, type: "video", checks, issues, warnings, summary: ok ? `video ok (${duration.toFixed(1)}s, ${width}x${height}, audio=${hasAudio})${warnings.length ? " [avisos: " + warnings.map((w) => w.type).join(",") + "]" : ""}` : `${issues.length} problema(s): ${issues.map((i) => i.type).join(",")}` };
  }

  // imagem
  const luma = meanLuma(file);
  checks.meanLuma = +luma.toFixed(1);
  checks.nonBlack = luma >= BLACK_LUMA;
  if (luma < BLACK_LUMA) issues.push({ type: "black-image", meanLuma: +luma.toFixed(1) });
  const ok = issues.length === 0;
  return { ok, type: "image", checks, issues, summary: ok ? `imagem ok (${width}x${height}, luma=${luma.toFixed(0)})` : `${issues.length} problema(s): ${issues.map((i) => i.type).join(",")}` };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("verify-asset.mjs")) {
  const file = process.argv[2];
  if (!file) { console.error("uso: node verify-asset.mjs <arquivo> [b1,b2,...]"); process.exit(1); }
  const bounds = (process.argv[3] || "").split(",").filter(Boolean).map(Number);
  const v = verifyAsset(file, bounds);
  console.log(JSON.stringify(v, null, 2));
  process.exit(v.ok ? 0 : 2);
}
