import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getCampaignInsights } from "@/lib/integrations/meta-ads"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl.pathname
    const segments = url.split("/")
    const id = segments[segments.indexOf("campaigns") + 1]

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const since = req.nextUrl.searchParams.get("since")
    const until = req.nextUrl.searchParams.get("until")

    // Look up the campaign to get the Meta campaign_id and token
    const campaignResult = await pool.query(
      `SELECT c.meta_campaign_id AS campaign_id, a.access_token
       FROM ct_ad_campaigns c
       JOIN ct_instagram_accounts a ON a.id = c.account_id
       WHERE c.id = $1`,
      [id]
    )

    const campaign = campaignResult.rows[0]
    if (!campaign) {
      return NextResponse.json(
        { error: "Campanha nao encontrada" },
        { status: 404 }
      )
    }

    const dateRange = since && until ? { since, until } : undefined

    const result = await getCampaignInsights(
      campaign.campaign_id,
      campaign.access_token,
      dateRange
    )

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
      { error: `Erro ao buscar insights da campanha: ${message}` },
      { status: 500 }
    )
  }
})
