import type { Pool } from "pg"

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0"

interface MetaApiError {
  error: {
    message: string
    type: string
    code: number
  }
}

interface Campaign {
  id: string
  name: string
  objective: string
  status: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
}

interface CampaignInsight {
  impressions: number
  reach: number
  clicks: number
  spend: number
  cpc: number
  ctr: number
  cpm: number
  actions: Array<{ action_type: string; value: string }>
  cost_per_action_type: Array<{ action_type: string; value: string }>
}

interface SpendSummary {
  spend: number
  impressions: number
  reach: number
  clicks: number
}

interface MetaResult<T> {
  success: boolean
  data?: T
  error?: string
}

function isMetaError(data: unknown): data is MetaApiError {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as MetaApiError).error?.message === "string"
  )
}

async function graphGet<T>(
  endpoint: string,
  token: string
): Promise<MetaResult<T>> {
  try {
    const separator = endpoint.includes("?") ? "&" : "?"
    const url = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${token}`

    const response = await fetch(url)
    const json = await response.json()

    if (isMetaError(json)) {
      return { success: false, error: json.error.message }
    }

    return { success: true, data: json as T }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro na API Meta: ${message}` }
  }
}

export async function getActiveCampaigns(
  adAccountId: string,
  token: string
): Promise<MetaResult<Campaign[]>> {
  const fields = "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time"
  const effectiveStatus = encodeURIComponent('["ACTIVE","PAUSED"]')
  const endpoint = `/${adAccountId}/campaigns?fields=${fields}&effective_status=${effectiveStatus}`

  const result = await graphGet<{ data: Campaign[] }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data.data }
}

export async function getCampaignInsights(
  campaignId: string,
  token: string,
  dateRange?: { since: string; until: string }
): Promise<MetaResult<CampaignInsight>> {
  const fields = "impressions,reach,clicks,spend,cpc,ctr,cpm,actions,cost_per_action_type"

  let endpoint = `/${campaignId}/insights?fields=${fields}`

  if (dateRange) {
    const timeRange = encodeURIComponent(
      JSON.stringify({ since: dateRange.since, until: dateRange.until })
    )
    endpoint += `&time_range=${timeRange}`
  }

  const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  const raw = result.data.data[0]

  if (!raw) {
    return {
      success: true,
      data: {
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        cpc: 0,
        ctr: 0,
        cpm: 0,
        actions: [],
        cost_per_action_type: [],
      },
    }
  }

  return {
    success: true,
    data: {
      impressions: parseInt(String(raw.impressions ?? "0")),
      reach: parseInt(String(raw.reach ?? "0")),
      clicks: parseInt(String(raw.clicks ?? "0")),
      spend: parseFloat(String(raw.spend ?? "0")),
      cpc: parseFloat(String(raw.cpc ?? "0")),
      ctr: parseFloat(String(raw.ctr ?? "0")),
      cpm: parseFloat(String(raw.cpm ?? "0")),
      actions: (raw.actions as CampaignInsight["actions"]) ?? [],
      cost_per_action_type: (raw.cost_per_action_type as CampaignInsight["cost_per_action_type"]) ?? [],
    },
  }
}

export async function getAdAccountSpend(
  adAccountId: string,
  token: string,
  period: "today" | "last_7d" | "last_30d" = "last_30d"
): Promise<MetaResult<SpendSummary>> {
  const fields = "spend,impressions,reach,clicks"
  const endpoint = `/${adAccountId}/insights?fields=${fields}&date_preset=${period}`

  const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  const raw = result.data.data[0]

  if (!raw) {
    return {
      success: true,
      data: { spend: 0, impressions: 0, reach: 0, clicks: 0 },
    }
  }

  return {
    success: true,
    data: {
      spend: parseFloat(String(raw.spend ?? "0")),
      impressions: parseInt(String(raw.impressions ?? "0")),
      reach: parseInt(String(raw.reach ?? "0")),
      clicks: parseInt(String(raw.clicks ?? "0")),
    },
  }
}

