import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { syncCampaignsToDb } from "@/lib/integrations/meta-ads"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get("account_id")

    // DISTINCT ON meta_campaign_id deduplicates campaigns that appear in multiple
    // Instagram accounts sharing the same ad_account_id
    let query = `SELECT DISTINCT ON (c.meta_campaign_id)
                   c.id, c.account_id, c.meta_campaign_id as campaign_id, c.name as campaign_name, c.objective, c.status,
                   c.daily_budget, c.lifetime_budget, c.start_date as start_time, c.end_date as stop_time,
                   c.created_at, c.metrics_updated_at as updated_at,
                   COALESCE((c.metrics->>'impressions')::int, 0) as impressions,
                   COALESCE((c.metrics->>'reach')::int, 0) as reach,
                   COALESCE((c.metrics->>'clicks')::int, 0) as clicks,
                   COALESCE((c.metrics->>'spend')::numeric, 0) as spend,
                   COALESCE((c.metrics->>'cpc')::numeric, 0) as cpc,
                   COALESCE((c.metrics->>'ctr')::numeric, 0) as ctr,
                   a.handle as account_handle
                 FROM ct_ad_campaigns c
                 LEFT JOIN ct_instagram_accounts a ON c.account_id = a.id`
    const params: unknown[] = []

    if (accountId) {
      query += ` WHERE c.account_id = $1`
      params.push(accountId)
    }

    // DISTINCT ON requires the distinct column to appear first in ORDER BY
    query += ` ORDER BY c.meta_campaign_id, c.metrics_updated_at DESC NULLS LAST`

    const result = await pool.query(query, params)

    return NextResponse.json({ data: result.rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar campanhas: ${message}` },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { account_id } = body

    if (!account_id) {
      return NextResponse.json(
        { error: "account_id e obrigatorio" },
        { status: 400 }
      )
    }

    const result = await syncCampaignsToDb(pool, account_id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 502 }
      )
    }

    return NextResponse.json({
      data: { synced: result.data?.synced ?? 0 },
      message: `${result.data?.synced ?? 0} campanhas sincronizadas`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao sincronizar campanhas: ${message}` },
      { status: 500 }
    )
  }
})
