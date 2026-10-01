import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { updateDeal } from "@/lib/queries/crm"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  return withTenantDB(request, async (db) => {
    const deal = await updateDeal(db, id, {
      stage_id: body.stage_id,
      status: body.status,
      notes: body.notes,
    })
    if (!deal) throw new Error("Deal not found")
    return deal
  })
}
