import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getContactById } from "@/lib/queries/contacts"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenantDB(request, async (db) => {
    const { id } = await params
    const result = await getContactById(db, id)
    if (!result) throw new Error("Contact not found")
    return result
  })
}
