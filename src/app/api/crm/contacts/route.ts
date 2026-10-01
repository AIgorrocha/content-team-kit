import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listContacts } from "@/lib/queries/contacts"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const params = request.nextUrl.searchParams

    const page = Math.max(1, parseInt(params.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20")))

    const { data, total } = await listContacts(db, {
      search: params.get("search") || undefined,
      source: params.get("source") || undefined,
      page,
      limit,
    })

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  })
}
