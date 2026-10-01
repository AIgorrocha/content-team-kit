import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getAccountInsights } from "@/lib/integrations/instagram"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl.pathname
    const segments = url.split("/")
    const id = segments[segments.indexOf("accounts") + 1]

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const periodParam = req.nextUrl.searchParams.get("period") ?? "month"
    const validPeriods = ["day", "week", "month"] as const
    const period = validPeriods.includes(periodParam as typeof validPeriods[number])
      ? (periodParam as "day" | "week" | "month")
      : "month"

    const result = await getAccountInsights(period, id, pool)

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
      { error: `Erro ao buscar insights: ${message}` },
      { status: 500 }
    )
  }
})
