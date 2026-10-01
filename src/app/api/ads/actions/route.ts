import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const accountId = req.nextUrl.searchParams.get("account_id")

    let query = `SELECT id, campaign_id, action_type, old_value, new_value, executed_by, created_at
                 FROM ct_ad_actions_log`
    const params: unknown[] = []

    if (accountId) {
      query += ` WHERE campaign_id IN (
        SELECT meta_campaign_id FROM ct_ad_campaigns WHERE account_id = $1
      )`
      params.push(accountId)
    }

    query += ` ORDER BY created_at DESC LIMIT 50`

    const result = await pool.query(query, params)

    return NextResponse.json({ data: result.rows })
  } catch {
    return NextResponse.json({ data: [] })
  }
})