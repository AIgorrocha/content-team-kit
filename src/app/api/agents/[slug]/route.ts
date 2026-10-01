import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getAgentDetail } from "@/lib/queries/agents"
import { readFile } from "fs/promises"
import { join } from "path"

interface AgentFileInfo {
  name: string
  description: string
  tools: string[]
  model: string
  content: string
}

function parseAgentFrontmatter(raw: string, filename: string): AgentFileInfo {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { name: filename, description: "", tools: [], model: "sonnet", content: raw }
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
    name: getName(frontmatter),
    description: getDesc(frontmatter),
    tools: getTools(frontmatter),
    model: getModel(frontmatter),
    content,
  }
}

async function getAgentFileInfo(slug: string): Promise<AgentFileInfo | null> {
  try {
    const root = process.cwd()
    const filePath = join(root, "agents", `${slug}.md`)
    const raw = await readFile(filePath, "utf-8")
    return parseAgentFrontmatter(raw, slug)
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return withTenantDB(request, async (db) => {
    const { slug } = await params
    const detail = await getAgentDetail(db, slug)
    if (!detail) {
      throw new Error("Agent not found")
    }

    const fileInfo = await getAgentFileInfo(slug)

    return {
      ...detail,
      fileInfo,
    }
  })
}
