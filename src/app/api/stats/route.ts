import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getDashboardStats } from "@/lib/queries/stats"

export async function GET(request: NextRequest) {
  const client_slug = request.nextUrl.searchParams.get("client_slug") || undefined
  return withTenantDB(request, (db) => getDashboardStats(db, { client_slug }))
}
