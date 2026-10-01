// Checagem de autenticação das rotas da Sala. Mesma lógica das demais rotas autenticadas,
// extraída aqui pra ser reutilizada por todas as rotas de /api/sala/*.
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function authCheck(req: NextRequest): Promise<{
  ok: boolean
  error?: string
  userId?: string
}> {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origem = req.headers.get("origin")
    if (origem && origem !== new URL(req.url).origin) return { ok: false, error: "Origem não permitida" }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    const hostname = new URL(req.url).hostname
    if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
      return { ok: false, error: "Serviço indisponível: autenticação não configurada" }
    }
    return { ok: true, userId: "dev-user" }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll() {},
    },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, error: "Não autorizado" }
  return { ok: true, userId: user.id }
}
