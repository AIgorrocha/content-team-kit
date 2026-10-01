import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { collectAndStoreMetrics } from "@/lib/integrations/instagram"

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const params = req.nextUrl.searchParams

    const accountId = params.get("account_id")
    if (!accountId) {
      return NextResponse.json(
        { error: "account_id e obrigatorio" },
        { status: 400 }
      )
    }

    const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") ?? "25")))

    const result = await collectAndStoreMetrics(accountId, pool, limit)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        message: `Metricas coletadas: ${result.data?.collected} sucesso, ${result.data?.failed} falhas`,
        ...result.data,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao coletar metricas: ${message}` },
      { status: 500 }
    )
  }
})
