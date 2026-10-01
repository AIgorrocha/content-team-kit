#!/usr/bin/env node
/**
 * sync-agents-push.mjs
 *
 * Le todos agents/ct-*.md, parseia frontmatter YAML e corpo markdown,
 * faz UPSERT em ct_agents (registry) e ct_agent_prompts (prompt completo).
 *
 * Supabase e a source of truth — esse script envia os .md locais pra la.
 *
 * Uso: node scripts/sync-agents-push.mjs
 * Requer: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env (ou .env.local)
 */

import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import yaml from "yaml"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, "..")

// Carrega .env e .env.local (local sobrescreve)
dotenv.config({ path: join(ROOT, ".env") })
dotenv.config({ path: join(ROOT, ".env.local"), override: true })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

/**
 * Parseia um arquivo markdown com frontmatter YAML.
 * Retorna { frontmatter: object, body: string }
 */
function parseMarkdown(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }
  try {
    const frontmatter = yaml.parse(match[1]) || {}
    return { frontmatter, body: match[2].trim() }
  } catch (error) {
    console.warn("Falha parseando frontmatter:", error.message)
    return { frontmatter: {}, body: content }
  }
}

function extractDisplayName(slug, body) {
  // Tenta pegar do primeiro H1 do body (ex: "# Diretor - Diretor de Conteúdo")
  const h1 = body.match(/^#\s+(.+)$/m)
  if (h1) {
    const title = h1[1].trim()
    const before = title.split(/\s[-–]\s/)[0].trim()
    return before || title
  }
  return slug.replace(/^ct-/, "")
}

async function main() {
  const agentsDir = join(ROOT, "agents")
  const files = (await readdir(agentsDir)).filter((f) => f.startsWith("ct-") && f.endsWith(".md"))

  console.log(`Encontrados ${files.length} agentes em ${agentsDir}`)

  let agentUpserts = 0
  let promptUpserts = 0
  const errors = []

  for (const file of files) {
    const slug = file.replace(/\.md$/, "")
    const fullPath = join(agentsDir, file)
    const raw = await readFile(fullPath, "utf8")
    const { frontmatter, body } = parseMarkdown(raw)

    const description = frontmatter.description || ""
    const displayName = extractDisplayName(slug, body)
    const role = (frontmatter.role || description.split(" - ")[0] || displayName).slice(0, 50)

    // UPSERT ct_agents
    const { error: agentErr } = await supabase
      .from("ct_agents")
      .upsert(
        {
          slug,
          display_name: displayName,
          role,
          status: "idle",
          config: {
            description,
            model: frontmatter.model || "sonnet",
            tools: frontmatter.tools || [],
          },
        },
        { onConflict: "slug" }
      )

    if (agentErr) {
      errors.push(`ct_agents ${slug}: ${agentErr.message}`)
      continue
    }
    agentUpserts++

    // UPSERT ct_agent_prompts (prompt_md = arquivo inteiro, pra preservar frontmatter)
    const { error: promptErr } = await supabase.from("ct_agent_prompts").upsert(
      {
        agent_slug: slug,
        prompt_md: raw,
        config: {
          source: "local-md",
          frontmatter,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_slug" }
    )

    if (promptErr) {
      errors.push(`ct_agent_prompts ${slug}: ${promptErr.message}`)
      continue
    }
    promptUpserts++

    console.log(`OK ${slug} (${displayName})`)
  }

  console.log("\n=== RESUMO ===")
  console.log(`ct_agents upserts: ${agentUpserts}`)
  console.log(`ct_agent_prompts upserts: ${promptUpserts}`)
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
