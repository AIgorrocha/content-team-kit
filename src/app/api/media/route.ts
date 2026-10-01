import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query } from "@/lib/db"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { DEFAULT_CLIENT_SLUG } from "@/lib/clients"

const MAX_BYTES = (Number(process.env.MEDIA_MAX_MB) || 200) * 1024 * 1024
const SLUG_OK = /^[a-z0-9][a-z0-9-]*$/
const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg",
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const GET = withAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams
  const mediaType = params.get("media_type")
  const clientSlug = params.get("client_slug")
  const tags = params.get("tags")
  const search = params.get("search")
  const page = Math.max(1, parseInt(params.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "30")))
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (mediaType) {
    conditions.push(`media_type = $${paramIndex++}`)
    values.push(mediaType)
  }

  if (clientSlug) {
    conditions.push(`client_slug = $${paramIndex++}`)
    values.push(clientSlug)
  }

  if (tags) {
    conditions.push(`tags @> $${paramIndex++}`)
    values.push([tags])
  }

  if (search) {
    conditions.push(`(original_filename ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`)
    values.push(`%${search}%`)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ct_media ${whereClause}`,
    values
  )
  const total = parseInt(countResult[0]?.count ?? "0")

  values.push(limit)
  values.push(offset)

  const rows = await query(
    `SELECT * FROM ct_media ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
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
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo grande demais." }, { status: 413 })
    }
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const clientSlug = formData.get("client_slug") as string | null
    const description = formData.get("description") as string | null
    const tagsRaw = formData.get("tags") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      )
    }

    const ext = EXT_POR_MIME[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Aceitos: JPG, PNG, WebP, GIF, AVIF, MP4, MOV, WebM, MP3, WAV, M4A, AAC, OGG." },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo maior que o limite de ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` },
        { status: 413 }
      )
    }
    if (clientSlug && !SLUG_OK.test(clientSlug)) {
      return NextResponse.json({ error: "client_slug inválido" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const uniqueName = `${randomUUID()}.${ext}`
    const storagePath = clientSlug
      ? `${clientSlug}/${uniqueName}`
      : uniqueName

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Erro no upload: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(storagePath)

    const mediaType = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : "audio"

    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : []

    const rows = await query(
      `INSERT INTO ct_media (
        filename, original_filename, mime_type, size_bytes,
        storage_path, public_url, media_type, tags,
        client_slug, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        uniqueName,
        file.name,
        file.type,
        file.size,
        storagePath,
        urlData.publicUrl,
        mediaType,
        tags,
        clientSlug ?? DEFAULT_CLIENT_SLUG,
        description ?? null,
      ]
    )

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao fazer upload" },
      { status: 500 }
    )
  }
})
