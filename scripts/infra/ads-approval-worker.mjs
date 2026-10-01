#!/usr/bin/env node
/**
 * Ads Approval Worker
 *
 * Roda num servidor a cada 5 minutos via cron.
 * Lê aprovações pendentes em ct_ad_approvals e executa via Meta API.
 * Registra em ct_ad_actions_log.
 *
 * Uso: node scripts/infra/ads-approval-worker.mjs
 *
 * Env vars necessárias:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - META_ACCESS_TOKEN
 *
 * Cron sugerido (servidor):
 *   *\/5 * * * * cd <pasta-do-kit> && node scripts/infra/ads-approval-worker.mjs >> ads-approval.log 2>&1
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const META_TOKEN = process.env.META_ACCESS_TOKEN

if (!SUPABASE_URL || !SUPABASE_KEY || !META_TOKEN) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_ACCESS_TOKEN")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const GRAPH_API = "https://graph.facebook.com/v21.0"

async function executeAction(approval) {
  const { campaign_id, action_type, proposed_value } = approval

  try {
    let endpoint = ""
    let body = ""

    if (action_type === "pause") {
      endpoint = `${GRAPH_API}/${campaign_id}?status=PAUSED&access_token=${META_TOKEN}`
    } else if (action_type === "activate") {
      endpoint = `${GRAPH_API}/${campaign_id}?status=ACTIVE&access_token=${META_TOKEN}`
    } else if (action_type === "update_budget") {
      // proposed_value in BRL, convert to cents
      const cents = Math.round(parseFloat(proposed_value) * 100)
      endpoint = `${GRAPH_API}/${campaign_id}?daily_budget=${cents}&access_token=${META_TOKEN}`
    } else {
      return { success: false, error: `Unknown action_type: ${action_type}` }
    }

    const res = await fetch(endpoint, { method: "POST" })
    const data = await res.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Checking pending approvals...`)

  const { data: approvals, error } = await supabase
    .from("ct_ad_approvals")
    .select("*")
    .eq("status", "approved")
    .is("executed_at", null)
    .limit(10)

  if (error) {
    console.error("Error fetching approvals:", error.message)
    process.exit(1)
  }

  if (!approvals || approvals.length === 0) {
    console.log("No pending approvals.")
    return
  }

  console.log(`Found ${approvals.length} approved actions to execute.`)

  for (const approval of approvals) {
    console.log(`  Executing ${approval.action_type} on campaign ${approval.campaign_id}...`)
    const result = await executeAction(approval)

    if (result.success) {
      // Mark as executed
      await supabase
        .from("ct_ad_approvals")
        .update({
          executed_at: new Date().toISOString(),
          executed_by: "ads-approval-worker",
          status: "executed",
        })
        .eq("id", approval.id)

      // Log action
      await supabase.from("ct_ad_actions_log").insert({
        campaign_id: approval.campaign_id,
        action_type: approval.action_type,
        new_value: approval.proposed_value,
        executed_by: "ads-approval-worker",
      })

      console.log(`  OK`)
    } else {
      await supabase
        .from("ct_ad_approvals")
        .update({
          status: "failed",
          executed_by: `error: ${result.error}`,
        })
        .eq("id", approval.id)

      console.error(`  FAILED: ${result.error}`)
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