async function graphPost<T>(
  endpoint: string,
  token: string,
  body: Record<string, unknown>
): Promise<MetaResult<T>> {
  try {
    const url = `${GRAPH_API_BASE}${endpoint}`
    const params = new URLSearchParams({
      access_token: token,
      ...Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, String(v)])
      ),
    })

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
    const json = await response.json()

    if (isMetaError(json)) {
      return { success: false, error: json.error.message }
    }

    return { success: true, data: json as T }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro na API Meta: ${message}` }
  }
}

export async function getInsightsTimeline(
  campaignId: string,
  token: string,
  period: string = "last_7d"
): Promise<MetaResult<Array<{date: string, impressions: number, reach: number, clicks: number, spend: number, cpc: number, ctr: number}>>> {
  const fields = "impressions,reach,clicks,spend,cpc,ctr"
  const endpoint = `/${campaignId}/insights?fields=${fields}&date_preset=${period}&time_increment=1`

  const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  const timeline = result.data.data.map((row) => ({
    date: String(row.date_start ?? ""),
    impressions: parseInt(String(row.impressions ?? "0")),
    reach: parseInt(String(row.reach ?? "0")),
    clicks: parseInt(String(row.clicks ?? "0")),
    spend: parseFloat(String(row.spend ?? "0")),
    cpc: parseFloat(String(row.cpc ?? "0")),
    ctr: parseFloat(String(row.ctr ?? "0")),
  }))

  return { success: true, data: timeline }
}

export async function getDemographics(
  adAccountId: string,
  token: string,
  breakdown: "age,gender" | "publisher_platform,platform_position" | "region",
  period: string = "last_7d"
): Promise<MetaResult<Array<Record<string, unknown>>>> {
  const fields = "impressions,clicks,spend"
  const breakdownEncoded = encodeURIComponent(breakdown)
  const endpoint = `/${adAccountId}/insights?fields=${fields}&date_preset=${period}&breakdowns=${breakdownEncoded}`

  const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data.data }
}

export async function updateCampaignStatus(
  campaignId: string,
  token: string,
  status: "ACTIVE" | "PAUSED"
): Promise<MetaResult<{success: boolean}>> {
  const result = await graphPost<Record<string, unknown>>(
    `/${campaignId}`,
    token,
    { status }
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: { success: true } }
}

export async function updateAdSetBudget(
  adSetId: string,
  token: string,
  dailyBudget: number
): Promise<MetaResult<{success: boolean}>> {
  const dailyBudgetCents = Math.round(dailyBudget * 100)

  const result = await graphPost<Record<string, unknown>>(
    `/${adSetId}`,
    token,
    { daily_budget: dailyBudgetCents }
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: { success: true } }
}

export async function getAdSets(
  campaignId: string,
  token: string
): Promise<MetaResult<Array<{id: string, name: string, status: string, daily_budget: string, impressions?: number, clicks?: number, spend?: number}>>> {
  const fields = "id,name,status,daily_budget"
  const endpoint = `/${campaignId}/adsets?fields=${fields}`

  const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

  if (!result.success || !result.data) {
    return { success: false, error: result.error }
  }

  const adsets = result.data.data.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    status: String(row.status ?? ""),
    daily_budget: String(row.daily_budget ?? "0"),
  }))

  return { success: true, data: adsets }
}

export function generateRecommendations(
  campaigns: Array<{
    campaign_id: string
    name: string
    cpc: number
    ctr: number
    spend: number
    daily_budget: number
    status: string
    impressions: number
    clicks: number
    landing_page_views: number
  }>
): Array<{campaign_id: string, type: string, severity: string, message: string, data: Record<string, unknown>}> {
  const recommendations: Array<{campaign_id: string, type: string, severity: string, message: string, data: Record<string, unknown>}> = []

  for (const campaign of campaigns) {
    if (campaign.cpc > 0.50) {
      recommendations.push({
        campaign_id: campaign.campaign_id,
        type: "cpc_high",
        severity: "warning",
        message: `CPC alto: R$${campaign.cpc.toFixed(2)} na campanha "${campaign.name}"`,
        data: { cpc: campaign.cpc },
      })
    }

    if (campaign.ctr < 1) {
      recommendations.push({
        campaign_id: campaign.campaign_id,
        type: "ctr_low",
        severity: "warning",
        message: `CTR baixo: ${campaign.ctr.toFixed(2)}% na campanha "${campaign.name}"`,
        data: { ctr: campaign.ctr },
      })
    }

    if (campaign.ctr > 5) {
      recommendations.push({
        campaign_id: campaign.campaign_id,
        type: "ctr_excellent",
        severity: "info",
        message: `CTR excelente: ${campaign.ctr.toFixed(2)}% na campanha "${campaign.name}"`,
        data: { ctr: campaign.ctr },
      })
    }

    if (campaign.landing_page_views < campaign.clicks * 0.5) {
      recommendations.push({
        campaign_id: campaign.campaign_id,
        type: "landing_page_issues",
        severity: "warning",
        message: `Landing page com problemas: apenas ${campaign.landing_page_views} visualizações de ${campaign.clicks} cliques na campanha "${campaign.name}"`,
        data: { landing_page_views: campaign.landing_page_views, clicks: campaign.clicks },
      })
    }

    // budget_almost_spent removed: daily budget being spent is normal behavior
    // campaign_paused removed: route now only queries ACTIVE campaigns
  }

  return recommendations
}

export async function syncInsightsToDb(
  pool: Pool,
  adAccountId: string,
  token: string,
  period: string
): Promise<MetaResult<{synced: number}>> {
  try {
    const fields = "campaign_id,impressions,reach,clicks,spend,cpc,ctr,cpm,landing_page_views,video_views,actions"
    const endpoint = `/${adAccountId}/insights?fields=${fields}&date_preset=${period}&time_increment=1&level=campaign`

    const result = await graphGet<{ data: Array<Record<string, unknown>> }>(endpoint, token)

    if (!result.success || !result.data) {
      return { success: false, error: result.error }
    }

    let synced = 0

    for (const row of result.data.data) {
      await pool.query(
        `INSERT INTO ct_ad_insights (
          campaign_id, date, impressions, reach, clicks, spend,
          cpc, ctr, cpm, landing_page_views, video_views, actions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (campaign_id, date) DO UPDATE SET
          impressions = EXCLUDED.impressions,
          reach = EXCLUDED.reach,
          clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend,
          cpc = EXCLUDED.cpc,
          ctr = EXCLUDED.ctr,
          cpm = EXCLUDED.cpm,
          landing_page_views = EXCLUDED.landing_page_views,
          video_views = EXCLUDED.video_views,
          actions = EXCLUDED.actions`,
        [
          String(row.campaign_id ?? ""),
          String(row.date_start ?? new Date().toISOString().slice(0, 10)),
          parseInt(String(row.impressions ?? "0")),
          parseInt(String(row.reach ?? "0")),
          parseInt(String(row.clicks ?? "0")),
          parseFloat(String(row.spend ?? "0")),
          parseFloat(String(row.cpc ?? "0")),
          parseFloat(String(row.ctr ?? "0")),
          parseFloat(String(row.cpm ?? "0")),
          parseInt(String(row.landing_page_views ?? "0")),
          parseInt(String(row.video_views ?? "0")),
          JSON.stringify(row.actions ?? []),
        ]
      )
      synced++
    }

    return { success: true, data: { synced } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao sincronizar insights: ${message}` }
  }
}

