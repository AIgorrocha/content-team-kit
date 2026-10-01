import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

const VALID_PERIODS = ["7d", "30d", "90d"] as const
type Period = (typeof VALID_PERIODS)[number]

const VALID_TRAFFIC_TYPES = ["organic", "paid", "all"] as const
type TrafficType = (typeof VALID_TRAFFIC_TYPES)[number]

function periodToInterval(period: Period): string {
  const map: Record<Period, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "90d": "90 days",
  }
  return map[period]
}

interface PostRow {
  id: string
  content_item_id: string
  caption: string | null
  external_id: string | null
  external_url: string | null
  published_at: string | null
  media_type: string | null
  impressions: number | null
  reach: number | null
  engagement: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saved: number | null
  boost_campaign_id: string | null
  campaign_name: string | null
  campaign_status: string | null
  campaign_objective: string | null
  daily_budget: number | null
  lifetime_budget: number | null
}

interface FormattedPost {
  id: string
  content_item_id: string
  caption: string | null
  external_id: string | null
  external_url: string | null
  published_at: string | null
  media_type: string | null
  is_organic: boolean
  metrics: {
    impressions: number
    reach: number
    engagement: number
    likes: number
    comments: number
    shares: number
    saved: number
  }
  campaign: {
    id: string
    name: string
    status: string
    objective: string
    daily_budget: number | null
    lifetime_budget: number | null
  } | null
}

interface AggregatedTotals {
  organic: {
    count: number
    total_reach: number
    total_impressions: number
    total_engagement: number
    avg_engagement: number
  }
  paid: {
    count: number
    total_reach: number
    total_impressions: number
    total_engagement: number
    avg_engagement: number
  }
  all: {
    count: number
    total_reach: number
    total_impressions: number
    total_engagement: number
    avg_engagement: number
  }
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const params = req.nextUrl.searchParams

    const accountId = params.get("account_id")
    if (!accountId) {
      return NextResponse.json(
        { error: "account_id e obrigatorio" },
        { status: 400 }
      )
    }

    const periodParam = params.get("period") ?? "30d"
    if (!VALID_PERIODS.includes(periodParam as Period)) {
      return NextResponse.json(
        { error: `period invalido. Use: ${VALID_PERIODS.join(", ")}` },
        { status: 400 }
      )
    }
    const period = periodParam as Period

    const trafficParam = params.get("traffic_type") ?? "all"
    if (!VALID_TRAFFIC_TYPES.includes(trafficParam as TrafficType)) {
      return NextResponse.json(
        { error: `traffic_type invalido. Use: ${VALID_TRAFFIC_TYPES.join(", ")}` },
        { status: 400 }
      )
    }
    const trafficType = trafficParam as TrafficType

    const limitParam = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "10")))

    const interval = periodToInterval(period)

    // Build traffic filter clause
    let trafficClause = ""
    if (trafficType === "organic") {
      trafficClause = "AND p.boost_campaign_id IS NULL"
    } else if (trafficType === "paid") {
      trafficClause = "AND p.boost_campaign_id IS NOT NULL"
    }

    const query = `
      SELECT
        p.id,
        p.content_item_id,
        p.caption,
        p.external_id,
        p.external_url,
        p.published_at,
        p.media_type,
        m.impressions,
        m.reach,
        m.engagement,
        m.like_count AS likes,
        m.comments_count AS comments,
        m.shares,
        m.saved,
        p.boost_campaign_id,
        c.name AS campaign_name,
        c.status AS campaign_status,
        c.objective AS campaign_objective,
        c.daily_budget,
        c.lifetime_budget
      FROM ct_publications p
      LEFT JOIN ct_instagram_metrics m ON m.media_id = p.external_id
      LEFT JOIN ct_ad_campaigns c ON c.id = p.boost_campaign_id
      WHERE p.platform = 'instagram'
        AND p.status = 'published'
        AND p.account_id = $1
        AND p.published_at >= NOW() - $2::interval
        ${trafficClause}
      ORDER BY p.published_at DESC
      LIMIT $3
    `

    const result = await pool.query(query, [accountId, interval, limitParam])
    const rows = result.rows as PostRow[]

    // Format posts
    const posts: FormattedPost[] = rows.map((row) => ({
      id: row.id,
      content_item_id: row.content_item_id,
      caption: row.caption,
      external_id: row.external_id,
      external_url: row.external_url,
      published_at: row.published_at,
      media_type: row.media_type,
      is_organic: row.boost_campaign_id === null,
      metrics: {
        impressions: row.impressions ?? 0,
        reach: row.reach ?? 0,
        engagement: row.engagement ?? 0,
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        shares: row.shares ?? 0,
        saved: row.saved ?? 0,
      },
      campaign: row.boost_campaign_id
        ? {
            id: row.boost_campaign_id,
            name: row.campaign_name ?? "",
            status: row.campaign_status ?? "",
            objective: row.campaign_objective ?? "",
            daily_budget: row.daily_budget,
            lifetime_budget: row.lifetime_budget,
          }
        : null,
    }))

    // Compute aggregated totals
    const organicPosts = posts.filter((p) => p.is_organic)
    const paidPosts = posts.filter((p) => !p.is_organic)

    const aggregate = (items: FormattedPost[]) => {
      const count = items.length
      const total_reach = items.reduce((sum, p) => sum + p.metrics.reach, 0)
      const total_impressions = items.reduce((sum, p) => sum + p.metrics.impressions, 0)
      const total_engagement = items.reduce((sum, p) => sum + p.metrics.engagement, 0)
      const avg_engagement = count > 0
        ? Math.round((total_engagement / count) * 100) / 100
        : 0

      return { count, total_reach, total_impressions, total_engagement, avg_engagement }
    }

    const totals: AggregatedTotals = {
      organic: aggregate(organicPosts),
      paid: aggregate(paidPosts),
      all: aggregate(posts),
    }

    return NextResponse.json({
      data: {
        account_id: accountId,
        period,
        traffic_type: trafficType,
        posts,
        totals,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar analytics organico vs pago: ${message}` },
      { status: 500 }
    )
  }
})
