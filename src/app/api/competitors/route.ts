import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listCompetitors } from "@/lib/queries/competitors"

export async function GET(request: NextRequest) {
  return withTenantDB(request, (db) => {
    const search = request.nextUrl.searchParams.get("search") || undefined
    return listCompetitors(db, { search })
  })
}
