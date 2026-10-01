import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { publishToInstagram, publishStory } from "@/lib/integrations/instagram"
import { publishToThreads } from "@/lib/integrations/threads"
import { publishToLinkedIn } from "@/lib/integrations/linkedin"
import { publishToTikTok } from "@/lib/integrations/tiktok"
import { publishToYouTube } from "@/lib/integrations/youtube"
import type { PublishPlatform } from "@/lib/integrations/types"

interface PublishBody {
  content_item_id: string
  platforms: PublishPlatform[]
  captions: Partial<Record<PublishPlatform, string>>
  media_urls: string[]
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"
  scheduled_at?: string
  account_id?: string
  youtube_title?: string
  youtube_description?: string
  youtube_tags?: string[]
  youtube_is_short?: boolean
}

interface PlatformResult {
  platform: PublishPlatform
  success: boolean
  publicationId: string
  externalId?: string
  externalUrl?: string
  error?: string
}

async function publishToPlatform(
  platform: PublishPlatform,
  caption: string,
  mediaUrls: string[],
  mediaType: string,
  body: PublishBody
): Promise<{ success: boolean; externalId?: string; externalUrl?: string; error?: string }> {
  switch (platform) {
    case "instagram": {
      const igType = mediaUrls.length > 1 ? "CAROUSEL_ALBUM" : (mediaType as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM")
      return publishToInstagram(
        caption,
        mediaUrls[0] ?? "",
        igType,
        mediaUrls.length > 1 ? mediaUrls.slice(1) : undefined,
        body.account_id,
        body.account_id ? pool : undefined
      )
    }
    case "instagram_stories" as PublishPlatform: {
      const results: { success: boolean; externalId?: string; externalUrl?: string; error?: string } = { success: true }
      for (const url of mediaUrls) {
        const r = await publishStory(caption, url, body.account_id, body.account_id ? pool : undefined)
        if (!r.success) return r
        results.externalId = r.externalId
        results.externalUrl = r.externalUrl
      }
      return results
    }
    case "threads": {
      const threadsType = mediaType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const
      return publishToThreads(caption, mediaUrls[0], mediaUrls[0] ? threadsType : undefined)
    }
    case "linkedin":
      return publishToLinkedIn(caption, mediaType === "VIDEO" ? mediaUrls[0] : undefined)
    case "tiktok":
      return publishToTikTok(caption, mediaUrls[0] ?? "")
    case "youtube":
      return publishToYouTube(
        body.youtube_title ?? "",
        body.youtube_description ?? caption,
        body.youtube_tags ?? [],
        mediaUrls[0] ?? "",
        body.youtube_is_short ?? false
      )
    default:
      return { success: false, error: `Plataforma não suportada: ${platform}` }
  }
}

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body: PublishBody = await req.json()

    if (!body.content_item_id || !body.platforms || body.platforms.length === 0) {
      return NextResponse.json(
        { error: "content_item_id e platforms são obrigatórios" },
        { status: 400 }
      )
    }

    const validPlatforms: string[] = [
      "instagram", "instagram_stories", "threads", "linkedin", "tiktok", "youtube",
    ]
    const invalidPlatforms = body.platforms.filter((p) => !validPlatforms.includes(p))
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Plataformas inválidas: ${invalidPlatforms.join(", ")}` },
        { status: 400 }
      )
    }

    const isScheduled = Boolean(body.scheduled_at)
    const results: PlatformResult[] = []

    for (const platform of body.platforms) {
      const caption = body.captions[platform] ?? ""
      const mediaType = body.media_type ?? "IMAGE"

      // Create publication record
      const insertResult = await pool.query(
        `INSERT INTO ct_publications (
          content_item_id, platform, status, scheduled_at, caption, media_ids, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id`,
        [
          body.content_item_id,
          platform,
          isScheduled ? "scheduled" : "publishing",
          body.scheduled_at ?? null,
          caption,
          '{}',
        ]
      )

      // Store account_id on the content item if provided
      if (body.account_id) {
        await pool.query(
          `UPDATE ct_content_items SET account_id = $1 WHERE id = $2 AND account_id IS NULL`,
          [body.account_id, body.content_item_id]
        )
      }

      const publicationId = insertResult.rows[0].id

      if (isScheduled) {
        results.push({
          platform,
          success: true,
          publicationId,
        })
        continue
      }

      // Publish immediately
      const result = await publishToPlatform(
        platform,
        caption,
        body.media_urls,
        mediaType,
        body
      )

      if (result.success) {
        await pool.query(
          `UPDATE ct_publications
           SET status = 'published',
               published_at = NOW(),
               external_id = $2,
               external_url = $3
           WHERE id = $1`,
          [publicationId, result.externalId ?? null, result.externalUrl ?? null]
        )
      } else {
        await pool.query(
          `UPDATE ct_publications
           SET status = 'failed',
               error_message = $2,
               retry_count = retry_count + 1
           WHERE id = $1`,
          [publicationId, result.error ?? "Erro desconhecido"]
        )
      }

      results.push({
        platform,
        success: result.success,
        publicationId,
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        error: result.error,
      })
    }

    // Update content item status if all published
    const allPublished = results.every((r) => r.success)
    if (allPublished && !isScheduled) {
      await pool.query(
        `UPDATE ct_content_items SET status = 'published', published_at = NOW() WHERE id = $1`,
        [body.content_item_id]
      )
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao publicar: ${message}` },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const params = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(params.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20")))
    const offset = (page - 1) * limit
    const platform = params.get("platform")
    const status = params.get("status")

    let where = "WHERE 1=1"
    const values: unknown[] = []
    let paramIndex = 1

    if (platform) {
      where += ` AND p.platform = $${paramIndex++}`
      values.push(platform)
    }

    if (status) {
      where += ` AND p.status = $${paramIndex++}`
      values.push(status)
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ct_publications p ${where}`,
      values
    )
    const total = parseInt(countResult.rows[0].count)

    const dataResult = await pool.query(
      `SELECT p.*, ci.title as content_title
       FROM ct_publications p
       LEFT JOIN ct_content_items ci ON ci.id = p.content_item_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    )

    return NextResponse.json({
      data: dataResult.rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json(
      { error: `Erro ao buscar publicações: ${message}` },
      { status: 500 }
    )
  }
})
