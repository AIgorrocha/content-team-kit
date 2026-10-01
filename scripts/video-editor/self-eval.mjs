#!/usr/bin/env node
// self-eval.mjs - confere um MP4 renderizado e devolve veredito.
// Inspirado no loop de auto-avaliacao do browser-use/video-use (ADR-014).
//
// Detecta, com foco nos pontos de corte (fronteiras do layout):
//  - frame preto (luma media ~0) -> "black"
//  - flicker (pico de brilho de 1 frame que volta) -> "flicker"
//  - black/flicker EM CIMA de uma fronteira de corte -> marcado fixavel (nudge)
//
// Uso programatico:  import { selfEval } from "./self-eval.mjs"
//   const verdict = selfEval(mp4Path, layoutBoundariesSec, { FFMPEG, FFPROBE })
// Uso CLI:  node self-eval.mjs <mp4> [b1,b2,b3...]
//
// Veredito: { ok, frames, issues:[{type, atSec, fixableBoundary|null}], summary }

import { execFileSync } from "node:child_process";

const DEFAULT_FFMPEG = process.env.FFMPEG_BIN ||
  "ffmpeg";

// Limiares (luma 0..255)
const BLACK_LUMA = 20;       // YAVG abaixo disso = preto. Black yuv420p range-TV = Y~16, entao 20 com "<" pega
const FLICKER_JUMP = 40;     // salto de brilho frame-a-frame
const BOUNDARY_WIN = 0.12;   // segundos de tolerancia em volta da fronteira

// Le YAVG (luma media) por frame via signalstats. Robusto p/ reels curtos.
function readLuma(mp4, FFMPEG) {
  const out = execFileSync(
    FFMPEG,
    ["-i", mp4, "-vf", "signalstats,metadata=print:file=-", "-an", "-f", "null", "-"],
    { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }
  ).toString();
  const frames = [];
  let curT = null;
  for (const line of out.split(/\r?\n/)) {
    const mt = line.match(/pts_time:([0-9.]+)/);
    if (mt) { curT = Number(mt[1]); continue; }
    const my = line.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
    if (my && curT != null) frames.push({ t: curT, y: Number(my[1]) });
  }
  return frames;
}

function nearestBoundary(t, boundaries) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < boundaries.length; i++) {
    const d = Math.abs(t - boundaries[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return bestD <= BOUNDARY_WIN ? best : null;
}

export function selfEval(mp4, boundaries = [], opts = {}) {
  const FFMPEG = opts.FFMPEG || DEFAULT_FFMPEG;
  const frames = readLuma(mp4, FFMPEG);
  const issues = [];
  if (frames.length === 0) {
    return { ok: false, frames: 0, issues: [{ type: "no-frames", atSec: 0, fixableBoundary: null }], summary: "sem frames lidos (ffmpeg signalstats falhou)" };
  }
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    // frame preto
    if (f.y < BLACK_LUMA) {
      issues.push({ type: "black", atSec: +f.t.toFixed(3), fixableBoundary: nearestBoundary(f.t, boundaries) });
      continue;
    }
    // flicker: pico isolado vs vizinhos (volta no frame seguinte)
    const prev = frames[i - 1], next = frames[i + 1];
    if (prev && next) {
      const up = f.y - prev.y, down = f.y - next.y;
      if (Math.abs(up) > FLICKER_JUMP && Math.abs(down) > FLICKER_JUMP && Math.sign(up) === Math.sign(down)) {
        issues.push({ type: "flicker", atSec: +f.t.toFixed(3), fixableBoundary: nearestBoundary(f.t, boundaries) });
      }
    }
  }
  const ok = issues.length === 0;
  const fixable = issues.filter((x) => x.fixableBoundary != null).length;
  const summary = ok
    ? `ok (${frames.length} frames, sem black/flicker)`
    : `${issues.length} problema(s): ${issues.map((x) => x.type).join(",")} | ${fixable} em fronteira de corte (fixavel)`;
  return { ok, frames: frames.length, issues, summary };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("self-eval.mjs")) {
  const mp4 = process.argv[2];
  if (!mp4) { console.error("uso: node self-eval.mjs <mp4> [b1,b2,...]"); process.exit(1); }
  const bounds = (process.argv[3] || "").split(",").filter(Boolean).map(Number);
  const v = selfEval(mp4, bounds);
  console.log(JSON.stringify(v, null, 2));
  process.exit(v.ok ? 0 : 2);
}
