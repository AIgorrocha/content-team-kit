import type { TenantDB } from "@/lib/tenant-db"

export interface AnalyticsKpis {
  total: number
  successRate: number
  mostActivePlatform: string
  thisMonth: number
  previousMonth: number
  previousTotal: number
}

export interface TimeSeriesPoint {
  week: string
  instagram: number
  linkedin: number
  youtube: number
  tiktok: number
  x: number
  email: number
}

export interface PlatformDistItem {
  platform: string
  count: number
  percentage: number
}

export interface MonthlyDataPoint {
  month: string
  instagram: number
  linkedin: number
  youtube: number
  tiktok: number
  x: number
  email: number
}

export interface BestTimePoint {
  dayOfWeek: number
  hour: number
  count: number
}

export interface RecentPublication {
  id: string
  title: string
  platform: string
  content_type: string
  status: string
  published_at: string | null
  scheduled_at: string | null
}

export interface AnalyticsData {
  kpis: AnalyticsKpis
  timeSeriesData: TimeSeriesPoint[]
  platformDistribution: PlatformDistItem[]
  monthlyData: MonthlyDataPoint[]
  bestTimes: BestTimePoint[]
  recentPublications: RecentPublication[]
}

function getPeriodInterval(period: string): string {
  switch (period) {
    case "7d":
      return "7 days"
    case "30d":
      return "30 days"
    case "12m":
      return "12 months"
    case "90d":
    default:
      return "90 days"
  }
}

