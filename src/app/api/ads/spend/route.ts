import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getAdAccountSpend } from "@/lib/integrations/meta-ads"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const periodParam = req.nextUrl.searchParams.get("period") ?? "last_30d"
    const validPeriods = ["today", "last_7d", "last_30d"] as const
    const period = validPeriods.includes(periodParam as typeof validPeriods[number])
      ? (periodParam as "today" | "last_7d" | "last_30d")
      : "last_30d"

    const accountId = req.nextUrl.searchParams.get("account_id")

    // Fetch accounts with ad_account_id
    let accountQuery = `SELECT id, handle, ad_account_id, access_token
                        FROM ct_instagram_accounts
                        WHERE is_active = true AND ad_account_id IS NOT NULL`
    const accountParams: unknown[] = []

    if (accountId) {
      accountQuery += ` AND id = $1`
      accountParams.push(accountId)
    }

    const accountsResult = await pool.query(accountQuery, accountParams)
    const accounts = accountsResult.rows

    if (accounts.length === 0) {
      return NextResponse.json({
        data: {
          total: { spend: 0, impressions: 0, reach: 0, clicks: 0 },
          by_account: [],
          period,
        },
      })
    }

    const byAccount: Array<{
      account_id: string
      handle: string
      spend: number
      impressions: number
      reach: number
      clicks: number
    }> = []

    let totalSpend = 0
    let totalImpressions = 0
    let totalReach = 0
    let totalClicks = 0

    for (const account of accounts) {
      const result = await getAdAccountSpend(
        account.ad_account_id,
        account.access_token,
        period
      )

      const data = result.success && result.data
        ? result.data
        : { spend: 0, impressions: 0, reach: 0, clicks: 0 }

      byAccount.push({
        account_id: account.id,
        handle: account.handle,
        ...data,
      })

      totalSpend += data.spend
      totalImpressions += data.impressions
      totalReach += data.reach
      totalClicks += data.clicks
    }

    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    return NextResponse.json({
      data: {
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_reach: totalReach,
        avg_cpc: avgCpc,
        avg_ctr: avgCtr,
        landing_page_views: 0,
        period,
        by_account: byAccount,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar gastos: ${message}` },
      { status: 500 }
    )
  }
})
