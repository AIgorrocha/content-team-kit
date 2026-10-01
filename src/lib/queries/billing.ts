import { query, queryOne } from "@/lib/db"
import type { Plan, Subscription, Usage, PlanId, PlanLimits } from "@/lib/types"

// --- Plans ---

export async function listPlans(): Promise<Plan[]> {
  return query<Plan>(
    "SELECT * FROM ct_plans WHERE is_active = TRUE ORDER BY sort_order ASC"
  )
}

export async function getPlan(planId: string): Promise<Plan | null> {
  return queryOne<Plan>("SELECT * FROM ct_plans WHERE id = $1", [planId])
}

// --- Subscriptions ---

export async function getSubscription(tenantId: string): Promise<Subscription | null> {
  return queryOne<Subscription>(
    "SELECT * FROM ct_subscriptions WHERE tenant_id = $1",
    [tenantId]
  )
}

export async function getSubscriptionWithPlan(tenantId: string): Promise<(Subscription & { plan: Plan }) | null> {
  const row = await queryOne<Subscription & {
    plan_name: string
    plan_description: string | null
    plan_price_monthly: number
    plan_price_yearly: number
    plan_limits: PlanLimits
    plan_features: string[]
  }>(
    `SELECT s.*, p.name as plan_name, p.description as plan_description,
            p.price_monthly as plan_price_monthly, p.price_yearly as plan_price_yearly,
            p.limits as plan_limits, p.features as plan_features
     FROM ct_subscriptions s
     JOIN ct_plans p ON p.id = s.plan_id
     WHERE s.tenant_id = $1`,
    [tenantId]
  )
  if (!row) return null

  const { plan_name, plan_description, plan_price_monthly, plan_price_yearly, plan_limits, plan_features, ...sub } = row
  return {
    ...sub,
    plan: {
      id: sub.plan_id,
      name: plan_name,
      description: plan_description,
      price_monthly: plan_price_monthly,
      price_yearly: plan_price_yearly,
      limits: plan_limits,
      features: plan_features,
      is_active: true,
      sort_order: 0,
      created_at: sub.created_at,
    },
  }
}

export async function createSubscription(data: {
  tenantId: string
  planId: PlanId
  billingCycle: string
  provider?: string
  providerSubscriptionId?: string
  providerCustomerId?: string
  trialEndsAt?: string
}): Promise<Subscription> {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + (data.billingCycle === "yearly" ? 12 : 1))

  const rows = await query<Subscription>(
    `INSERT INTO ct_subscriptions (tenant_id, plan_id, status, billing_cycle, provider,
       provider_subscription_id, provider_customer_id, current_period_start, current_period_end, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       billing_cycle = EXCLUDED.billing_cycle,
       provider = EXCLUDED.provider,
       provider_subscription_id = EXCLUDED.provider_subscription_id,
       provider_customer_id = EXCLUDED.provider_customer_id,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       trial_ends_at = EXCLUDED.trial_ends_at,
       updated_at = NOW()
     RETURNING *`,
    [
      data.tenantId,
      data.planId,
      data.trialEndsAt ? "trialing" : "active",
      data.billingCycle,
      data.provider ?? null,
      data.providerSubscriptionId ?? null,
      data.providerCustomerId ?? null,
      now.toISOString(),
      periodEnd.toISOString(),
      data.trialEndsAt ?? null,
    ]
  )

  // Update tenant plan field
  await query(
    "UPDATE ct_tenants SET plan = $1 WHERE id = $2",
    [data.planId, data.tenantId]
  )

  return rows[0]
}

export async function cancelSubscription(tenantId: string): Promise<Subscription | null> {
  const rows = await query<Subscription>(
    `UPDATE ct_subscriptions
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1
     RETURNING *`,
    [tenantId]
  )
  if (rows.length > 0) {
    await query("UPDATE ct_tenants SET plan = 'free' WHERE id = $1", [tenantId])
  }
  return rows[0] ?? null
}

export async function updateSubscriptionFromProvider(
  provider: string,
  providerSubscriptionId: string,
  updates: Partial<Pick<Subscription, "status" | "plan_id" | "current_period_start" | "current_period_end" | "cancelled_at">>
): Promise<Subscription | null> {
  const setClauses: string[] = ["updated_at = NOW()"]
  const values: unknown[] = []
  let idx = 1

  if (updates.status !== undefined) {
    setClauses.push(`status = $${idx++}`)
    values.push(updates.status)
  }
  if (updates.plan_id !== undefined) {
    setClauses.push(`plan_id = $${idx++}`)
    values.push(updates.plan_id)
  }
  if (updates.current_period_start !== undefined) {
    setClauses.push(`current_period_start = $${idx++}`)
    values.push(updates.current_period_start)
  }
  if (updates.current_period_end !== undefined) {
    setClauses.push(`current_period_end = $${idx++}`)
    values.push(updates.current_period_end)
  }
  if (updates.cancelled_at !== undefined) {
    setClauses.push(`cancelled_at = $${idx++}`)
    values.push(updates.cancelled_at)
  }

  values.push(provider, providerSubscriptionId)

  const rows = await query<Subscription>(
    `UPDATE ct_subscriptions SET ${setClauses.join(", ")}
     WHERE provider = $${idx++} AND provider_subscription_id = $${idx}
     RETURNING *`,
    values
  )

  if (rows[0] && updates.plan_id) {
    await query("UPDATE ct_tenants SET plan = $1 WHERE id = $2", [updates.plan_id, rows[0].tenant_id])
  }

  return rows[0] ?? null
}

// --- Usage ---

export async function getUsage(tenantId: string, period?: string): Promise<Usage | null> {
  const p = period ?? new Date().toISOString().slice(0, 7)
  return queryOne<Usage>(
    "SELECT * FROM ct_usage WHERE tenant_id = $1 AND period = $2",
    [tenantId, p]
  )
}

export async function incrementUsage(
  tenantId: string,
  field: "tasks_executed" | "content_created" | "emails_sent" | "api_calls",
  amount: number = 1
): Promise<Usage> {
  const period = new Date().toISOString().slice(0, 7)
  const rows = await query<Usage>(
    `INSERT INTO ct_usage (tenant_id, period, ${field})
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, period) DO UPDATE
     SET ${field} = ct_usage.${field} + $3, updated_at = NOW()
     RETURNING *`,
    [tenantId, period, amount]
  )
  return rows[0]
}

// --- Limit checking ---

export async function checkLimit(
  tenantId: string,
  resource: keyof PlanLimits
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const sub = await getSubscriptionWithPlan(tenantId)
  const limits = sub?.plan.limits ?? { agents: 3, tasks_per_month: 50, content_per_month: 20, emails_per_month: 100, storage_mb: 500 }
  const limit = limits[resource]

  // -1 = unlimited
  if (limit === -1) return { allowed: true, current: 0, limit: -1 }

  const usage = await getUsage(tenantId)
  const fieldMap: Record<string, keyof Usage> = {
    tasks_per_month: "tasks_executed",
    content_per_month: "content_created",
    emails_per_month: "emails_sent",
    agents: "agents_used",
    storage_mb: "storage_bytes",
  }

  const usageField = fieldMap[resource]
  let current = 0
  if (usage && usageField) {
    current = Number(usage[usageField]) || 0
    if (resource === "storage_mb") {
      current = Math.ceil(current / (1024 * 1024)) // bytes to MB
    }
  }

  return { allowed: current < limit, current, limit }
}
