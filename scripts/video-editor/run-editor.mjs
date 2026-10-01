#!/usr/bin/env node
// run-editor.mjs - orquestrador "CapCut com agentes" (white-label).
// Encadeia: normaliza video do talento (1 passe) -> transcricao -> legendas ->
// captura imagem da pagina (proposta/app) -> render Remotion CapCutSplit.
//
// Uso:  node run-editor.mjs <config.json>
//
// config.json:
// {
//   "name": "agentes-skills",
//   "client": "{slug-do-cliente}",
//   "sourceVideo": "entrada/gravacao.mp4",
//   "pageUrl": "http://localhost:8099/",     // pagina pra rolar na tela (ou null)
//   "anon": "Cliente Real=>Cliente Exemplo",  // opcional
//   "hide": ".nav,.hero,footer.foot",         // selectores a esconder na captura
//   "composition": "CapCutSplit",             // ou "CapCutSplitAlt" (split alternado; exige layout)
//   "layout": [ {"fromSec":0,"toSec":5,"mode":"talk"}, ... ]   // opcional (obrigatorio no Alt)
// }
//
// Legenda: o estilo vem de clients/{slug}/design-system.md, secao "Legenda de reel" (estilo,
// cor do texto, cor de destaque da palavra falada, caixa e peso, posicao). Sem a secao, vale o
// padrao do kit (branca, maiusculas, negrito, sem destaque). O config.json pode sobrepor com
// captionColor, highlightColor ("sem destaque" = null), captionStyle ("phrase"|"word"),
// captionUppercase, captionBold e captionPosition ("bottom"|"center").
//
// Ambiente (.env.local): FFMPEG_BIN, FFPROBE_BIN, SELF_EVAL=0 (desliga o self-eval),
// BROWSER_EXECUTABLE (Chrome do sistema, lido por remotion/remotion.config.ts),
// ANTHROPIC_API_KEY (so para cutLlm).
//
// LICOES CRITICAS embutidas (ver SKILL.md):
//  - Normaliza o video do talento em UM passe (autorotate + 30fps CFR). NUNCA
//    encadear varios re-encodes: isso injeta frame preto periodico (a cada N
//    frames, N = denominador do fps original) = "tela piscando".
//  - Tela = SCREENSHOT full-page rolado por codigo no Remotion (pan), NAO video
//    de scroll do Chrome (25fps VFR -> judder ao reamostrar pra 30fps).
//  - Render usa o Chrome do sistema (headless-shell do Remotion quebra no Windows).

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../video/_env.mjs";
import { selfEval } from "./self-eval.mjs";
import { resolveClient } from "../_lib/workspace-client.mjs";
import { brandFor, writeThemeFile } from "../video/_brand.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const FFMPEG = process.env.FFMPEG_BIN || "ffmpeg";
// ffprobe fica ao lado do ffmpeg (ou no PATH): ffmpeg -> ffprobe, ffmpeg.exe -> ffprobe.exe
const FFPROBE = process.env.FFPROBE_BIN || FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
const VENV = path.join(ROOT, "integrations/video-editor");
const REMOTION_CLI = path.join(ROOT, "remotion/node_modules/@remotion/cli/remotion-cli.js");

const cfgPath = process.argv[2];
if (!cfgPath) { console.error("uso: node run-editor.mjs <config.json>"); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const NAME = cfg.name || "reel";
const WORK = path.join(ROOT, "output/reel-agentes", NAME);
const PUBLIC = path.join(ROOT, "remotion/public");
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(PUBLIC, { recursive: true }); // a pasta nao vem pronta num clone novo

const sh = (cmd, a, opts = {}) => { console.log(`\n$ ${cmd} ${a.join(" ")}`); return execFileSync(cmd, a, { stdio: ["inherit", "pipe", "inherit"], cwd: ROOT, ...opts }).toString(); };
const shv = (cmd, a, opts = {}) => { console.log(`\n$ ${cmd} ${a.join(" ")}`); execFileSync(cmd, a, { stdio: "inherit", cwd: ROOT, ...opts }); };
const probeDur = (f) => Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString().trim());
const probeBlack = (f) => {
  const r = spawnSync(FFMPEG, ["-i", f, "-vf", "blackdetect=d=0.01:pic_th=0.95", "-an", "-f", "null", "-"], { encoding: "utf8" });
  const out = (r.stderr || "") + (r.stdout || "");
  return (out.match(/black_start/g) || []).length;
};

