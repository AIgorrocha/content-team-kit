import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getAnalyticsData } from "@/lib/queries/analytics"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "90d"
  const platform = searchParams.get("platform") ?? undefined
  const trafficType = searchParams.get("traffic_type") ?? "all"
  const accountId = searchParams.get("account_id") ?? undefined

  return withTenantDB(request, (db) =>
    getAnalyticsData(db, period, platform, trafficType, accountId)
  )
}
