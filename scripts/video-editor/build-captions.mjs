#!/usr/bin/env node
// build-captions.mjs
// Converte o JSON do WhisperX (palavras com timestamp) em "paginas" de legenda
// estilo CapCut: poucos tokens por pagina, com destaque palavra-a-palavra.
//
// Uso:
//   node build-captions.mjs <whisperx.json> <out-captions.json> [maxWordsPerPage] [maxGapSec]
//
// Saida (captions.json):
// [
//   { startMs, endMs, text, words: [{ word, startMs, endMs }] },
//   ...
// ]

import fs from "node:fs";

const [, , inPath, outPath, maxWordsArg, maxGapArg] = process.argv;

if (!inPath || !outPath) {
  console.error("uso: node build-captions.mjs <whisperx.json> <out.json> [maxWords] [maxGapSec]");
  process.exit(1);
}

const MAX_WORDS = Number(maxWordsArg) || 4; // CapCut: 3-5 palavras por pagina
const MAX_GAP = Number(maxGapArg) || 0.6; // pausa que forca quebra de pagina

const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));

// Achatar todas as palavras de todos os segmentos.
const words = [];
for (const seg of raw.segments || []) {
  for (const w of seg.words || []) {
    // WhisperX as vezes nao da start/end pra tokens curtos (ex: pontuacao).
    // Nesses casos herda o tempo do vizinho na 2a passada.
    words.push({
      word: (w.word || "").trim(),
      start: typeof w.start === "number" ? w.start : null,
      end: typeof w.end === "number" ? w.end : null,
    });
  }
}

// 2a passada: preencher start/end faltantes interpolando dos vizinhos.
for (let i = 0; i < words.length; i++) {
  if (words[i].start == null) {
    const prev = words[i - 1];
    words[i].start = prev ? prev.end : 0;
  }
  if (words[i].end == null) {
    const next = words[i + 1];
    words[i].end = next && next.start != null ? next.start : words[i].start + 0.2;
  }
}

// Agrupar em paginas.
const pages = [];
let cur = [];
const flush = () => {
  if (!cur.length) return;
  pages.push({
    startMs: Math.round(cur[0].start * 1000),
    endMs: Math.round(cur[cur.length - 1].end * 1000),
    text: cur.map((w) => w.word).join(" "),
    words: cur.map((w) => ({
      word: w.word,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    })),
  });
  cur = [];
};

for (let i = 0; i < words.length; i++) {
  const w = words[i];
  if (!w.word) continue;
  if (cur.length) {
    const gap = w.start - cur[cur.length - 1].end;
    const endsClause = /[.,!?;:]$/.test(cur[cur.length - 1].word);
    if (cur.length >= MAX_WORDS || gap >= MAX_GAP || endsClause) flush();
  }
  cur.push(w);
}
flush();

fs.writeFileSync(outPath, JSON.stringify(pages, null, 2));
console.log(`captions: ${pages.length} paginas, ${words.length} palavras -> ${outPath}`);
