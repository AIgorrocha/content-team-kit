import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listSubscribers, getSubscriberStats } from "@/lib/queries/email"
import type { SubscriberStatus } from "@/lib/types"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const params = request.nextUrl.searchParams

    const page = Math.max(1, parseInt(params.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20")))

    const [{ data, total }, stats] = await Promise.all([
      listSubscribers(db, {
        search: params.get("search") || undefined,
        status: (params.get("status") as SubscriberStatus) || undefined,
        page,
        limit,
      }),
      getSubscriberStats(db),
    ])

    return {
      data,
      stats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  })
}
