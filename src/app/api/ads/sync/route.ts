import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { syncCampaignsToDb, syncInsightsToDb } from "@/lib/integrations/meta-ads"

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const period = typeof body.period === "string" ? body.period : "last_7d"

    const validPeriods = ["last_7d", "last_30d", "last_14d", "this_month", "last_month"]
    const safePeriod = validPeriods.includes(period) ? period : "last_7d"

    const accountsResult = await pool.query(
      `SELECT id, handle, ad_account_id, access_token
       FROM ct_instagram_accounts
       WHERE is_active = true AND ad_account_id IS NOT NULL`
    )

    const accounts = accountsResult.rows

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma conta Meta com ad_account_id configurada" },
        { status: 404 }
      )
    }

    const results: Array<{account_id: string, handle: string, campaigns_synced: number, insights_synced: number, error?: string}> = []

    for (const account of accounts) {
      const campaignsSync = await syncCampaignsToDb(pool, account.id)
      const insightsSync = await syncInsightsToDb(pool, account.ad_account_id, account.access_token, safePeriod)

      results.push({
        account_id: account.id,
        handle: account.handle,
        campaigns_synced: campaignsSync.data?.synced ?? 0,
        insights_synced: insightsSync.data?.synced ?? 0,
        ...((!campaignsSync.success || !insightsSync.success)
          ? { error: campaignsSync.error ?? insightsSync.error }
          : {}),
      })
    }

    const totalCampaigns = results.reduce((acc, r) => acc + r.campaigns_synced, 0)
    const totalInsights = results.reduce((acc, r) => acc + r.insights_synced, 0)

    return NextResponse.json({
      data: {
        accounts: results,
        total_campaigns_synced: totalCampaigns,
        total_insights_synced: totalInsights,
        period: safePeriod,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao sincronizar: ${message}` },
      { status: 500 }
    )
  }
})
