import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { getDemographics } from "@/lib/integrations/meta-ads"

const VALID_BREAKDOWNS = [
  "age,gender",
  "publisher_platform,platform_position",
  "region",
] as const

type ValidBreakdown = typeof VALID_BREAKDOWNS[number]

function toBreakdownParam(raw: string | null): ValidBreakdown {
  const map: Record<string, ValidBreakdown> = {
    age_gender: "age,gender",
    placement: "publisher_platform,platform_position",
    region: "region",
  }
  const resolved = raw ? (map[raw] ?? raw) : "age,gender"
  return VALID_BREAKDOWNS.includes(resolved as ValidBreakdown)
    ? (resolved as ValidBreakdown)
    : "age,gender"
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const campaignId = req.nextUrl.searchParams.get("campaign_id")
    const accountIdParam = req.nextUrl.searchParams.get("account_id")
    const breakdownParam = req.nextUrl.searchParams.get("breakdown")
    const period = req.nextUrl.searchParams.get("period") ?? "last_7d"

    const breakdown = toBreakdownParam(breakdownParam)

    // Resolve ad_account_id from campaign or account param
    let adAccountId: string | null = null
    let accessToken: string | null = null

    if (accountIdParam) {
      const row = await pool.query(
        `SELECT ad_account_id, access_token FROM ct_instagram_accounts WHERE id = $1 AND is_active = true`,
        [accountIdParam]
      )
      adAccountId = row.rows[0]?.ad_account_id ?? null
      accessToken = row.rows[0]?.access_token ?? null
    } else if (campaignId) {
      const row = await pool.query(
        `SELECT ia.ad_account_id, ia.access_token
         FROM ct_ad_campaigns c
         JOIN ct_instagram_accounts ia ON ia.id = c.account_id
         WHERE c.meta_campaign_id = $1
         LIMIT 1`,
        [campaignId]
      )
      adAccountId = row.rows[0]?.ad_account_id ?? null
      accessToken = row.rows[0]?.access_token ?? null
    } else {
      const row = await pool.query(
        `SELECT ad_account_id, access_token FROM ct_instagram_accounts WHERE is_active = true AND ad_account_id IS NOT NULL LIMIT 1`
      )
      adAccountId = row.rows[0]?.ad_account_id ?? null
      accessToken = row.rows[0]?.access_token ?? null
    }

    if (!adAccountId || !accessToken) {
      return NextResponse.json({ data: [], breakdown, period })
    }

    const validPeriods = ["last_7d", "last_30d", "last_14d", "this_month", "last_month"]
    const safePeriod = validPeriods.includes(period) ? period : "last_7d"

    const result = await getDemographics(adAccountId, accessToken, breakdown, safePeriod)

    if (!result.success || !result.data) {
      return NextResponse.json({ data: [], breakdown, period: safePeriod })
    }

    const rows = result.data as Array<Record<string, unknown>>

    const toInt = (v: unknown): number => {
      const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10)
      return Number.isFinite(n) ? n : 0
    }

    let mapped: Array<Record<string, unknown>> = []

    if (breakdown === "age,gender") {
      // DemographicsSegment[] = { label, value }
      mapped = rows.map((r) => ({
        label: `${String(r.age ?? "")} ${String(r.gender ?? "")}`.trim(),
        value: toInt(r.impressions),
      }))
    } else if (breakdown === "publisher_platform,platform_position") {
      // PlacementSegment[] = { label, impressions, clicks }
      mapped = rows.map((r) => ({
        label: `${String(r.publisher_platform ?? "")} / ${String(r.platform_position ?? "")}`,
        impressions: toInt(r.impressions),
        clicks: toInt(r.clicks),
      }))
    } else {
      mapped = rows.map((r) => ({
        label: String(r.region ?? ""),
        value: toInt(r.impressions),
      }))
    }

    return NextResponse.json({ data: mapped, breakdown, period: safePeriod })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar demographics: ${message}` },
      { status: 500 }
    )
  }
})
