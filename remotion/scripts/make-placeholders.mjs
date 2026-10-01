#!/usr/bin/env node
// Gera imagens neutras de exemplo em remotion/public/ (so as que faltam), sem dependencia:
// PNG escrito na mao com zlib. Servem para as composicoes de exemplo (KenBurnsTest,
// StaticCreative*, StoryScenes) renderizarem numa instalacao nova. Nada aqui e midia da marca:
// troque por arquivos reais via --props. Roda sozinho antes de studio, render e still.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// pixel(x, y) -> [r, g, b]
export function makePng(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), row + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// faixas horizontais cinza-azuladas com gradiente vertical suave (da para ver o pan e o zoom)
const stripes = (w, h, band) => (x, y) => {
  const base = 70 + Math.round((y / h) * 40);
  const v = Math.floor(y / band) % 2 ? base + 18 : base;
  return [v, v + 6, v + 14];
};
const solid = (r, g, b) => () => [r, g, b];

const FILES = [
  ["imagem-exemplo.png", 1080, 2400, stripes(1080, 2400, 160)],
  ["placeholder/cena.png", 1080, 1920, stripes(1080, 1920, 120)],
  ["placeholder/logo-full.png", 600, 200, solid(150, 160, 170)],
  ["placeholder/logo-icon.png", 200, 200, solid(150, 160, 170)],
  ["placeholder/worker.png", 800, 1000, solid(120, 130, 140)],
  ["placeholder/appmockup.png", 600, 1200, solid(200, 205, 210)],
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let made = 0;
  for (const [name, w, h, px] of FILES) {
    const out = join(PUBLIC, name);
    if (existsSync(out)) continue;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, makePng(w, h, px));
    made++;
  }
  console.log(made ? `placeholders: ${made} imagem(ns) neutra(s) criada(s) em remotion/public/` : "placeholders: ja existem");
  // Tema gerado por marca (scripts/video/emit-theme.mjs). Fica fora do Git; sem ele o
  // themes.ts nao compila, entao cria vazio ({} = usa o tema "exemplo").
  const tema = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "themes.generated.json");
  if (!existsSync(tema)) writeFileSync(tema, "{}\n");
}
