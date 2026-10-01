import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getSettings, updateSettings } from "@/lib/queries/settings"

export async function GET(request: NextRequest) {
  return withTenantDB(request, (db) => getSettings(db))
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  return withTenantDB(request, (db) => updateSettings(db, body))
}
