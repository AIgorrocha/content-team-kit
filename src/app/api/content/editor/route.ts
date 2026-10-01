import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import type { Pool } from "pg"

const VALID_STATUSES = ["draft", "review", "scheduled", "published"] as const
type EditorStatus = (typeof VALID_STATUSES)[number]

interface EditorBody {
  id?: string
  title: string
  platform_captions: Record<string, string>
  status: EditorStatus
  hashtags: string[]
  media_ids?: string[]
}

function validateBody(body: unknown): body is EditorBody {
  if (!body || typeof body !== "object") return false
  const b = body as Record<string, unknown>
  if (typeof b.title !== "string" || !b.title.trim()) return false
  if (!b.platform_captions || typeof b.platform_captions !== "object") return false
  if (!VALID_STATUSES.includes(b.status as EditorStatus)) return false
  if (!Array.isArray(b.hashtags)) return false
  return true
}

export const POST = withAuth(async (req: NextRequest, db: Pool) => {
  const body = await req.json()

  if (!validateBody(body)) {
    return NextResponse.json(
      { error: "Dados invalidos. Verifique titulo, legendas e status." },
      { status: 400 }
    )
  }

  const { title, platform_captions, status, hashtags, media_ids } = body

  // Determine primary platform from captions (longest caption = primary)
  const primaryPlatform = Object.entries(platform_captions).reduce(
    (best, [key, val]) =>
      (val as string).length > (platform_captions[best] ?? "").length ? key : best,
    "instagram"
  )

  // Use the primary platform caption as the main caption
  const primaryCaption = platform_captions[primaryPlatform] ?? ""

  const result = await db.query(
    `INSERT INTO ct_content_items (
      title, content_type, status, platform, caption, hashtags, media_urls,
      metadata, approval_status, created_at, updated_at
    ) VALUES (
      $1, 'post', $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW()
    ) RETURNING *`,
    [
      title.trim(),
      status,
      primaryPlatform,
      primaryCaption,
      hashtags,
      media_ids ?? [],
      JSON.stringify({ platform_captions }),
    ]
  )

  return NextResponse.json({ data: result.rows[0] })
})

export const PUT = withAuth(async (req: NextRequest, db: Pool) => {
  const body = await req.json()

  if (!validateBody(body) || !body.id) {
    return NextResponse.json(
      { error: "Dados invalidos. ID e obrigatorio para atualizar." },
      { status: 400 }
    )
  }

  const { id, title, platform_captions, status, hashtags, media_ids } = body

  const primaryPlatform = Object.entries(platform_captions).reduce(
    (best, [key, val]) =>
      (val as string).length > (platform_captions[best] ?? "").length ? key : best,
    "instagram"
  )

  const primaryCaption = platform_captions[primaryPlatform] ?? ""

  const result = await db.query(
    `UPDATE ct_content_items SET
      title = $1,
      status = $2,
      platform = $3,
      caption = $4,
      hashtags = $5,
      media_urls = $6,
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{platform_captions}', $7::jsonb),
      updated_at = NOW()
    WHERE id = $8
    RETURNING *`,
    [
      title.trim(),
      status,
      primaryPlatform,
      primaryCaption,
      hashtags,
      media_ids ?? [],
      JSON.stringify(platform_captions),
      id,
    ]
  )

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "Conteudo nao encontrado." },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: result.rows[0] })
})
