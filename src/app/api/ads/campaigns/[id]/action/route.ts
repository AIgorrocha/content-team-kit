import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { updateCampaignStatus, updateAdSetBudget } from "@/lib/integrations/meta-ads"

export const POST = withAuth(async (req: NextRequest, _db, _userId) => {
  try {
    const url = req.nextUrl.pathname
    const campaignId = url.split("/").at(-2) ?? ""

    if (!campaignId) {
      return NextResponse.json({ error: "campaign_id inválido" }, { status: 400 })
    }

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string
    const confirmed = body.confirmed === true
    const value = body.value as number | undefined

    if (!confirmed) {
      return NextResponse.json(
        { error: "Confirmação obrigatória. Envie confirmed: true para executar a ação." },
        { status: 400 }
      )
    }

    if (!["pause", "activate", "budget"].includes(action)) {
      return NextResponse.json(
        { error: "Ação inválida. Use: pause, activate ou budget" },
        { status: 400 }
      )
    }

    // Fetch token from DB
    const accountRow = await pool.query(
      `SELECT ia.access_token, c.status, c.daily_budget
       FROM ct_ad_campaigns c
       JOIN ct_instagram_accounts ia ON ia.id = c.account_id
       WHERE c.meta_campaign_id = $1
       LIMIT 1`,
      [campaignId]
    )

    if (!accountRow.rows[0]) {
      return NextResponse.json(
        { error: `Campanha não encontrada: ${campaignId}` },
        { status: 404 }
      )
    }

    const { access_token, status: oldStatus, daily_budget: oldBudget } = accountRow.rows[0]

    if (action === "pause") {
      const result = await updateCampaignStatus(campaignId, access_token, "PAUSED")
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      await pool.query(
        `INSERT INTO ct_ad_actions_log (campaign_id, action_type, old_value, new_value)
         VALUES ($1, $2, $3, $4)`,
        [campaignId, "status_change", oldStatus, "PAUSED"]
      )

      await pool.query(
        `UPDATE ct_ad_campaigns SET status = 'PAUSED', updated_at = NOW() WHERE campaign_id = $1`,
        [campaignId]
      )

      return NextResponse.json({ data: { success: true, action: "pause", campaign_id: campaignId } })
    }

    if (action === "activate") {
      const result = await updateCampaignStatus(campaignId, access_token, "ACTIVE")
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      await pool.query(
        `INSERT INTO ct_ad_actions_log (campaign_id, action_type, old_value, new_value)
         VALUES ($1, $2, $3, $4)`,
        [campaignId, "status_change", oldStatus, "ACTIVE"]
      )

      await pool.query(
        `UPDATE ct_ad_campaigns SET status = 'ACTIVE', updated_at = NOW() WHERE campaign_id = $1`,
        [campaignId]
      )

      return NextResponse.json({ data: { success: true, action: "activate", campaign_id: campaignId } })
    }

    if (action === "budget") {
      if (!value || value <= 0) {
        return NextResponse.json(
          { error: "value (orçamento diário em BRL) é obrigatório e deve ser positivo" },
          { status: 400 }
        )
      }

      const result = await updateAdSetBudget(campaignId, access_token, value)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      await pool.query(
        `INSERT INTO ct_ad_actions_log (campaign_id, action_type, old_value, new_value)
         VALUES ($1, $2, $3, $4)`,
        [campaignId, "budget_change", String(oldBudget), String(value)]
      )

      return NextResponse.json({ data: { success: true, action: "budget", campaign_id: campaignId, new_budget: value } })
    }

    return NextResponse.json({ error: "Ação não tratada" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao executar ação: ${message}` },
      { status: 500 }
    )
  }
})
