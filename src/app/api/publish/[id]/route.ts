import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"

export const GET = withAuth(async (
  req: NextRequest
) => {
  try {
    const id = req.nextUrl.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    const result = await pool.query(
      `SELECT p.*, ci.title as content_title
       FROM ct_publications p
       LEFT JOIN ct_content_items ci ON ci.id = p.content_item_id
       WHERE p.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar publicação: ${message}` },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (
  req: NextRequest
) => {
  try {
    const id = req.nextUrl.pathname.split("/").pop()

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    const existing = await pool.query(
      `SELECT status FROM ct_publications WHERE id = $1`,
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 })
    }

    if (existing.rows[0].status !== "scheduled") {
      return NextResponse.json(
        { error: "Apenas publicações agendadas podem ser canceladas" },
        { status: 400 }
      )
    }

    await pool.query(
      `UPDATE ct_publications SET status = 'cancelled' WHERE id = $1`,
      [id]
    )

    return NextResponse.json({ data: { id, status: "cancelled" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao cancelar publicação: ${message}` },
      { status: 500 }
    )
  }
})
