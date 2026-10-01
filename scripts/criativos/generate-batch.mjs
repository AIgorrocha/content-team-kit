#!/usr/bin/env node
/**
 * generate-batch.mjs - orquestra a fabrica de criativo generica white-label.
 * Cliente vem do workspace ativo desta pasta (scripts/_lib/workspace-client.mjs).
 *
 * Cadeia:  imagem (still) -> verify -> video (reel) -> verify -> upload-r2 (gated)
 *
 * MODO GRATIS (default): renderiza tudo com Remotion a partir de
 *   clients/{slug}/criativos/presets.json + clients/{slug}/criativos/assets/.
 *   Zero credito.
 *
 * MODO HIGGSFIELD (HIGGSFIELD_ENABLED=true): usa Higgsfield (nano_banana pra
 *   imagem, kling2_6 i2v pro video). GATED: sem a flag, nunca chama a API paga.
 *   Exige que o preset do angulo tenha hfImagePrompt (e hfVideoPrompt pro reel).
 *
 * Upload R2 tambem e GATED (ver upload-r2.mjs): sem env, faz dry-run.
 *
 * Uso:
 *   node scripts/criativos/generate-batch.mjs --angle <chave>                # story + reel
 *   node scripts/criativos/generate-batch.mjs --angle <chave> --still-only   # so a story
 *   node scripts/criativos/generate-batch.mjs --angle <chave> --format feed  # so o feed (still)
 *   node scripts/criativos/generate-batch.mjs --angle <chave> --format reel  # so o reel (video)
 *
 * Env flags:
 *   HIGGSFIELD_ENABLED=true   liga o caminho pago (senao Remotion-only)
 *   R2_*                      liga o upload real (senao dry-run)
 */
import { execSeguro } from "../_lib/exec-seguro.mjs";
import { mkdirSync, cpSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAsset } from "./verify-asset.mjs";
import { uploadR2 } from "./upload-r2.mjs";
import { resolveClient } from "../_lib/workspace-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");
const REMOTION_DIR = resolve(REPO, "remotion");

const SLUG = resolveClient(REPO);
const ASSETS_SRC = resolve(REPO, "clients", SLUG, "criativos", "assets");
const ASSETS_DEST = resolve(REMOTION_DIR, "public", SLUG);
const OUT_DIR = resolve(REPO, "output", SLUG, "criativos");

// Teto de custo pra UM batch pago (imagem + video). Nunca ultrapassar.
const CREDIT_CAP = 30;
const FFMPEG =
  process.env.FFMPEG_BIN ||
  "ffmpeg";

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(n);

const ANGLE = flag("--angle");
const FORMAT = flag("--format", "story+reel"); // story | feed | reel | story+reel
const STILL_ONLY = has("--still-only") || FORMAT === "feed";
const HIGGS = process.env.HIGGSFIELD_ENABLED === "true";

const REEL_COMP = "StaticCreativeReel";
const STORY_COMP = "StaticCreativeStory";
const FEED_COMP = "StaticCreativeFeed";

if (!ANGLE) {
  console.error("uso: node generate-batch.mjs --angle <chave-do-preset> [--still-only]");
  console.error("chaves disponiveis: node scripts/criativos/emit-props.mjs");
  process.exit(1);
}
// O angulo entra em nome de arquivo e de comando: so letras, numeros, _ e -.
if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(ANGLE)) {
  console.error("--angle invalido: use so letras, numeros, _ e -");
  process.exit(1);
}

// Sem shell: argumentos em array (ver scripts/_lib/exec-seguro.mjs).
function run(cmd, cmdArgs, cwd) {
  console.log(`  $ ${[cmd, ...cmdArgs].join(" ")}`);
  execSeguro(cmd === "node" ? process.execPath : cmd, cmdArgs, { cwd, stdio: "inherit" });
}

