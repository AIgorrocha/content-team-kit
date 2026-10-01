import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query, queryOne } from "@/lib/db"

export const GET = withAuth(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
  }

  const row = await queryOne(
    `SELECT * FROM ct_video_projects WHERE id = $1`,
    [id]
  )

  if (!row) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ data: row })
})

export const PUT = withAuth(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
  }

  try {
    const body = await req.json()
    const allowedFields = [
      "name",
      "status",
      "composition_data",
      "duration_seconds",
      "fps",
      "width",
      "height",
      "source_media_ids",
      "caption_srt",
      "caption_style",
      "output_url",
      "output_formats",
      "render_id",
      "render_progress",
    ]

    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = field === "composition_data"
          ? JSON.stringify(body[field])
          : body[field]
        updates.push(`${field} = $${paramIndex++}`)
        values.push(value)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const rows = await query(
      `UPDATE ct_video_projects SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 })
    }

    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar projeto" },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split("/").pop()

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
  }

  const rows = await query(
    `DELETE FROM ct_video_projects WHERE id = $1 RETURNING id`,
    [id]
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ data: { deleted: true } })
})
