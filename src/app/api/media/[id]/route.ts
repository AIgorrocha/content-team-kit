import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query, queryOne } from "@/lib/db"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export const GET = withAuth(async (req: NextRequest, _db, _userId) => {
  const url = new URL(req.url)
  const id = url.pathname.split("/").pop()

  const row = await queryOne("SELECT * FROM ct_media WHERE id = $1", [id])

  if (!row) {
    return NextResponse.json(
      { error: "Mídia não encontrada" },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: row })
}) as unknown as (req: NextRequest, ctx: RouteParams) => Promise<NextResponse>

export const PUT = withAuth(async (req: NextRequest, _db, _userId) => {
  const url = new URL(req.url)
  const id = url.pathname.split("/").pop()

  try {
    const body = await req.json()
    const { tags, description } = body as {
      tags?: string[]
      description?: string
    }

    const existing = await queryOne("SELECT id FROM ct_media WHERE id = $1", [id])
    if (!existing) {
      return NextResponse.json(
        { error: "Mídia não encontrada" },
        { status: 404 }
      )
    }

    const sets: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (tags !== undefined) {
      sets.push(`tags = $${paramIndex++}`)
      values.push(tags)
    }

    if (description !== undefined) {
      sets.push(`description = $${paramIndex++}`)
      values.push(description)
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 }
      )
    }

    sets.push(`updated_at = NOW()`)
    values.push(id)

    const rows = await query(
      `UPDATE ct_media SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar mídia" },
      { status: 500 }
    )
  }
}) as unknown as (req: NextRequest, ctx: RouteParams) => Promise<NextResponse>

export const DELETE = withAuth(async (req: NextRequest, _db, _userId) => {
  const url = new URL(req.url)
  const id = url.pathname.split("/").pop()

  try {
    const row = await queryOne<{ storage_path: string }>(
      "SELECT storage_path FROM ct_media WHERE id = $1",
      [id]
    )

    if (!row) {
      return NextResponse.json(
        { error: "Mídia não encontrada" },
        { status: 404 }
      )
    }

    const supabase = getSupabaseAdmin()
    await supabase.storage.from("media").remove([row.storage_path])

    await query("DELETE FROM ct_media WHERE id = $1", [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir mídia" },
      { status: 500 }
    )
  }
}) as unknown as (req: NextRequest, ctx: RouteParams) => Promise<NextResponse>
