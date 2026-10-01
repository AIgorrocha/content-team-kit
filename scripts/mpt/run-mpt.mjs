#!/usr/bin/env node
/**
 * run-mpt.mjs — wrapper white-label do MoneyPrinterTurbo pro Content Team AI.
 *
 * Le a identidade do cliente ativo (voz, cor de legenda, stroke, fonte, formato)
 * e dispara o driver Python (scripts/mpt/mpt_generate.py) dentro do ambiente uv
 * do MPT vendorizado. Depois move o MP4 final pra content/{slug}/reels/{nome}/.
 *
 * O ROTEIRO vem pronto (do ct-redator) via --script-file. O MPT nao escreve roteiro.
 *
 * Uso:
 *   node scripts/mpt/run-mpt.mjs \
 *     --slug {slug-do-cliente} \
 *     --subject "Tema do video" \
 *     --script-file output/mpt/meu-roteiro.txt \
 *     --terms "artificial intelligence,laptop,coding" \
 *     --name meu-reel
 *
 * Flags opcionais: --source (pexels|pixabay|local), --aspect (9:16|16:9),
 *                  --materials "p1,p2" (quando source=local), --no-subtitle
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveClient } from "../_lib/workspace-client.mjs";
import { brandFor } from "../video/_brand.mjs";

const require = createRequire(import.meta.url);
const { getClientDefaults } = require("../../skills/_shared/client-defaults/index.cjs");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MPT_DIR = join(ROOT, "integrations", "moneyprinter-turbo");
const DRIVER = join(ROOT, "scripts", "mpt", "mpt_generate.py");

// ---- identidade por cliente (espelha clients/{slug}/design-system.md) ----
// Voz real vem de skills/_shared/client-defaults/{slug}.cjs#mpt (opcional); sem
// arquivo pro cliente, cai no default neutro abaixo.
const DEFAULT_STYLE = {
  voice: "pt-BR-FranciscaNeural-Female",
  text_fore_color: "#FFFFFF",
  stroke_color: "#000000",
  font_size: 60,
  subtitle_position: "bottom",
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-subtitle") { args.subtitle = false; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function resolveUv() {
  const candidates = [
    "uv",
    join(process.env.USERPROFILE || process.env.HOME || "", ".local", "bin", "uv.exe"),
    join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "uv.exe"),
  ];
  for (const c of candidates) {
    try { execFileSync(c, ["--version"], { stdio: "ignore" }); return c; } catch { /* next */ }
  }
  // fallback: varre WinGet\Packages por uma pasta astral-sh.uv*/uv.exe
  const base = join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages");
  try {
    for (const d of readdirSync(base)) {
      if (/^astral-sh\.uv/i.test(d)) {
        const p = join(base, d, "uv.exe");
        if (existsSync(p)) return p;
      }
    }
  } catch { /* ignore */ }
  throw new Error("uv nao encontrado. Instale: winget install astral-sh.uv");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug || resolveClient();
  // legenda da marca (design-system.md, secao "Legenda de reel") sobre o default neutro;
  // skills/_shared/client-defaults/{slug}.cjs#mpt (opcional) manda em tudo.
  const cap = brandFor(slug).caption;
  const style = getClientDefaults(slug).mpt || {
    ...DEFAULT_STYLE,
    text_fore_color: cap.color,
    subtitle_position: cap.position === "center" ? "center" : "bottom",
  };

  if (!args.subject) throw new Error("--subject obrigatorio");
  if (!args["script-file"] && !args.script) throw new Error("--script-file obrigatorio (roteiro do ct-redator)");
  const script = args.script || readFileSync(resolve(ROOT, args["script-file"]), "utf-8").trim();
  if (!script) throw new Error("roteiro vazio");

  const name = args.name || slug + "-mpt";
  const source = args.source || "pexels";

  // checagem de chave Pexels
  if (source === "pexels") {
    const cfgPath = join(MPT_DIR, "config.toml");
    const cfg = existsSync(cfgPath) ? readFileSync(cfgPath, "utf-8") : "";
    // so linhas ativas (ignora comentarios # ... pexels_api_keys = ["exemplo"])
    const activeKeyLine = cfg.split(/\r?\n/).some(
      (l) => !l.trimStart().startsWith("#") && /pexels_api_keys\s*=\s*\[\s*"[^"]+"/.test(l)
    );
    if (!activeKeyLine) {
      throw new Error(
        "Sem chave Pexels em integrations/moneyprinter-turbo/config.toml.\n" +
        "Pegue gratis em https://www.pexels.com/api/ e coloque em pexels_api_keys = [\"SUA_CHAVE\"].\n" +
        "Ou rode com --source local --materials \"caminho1.mp4,caminho2.mp4\"."
      );
    }
  }

  const params = {
    subject: args.subject,
    script,
    terms: args.terms || "",
    source,
    aspect: args.aspect || "9:16",
    materials: args.materials || "",
    voice: style.voice,
    text_fore_color: style.text_fore_color,
    stroke_color: style.stroke_color,
    font_size: style.font_size,
    subtitle_position: style.subtitle_position,
    subtitle_enabled: args.subtitle === false ? false : true,
  };

  // grava params temporarios
  const tmpDir = join(ROOT, "output", "mpt");
  mkdirSync(tmpDir, { recursive: true });
  const paramsFile = join(tmpDir, `${name}.params.json`);
  writeFileSync(paramsFile, JSON.stringify(params, null, 2), "utf-8");

  const uv = resolveUv();
  console.log(`[mpt] cliente=${slug} voz=${style.voice} formato=${params.aspect}`);
  console.log(`[mpt] gerando video (pode demorar: download de clipes + render)...`);

  const out = execFileSync(uv, ["run", "python", DRIVER, paramsFile], {
    cwd: MPT_DIR,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
    // forca UTF-8 no Python: evita UnicodeEncodeError do loguru no console cp1252 (Windows)
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
  });

  const lastJson = out.trim().split(/\r?\n/).filter(Boolean).pop();
  let res;
  try { res = JSON.parse(lastJson); } catch { console.log(out); throw new Error("driver nao devolveu JSON valido"); }
  if (res.error || !res.final_videos || !res.final_videos.length) {
    throw new Error("MPT falhou: " + (res.error || "sem video final"));
  }

  // move pro destino do cliente
  const destDir = join(ROOT, "content", slug, "reels", name);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, `${name}.mp4`);
  copyFileSync(res.final_videos[0], dest);

  console.log(JSON.stringify({
    ok: true,
    slug,
    name,
    mp4: dest.replace(ROOT + "\\", "").replace(/\\/g, "/"),
    task_id: res.task_id,
    voice: style.voice,
    aspect: params.aspect,
  }, null, 2));
}

main();
