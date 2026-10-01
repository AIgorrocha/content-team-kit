import { NextResponse } from "next/server"
import type { RequestTenant } from "@/lib/api-auth"
import type { PlanLimits } from "@/lib/types"
import { checkLimit, incrementUsage } from "@/lib/queries/billing"

type UsageResource = "tasks_per_month" | "content_per_month" | "emails_per_month"

const resourceToField = {
  tasks_per_month: "tasks_executed",
  content_per_month: "content_created",
  emails_per_month: "emails_sent",
} as const

export async function enforcePlanLimit(
  tenant: RequestTenant,
  resource: keyof PlanLimits
): Promise<NextResponse | null> {
  const result = await checkLimit(tenant.tenantId, resource)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Limite do plano atingido",
        code: "PLAN_LIMIT_EXCEEDED",
        details: {
          resource,
          current: result.current,
          limit: result.limit,
        },
      },
      { status: 403 }
    )
  }

  return null
}

export async function trackAndEnforce(
  tenant: RequestTenant,
  resource: UsageResource
): Promise<NextResponse | null> {
  const limitError = await enforcePlanLimit(tenant, resource)
  if (limitError) return limitError

  await incrementUsage(
    tenant.tenantId,
    resourceToField[resource]
  )

  return null
}
