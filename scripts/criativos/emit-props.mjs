#!/usr/bin/env node
/**
 * emit-props.mjs - le clients/{slug}/criativos/presets.json (cliente ativo
 * desta pasta) e escreve JSON de props pro `remotion render --props` /
 * `remotion still --props`. Generico: qualquer cliente com presets.json.
 *
 * Uso:  node scripts/criativos/emit-props.mjs <registro> <chave> [saida.json]
 *   registro: stories | feeds | reels
 *   chave:    nome do preset dentro do registro
 *   sem argumentos -> lista todos os presets do cliente ativo por formato
 *
 * Schema de presets.json: ver skills/ct-criativos-lote/SKILL.md
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveClient } from "../_lib/workspace-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..", "..");

const REGISTROS = ["stories", "feeds", "reels"];

function loadPresets(slug) {
  const file = resolve(REPO, "clients", slug, "criativos", "presets.json");
  if (!existsSync(file)) {
    console.error(`presets.json nao existe: ${file}`);
    process.exit(1);
  }
  return { file, data: JSON.parse(readFileSync(file, "utf8")) };
}

function buildProps(presets, registro, chave) {
  const entry = presets[registro]?.[chave];
  if (!entry) return null;
  const { hfImagePrompt, hfVideoPrompt, ...rest } = entry;
  return {
    theme: presets.theme,
    assets: presets.assets,
    variant: registro === "reels" ? "worker" : rest.variant || "worker",
    ...rest,
  };
}

const slug = resolveClient(REPO);
const { data: presets } = loadPresets(slug);

const registro = process.argv[2];
const chave = process.argv[3];

if (!registro) {
  console.log(`cliente ativo: ${slug}`);
  for (const r of REGISTROS) {
    const keys = Object.keys(presets[r] || {});
    console.log(`${r} (${keys.length}): ${keys.join(", ") || "(vazio)"}`);
  }
  process.exit(0);
}

if (!REGISTROS.includes(registro)) {
  console.error(`registro desconhecido: ${registro}. Opcoes: ${REGISTROS.join(", ")}`);
  process.exit(1);
}

if (!chave || !presets[registro]?.[chave]) {
  console.error(
    `chave "${chave ?? ""}" nao existe em ${registro}. Opcoes: ${Object.keys(presets[registro] || {}).join(", ")}`
  );
  process.exit(1);
}

const props = buildProps(presets, registro, chave);
const outPath = process.argv[4] || resolve(REPO, "remotion", `.cr-props-${slug}-${registro}-${chave}.json`);
writeFileSync(outPath, JSON.stringify(props, null, 2));
console.log(outPath);
