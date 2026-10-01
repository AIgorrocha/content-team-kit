import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { publishToInstagram } from "@/lib/integrations/instagram"
import { deleteFromStorage, extractStoragePaths, TEMP_MEDIA_BUCKET } from "@/lib/integrations/supabase-storage"

/**
 * POST /api/publish/instagram
 *
 * Publica um ct_content_items no Instagram usando Graph API (carrossel, foto ou reel).
 * - Le caption + media_urls da tabela ct_content_items
 * - Cria containers + publica
 * - Sucesso: marca published + apaga arquivos do Supabase Storage (bucket ct-temp-media)
 * - Erro: marca failed + mantem arquivos pra retry
 *
 * Auth: Header x-cron-secret == process.env.CRON_SECRET
 *       OU sessao autenticada (Bearer JWT do dashboard)
 */

interface PublishIGBody {
  content_item_id: string
  dry_run?: boolean
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return provided === secret
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: PublishIGBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 })
  }

  if (!body.content_item_id) {
    return NextResponse.json({ error: "content_item_id obrigatorio" }, { status: 400 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, caption, media_urls, status, account_id, metadata
       FROM ct_content_items WHERE id = $1`,
      [body.content_item_id]
    )

    const item = rows[0]
    if (!item) {
      return NextResponse.json({ error: "content_item nao encontrado" }, { status: 404 })
    }

    if (item.status === "published") {
      return NextResponse.json({ error: "item ja publicado", item_id: item.id }, { status: 409 })
    }

    const mediaUrls: string[] = Array.isArray(item.media_urls) ? item.media_urls : []
    if (mediaUrls.length === 0) {
      return NextResponse.json({ error: "media_urls vazio" }, { status: 400 })
    }

    // Todas as URLs precisam ser publicas (http/https) — Graph API nao aceita paths locais
    const invalid = mediaUrls.filter((u) => !/^https?:\/\//i.test(u))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "media_urls contem paths nao publicos", invalid },
        { status: 400 }
      )
    }

    if (body.dry_run) {
      return NextResponse.json({
        dry_run: true,
        would_publish: {
          id: item.id,
          caption_preview: (item.caption ?? "").substring(0, 100),
          media_count: mediaUrls.length,
        },
      })
    }

    const caption = item.caption ?? ""
    const mediaType = mediaUrls.length > 1 ? "CAROUSEL_ALBUM" : "IMAGE"
    const extras = mediaUrls.length > 1 ? mediaUrls.slice(1) : undefined

    const result = await publishToInstagram(
      caption,
      mediaUrls[0],
      mediaType,
      extras,
      item.account_id ?? undefined,
      item.account_id ? pool : undefined
    )

    if (!result.success) {
      await pool.query(
        `UPDATE ct_content_items
           SET status = 'failed',
               metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                 'error', $2::text,
                 'failed_at', NOW()::text
               )
         WHERE id = $1`,
        [item.id, result.error ?? "Erro desconhecido"]
      )
      return NextResponse.json(
        { success: false, error: result.error, item_id: item.id },
        { status: 502 }
      )
    }

    await pool.query(
      `UPDATE ct_content_items
         SET status = 'published',
             published_at = NOW(),
             publish_url = $2,
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
               'external_id', $3::text,
               'published_by', 'cron'
             )
       WHERE id = $1`,
      [item.id, result.externalUrl ?? null, result.externalId ?? null]
    )

    // Cleanup: apagar arquivos do Supabase Storage (economia de espaco)
    let cleanup: { deleted: number; errors: string[] } = { deleted: 0, errors: [] }
    try {
      const paths = extractStoragePaths(mediaUrls, TEMP_MEDIA_BUCKET)
      if (paths.length > 0) {
        cleanup = await deleteFromStorage({ bucket: TEMP_MEDIA_BUCKET, paths })
      }
    } catch (cleanupErr) {
      cleanup.errors.push(cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr))
    }

    return NextResponse.json({
      success: true,
      item_id: item.id,
      external_id: result.externalId,
      external_url: result.externalUrl,
      cleanup,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
