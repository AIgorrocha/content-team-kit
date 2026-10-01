import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listInfluencers } from "@/lib/queries/influencers"
import type { InfluencerStatus } from "@/lib/types"

const validStatuses: InfluencerStatus[] = ["prospect", "contacted", "active", "inactive"]

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const url = new URL(request.url)

    const statusParam = url.searchParams.get("status") ?? undefined
    const status = statusParam && validStatuses.includes(statusParam as InfluencerStatus)
      ? (statusParam as InfluencerStatus)
      : undefined
    const search = url.searchParams.get("search") ?? undefined
    const page = parseInt(url.searchParams.get("page") ?? "1")
    const limit = parseInt(url.searchParams.get("limit") ?? "20")

    const result = await listInfluencers(db, { status, search, page, limit })

    return {
      data: result.influencers,
      meta: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    }
  })
}
