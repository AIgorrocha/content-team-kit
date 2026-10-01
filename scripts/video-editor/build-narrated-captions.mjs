#!/usr/bin/env node
// build-narrated-captions.mjs
// Transforma o JSON do WhisperX da NARRACAO em props da composicao NarratedReel
// (remotion/src/NarratedReel.tsx): uma cena por frase falada, cada cena comecando no instante
// da primeira palavra real, cenas contiguas (sem buraco), legenda quebrada em frases.
//
// Uso:
//   node scripts/video-editor/build-narrated-captions.mjs <whisperx.json> <out-props.json>
//        [--theme slug] [--audio narracao.mp3] [--media a.mp4,b.png,c.mp4] [--clip-sec 5]
//        [--per-scene 1] [--max-words 6] [--fix fix.json]
//
//   --media      visual de cada cena, em ordem (arquivo em remotion/public/). Se faltar, repete o ultimo.
//                Extensao de imagem (png, jpg, jpeg, webp) vira cena de imagem; o resto, de video.
//   --clip-sec   duracao nativa dos clipes (ajusta a velocidade do clipe ao tempo da cena).
//   --per-scene  quantas frases do WhisperX formam uma cena (padrao 1).
//   --max-words  palavras por linha de legenda antes de quebrar (padrao 6).
//   --fix        JSON {"indice-da-palavra": "texto certo"}; "" remove a palavra. O WhisperX erra
//                nome proprio e termo tecnico: corrija mantendo o tempo de cada palavra.
//                O indice e a posicao da palavra na transcricao inteira (comeca em 0).
//
// Depois: npx remotion render NarratedReel out.mp4 --props=<out-props.json>   (dentro de remotion/)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

// Achata todas as palavras; palavra sem tempo herda do vizinho (mesma ideia do build-captions.mjs).
export function flattenWords(raw, fix = {}) {
  const words = [];
  (raw.segments || []).forEach((seg, si) => {
    for (const w of seg.words || []) {
      words.push({
        i: words.length,
        seg: si,
        text: (w.word || "").trim(),
        start: typeof w.start === "number" ? w.start : null,
        end: typeof w.end === "number" ? w.end : null,
      });
    }
  });
  for (let i = 0; i < words.length; i++) {
    if (words[i].start == null) words[i].start = words[i - 1] ? words[i - 1].end : 0;
    if (words[i].end == null) words[i].end = words[i + 1] && words[i + 1].start != null ? words[i + 1].start : words[i].start + 0.2;
  }
  return words
    .map((w) => (fix[w.i] !== undefined ? { ...w, text: fix[w.i] } : w))
    .filter((w) => w.text !== "");
}

export function buildNarrated(raw, opts = {}) {
  const { perScene = 1, maxWords = 6, media = [], clipSec = null, theme = "exemplo", audio = null, fix = {} } = opts;
  const words = flattenWords(raw, fix);
  if (!words.length) throw new Error("WhisperX sem palavras: confira o JSON de entrada");

  // agrupa por frase do WhisperX, depois junta perScene frases por cena
  const phrases = [];
  for (const w of words) {
    const last = phrases[phrases.length - 1];
    if (last && last.seg === w.seg) last.words.push(w);
    else phrases.push({ seg: w.seg, words: [w] });
  }
  const scenes = [];
  for (let i = 0; i < phrases.length; i += perScene) {
    scenes.push(phrases.slice(i, i + perScene).flatMap((p) => p.words));
  }

  const segments = scenes.map((ws, idx) => {
    const startMs = Math.round(ws[0].start * 1000);
    const next = scenes[idx + 1];
    const endMs = next ? Math.round(next[0].start * 1000) : Math.round(ws[ws.length - 1].end * 1000);
    let inLine = 0;
    const capWords = ws.map((w, k) => {
      const prev = ws[k - 1];
      const br = k > 0 && (/[.!?]$/.test(prev.text) || inLine >= maxWords);
      inLine = br || k === 0 ? 1 : inLine + 1;
      return { text: w.text, startMs: Math.round(w.start * 1000) - startMs, br };
    });
    const file = media.length ? media[Math.min(idx, media.length - 1)] : "";
    return {
      key: `s${idx + 1}`,
      src: file,
      kind: IMAGE_EXT.test(file) ? "image" : "video",
      clipSec: clipSec && !IMAGE_EXT.test(file) ? clipSec : null,
      startMs,
      endMs,
      words: capWords,
      captionAnchor: "bottom",
    };
  });

  return { themeSlug: theme, audioSrc: audio, segments };
}

function main() {
  const args = process.argv.slice(2);
  const [inPath, outPath] = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
  const flag = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : null;
  };
  if (!inPath || !outPath) {
    console.error("uso: node build-narrated-captions.mjs <whisperx.json> <out-props.json> [--theme slug] [--audio f.mp3] [--media a,b,c] [--clip-sec 5] [--per-scene 1] [--max-words 6] [--fix fix.json]");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const fixFile = flag("--fix");
  const props = buildNarrated(raw, {
    perScene: Number(flag("--per-scene")) || 1,
    maxWords: Number(flag("--max-words")) || 6,
    media: (flag("--media") || "").split(",").map((s) => s.trim()).filter(Boolean),
    clipSec: Number(flag("--clip-sec")) || null,
    theme: flag("--theme") || "exemplo",
    audio: flag("--audio"),
    fix: fixFile ? JSON.parse(fs.readFileSync(fixFile, "utf8")) : {},
  });
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(props, null, 2));
  console.log(`narrated: ${props.segments.length} cena(s) -> ${outPath}`);
  if (!props.segments[0].src) console.log("   >> preencha o campo src de cada cena (ou use --media) antes do render.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
