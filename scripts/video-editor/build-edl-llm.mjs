#!/usr/bin/env node
// build-edl-llm.mjs - decide cortes por CONTEUDO (nao so por silencio).
// Inspirado no EDL do browser-use/video-use (ADR-014 F1).
//
// Le o WhisperX (audio.json, palavras com timestamp) e devolve uma EDL: lista de
// intervalos a DROPAR. Default = heuristica segura (alta precisao). Com --llm,
// pede ao Claude pra marcar tambem take fraco / divagacao (semantico).
//
// Uso:  node build-edl-llm.mjs <audio.json> <out-edl.json> [--llm] [--max-drop-pct=25]
//
// Saida (edl.json):
// { drops:[{start,end,reason,text}], droppedSec, keptSec, sourceSec, mode }
//
// FILOSOFIA: errar pro lado de NAO cortar. Falso-corte estraga a fala; falso-keep
// so deixa uma muleta. EDL e auditavel: revise antes do render.

import fs from "node:fs";

const args = process.argv.slice(2);
const inPath = args[0];
const outPath = args[1];
const USE_LLM = args.includes("--llm");
const maxDropPct = Number((args.find((a) => a.startsWith("--max-drop-pct=")) || "").split("=")[1] || 25);

if (!inPath || !outPath) {
  console.error("uso: node build-edl-llm.mjs <audio.json> <out-edl.json> [--llm] [--max-drop-pct=25]");
  process.exit(1);
}

// Hesitacoes nao-lexicais (raramente palavra real) - lista conservadora.
// NAO incluir "é/né/tipo/aí/então": sao palavras reais, cortar muda sentido.
const HESITATION = new Set([
  "éé", "ééé", "éééé", "ãã", "ããã", "ãh", "ãhn", "hum", "hmm", "hmmm",
  "ahn", "ahnn", "uhm", "uhn", "ehh", "ehhh", "eh", "mmm", "hã", "hãã",
]);

const norm = (w) => (w || "").toLowerCase().replace(/[.,!?;:…"'`]/g, "").trim();

const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));
const words = [];
for (const seg of raw.segments || []) {
  for (const w of seg.words || []) {
    if (typeof w.start === "number" && typeof w.end === "number") {
      words.push({ word: (w.word || "").trim(), start: w.start, end: w.end, score: w.score ?? 1 });
    }
  }
}
const sourceSec = words.length ? words[words.length - 1].end : 0;

const drops = [];
const dropWord = (w, reason) => drops.push({ start: +w.start.toFixed(3), end: +w.end.toFixed(3), reason, text: w.word });

// 1) Hesitacao nao-lexical (alta precisao)
for (const w of words) {
  if (HESITATION.has(norm(w.word))) dropWord(w, "hesitacao");
}

// 2) Gagueira / repeticao imediata: "a a casa" ou "eu eu acho" -> dropa a 1a, mantem a ultima.
for (let i = 0; i < words.length - 1; i++) {
  const a = norm(words[i].word), b = norm(words[i + 1].word);
  if (!a || a.length < 1) continue;
  const gap = words[i + 1].start - words[i].end;
  if (a === b && gap < 0.6) dropWord(words[i], "gagueira");
}

// 3) (opcional) LLM: take fraco, false-start longo, divagacao. So adiciona dropes.
async function llmDrops() {
  let Anthropic;
  try { ({ default: Anthropic } = await import("@anthropic-ai/sdk")); }
  catch { console.warn("   --llm: @anthropic-ai/sdk indisponivel, pulo o passo semantico."); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.warn("   --llm: ANTHROPIC_API_KEY ausente, pulo o passo semantico."); return; }
  const client = new Anthropic({ apiKey: key });
  // transcript indexado por tempo p/ o modelo referenciar intervalos reais
  const transcript = words.map((w) => `[${w.start.toFixed(2)}-${w.end.toFixed(2)}] ${w.word}`).join(" ");
  const sys = "Voce edita Reels. Recebe transcricao com timestamps [ini-fim] por palavra. " +
    "Marque APENAS trechos claramente descartaveis: take refeito (a pessoa erra e repete a frase), " +
    "false-start longo, divagacao que nao agrega. NUNCA corte conteudo que faz sentido. " +
    "Responda SO um JSON: {\"drops\":[{\"start\":num,\"end\":num,\"reason\":\"...\"}]}. Conservador.";
  try {
    const r = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1500,
      system: sys, messages: [{ role: "user", content: transcript }],
    });
    const txt = r.content?.map((c) => c.text || "").join("") || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return;
    const parsed = JSON.parse(m[0]);
    for (const d of parsed.drops || []) {
      if (typeof d.start === "number" && typeof d.end === "number" && d.end > d.start) {
        drops.push({ start: +d.start.toFixed(3), end: +d.end.toFixed(3), reason: "llm:" + (d.reason || "take-fraco"), text: "" });
      }
    }
  } catch (e) { console.warn("   --llm: chamada falhou (" + e.message + "), sigo so com heuristica."); }
}

function finalize() {
  // merge de intervalos sobrepostos/adjacentes
  drops.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const d of drops) {
    const last = merged[merged.length - 1];
    if (last && d.start <= last.end + 0.05) { last.end = Math.max(last.end, d.end); last.reason += "+" + d.reason; }
    else merged.push({ ...d });
  }
  let droppedSec = merged.reduce((s, d) => s + (d.end - d.start), 0);
  // trava de seguranca: nao deixar cortar mais que maxDropPct do total
  const cap = (sourceSec * maxDropPct) / 100;
  let safe = merged;
  if (droppedSec > cap) {
    console.warn(`   EDL cortaria ${droppedSec.toFixed(1)}s (> ${maxDropPct}% de ${sourceSec.toFixed(1)}s). Mantenho so hesitacao/gagueira (descarto dropes LLM).`);
    safe = merged.filter((d) => !d.reason.includes("llm"));
    droppedSec = safe.reduce((s, d) => s + (d.end - d.start), 0);
  }
  const edl = {
    drops: safe,
    droppedSec: +droppedSec.toFixed(3),
    keptSec: +(sourceSec - droppedSec).toFixed(3),
    sourceSec: +sourceSec.toFixed(3),
    mode: USE_LLM ? "heuristica+llm" : "heuristica",
  };
  fs.writeFileSync(outPath, JSON.stringify(edl, null, 2));
  console.log(`EDL: ${safe.length} corte(s), -${droppedSec.toFixed(1)}s (${sourceSec.toFixed(1)}s -> ${edl.keptSec}s) [${edl.mode}] -> ${outPath}`);
}

if (USE_LLM) await llmDrops();
finalize();
