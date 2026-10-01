import { NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { listPlans } from "@/lib/queries/billing"

export const GET = withAuth(async () => {
  try {
    const plans = await listPlans()
    return NextResponse.json({ data: plans })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plans" },
      { status: 500 }
    )
  }
})
