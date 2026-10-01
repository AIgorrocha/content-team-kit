import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getRecentMedia } from "@/lib/integrations/instagram"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl.pathname
    const segments = url.split("/")
    const id = segments[segments.indexOf("accounts") + 1]

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const limitParam = req.nextUrl.searchParams.get("limit")
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? "25")))

    const result = await getRecentMedia(limit, id, pool)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      )
    }

    return NextResponse.json({ data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar midias: ${message}` },
      { status: 500 }
    )
  }
})
