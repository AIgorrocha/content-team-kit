import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { generateRecommendations } from "@/lib/integrations/meta-ads"

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const campaignsResult = await pool.query(
      `SELECT id, meta_campaign_id, name, status, daily_budget, lifetime_budget, metrics
       FROM ct_ad_campaigns
       WHERE status = 'ACTIVE'
       ORDER BY metrics_updated_at DESC NULLS LAST`
    )

    if (campaignsResult.rows.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const campaignIds = campaignsResult.rows.map((r) => r.meta_campaign_id)

    // Get latest insights per campaign
    const insightsResult = await pool.query(
      `SELECT DISTINCT ON (campaign_id)
         campaign_id, impressions, clicks, spend, cpc, ctr, landing_page_views
       FROM ct_ad_insights
       WHERE campaign_id = ANY($1)
       ORDER BY campaign_id, date DESC`,
      [campaignIds]
    )

    const insightsMap = new Map(
      insightsResult.rows.map((r) => [r.campaign_id, r])
    )

    const input = campaignsResult.rows.map((c) => {
      const ins = insightsMap.get(c.meta_campaign_id)
      const metrics = c.metrics ?? {}
      return {
        campaign_id: c.meta_campaign_id,
        name: c.name,
        status: c.status,
        daily_budget: parseFloat(c.daily_budget ?? c.lifetime_budget ?? "0"),
        impressions: parseInt(ins?.impressions ?? metrics.impressions ?? "0"),
        clicks: parseInt(ins?.clicks ?? metrics.clicks ?? "0"),
        spend: parseFloat(ins?.spend ?? metrics.spend ?? "0"),
        cpc: parseFloat(ins?.cpc ?? metrics.cpc ?? "0"),
        ctr: parseFloat(ins?.ctr ?? metrics.ctr ?? "0"),
        landing_page_views: parseInt(ins?.landing_page_views ?? metrics.landing_page_views ?? "0"),
      }
    })

    const rawRecommendations = generateRecommendations(input)

    const nameById = new Map(
      campaignsResult.rows.map((c) => [c.meta_campaign_id, c.name as string])
    )

    const severityScore: Record<string, number> = {
      critical: 100,
      warning: 50,
      info: 10,
    }

    const severityMap: Record<string, "critical" | "warning" | "info"> = {
      critical: "critical",
      warning: "warning",
      info: "info",
    }

    const titleByType: Record<string, string> = {
      cpc_high: "CPC alto",
      ctr_low: "CTR baixo",
      ctr_excellent: "CTR excelente",
      landing_page_issues: "Problemas na landing page",
    }

    const recommendations = rawRecommendations
      .sort((a, b) => (severityScore[b.severity] ?? 0) - (severityScore[a.severity] ?? 0))
      .slice(0, 10)
      .map((rec, idx) => ({
        id: `${rec.campaign_id}-${rec.type}-${idx}`,
        severity: severityMap[rec.severity] ?? "info",
        title: titleByType[rec.type] ?? rec.type,
        description: rec.message,
        campaign_name: nameById.get(rec.campaign_id) ?? undefined,
      }))

    return NextResponse.json({ data: recommendations, total: recommendations.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao gerar recomendações: ${message}` },
      { status: 500 }
    )
  }
})
