import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

interface CampaignAnalysis {
  campaign_id: string
  campaign_name: string
  account_handle: string
  status: string
  objective: string
  daily_budget: number | null

  // Métricas
  impressions: number
  reach: number
  clicks: number
  spend: number
  cpc: number
  ctr: number
  cpm: number
  landing_page_views: number
  lp_conversion_rate: number // landing_page_views / clicks

  // Análise
  score: number // 0-100
  health: "excellent" | "good" | "warning" | "critical"
  headline: string // "🏆 MELHOR CAMPANHA" etc
  diagnosis: string // narrativa
  recommendations: Array<{
    priority: "critical" | "high" | "medium" | "low"
    action: string
    reason: string
    suggested_value?: string
  }>
}

function analyzeCampaign(c: {
  meta_campaign_id: string
  name: string
  account_handle: string
  status: string
  objective: string
  daily_budget: number | null
  metrics: Record<string, unknown> | null
}): CampaignAnalysis {
  const m = c.metrics ?? {}
  const impressions = Number(m.impressions ?? 0)
  const reach = Number(m.reach ?? 0)
  const clicks = Number(m.clicks ?? 0)
  const spend = Number(m.spend ?? 0)
  const cpc = Number(m.cpc ?? 0)
  const ctr = Number(m.ctr ?? 0)
  const cpm = Number(m.cpm ?? 0)
  const landing_page_views = Number(m.landing_page_views ?? 0)
  const lp_conversion_rate = clicks > 0 ? (landing_page_views / clicks) * 100 : 0

  // Score calculation
  let score = 50
  if (ctr > 5) score += 25
  else if (ctr > 3) score += 15
  else if (ctr > 1) score += 5
  else score -= 10

  if (cpc > 0 && cpc < 0.2) score += 20
  else if (cpc < 0.35) score += 10
  else if (cpc > 0.5) score -= 15

  if (lp_conversion_rate > 70) score += 15
  else if (lp_conversion_rate > 50) score += 5
  else if (lp_conversion_rate > 0 && lp_conversion_rate < 40) score -= 20

  if (c.status === "PAUSED") score = Math.min(score, 40)

  score = Math.max(0, Math.min(100, score))

  // Health
  let health: CampaignAnalysis["health"] = "warning"
  if (score >= 80) health = "excellent"
  else if (score >= 60) health = "good"
  else if (score < 40) health = "critical"

  // Headline
  let headline = ""
  if (score >= 85) headline = "🏆 MELHOR CAMPANHA"
  else if (score >= 70) headline = "✅ Performando bem"
  else if (score >= 50) headline = "⚠️ Atenção necessária"
  else if (c.status === "PAUSED") headline = "⏸️ Pausada"
  else headline = "🔴 Performance crítica"

  // Diagnosis
  const parts: string[] = []
  if (impressions === 0) {
    parts.push("Sem dados de veiculação ainda. Meta pode levar até 24h pra processar métricas de campanhas novas.")
  } else {
    if (ctr > 5) parts.push(`CTR de ${ctr.toFixed(2)}% é excelente (3x acima da média do setor).`)
    else if (ctr > 3) parts.push(`CTR de ${ctr.toFixed(2)}% está acima da média.`)
    else if (ctr < 1) parts.push(`CTR de ${ctr.toFixed(2)}% é baixo, público ou criativo não estão conectando.`)

    if (cpc > 0 && cpc < 0.2) parts.push(`CPC de R$${cpc.toFixed(2)} é muito eficiente.`)
    else if (cpc > 0.5) parts.push(`CPC de R$${cpc.toFixed(2)} está alto, vale testar públicos novos.`)

    if (lp_conversion_rate > 70) parts.push(`${lp_conversion_rate.toFixed(0)}% dos cliques chegam na landing page — conversão excelente.`)
    else if (lp_conversion_rate > 0 && lp_conversion_rate < 50) parts.push(`Apenas ${lp_conversion_rate.toFixed(0)}% dos cliques viram visita na LP — diferença entre clique e chegada sugere que o criativo promete mais do que a LP entrega, ou que o público bounce antes de carregar.`)
  }

  const diagnosis = parts.length > 0 ? parts.join(" ") : "Campanha sem dados suficientes pra análise."

  // Recommendations
  const recommendations: CampaignAnalysis["recommendations"] = []

  if (c.status === "ACTIVE" && impressions > 0) {
    if (score >= 80) {
      recommendations.push({
        priority: "high",
        action: "Aumentar orçamento +50%",
        reason: `Campanha com score ${score}/100, escalar vai dar mais retorno`,
        suggested_value: c.daily_budget ? `R$${(c.daily_budget * 1.5).toFixed(2)}` : undefined,
      })
      recommendations.push({
        priority: "medium",
        action: "Criar cópia pra testar variações",
        reason: "Melhor performer, vale replicar com novos criativos",
      })
    }

    if (ctr < 1 && impressions > 500) {
      recommendations.push({
        priority: "critical",
        action: "Pausar ou revisar criativo",
        reason: `CTR de ${ctr.toFixed(2)}% está crítico, não vale continuar gastando`,
      })
    }

    if (lp_conversion_rate > 0 && lp_conversion_rate < 50 && clicks > 30) {
      recommendations.push({
        priority: "high",
        action: "Investigar landing page",
        reason: `${clicks - landing_page_views} cliques não chegaram na LP, investigar velocidade mobile ou conteúdo`,
      })
    }

    if (cpc > 0.5) {
      recommendations.push({
        priority: "medium",
        action: "Testar novo público",
        reason: `CPC de R$${cpc.toFixed(2)} está alto, público atual pode estar saturado`,
      })
    }
  }

  return {
    campaign_id: c.meta_campaign_id,
    campaign_name: c.name,
    account_handle: c.account_handle,
    status: c.status,
    objective: c.objective,
    daily_budget: c.daily_budget,
    impressions,
    reach,
    clicks,
    spend,
    cpc,
    ctr,
    cpm,
    landing_page_views,
    lp_conversion_rate,
    score,
    health,
    headline,
    diagnosis,
    recommendations,
  }
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get("account_id")

    let query = `SELECT DISTINCT ON (c.meta_campaign_id)
                   c.meta_campaign_id, c.name, c.status, c.objective,
                   c.daily_budget, c.metrics,
                   a.handle as account_handle
                 FROM ct_ad_campaigns c
                 LEFT JOIN ct_instagram_accounts a ON c.account_id = a.id
                 WHERE c.status = 'ACTIVE'`
    const params: unknown[] = []

    if (accountId) {
      query += ` AND c.account_id = $1`
      params.push(accountId)
    }

    query += ` ORDER BY c.meta_campaign_id, c.metrics_updated_at DESC NULLS LAST`

    const result = await pool.query(query, params)

    const analyses = result.rows.map((row) =>
      analyzeCampaign({
        meta_campaign_id: row.meta_campaign_id,
        name: row.name,
        account_handle: row.account_handle ?? "—",
        status: row.status,
        objective: row.objective ?? "",
        daily_budget: row.daily_budget ? Number(row.daily_budget) : null,
        metrics: row.metrics,
      })
    )

    // Sort: critical first, then by score descending
    analyses.sort((a, b) => {
      if (a.health === "critical" && b.health !== "critical") return -1
      if (b.health === "critical" && a.health !== "critical") return 1
      return b.score - a.score
    })

    return NextResponse.json({ data: analyses })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
})
