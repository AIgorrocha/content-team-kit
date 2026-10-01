import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

export const GET = withAuth(async (
  _req: NextRequest,
  _db,
  _userId,
) => {
  try {
    // Extract id from URL path
    const url = _req.nextUrl.pathname
    const segments = url.split("/")
    const id = segments[segments.indexOf("accounts") + 1]

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const result = await pool.query(
      `SELECT id, handle, ig_user_id, ad_account_id, is_active, created_at, updated_at
       FROM ct_instagram_accounts
       WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar conta: ${message}` },
      { status: 500 }
    )
  }
})

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const url = req.nextUrl.pathname
    const segments = url.split("/")
    const id = segments[segments.indexOf("accounts") + 1]

    if (!id) {
      return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 })
    }

    const body = await req.json()
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (body.access_token !== undefined) {
      updates.push(`access_token = $${paramIndex++}`)
      values.push(body.access_token)
    }
    if (body.ad_account_id !== undefined) {
      updates.push(`ad_account_id = $${paramIndex++}`)
      values.push(body.ad_account_id)
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(body.is_active)
    }
    if (body.handle !== undefined) {
      updates.push(`handle = $${paramIndex++}`)
      values.push(body.handle)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)

    const result = await pool.query(
      `UPDATE ct_instagram_accounts
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, handle, ig_user_id, ad_account_id, is_active, updated_at`,
      [...values, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao atualizar conta: ${message}` },
      { status: 500 }
    )
  }
})
