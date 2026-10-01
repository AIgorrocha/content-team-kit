import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query } from "@/lib/db"
import { DEFAULT_CLIENT_SLUG } from "@/lib/clients"

/**
 * POST /api/studio/upload
 *
 * Receives JSON metadata after the video has been uploaded
 * directly to Supabase Storage from the browser.
 * This avoids the Vercel 4.5MB body limit for serverless functions.
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const {
      name,
      video_url,
      video_storage_path,
      video_size_bytes,
      client_slug = DEFAULT_CLIENT_SLUG,
    } = body

    if (!video_url || !video_storage_path) {
      return NextResponse.json(
        { error: "video_url e video_storage_path são obrigatórios" },
        { status: 400 }
      )
    }

    const projectName = name ?? "Novo projeto"

    const rows = await query(
      `INSERT INTO ct_studio_projects (
        name, status, video_url, video_storage_path,
        video_size_bytes, client_slug
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        projectName,
        "uploaded",
        video_url,
        video_storage_path,
        video_size_bytes ?? null,
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
