import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import pool from "@/lib/db"
import { createServerClient } from "@supabase/ssr"
import { sha256 } from "@/lib/sala/fontes/hash"
import { salvarPromptNoArquivo } from "@/lib/sala/escrita/prompt"
import { ConflitoEdicao } from "@/lib/sala/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Qualquer um dos 25 agentes (agents/ct-*.md), não mais uma lista fixa de 14: a Biblioteca
// e a Sala passam a editar o mesmo jeito (ADR 3.1, escrita sempre no arquivo).
const SLUG_VALIDO = /^ct-[a-z0-9-]+$/

async function authCheck(req: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return process.env.NODE_ENV !== "production"
  }
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll() {},
    },
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  return !error && !!user
}

async function readFileFromRepo(slug: string): Promise<{ content: string; mtime: string }> {
  const p = path.join(process.cwd(), "agents", `${slug}.md`)
  const [content, stat] = await Promise.all([fs.readFile(p, "utf8"), fs.stat(p)])
  return { content, mtime: stat.mtime.toISOString() }
}

// GET sempre lê `agents/{slug}.md` (a fonte, ADR 3.1) e devolve o hash pra tela poder
// mandar de volta como baseHash no PUT/POST. ct_agent_prompts/ct_agents só completam
// display_name/role/config: quem sincroniza esse trio com o arquivo é o vigia.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { slug } = await params
  if (!SLUG_VALIDO.test(slug)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
  }

  try {
    const { content, mtime } = await readFileFromRepo(slug)
    const hash = sha256(content)

    const agentInfo = await pool.query<{ display_name: string; role: string; config: Record<string, unknown> }>(
      `SELECT display_name, role, config FROM ct_agents WHERE slug = $1`,
      [slug]
    )

    return NextResponse.json({
      slug,
      prompt_md: content,
      source: "file" as const,
      hash,
      updated_at: mtime,
      display_name: agentInfo.rows[0]?.display_name ?? slug,
      role: agentInfo.rows[0]?.role ?? "",
      config: agentInfo.rows[0]?.config ?? {},
    })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { slug } = await params
  if (!SLUG_VALIDO.test(slug)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
  }

  let body: { prompt_md?: string; baseHash?: string; config?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const promptMd = typeof body.prompt_md === "string" ? body.prompt_md : ""
  if (!promptMd.trim()) {
    return NextResponse.json({ error: "prompt_md vazio" }, { status: 400 })
  }
  const baseHash = typeof body.baseHash === "string" ? body.baseHash : ""
  if (!baseHash) {
    return NextResponse.json({ error: "campo obrigatório: baseHash" }, { status: 400 })
  }

  try {
    const hash = salvarPromptNoArquivo(slug, promptMd, baseHash)
    return NextResponse.json({ ok: true, slug, hash })
  } catch (err) {
    if (err instanceof ConflitoEdicao) {
      return NextResponse.json(
        { error: "o prompt mudou desde que foi carregado", atual: err.atual, hashAtual: err.hashAtual },
        { status: 409 }
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes("não encontrado") ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { slug } = await params
  if (!SLUG_VALIDO.test(slug)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
  }

  try {
    await pool.query(`DELETE FROM ct_agent_prompts WHERE agent_slug = $1`, [slug])
    return NextResponse.json({ ok: true, slug, reset: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
