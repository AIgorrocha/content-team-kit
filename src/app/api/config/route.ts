import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { readFile, readdir } from "fs/promises"
import { join } from "path"

interface AgentInfo {
  filename: string
  name: string
  description: string
  tools: string[]
  model: string
  content: string
}

function parseAgentFrontmatter(raw: string, filename: string): AgentInfo {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { filename, name: filename, description: "", tools: [], model: "sonnet", content: raw }
  }

  const frontmatter = match[1]
  const content = match[2].trim()

  const getName = (fm: string) => fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? filename
  const getDesc = (fm: string) => {
    const m = fm.match(/^description:\s*"?(.+?)"?\s*$/m)
    return m?.[1] ?? ""
  }
  const getTools = (fm: string) => {
    const m = fm.match(/^tools:\s*\[(.+)\]\s*$/m)
    if (!m) return []
    return m[1].split(",").map((t) => t.trim().replace(/"/g, ""))
  }
  const getModel = (fm: string) => fm.match(/^model:\s*(.+)$/m)?.[1]?.trim() ?? "sonnet"

  return {
    filename,
    name: getName(frontmatter),
    description: getDesc(frontmatter),
    tools: getTools(frontmatter),
    model: getModel(frontmatter),
    content,
  }
}

const TOOLS = [
  { name: "supabase_query", description: "Consulta e manipula dados no banco Supabase (30 tabelas ct_*)" },
  { name: "web_search", description: "Pesquisa na web para tendencias, concorrentes e inspiracao" },
  { name: "telegram_send", description: "Envia mensagens e conteudo pelo bot Telegram" },
  { name: "carousel", description: "Gera carrosseis Instagram via HTML + Playwright (1080x1350)" },
  { name: "run_script", description: "Executa scripts auxiliares do sistema" },
]

const DESIGN_SYSTEM = {
  colors: [
    { name: "Background", value: "#0D0D0D" },
    { name: "Surface", value: "#1A1A1A" },
    { name: "Texto Primario", value: "#FFFFFF" },
    { name: "Texto Secundario", value: "#A0A0A0" },
    { name: "Destaque Azul", value: "#4A90D9" },
    { name: "Destaque Roxo", value: "#7C3AED" },
  ],
  fonts: ["Inter", "Space Grotesk"],
  carousel: { width: 1080, height: 1350, style: "Minimalista, dark theme" },
}

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const root = process.cwd()

    const agentsDir = join(root, "agents")
    const agentFiles = await readdir(agentsDir).catch(() => [] as string[])
    const ctFiles = agentFiles.filter((f) => f.startsWith("ct-") && f.endsWith(".md"))
    const agents = await Promise.all(
      ctFiles.map(async (f) => {
        const raw = await readFile(join(agentsDir, f), "utf-8")
        return parseAgentFrontmatter(raw, f.replace(".md", ""))
      })
    )

    let systemPrompt = ""
    try {
      systemPrompt = await readFile(join(root, "bot", "system-prompt.mjs"), "utf-8")
    } catch {
      systemPrompt = "(arquivo nao encontrado)"
    }

    const refsDir = join(root, "references")
    const refFiles = await readdir(refsDir).catch(() => [] as string[])
    const mdRefs = refFiles.filter((f) => f.endsWith(".md"))
    const references = await Promise.all(
      mdRefs.map(async (f) => {
        const content = await readFile(join(refsDir, f), "utf-8")
        return { filename: f, title: f.replace(".md", "").replace(/-/g, " "), content }
      })
    )

    const ENV_VARS = [
      "ANTHROPIC_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "TELEGRAM_BOT_TOKEN",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]

    const botConfig = {
      model: "claude-haiku-4-5-20251001",
      maxHistory: 20,
      ttl: "30min",
      envVars: ENV_VARS.map((name) => ({ name, present: !!process.env[name] })),
    }

    return NextResponse.json({
      systemPrompt,
      agents,
      tools: TOOLS,
      botConfig,
      references,
      designSystem: DESIGN_SYSTEM,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
})