// Copia os assets do cliente pra remotion/public/{slug}/ antes de renderizar.
function syncAssets() {
  if (!existsSync(ASSETS_SRC)) {
    console.log(`[assets] nada em ${ASSETS_SRC}, pulando copia`);
    return;
  }
  mkdirSync(ASSETS_DEST, { recursive: true });
  cpSync(ASSETS_SRC, ASSETS_DEST, { recursive: true });
  console.log(`[assets] copiado ${ASSETS_SRC} -> ${ASSETS_DEST}`);
}

function propsFileFor(registro, angle) {
  const jsonPath = resolve(REMOTION_DIR, `.cr-props-${SLUG}-${registro}-${angle}.json`);
  run("node", [resolve(__dirname, "emit-props.mjs"), registro, angle, jsonPath], REPO);
  return jsonPath;
}

function renderStill(outFile) {
  const isFeed = FORMAT === "feed";
  const propsFile = propsFileFor(isFeed ? "feeds" : "stories", ANGLE);
  run("npx", ["remotion", "still", "src/index.ts", isFeed ? FEED_COMP : STORY_COMP, outFile, `--props=${propsFile}`], REMOTION_DIR);
}

function renderReel(outFile) {
  const propsFile = propsFileFor("reels", ANGLE);
  run("npx", ["remotion", "render", "src/index.ts", REEL_COMP, outFile, `--props=${propsFile}`], REMOTION_DIR);
}

// ---------------------------------------------------------------------------
// Caminho PAGO (Higgsfield). Sem fallback: se a API falhar, o erro sobe.
// Prompts vem do preset (hfImagePrompt/hfVideoPrompt), nunca hardcoded aqui.
// ---------------------------------------------------------------------------
function loadPresetEntry(registro, angle) {
  const file = resolve(REPO, "clients", SLUG, "criativos", "presets.json");
  const presets = JSON.parse(readFileSync(file, "utf8"));
  return presets[registro]?.[angle];
}

