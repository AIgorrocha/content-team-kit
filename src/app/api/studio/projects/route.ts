import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query } from "@/lib/db"

export const GET = withAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams
  const clientSlug = params.get("client_slug")
  const status = params.get("status")
  const page = Math.max(1, parseInt(params.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20")))
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
    `SELECT COUNT(*) as count FROM ct_studio_projects ${whereClause}`,
    values
  )
  const total = parseInt(countResult[0]?.count ?? "0")

  values.push(limit)
  values.push(offset)

  const rows = await query(
    `SELECT id, name, status, video_url, video_duration_seconds as duration_seconds,
            video_size_bytes, srt, transcript, language, caption_color, caption_font_size,
            output_url, output_format, client_slug, created_at, updated_at
     FROM ct_studio_projects ${whereClause}
     ORDER BY created_at DESC
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
