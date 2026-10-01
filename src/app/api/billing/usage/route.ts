import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { getUsage, checkLimit } from "@/lib/queries/billing"

const TENANT_ID = "af100000-0000-0000-0000-000000000001"


export const GET = withAuth(async (request: NextRequest) => {
  try {
    const usage = await getUsage(TENANT_ID)
    const [agents, tasks, content, emails, storage] = await Promise.all([
      checkLimit(TENANT_ID, "agents"),
      checkLimit(TENANT_ID, "tasks_per_month"),
      checkLimit(TENANT_ID, "content_per_month"),
      checkLimit(TENANT_ID, "emails_per_month"),
      checkLimit(TENANT_ID, "storage_mb"),
    ])

    return NextResponse.json({
      data: {
        usage,
        limits: { agents, tasks, content, emails, storage },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch usage" },
      { status: 500 }
    )
  }
})
