import { NextRequest, NextResponse } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { createDeal } from "@/lib/queries/crm"

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
    return NextResponse.json(
      { error: "Field 'title' is required" },
      { status: 400 }
    )
  }

  if (!body.stage_id || typeof body.stage_id !== "string") {
    return NextResponse.json(
      { error: "Field 'stage_id' is required" },
      { status: 400 }
    )
  }

  return withTenantDB(request, async (db) => {
    const deal = await createDeal(db, {
      title: body.title.trim(),
      contact_id: body.contact_id || undefined,
      stage_id: body.stage_id,
      value: body.value != null ? Number(body.value) : undefined,
      expected_close_at: body.expected_close_at || undefined,
    })
    return deal
  })
}
