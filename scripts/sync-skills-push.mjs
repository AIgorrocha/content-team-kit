#!/usr/bin/env node
/**
 * sync-skills-push.mjs
 *
 * Le todas skills ct-* (SKILL.md), parseia frontmatter YAML e corpo,
 * faz UPSERT em ct_skills.
 *
 * Depois do upsert, RECONCILIA: slug que existe no banco e nao existe mais em
 * skills/ vira active=false (nao deleta, pra nao perder historico). Sem isso,
 * pasta apagada continua visivel pro frontend e pro Telegram pra sempre, que foi
 * o caso de ct-instagram-audit e ct-projeto-conteudo (auditoria de 30/ago/2026).
 *
 * Uso: node scripts/sync-skills-push.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import yaml from "yaml"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, "..")

dotenv.config({ quiet: true, path: join(ROOT, ".env") })
dotenv.config({ quiet: true, path: join(ROOT, ".env.local"), override: true })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

function parseMarkdown(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }
  try {
    return { frontmatter: yaml.parse(match[1]) || {}, body: match[2].trim() }
  } catch {
    return { frontmatter: {}, body: content }
  }
}

// Categorizacao heuristica por prefixo/sufixo do slug
function inferCategory(slug) {
  if (slug.includes("publicar") || slug.includes("agendar")) return "Publicacao"
  if (slug.includes("pesquisa") || slug.includes("analisar") || slug.includes("seo") || slug === "ct-web") return "Pesquisa"
  if (
    slug.includes("carrossel") ||
    slug.includes("story") ||
    slug.includes("reel") ||
    slug.includes("telas") ||
    slug.includes("thumbnail") ||
    slug.includes("adaptar") ||
    slug.includes("notebook") ||
    slug.includes("linkedin") ||
    slug.includes("extrair")
  )
    return "Criacao"
  if (slug.includes("banco") || slug.includes("orquestrador") || slug.includes("obsidian")) return "Ferramentas"
  if (slug.includes("help")) return "Ajuda"
  if (slug.includes("ads") || slug.includes("trafego")) return "Ads"
  return "Outros"
}

async function main() {
  const skillsDir = join(ROOT, "skills")
  const entries = await readdir(skillsDir)
  const ctSkills = []

  for (const entry of entries) {
    if (!entry.startsWith("ct-")) continue
    const skillPath = join(skillsDir, entry)
    const s = await stat(skillPath)
    if (!s.isDirectory()) continue
    const mdPath = join(skillPath, "SKILL.md")
    try {
      await stat(mdPath)
      ctSkills.push({ slug: entry, path: skillPath, mdPath })
    } catch {
      console.warn(`Pulando ${entry}: sem SKILL.md`)
    }
  }

  console.log(`Encontradas ${ctSkills.length} skills ct-*`)

  let upserts = 0
  const errors = []

  for (const { slug, path, mdPath } of ctSkills) {
    const raw = await readFile(mdPath, "utf8")
    const { frontmatter, body } = parseMarkdown(raw)
    const name = frontmatter.name || slug
    const description = frontmatter.description || body.split("\n").find((l) => l.trim().length > 0) || ""

    const { error } = await supabase.from("ct_skills").upsert(
      {
        slug,
        name,
        description: description.slice(0, 500),
        category: inferCategory(slug),
        content: raw,
        path: path.replace(ROOT, "").replace(/\\/g, "/"),
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )

    if (error) {
      errors.push(`${slug}: ${error.message}`)
      continue
    }
    upserts++
    console.log(`OK ${slug} (${inferCategory(slug)})`)
  }

  // Reconciliacao: o que esta no banco e nao esta mais no disco vira inativo.
  const slugsNoDisco = new Set(ctSkills.map((s) => s.slug))
  const { data: noBanco, error: readErr } = await supabase.from("ct_skills").select("slug, active")

  let desativados = []
  if (readErr) {
    errors.push(`reconciliacao (leitura): ${readErr.message}`)
  } else {
    const orfaos = noBanco.filter((r) => !slugsNoDisco.has(r.slug) && r.active !== false).map((r) => r.slug)
    if (orfaos.length > 0) {
      const { error } = await supabase
        .from("ct_skills")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("slug", orfaos)
      if (error) errors.push(`reconciliacao (update): ${error.message}`)
      else desativados = orfaos
    }
  }

  console.log("\n=== RESUMO ===")
  console.log(`ct_skills upserts: ${upserts}`)
  if (desativados.length > 0) {
    console.log(`Desativados (sem pasta em skills/): ${desativados.length}`)
    desativados.forEach((s) => console.log(" -", s))
  } else {
    console.log("Desativados: nenhum orfao novo")
  }
  if (errors.length > 0) {
    console.log(`\nERROS (${errors.length}):`)
    errors.forEach((e) => console.log(" -", e))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("FATAL:", err)
  process.exit(1)
})