export async function syncCampaignsToDb(
  pool: Pool,
  accountId: string
): Promise<MetaResult<{ synced: number }>> {
  try {
    const accountResult = await pool.query(
      `SELECT ad_account_id, access_token FROM ct_instagram_accounts WHERE id = $1 AND is_active = true`,
      [accountId]
    )

    const account = accountResult.rows[0]
    if (!account) {
      return { success: false, error: `Conta não encontrada: ${accountId}` }
    }

    if (!account.ad_account_id) {
      return { success: false, error: "Conta não possui ad_account_id configurado" }
    }

    const campaignsResult = await getActiveCampaigns(
      account.ad_account_id,
      account.access_token
    )

    if (!campaignsResult.success || !campaignsResult.data) {
      return { success: false, error: campaignsResult.error }
    }

    let synced = 0

    for (const campaign of campaignsResult.data) {
      // Budget values from Meta come in cents - divide by 100
      const dailyBudget = campaign.daily_budget
        ? parseFloat(campaign.daily_budget) / 100
        : null
      const lifetimeBudget = campaign.lifetime_budget
        ? parseFloat(campaign.lifetime_budget) / 100
        : null

      await pool.query(
        `INSERT INTO ct_ad_campaigns (
          account_id, meta_campaign_id, name, objective, status,
          daily_budget, lifetime_budget, start_date, end_date,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (account_id, meta_campaign_id) DO UPDATE SET
          name = EXCLUDED.name,
          objective = EXCLUDED.objective,
          status = EXCLUDED.status,
          daily_budget = EXCLUDED.daily_budget,
          lifetime_budget = EXCLUDED.lifetime_budget,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          updated_at = NOW()`,
        [
          accountId,
          campaign.id,
          campaign.name,
          campaign.objective,
          campaign.status,
          dailyBudget,
          lifetimeBudget,
          campaign.start_time ?? null,
          campaign.stop_time ?? null,
        ]
      )

      synced++
    }

    return { success: true, data: { synced } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao sincronizar campanhas: ${message}` }
  }
}