// 1) Normaliza video do talento em UM PASSE: autorotate + 30fps CFR.
console.log("== 1/5 normaliza video (1 passe, 30fps CFR) ==");
let talking = path.join(WORK, "talking-clean.mp4");
shv(FFMPEG, ["-y", "-i", cfg.sourceVideo, "-map_metadata", "-1", "-vf", "fps=30,format=yuv420p", "-fps_mode", "cfr", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", talking]);
const blacks = probeBlack(talking);
console.log(`   frames pretos: ${blacks} (tem que ser 0)`);
if (blacks > 0) console.warn("   !! ATENCAO: video do talento com frames pretos. Confira o source.");

// 2) Transcricao palavra-a-palavra (WhisperX) no proprio video normalizado.
console.log("== 2/5 transcricao ==");
const wav = path.join(WORK, "audio.wav");
shv(FFMPEG, ["-y", "-i", talking, "-vn", "-ar", "16000", "-ac", "1", wav]);
shv("uv", ["run", "whisperx", wav, "--language", cfg.lang || "pt", "--model", cfg.model || "small", "--compute_type", "int8", "--output_format", "json", "--output_dir", WORK], { cwd: VENV });

// 2.5) Corte semantico (opcional, cutMode inclui "llm"). UM encode (regra critica).
let wordsJsonPath = path.join(WORK, "audio.json");
let edlKeeps = null; // pra remapear cfg.layout (se vier em timeline antigo)
const CUT_SEMANTIC = (cfg.cutMode || "").includes("llm");
if (CUT_SEMANTIC) {
  console.log("== 2.5 corte semantico (EDL) ==");
  const { keepSegments, remapWhisperX, remapLayout, ffmpegConcatFilter } = await import("./apply-edl.mjs");
  const edlPath = path.join(WORK, "edl.json");
  const edlArgs = [path.join(__dirname, "build-edl-llm.mjs"), wordsJsonPath, edlPath];
  if (cfg.cutLlm) edlArgs.push("--llm");
  if (cfg.maxDropPct) edlArgs.push(`--max-drop-pct=${cfg.maxDropPct}`);
  shv("node", edlArgs);
  const edl = JSON.parse(fs.readFileSync(edlPath, "utf8"));
  if (cfg.reviewEdl) { console.log(`   reviewEdl: pare e revise ${edlPath}. Re-rode sem reviewEdl pra aplicar.`); process.exit(0); }
  if (edl.drops.length) {
    const dur0 = probeDur(talking);
    const keeps = keepSegments(edl.drops, dur0);
    edlKeeps = keeps;
    const cut = path.join(WORK, "talking-cut.mp4");
    // UM encode: trim+concat dos keep-segments, 30fps CFR yuv420p.
    shv(FFMPEG, ["-y", "-i", talking, "-filter_complex", ffmpegConcatFilter(keeps),
      "-map", "[v]", "-map", "[a]", "-r", "30", "-fps_mode", "cfr", "-c:v", "libx264",
      "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", cut]);
    const cutBlacks = probeBlack(cut);
    console.log(`   cortado: ${edl.drops.length} trecho(s), ${dur0.toFixed(1)}s -> ${probeDur(cut).toFixed(1)}s. frames pretos: ${cutBlacks}`);
    // remapeia o WhisperX pro novo timeline (legendas batem com o video cortado)
    const remapped = remapWhisperX(JSON.parse(fs.readFileSync(wordsJsonPath, "utf8")), keeps);
    wordsJsonPath = path.join(WORK, "audio.cut.json");
    fs.writeFileSync(wordsJsonPath, JSON.stringify(remapped));
    talking = cut; // tudo a jusante usa o cortado
    if (cfg.layout) cfg.layout = remapLayout(cfg.layout, keeps, probeDur(cut));
  } else {
    console.log("   EDL vazia (nada pra cortar). Sigo com o video inteiro.");
  }
}

// 3) Legendas estilo CapCut
console.log("== 3/5 legendas ==");
const captionsJson = path.join(WORK, "captions.json");
shv("node", [path.join(__dirname, "build-captions.mjs"), wordsJsonPath, captionsJson, "4", "0.6"]);
console.log("   >> revise/corrija o texto das legendas em " + captionsJson + " antes do render final.");
const captions = JSON.parse(fs.readFileSync(captionsJson, "utf8"));

// 4) Captura imagem da pagina (proposta/app) - rolada por codigo no Remotion
let screenImage = null, screenImageHeight = 0;
if (cfg.pageUrl) {
  console.log("== 4/5 captura imagem da pagina ==");
  const png = path.join(PUBLIC, `page-${NAME}.png`);
  const a = [path.join(__dirname, "capture-page-image.mjs"), "--url", cfg.pageUrl, "--out", png, "--width", "1080"];
  if (cfg.anon) a.push("--anon", cfg.anon);
  if (cfg.hide) a.push("--hide", cfg.hide);
  const out = sh("node", a);
  screenImageHeight = Number((out.match(/HEIGHT=(\d+)/) || [])[1] || 0);
  screenImage = `page-${NAME}.png`;
  console.log(`   imagem ${screenImage} altura=${screenImageHeight}`);
} else {
  console.log("== 4/5 sem pageUrl, so talking + legenda ==");
}

// copia talking pro public
fs.copyFileSync(talking, path.join(PUBLIC, `talking-${NAME}.mp4`));

// composicao: CapCutSplit (padrao) ou CapCutSplitAlt (rosto maior, alterna cima/baixo, exige layout)
const COMPOSITION = cfg.composition || "CapCutSplit";
if (!["CapCutSplit", "CapCutSplitAlt"].includes(COMPOSITION)) {
  console.error(`composition invalida: ${COMPOSITION} (use CapCutSplit ou CapCutSplitAlt)`); process.exit(1);
}
if (COMPOSITION === "CapCutSplitAlt" && !cfg.layout) {
  console.error('CapCutSplitAlt precisa de "layout" no config: [{fromSec,toSec,mode:"split"|"talk",faceBottom:true|false,image:"arquivo-em-remotion/public.png"}]'); process.exit(1);
}

// identidade da marca: tema do Remotion + estilo da legenda (design-system.md)
const CLIENT = cfg.client || resolveClient();
const brand = brandFor(CLIENT);
if (brand.hasDesignSystem) writeThemeFile(CLIENT);
else console.warn(`   !! clients/${CLIENT}/design-system.md nao existe: tema e legenda neutros do kit.`);
const cap = brand.caption;
const captionProps = {
  captionStyle: cfg.captionStyle || cap.style,
  captionColor: cfg.captionColor || cap.color,
  highlightColor: cfg.highlightColor === undefined ? cap.highlight : (cfg.highlightColor === "sem destaque" ? null : cfg.highlightColor),
  captionUppercase: cfg.captionUppercase ?? cap.uppercase,
  captionBold: cfg.captionBold ?? cap.bold,
  captionPosition: cfg.captionPosition || cap.position,
};

// layout default: talk -> split -> screen -> split -> talk (termina no talento ao vivo)
const dur = probeDur(talking);
const layout = cfg.layout || [
  { fromSec: 0, toSec: 5, mode: "talk" },
  { fromSec: 5, toSec: dur * 0.34, mode: "split" },
  { fromSec: dur * 0.34, toSec: dur * 0.53, mode: screenImage ? "screen" : "split" },
  { fromSec: dur * 0.53, toSec: dur * 0.72, mode: "split" },
  { fromSec: dur * 0.72, toSec: 100, mode: "talk" },
];

// 5) Render Remotion (Chrome do sistema via remotion.config.ts) + self-eval com retry
console.log("== 5/5 render Remotion ==");
const propsPath = path.join(WORK, "props.json");
const outMp4 = path.join(WORK, `${NAME}.mp4`);

const renderOnce = (lay) => {
  const props = {
    themeSlug: CLIENT,
    talkingSrc: `talking-${NAME}.mp4`,
    audioSrc: null,
    captions,
    layout: lay,
    ...captionProps,
    ...(COMPOSITION === "CapCutSplit" ? { screenSrc: null, screenImage, screenImageHeight } : {}),
  };
  fs.writeFileSync(propsPath, JSON.stringify(props));
  shv("node", [REMOTION_CLI, "render", COMPOSITION, outMp4, `--props=${propsPath}`, "--log=error"], { cwd: path.join(ROOT, "remotion") });
};

// fronteiras de corte (em seg) = toSec de cada segmento menos o ultimo (sentinela)
const boundaries = () => layout.slice(0, -1).map((s) => Number(s.toSec));
// desloca a fronteira b (entre segmento b e b+1) por delta seg, sem inverter o segmento
const nudge = (b, delta) => {
  if (b == null || b < 0 || b + 1 >= layout.length) return false;
  const newTo = Number(layout[b].toSec) + delta;
  if (newTo <= Number(layout[b].fromSec) + 0.1) return false;        // nao colapsa seg b
  if (newTo >= Number(layout[b + 1].toSec) - 0.1) return false;      // nao colapsa seg b+1
  layout[b].toSec = newTo;
  layout[b + 1].fromSec = newTo;
  return true;
};

const SELF_EVAL = cfg.selfEval !== false && process.env.SELF_EVAL !== "0"; // default ON
const MAX_TRIES = SELF_EVAL ? 3 : 1;
const STEP = 2 / 30; // ~2 frames a 30fps

let verdict = null;
for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
  if (attempt > 1) console.log(`\n== self-eval: re-render tentativa ${attempt}/${MAX_TRIES} ==`);
  renderOnce(layout);
  if (!SELF_EVAL) break;

  verdict = selfEval(outMp4, boundaries(), { FFMPEG });
  console.log(`   self-eval: ${verdict.summary}`);
  if (verdict.ok) break;

  // tenta corrigir so o que esta em cima de fronteira (nudge); junta indices unicos
  const fixable = [...new Set(verdict.issues.map((i) => i.fixableBoundary).filter((b) => b != null))];
  if (fixable.length === 0) {
    console.warn("   self-eval: defeito(s) FORA de fronteira de corte, nao auto-corrigivel. Entrego assim e aviso.");
    break;
  }
  if (attempt === MAX_TRIES) break;
  let moved = false;
  for (const b of fixable) moved = nudge(b, STEP) || moved;
  if (!moved) { console.warn("   self-eval: nao deu pra deslocar a fronteira (limite do segmento). Paro."); break; }
  console.log(`   self-eval: desloquei fronteira(s) ${fixable.join(",")} em ${(STEP * 1000).toFixed(0)}ms e re-renderizo.`);
}

const outBlacks = probeBlack(outMp4);
console.log(`\n✅ pronto: ${outMp4}`);
console.log(`   frames pretos no final: ${outBlacks} (tem que ser 0)`);
console.log(`   duracao: ${probeDur(outMp4).toFixed(2)}s`);
if (SELF_EVAL && verdict) {
  console.log(`   self-eval final: ${verdict.ok ? "OK ✅" : "com ressalva ⚠️ -> " + verdict.summary}`);
  if (!verdict.ok) console.log(`   pontos: ${verdict.issues.map((i) => `${i.type}@${i.atSec}s`).join(", ")}`);
}
