#!/usr/bin/env node
// ct-motion-code / engine / critique.mjs
//
// Gera os artefatos pra critica visual (Claude LE com a tool Read, nao so
// roda numero e confia): contact sheet 2fps, tira de 12 quadros, teste
// 360px mobile, checagem de loop (SSIM primeiro x ultimo quadro) e o hash
// sha256 deste MP4 (comparar com uma segunda rodada de render.mjs pra
// provar determinismo, ver README/SKILL do ct-motion-code).
//
// Uso:
//   node critique.mjs --in video.mp4 --out-dir critique/

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

function ffprobeDuration(path) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
    { encoding: "utf8" }
  );
  return parseFloat(r.stdout.trim());
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} falhou:\n${r.stderr}`);
  return r;
}

function main() {
  const { values } = parseArgs({ options: { in: { type: "string" }, "out-dir": { type: "string" } } });
  if (!values.in) throw new Error("uso: node critique.mjs --in video.mp4 --out-dir critique/");
  const input = resolve(values.in);
  const outDir = resolve(values["out-dir"] || "critique");
  mkdirSync(outDir, { recursive: true });

  const duration = ffprobeDuration(input);

  // 1. contact sheet, 2fps (visao geral de toda a peca numa imagem so)
  const sheetFrames = Math.max(1, Math.ceil(duration * 2));
  const cols = Math.ceil(Math.sqrt(sheetFrames));
  const rows = Math.ceil(sheetFrames / cols);
  const contactSheet = join(outDir, "contact-sheet.png");
  run("ffmpeg", ["-y", "-i", input, "-vf", `fps=2,tile=${cols}x${rows}`, "-frames:v", "1", contactSheet]);

  // 2. tira de 12 quadros igualmente espacados (checar continuidade de movimento)
  const stripCount = 12;
  const stripFrames = [];
  for (let i = 0; i < stripCount; i++) {
    const t = (duration * i) / stripCount;
    const p = join(outDir, `strip-f${String(i).padStart(2, "0")}.png`);
    run("ffmpeg", ["-y", "-ss", t.toFixed(3), "-i", input, "-vf", "scale=200:-1", "-frames:v", "1", p]);
    stripFrames.push(p);
  }
  const strip = join(outDir, "strip-12.png");
  const hstackInputs = stripFrames.flatMap((p) => ["-i", p]);
  run("ffmpeg", ["-y", ...hstackInputs, "-filter_complex", `hstack=inputs=${stripCount}`, strip]);

  // 3. teste 360px mobile (inicio, meio, fim): legibilidade em tela pequena
  const mobileFrames = [];
  const times = [0.1, duration / 2, Math.max(0.1, duration - 0.2)];
  times.forEach((t, i) => {
    const p = join(outDir, `mobile-360-${i}.png`);
    run("ffmpeg", ["-y", "-ss", t.toFixed(3), "-i", input, "-vf", "scale=360:-1", "-frames:v", "1", p]);
    mobileFrames.push(p);
  });

  // 4. loop check: SSIM entre primeiro e ultimo quadro (engasgo no loop = SSIM baixo)
  const firstFrame = join(outDir, "loop-first.png");
  const lastFrame = join(outDir, "loop-last.png");
  run("ffmpeg", ["-y", "-i", input, "-frames:v", "1", firstFrame]);
  run("ffmpeg", ["-y", "-sseof", "-0.05", "-i", input, "-frames:v", "1", lastFrame]);
  const ssimRun = spawnSync("ffmpeg", ["-i", firstFrame, "-i", lastFrame, "-lavfi", "ssim", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const ssimMatch = (ssimRun.stderr || "").match(/All:([\d.]+)/);
  const ssimScore = ssimMatch ? parseFloat(ssimMatch[1]) : null;

  // 5. hash do mp4 (comparar com uma 2a rodada de render.mjs pra provar determinismo)
  const hash = createHash("sha256").update(readFileSync(input)).digest("hex");

  console.log("Contact sheet (2fps):", contactSheet);
  console.log("Tira de 12 quadros:", strip);
  console.log("Mobile 360px (inicio/meio/fim):", mobileFrames.join(", "));
  console.log(
    "Loop SSIM (primeiro x ultimo quadro):",
    ssimScore,
    ssimScore !== null && ssimScore >= 0.9 ? "(loop OK)" : "(CORTE VISIVEL no loop, checar)"
  );
  console.log("sha256 deste mp4:", hash);
}

main();
