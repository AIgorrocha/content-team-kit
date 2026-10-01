import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import pool from "@/lib/db"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_SLUGS = new Set([
  "ct-diretor",
  "ct-redator",
  "ct-carrossel",
  "ct-video",
  "ct-designer",
  "ct-pesquisador",
  "ct-reciclador",
  "ct-email",
  "ct-trafego",
  "ct-agenda",
  "ct-social",
  "ct-otimizador",
  "ct-parcerias",
  "ct-integrador",
])

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { slug } = await params
  if (!ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })
  }

  try {
    const rows = await pool.query<{ prompt_md: string }>(
      `SELECT prompt_md FROM ct_agent_prompts WHERE agent_slug = $1`,
      [slug]
    )
    let content: string
    if (rows.rows.length > 0) {
      content = rows.rows[0].prompt_md
    } else {
      const p = path.join(process.cwd(), "agents", `${slug}.md`)
      content = await fs.readFile(p, "utf8")
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.md"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
