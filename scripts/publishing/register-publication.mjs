#!/usr/bin/env node
/**
 * register-publication.mjs - Registra na mao uma peca JA publicada (TikTok, X, Threads, qualquer
 * rede) em ct_content_items, com o link real. Sem registro a peca some das metricas.
 *
 * Uso:
 *   node scripts/publishing/register-publication.mjs --platform tiktok --type video \
 *     --title "Nome da peca" --url "https://www.tiktok.com/@conta/video/123" \
 *     [--caption-file legenda.txt] [--client slug]
 *
 * --client padrao = marca ativa (.workspace ou CT_CLIENT).
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
const { registerPublication, activeClientOrNull } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const platform = flag("--platform"), type = flag("--type"), title = flag("--title"), url = flag("--url")
const client = flag("--client") || activeClientOrNull()
const capFile = flag("--caption-file")

if (!platform || !type || !title || !url || !client) {
  console.error('Uso: node scripts/publishing/register-publication.mjs --platform <rede> --type <tipo> --title "<titulo>" --url "<link real>" [--caption-file f.txt] [--client slug]')
  if (!client) console.error("Sem marca ativa: passe --client ou crie o .workspace.")
  process.exit(1)
}
if (capFile && !existsSync(capFile)) { console.error("--caption-file nao encontrado:", capFile); process.exit(1) }

try {
  await registerPublication({
    client_slug: client, platform, content_type: type, title, url,
    caption: capFile ? readFileSync(capFile, "utf8").trim() : null,
    source_agent: "register-publication.mjs",
  })
} catch (e) {
  console.error("Nao registrei:", e.message)
  process.exit(1)
}
