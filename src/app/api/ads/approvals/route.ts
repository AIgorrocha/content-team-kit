import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const result = await pool.query(
      `SELECT id, recommendation_id, campaign_id, action_type, proposed_value, status, created_at, approved_at, executed_at, executed_by
       FROM ct_ad_approvals
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    )
    return NextResponse.json({ data: result.rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar aprovações: ${message}` },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { campaign_id, action_type, proposed_value, recommendation_id } = body

    if (!campaign_id || !action_type) {
      return NextResponse.json(
        { error: "campaign_id e action_type são obrigatórios" },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO ct_ad_approvals (recommendation_id, campaign_id, action_type, proposed_value)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [recommendation_id ?? null, campaign_id, action_type, proposed_value ?? null]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao criar aprovação: ${message}` },
      { status: 500 }
    )
  }
})
