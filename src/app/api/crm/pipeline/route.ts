import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listPipelineWithDeals } from "@/lib/queries/crm"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const pipeline = await listPipelineWithDeals(db)
    return pipeline
  })
}
