import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { deleteServiceCredentials } from "@/lib/queries/credentials"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { service: string } }
) {
  return withTenantDB(request, async (db) => {
    await deleteServiceCredentials(db, params.service)
    return { success: true }
  })
}
