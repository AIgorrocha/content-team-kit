#!/usr/bin/env node
// ct-motion-code / engine / sfx.mjs
//
// Sintetiza click/pop/thump/whoosh em WAV puro (sem lib de audio, so Buffer
// da stdlib) a partir de um cues.json {duration, seed, cues:[{type,t}]}.
// Ruido usa mulberry32 (mesma semente do motion.js), nunca Math.random,
// pra o som tambem sair reproduzivel.
//
// Uso:
//   node sfx.mjs --cues cues.json --out sfx-raw.wav
//
// cues.json:
//   { "duration": 6.0, "seed": 1,
//     "cues": [ {"type":"click","t":0.0}, {"type":"pop","t":0.8},
//               {"type":"thump","t":2.0}, {"type":"whoosh","t":3.2} ] }
//
// Normalizar pra -14 LUFS (regra dura da skill) com ffmpeg, sem reinventar
// medicao de loudness aqui:
//   ffmpeg -i sfx-raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 44100 sfx-mix.wav

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SR = 44100;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function envelope(n, attack, decay) {
  // sobe linear (attack amostras), desce exponencial (escala em decay amostras)
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i < attack ? i / Math.max(1, attack) : Math.exp((-(i - attack) / Math.max(1, decay)) * 4);
  }
  return out;
}

function synthClick(rng) {
  const n = Math.round(0.015 * SR);
  const env = envelope(n, n * 0.05, n * 0.6);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tone = Math.sin(2 * Math.PI * 3200 * (i / SR));
    const noise = (rng() * 2 - 1) * 0.15;
    out[i] = (tone * 0.8 + noise) * env[i];
  }
  return out;
}

function synthPop(rng) {
  const n = Math.round(0.05 * SR);
  const env = envelope(n, n * 0.1, n * 0.5);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const freq = 900 - 600 * (i / n); // sweep de frequencia pra baixo
    out[i] = Math.sin(2 * Math.PI * freq * (i / SR)) * env[i];
  }
  return out;
}

function synthThump(rng) {
  const n = Math.round(0.16 * SR);
  const env = envelope(n, n * 0.03, n * 0.8);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const freq = 110 - 40 * (i / n);
    const tone = Math.sin(2 * Math.PI * freq * (i / SR));
    const noise = (rng() * 2 - 1) * 0.08;
    out[i] = (tone + noise) * env[i];
  }
  return out;
}

function synthWhoosh(rng) {
  const n = Math.round(0.4 * SR);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = rng() * 2 - 1;
  // passa-baixa de 1 polo com cutoff crescente (abre o filtro ao longo do
  // tempo) pra imitar o "varrer" de frequencia do whoosh, sem gerar ruido
  // de verdade em banda especifica (economia deliberada: nao ha filtro
  // passa-faixa aqui, so este de 1 polo, que da o efeito de sopro sem
  // exigir DSP maior).
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const alpha = 0.02 + 0.3 * (i / n);
    prev = prev + alpha * (raw[i] - prev);
    const arc = Math.sin(Math.PI * (i / n)); // envelope em arco (sobe e desce)
    out[i] = prev * arc;
  }
  return out;
}

const SYNTH = { click: synthClick, pop: synthPop, thump: synthThump, whoosh: synthWhoosh };

function mixCues(cues, duration, seed) {
  const totalSamples = Math.round(duration * SR);
  const mix = new Float32Array(totalSamples);
  const rng = mulberry32(seed);
  for (const cue of cues) {
    const synth = SYNTH[cue.type];
    if (!synth) throw new Error(`tipo de cue desconhecido: ${cue.type} (use click|pop|thump|whoosh)`);
    const sound = synth(rng);
    const startSample = Math.round(cue.t * SR);
    for (let i = 0; i < sound.length; i++) {
      const idx = startSample + i;
      if (idx >= 0 && idx < mix.length) mix[idx] += sound[i];
    }
  }
  // clip suave (tanh) pra nao estourar quando cues se sobrepoem
  for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh(mix[i]);
  return mix;
}

function writeWav(path, samples, sampleRate) {
  const bytesPerSample = 2;
  const byteRate = sampleRate * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(bytesPerSample, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

function main() {
  const { values } = parseArgs({ options: { cues: { type: "string" }, out: { type: "string" } } });
  if (!values.cues || !values.out) throw new Error("uso: node sfx.mjs --cues cues.json --out saida.wav");
  const cues = JSON.parse(readFileSync(resolve(values.cues), "utf8"));
  const mix = mixCues(cues.cues, cues.duration, cues.seed ?? 1);
  writeWav(resolve(values.out), mix, SR);
  const lufsOut = values.out.replace(/\.wav$/i, "-lufs.wav");
  console.log(`OK: ${values.out} (${cues.cues.length} cues, ${cues.duration}s)`);
  console.log(`Normalizar pra -14 LUFS: ffmpeg -i ${values.out} -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 44100 ${lufsOut}`);
}

main();
