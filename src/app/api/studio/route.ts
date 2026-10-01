import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query } from "@/lib/db"
import { DEFAULT_CLIENT_SLUG } from "@/lib/clients"

export const GET = withAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams
  const clientSlug = params.get("client_slug")
  const status = params.get("status")
  const page = Math.max(1, parseInt(params.get("page") ?? "1"))
  const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") ?? "20")))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (clientSlug) {
    conditions.push(`client_slug = $${paramIndex++}`)
    values.push(clientSlug)
  }

  if (status) {
    conditions.push(`status = $${paramIndex++}`)
    values.push(status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ct_video_projects ${whereClause}`,
    values
  )
  const total = parseInt(countResult[0]?.count ?? "0")

  values.push(limit)
  values.push(offset)

  const rows = await query(
    `SELECT id, name, status, duration_seconds, fps, width, height, output_url, output_formats, render_progress, client_slug, created_at, updated_at
     FROM ct_video_projects ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    values
  )

  return NextResponse.json({
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const {
      name,
      composition_data,
      duration_seconds = 30,
      fps = 30,
      width = 1080,
      height = 1920,
      source_media_ids = [],
      caption_srt = null,
      caption_style = null,
      client_slug = DEFAULT_CLIENT_SLUG,
    } = body

    if (!name || !composition_data) {
      return NextResponse.json(
        { error: "Nome e dados de composição são obrigatórios" },
        { status: 400 }
      )
    }

    const rows = await query(
      `INSERT INTO ct_video_projects (
        name, status, composition_data, duration_seconds, fps, width, height,
        source_media_ids, caption_srt, caption_style, output_formats, client_slug
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        name,
        "draft",
        JSON.stringify(composition_data),
        duration_seconds,
        fps,
        width,
        height,
        source_media_ids,
        caption_srt,
        caption_style,
        [],
        client_slug,
      ]
    )

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar projeto" },
      { status: 500 }
    )
  }
})
