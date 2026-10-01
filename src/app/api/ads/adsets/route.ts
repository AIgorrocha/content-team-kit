import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getAdSets } from "@/lib/integrations/meta-ads"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaign_id")

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaign_id é obrigatório" },
        { status: 400 }
      )
    }

    const accountRow = await pool.query(
      `SELECT ia.access_token
       FROM ct_ad_campaigns c
       JOIN ct_instagram_accounts ia ON ia.id = c.account_id
       WHERE c.meta_campaign_id = $1
       LIMIT 1`,
      [campaignId]
    )

    if (!accountRow.rows[0]) {
      // Fallback: any active account
      const fallback = await pool.query(
        `SELECT access_token FROM ct_instagram_accounts WHERE is_active = true AND ad_account_id IS NOT NULL LIMIT 1`
      )
      if (!fallback.rows[0]) {
        return NextResponse.json(
          { error: "Nenhuma conta Meta configurada" },
          { status: 404 }
        )
      }
    }

    const token = accountRow.rows[0]?.access_token

    const result = await getAdSets(campaignId, token)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar adsets: ${message}` },
      { status: 500 }
    )
  }
})
