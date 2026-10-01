import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getInsightsTimeline } from "@/lib/integrations/meta-ads"

interface DailySpendPoint {
  date: string
  spend: number
  clicks: number
}

interface InsightsTimelinePoint {
  date: string
  impressions: number
  clicks: number
  spend: number
  cpc: number
  ctr: number
}

function toDateString(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d ?? "").slice(0, 10)
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Number.isFinite(n) ? n : 0
}

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10)
  return Number.isFinite(n) ? n : 0
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaign_id")
    const period = req.nextUrl.searchParams.get("period") ?? "last_7d"

    const validPeriods = ["last_7d", "last_30d", "last_14d", "this_month", "last_month"]
    const safePeriod = validPeriods.includes(period) ? period : "last_7d"

    // Compute the longest window we need (30 days) and slice afterward
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    // Query full 30-day window aggregated by date (or by specific campaign)
    const dbResult = campaignId
      ? await pool.query(
          `SELECT date,
             impressions::int AS impressions,
             clicks::int AS clicks,
             spend::numeric AS spend,
             cpc::numeric AS cpc,
             ctr::numeric AS ctr
           FROM ct_ad_insights
           WHERE campaign_id = $1 AND date >= $2
           ORDER BY date ASC`,
          [campaignId, since30]
        )
      : await pool.query(
          `SELECT date,
             SUM(impressions::numeric)::int AS impressions,
             SUM(clicks::numeric)::int AS clicks,
             SUM(spend::numeric) AS spend,
             CASE WHEN SUM(clicks::numeric) > 0
                  THEN SUM(spend::numeric) / SUM(clicks::numeric)
                  ELSE 0 END AS cpc,
             CASE WHEN SUM(impressions::numeric) > 0
                  THEN SUM(clicks::numeric) / SUM(impressions::numeric)
                  ELSE 0 END AS ctr
           FROM ct_ad_insights
           WHERE date >= $1
           GROUP BY date
           ORDER BY date ASC`,
          [since30]
        )

    if (dbResult.rows.length > 0) {
      const monthly: InsightsTimelinePoint[] = dbResult.rows.map((r) => ({
        date: toDateString(r.date),
        impressions: toInt(r.impressions),
        clicks: toInt(r.clicks),
        spend: toNumber(r.spend),
        cpc: toNumber(r.cpc),
        ctr: toNumber(r.ctr),
      }))

      const daily: DailySpendPoint[] = monthly
        .filter((p) => p.date >= since7)
        .map((p) => ({ date: p.date, spend: p.spend, clicks: p.clicks }))

      return NextResponse.json({ data: { daily, monthly }, source: "db" })
    }

    // No DB data and no campaign_id — return empty structure
    if (!campaignId) {
      return NextResponse.json({ data: { daily: [], monthly: [] }, source: "db" })
    }

    // Fallback: fetch live from Meta API for a specific campaign
    const accountResult = await pool.query(
      `SELECT access_token FROM ct_instagram_accounts WHERE is_active = true AND ad_account_id IS NOT NULL LIMIT 1`
    )
    const account = accountResult.rows[0]

    if (!account) {
      return NextResponse.json({ data: { daily: [], monthly: [] }, source: "db" })
    }

    const result = await getInsightsTimeline(campaignId, account.access_token, safePeriod)

    if (!result.success || !result.data) {
      return NextResponse.json({ data: { daily: [], monthly: [] }, source: "db" })
    }

    const monthly: InsightsTimelinePoint[] = (result.data as Array<Record<string, unknown>>).map((r) => ({
      date: toDateString(r.date ?? r.date_start),
      impressions: toInt(r.impressions),
      clicks: toInt(r.clicks),
      spend: toNumber(r.spend),
      cpc: toNumber(r.cpc),
      ctr: toNumber(r.ctr),
    }))

    const daily: DailySpendPoint[] = monthly
      .filter((p) => p.date >= since7)
      .map((p) => ({ date: p.date, spend: p.spend, clicks: p.clicks }))

    return NextResponse.json({ data: { daily, monthly }, source: "api" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar insights: ${message}` },
      { status: 500 }
    )
  }
})
