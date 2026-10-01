import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import {
  getSubscriptionWithPlan,
  createSubscription,
  cancelSubscription,
  getUsage,
} from "@/lib/queries/billing"

const TENANT_ID = "af100000-0000-0000-0000-000000000001"


export const GET = withAuth(async (request: NextRequest) => {
  try {
    const subscription = await getSubscriptionWithPlan(TENANT_ID)
    const usage = await getUsage(TENANT_ID)

    return NextResponse.json({
      data: {
        subscription,
        usage,
        currentPlan: subscription?.plan_id ?? "free",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { planId, billingCycle = "monthly" } = body

    if (!planId) {
      return NextResponse.json({ error: "planId é obrigatório" }, { status: 400 })
    }

    const subscription = await createSubscription({
      tenantId: TENANT_ID,
      planId,
      billingCycle,
      provider: "manual",
    })

    return NextResponse.json({ data: subscription })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create subscription" },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const result = await cancelSubscription(TENANT_ID)
    if (!result) {
      return NextResponse.json({ error: "Nenhuma assinatura encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel subscription" },
      { status: 500 }
    )
  }
})
