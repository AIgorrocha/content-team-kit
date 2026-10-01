import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getDesignSystem, updateDesignSystem } from "@/lib/queries/design-system"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const ds = await getDesignSystem(db)
    return ds
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  return withTenantDB(request, async (db) => {
    const updated = await updateDesignSystem(db, body)
    return updated
  })
}