export async function getAnalyticsData(
  db: TenantDB,
  period: string,
  platformFilter?: string,
  trafficType: string = "all",
  accountId?: string
): Promise<AnalyticsData> {
  const interval = getPeriodInterval(period)
  const params: unknown[] = [interval]
  let paramIndex = 2

  let platformClause = ""
  if (platformFilter) {
    platformClause = `AND platform = $${paramIndex++}`
    params.push(platformFilter)
  }

  let trafficClause = ""
  if (trafficType !== "all") {
    trafficClause = `AND traffic_type = $${paramIndex++}`
    params.push(trafficType)
  }

  let accountClause = ""
  if (accountId) {
    accountClause = `AND account_id = $${paramIndex++}`
    params.push(accountId)
  }

  const extraClauses = `${platformClause} ${trafficClause} ${accountClause}`

  // KPIs
  const [kpiRow] = await db.query<{
    total: string
    published: string
    this_month: string
    previous_month: string
    previous_total: string
  }>(`
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'published'
        AND published_at >= NOW() - $1::interval
      ) as total,
      COUNT(*) FILTER (
        WHERE status = 'published'
        AND published_at >= NOW() - $1::interval
      ) as published,
      COUNT(*) FILTER (
        WHERE status = 'published'
        AND published_at >= date_trunc('month', CURRENT_DATE)
      ) as this_month,
      COUNT(*) FILTER (
        WHERE status = 'published'
        AND published_at >= date_trunc('month', CURRENT_DATE) - interval '1 month'
        AND published_at < date_trunc('month', CURRENT_DATE)
      ) as previous_month,
      COUNT(*) FILTER (
        WHERE status IN ('published', 'scheduled', 'draft')
        AND created_at >= NOW() - $1::interval
      ) as previous_total
    FROM ct_content_items
    WHERE 1=1 ${extraClauses}
  `, params)

  // Most active platform
  const [topPlatform] = await db.query<{ platform: string; cnt: string }>(`
    SELECT platform, COUNT(*) as cnt
    FROM ct_content_items
    WHERE status = 'published'
      AND published_at >= NOW() - $1::interval
      ${extraClauses}
    GROUP BY platform
    ORDER BY cnt DESC
    LIMIT 1
  `, params)

  const total = parseInt(kpiRow?.total ?? "0")
  const previousTotal = parseInt(kpiRow?.previous_total ?? "0")
  const successRate = previousTotal > 0
    ? Math.round((total / previousTotal) * 100)
    : 0

  const kpis: AnalyticsKpis = {
    total,
    successRate,
    mostActivePlatform: topPlatform?.platform ?? "nenhuma",
    thisMonth: parseInt(kpiRow?.this_month ?? "0"),
    previousMonth: parseInt(kpiRow?.previous_month ?? "0"),
    previousTotal,
  }

  // Time series - publications per week (last 3 months)
  const timeSeriesRows = await db.query<{
    week: string
    platform: string
    count: string
  }>(`
    SELECT
      to_char(date_trunc('week', published_at), 'YYYY-MM-DD') as week,
      platform,
      COUNT(*) as count
    FROM ct_content_items
    WHERE status = 'published'
      AND published_at >= NOW() - $1::interval
      ${extraClauses}
    GROUP BY week, platform
    ORDER BY week
  `, params)

  const weekMap = new Map<string, TimeSeriesPoint>()
  for (const row of timeSeriesRows) {
    const existing = weekMap.get(row.week) ?? {
      week: row.week,
      instagram: 0,
      linkedin: 0,
      youtube: 0,
      tiktok: 0,
      x: 0,
      email: 0,
    }
    const p = row.platform as keyof Omit<TimeSeriesPoint, "week">
    if (p in existing) {
      existing[p] = parseInt(row.count)
    }
    weekMap.set(row.week, existing)
  }
  const timeSeriesData = Array.from(weekMap.values())

  // Platform distribution
  const platformRows = await db.query<{
    platform: string
    count: string
  }>(`
    SELECT platform, COUNT(*) as count
    FROM ct_content_items
    WHERE status = 'published'
      AND published_at >= NOW() - $1::interval
      ${extraClauses}
    GROUP BY platform
    ORDER BY count DESC
  `, params)

  const platformTotal = platformRows.reduce(
    (sum, r) => sum + parseInt(r.count),
    0
  )
  const platformDistribution: PlatformDistItem[] = platformRows.map((r) => ({
    platform: r.platform,
    count: parseInt(r.count),
    percentage:
      platformTotal > 0
        ? Math.round((parseInt(r.count) / platformTotal) * 100)
        : 0,
  }))

  // Monthly data - stacked by platform
  const monthlyRows = await db.query<{
    month: string
    platform: string
    count: string
  }>(`
    SELECT
      to_char(date_trunc('month', published_at), 'YYYY-MM') as month,
      platform,
      COUNT(*) as count
    FROM ct_content_items
    WHERE status = 'published'
      AND published_at >= NOW() - $1::interval
      ${extraClauses}
    GROUP BY month, platform
    ORDER BY month
  `, params)

  const monthMap = new Map<string, MonthlyDataPoint>()
  for (const row of monthlyRows) {
    const existing = monthMap.get(row.month) ?? {
      month: row.month,
      instagram: 0,
      linkedin: 0,
      youtube: 0,
      tiktok: 0,
      x: 0,
      email: 0,
    }
    const p = row.platform as keyof Omit<MonthlyDataPoint, "month">
    if (p in existing) {
      existing[p] = parseInt(row.count)
    }
    monthMap.set(row.month, existing)
  }
  const monthlyData = Array.from(monthMap.values())

  // Best times
  const bestTimeRows = await db.query<{
    dow: string
    hour: string
    count: string
  }>(`
    SELECT
      EXTRACT(DOW FROM published_at) as dow,
      EXTRACT(HOUR FROM published_at) as hour,
      COUNT(*) as count
    FROM ct_content_items
    WHERE status = 'published'
      AND published_at >= NOW() - $1::interval
      ${extraClauses}
    GROUP BY dow, hour
    ORDER BY count DESC
  `, params)

  const bestTimes: BestTimePoint[] = bestTimeRows.map((r) => ({
    dayOfWeek: parseInt(r.dow),
    hour: parseInt(r.hour),
    count: parseInt(r.count),
  }))

  // Recent publications - build dedicated params since this query doesn't use interval
  const recentParams: unknown[] = []
  let recentParamIdx = 1
  let recentClauses = ""
  if (platformFilter) {
    recentClauses += ` AND platform = $${recentParamIdx++}`
    recentParams.push(platformFilter)
  }
  if (trafficType !== "all") {
    recentClauses += ` AND traffic_type = $${recentParamIdx++}`
    recentParams.push(trafficType)
  }
  if (accountId) {
    recentClauses += ` AND account_id = $${recentParamIdx++}`
    recentParams.push(accountId)
  }

  const recentPublications = await db.query<RecentPublication>(`
    SELECT id, title, platform, content_type, status, published_at, scheduled_at
    FROM ct_content_items
    WHERE status IN ('published', 'scheduled')
      ${recentClauses}
    ORDER BY COALESCE(published_at, scheduled_at) DESC
    LIMIT 20
  `, recentParams)

  return {
    kpis,
    timeSeriesData,
    platformDistribution,
    monthlyData,
    bestTimes,
    recentPublications,
  }
}
