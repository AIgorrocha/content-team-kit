import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listSkills } from "@/lib/queries/skills"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const skills = await listSkills(db)
    return { skills }
  })
}