function hfInvoke(job) {
  const jobFile = resolve(OUT_DIR, `.hf-job-${job.mode}-${ANGLE}.json`);
  writeFileSync(jobFile, JSON.stringify(job, null, 2));
  console.log(`  $ node ${resolve(__dirname, "hf-invoke.mjs")} ${jobFile}`);
  const out = execSeguro(process.execPath, [resolve(__dirname, "hf-invoke.mjs"), jobFile], { cwd: REPO, stdio: ["ignore", "pipe", "inherit"] }).toString();
  process.stdout.write(out);
  const m = out.split(/\r?\n/).reverse().find((l) => l.startsWith("HFRESULT:"));
  if (!m) throw new Error("hf-invoke nao retornou HFRESULT");
  return JSON.parse(m.slice("HFRESULT:".length));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`== generate-batch | cliente=${SLUG} | angulo=${ANGLE} | higgsfield=${HIGGS ? "ON" : "off"} ==`);
  syncAssets();

  if (HIGGS) {
    const storyEntry = loadPresetEntry("stories", ANGLE);
    if (!storyEntry?.hfImagePrompt) {
      throw new Error(`preset "${ANGLE}" nao tem hfImagePrompt; obrigatorio com HIGGSFIELD_ENABLED=true`);
    }
    const HF_BIN = process.env.HIGGSFIELD_BIN || "higgsfield";
    const cost = (model, extra) => {
      const out = execSeguro(HF_BIN, ["generate", "cost", model, ...extra, "--json"], { stdio: ["ignore", "pipe", "inherit"] }).toString();
      return Number(JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)).credits_exact || 0);
    };
    const imgCred = cost("nano_banana", ["--prompt", storyEntry.hfImagePrompt, "--aspect_ratio", "9:16"]);
    const reelEntry = STILL_ONLY ? null : loadPresetEntry("reels", ANGLE);
    const vidCred =
      STILL_ONLY || !reelEntry?.hfVideoPrompt
        ? 0
        : cost("kling2_6", ["--prompt", reelEntry.hfVideoPrompt, "--aspect_ratio", "9:16", "--duration", "10"]);
    const estimate = imgCred + vidCred;
    console.log(`[cost] estimativa REAL: imagem ${imgCred} + video ${vidCred} = ${estimate} creditos (teto ${CREDIT_CAP})`);
    if (estimate > CREDIT_CAP) throw new Error(`estimativa ${estimate} > teto ${CREDIT_CAP}; abortando antes de gastar`);
  }

  const stillKind = FORMAT === "feed" ? "feed" : "story";

  // Free mode + --format reel: reel nao depende de still nenhuma, pula direto.
  if (!HIGGS && FORMAT === "reel") {
    const reelFile = resolve(OUT_DIR, `reel-${ANGLE}.mp4`);
    console.log("[vid] modo gratis -> Remotion render");
    renderReel(reelFile);
    const vVid = verifyAsset(reelFile);
    console.log("[vid] verify:", JSON.stringify(vVid.checks), vVid.ok ? "PASS" : "FAIL");
    if (!vVid.ok) throw new Error("reel reprovado na verificacao: " + vVid.summary);
    await uploadR2(reelFile, `social/gen/${SLUG}-reel-${ANGLE}.mp4`);
    console.log("== done ==");
    return;
  }

  // 1. IMAGEM (still ou feed; e tambem a base i2v do reel pago)
  const stillFile = resolve(OUT_DIR, `${stillKind}-${ANGLE}.png`);
  if (HIGGS) {
    console.log("[img] Higgsfield generateImage (pago, sem fallback)");
    const storyEntry = loadPresetEntry(FORMAT === "feed" ? "feeds" : "stories", ANGLE);
    const r = hfInvoke({ mode: "image", imagePrompt: storyEntry.hfImagePrompt, imageOut: stillFile, imageQuality: "1080p" });
    console.log(`[img] gerada (${r.bytes} bytes, ~${r.credits} creditos): ${r.imageUrl}`);
  } else {
    console.log("[img] modo gratis -> Remotion still");
    renderStill(stillFile);
  }
  const vImg = verifyAsset(stillFile);
  console.log("[img] verify:", JSON.stringify(vImg.checks), vImg.ok ? "PASS" : "FAIL");
  if (!vImg.ok) throw new Error(`${stillKind} reprovada na verificacao: ` + vImg.summary);
  await uploadR2(stillFile, `social/gen/${SLUG}-${stillKind}-${ANGLE}.png`);

  if (STILL_ONLY) { console.log("== done (still-only) =="); return; }

  // 2. VIDEO (reel)
  const reelFile = resolve(OUT_DIR, `reel-${ANGLE}.mp4`);
  if (HIGGS) {
    const reelEntry = loadPresetEntry("reels", ANGLE);
    if (!reelEntry?.hfVideoPrompt) throw new Error(`preset "${ANGLE}" nao tem hfVideoPrompt em reels`);
    console.log("[vid] Higgsfield i2v a partir da still (pago, sem fallback)");
    const r = hfInvoke({
      mode: "video",
      imageFile: stillFile,
      videoActionPrompt: reelEntry.hfVideoPrompt,
      duration: 10,
      videoOut: reelFile,
    });
    console.log(`[vid] clipe (${r.bytes} bytes, ~${r.credits} creditos): ${r.videoUrl}`);
  } else {
    console.log("[vid] modo gratis -> Remotion render");
    renderReel(reelFile);
  }
  const vVid = verifyAsset(reelFile);
  console.log("[vid] verify:", JSON.stringify(vVid.checks), vVid.ok ? "PASS" : "FAIL");
  if (!vVid.ok) throw new Error("reel reprovado na verificacao: " + vVid.summary);
  await uploadR2(reelFile, `social/gen/${SLUG}-reel-${ANGLE}.mp4`);

  console.log("== done ==");
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
