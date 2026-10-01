#!/usr/bin/env node
/**
 * join-check.mjs - Falha se o join "peca nossa x desempenho" quebrar.
 *
 * O join so existe se a peca publicada estiver registrada COM uma URL que case com a metrica.
 * Este check e o que impede a regressao silenciosa: peca publicada e ausente do relatorio
 * do cockpit passa a quebrar o pipeline, em vez de sumir sem ninguem notar.
 *
 * Falha (exit 1) quando, nos ultimos N dias (default 30), existir peca com status=published
 * que NAO aparece na secao "Desempenho das nossas pecas":
 *   - sem publish_url  -> publicada por fora do registro
 *   - com publish_url que nao vira chave canonica (ex: instagram.com/p/<id de midia>)
 *
 * NAO falha por falta de metrica: o analyzer roda semanal, a medicao chega depois da
 * publicacao. Ausencia de medicao recente e reportada como aviso, nunca como erro.
 *
 * Uso: node scripts/checks/join-check.mjs [--days 30] [--client all|slug]
 */

import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const { loadEnv } = require(path.join(root, "skills/_shared/metrics-writer.cjs"))
const { postKey } = require(path.join(root, "skills/_shared/post-key.cjs"))
const { joinPieces } = require(path.join(root, "skills/ct-social-cockpit/pieces.cjs"))

// Clientes disponiveis: scan de clients/*, generico (qualquer pasta com brand-profile.md).
function scanClients() {
  const fs = require("node:fs")
  const dir = path.join(root, "clients")
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template")
    .filter((d) => fs.existsSync(path.join(dir, d.name, "brand-profile.md")))
    .map((d) => d.name)
}
const CLIENTS = scanClients()

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const DAYS = Number(arg("--days", 30))
const CLIENT = arg("--client", "all")

loadEnv()
const base = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !key) { console.error("join-check: SUPABASE_URL/SERVICE_ROLE_KEY ausentes"); process.exit(2) }

async function rest(q) {
  const r = await fetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) throw new Error(`REST ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

const since = new Date(Date.now() - DAYS * 86400000).toISOString()
const errors = []
const warns = []

for (const client of CLIENT === "all" ? CLIENTS : [CLIENT]) {
  const recentes = await rest(
    `ct_content_items?client_slug=eq.${client}&status=eq.published&published_at=gte.${since}` +
    `&select=id,title,platform,content_type,published_at,publish_url&order=published_at.desc&limit=500`
  )
    // Story nao tem permalink e a metrica dele e agregada por dia: nao entra no join por
    // mecanica da plataforma, nao por falha de registro. Ver pieces.cjs.
    .then((rs) => rs.filter((r) => r.content_type !== "story"))
  const d = await joinPieces(rest, client)
  const noRelatorio = new Set(d.rows.map((r) => r.url))

  for (const p of recentes) {
    const quando = (p.published_at || "").slice(0, 10)
    if (!p.publish_url) {
      errors.push(`[${client}] ${quando} "${p.title?.slice(0, 60)}" (${p.platform}): publicada SEM publish_url, fora do join. ` +
        `Se foi publicacao manual, cole o link no publish_url da peca ${p.id}`)
    } else if (!noRelatorio.has(p.publish_url)) {
      errors.push(`[${client}] ${quando} "${p.title?.slice(0, 60)}": publish_url nao vira chave de join ` +
        `(${postKey(p.publish_url) || "formato desconhecido"}) -> ${p.publish_url}`)
    }
  }
  const semMedicao = d.rows.filter((r) => !r.medido && r.data >= since.slice(0, 10)).length
  if (semMedicao) warns.push(`[${client}] ${semMedicao} peca(s) dos ultimos ${DAYS} dias ainda sem medicao (analyzer roda semanal)`)
  warns.push(`[${client}] ${d.medidos_sem_registro} de ${d.total_medidos} posts medidos seguem sem peca registrada (historico anterior ao registro)`)
  console.log(`[${client}] publicadas ${DAYS}d: ${recentes.length} · no relatorio: ${d.rows.length} · com medicao: ${d.com_medicao}`)
}

warns.forEach((w) => console.warn(`AVISO ${w}`))
if (errors.length) {
  console.error(`\njoin-check FALHOU: ${errors.length} peca(s) publicada(s) fora do relatorio de desempenho.`)
  errors.forEach((e) => console.error(` - ${e}`))
  console.error("\nCorrija na origem: todo publisher tem que chamar registerPublication() de scripts/publishing/_lib/register.mjs.")
  process.exit(1)
}
console.log("join-check: OK (toda peca publicada na janela aparece no relatorio)")
