import { NextRequest, NextResponse } from "next/server"
import { withTenantDB } from "@/lib/route-helper"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const platform = request.nextUrl.searchParams.get("platform")
    const client = request.nextUrl.searchParams.get("client")
    const params: unknown[] = []
    const where: string[] = []
    if (platform) { params.push(platform); where.push(`platform = $${params.length}`) }
    if (client) { params.push(client); where.push(`client_slug = $${params.length}`) }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const rows = await db.query(
      `SELECT id, platform, mode, client_slug, label, source_url, keywords,
              source_file, fetched_at, posts_count, metadata, created_at
         FROM ct_research_runs
         ${whereSql}
         ORDER BY COALESCE(fetched_at, created_at) DESC
         LIMIT 200`,
      params
    )
    return rows
  })
}
