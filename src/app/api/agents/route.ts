import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listAgents } from "@/lib/queries/agents"

export async function GET(request: NextRequest) {
  return withTenantDB(request, (db) => listAgents(db))
}
