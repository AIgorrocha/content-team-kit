import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

export const GET = withAuth(async () => {
  try {
    const result = await pool.query(
      `SELECT id, handle, ig_user_id, ad_account_id, is_active, created_at, updated_at
       FROM ct_instagram_accounts
       ORDER BY handle`
    )

    return NextResponse.json({ data: result.rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar contas: ${message}` },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()

    const { handle, ig_user_id, access_token, ad_account_id } = body

    if (!handle || !ig_user_id || !access_token) {
      return NextResponse.json(
        { error: "handle, ig_user_id e access_token sao obrigatorios" },
        { status: 400 }
      )
    }

    const result = await pool.query(
      `INSERT INTO ct_instagram_accounts (handle, ig_user_id, access_token, ad_account_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, handle, ig_user_id, ad_account_id, is_active, created_at`,
      [handle, ig_user_id, access_token, ad_account_id ?? null]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao criar conta: ${message}` },
      { status: 500 }
    )
  }
})
