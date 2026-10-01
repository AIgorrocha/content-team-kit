import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { safeEqual } from "@/lib/security/request-guard"

/**
 * GET/POST /api/cron/publish-scheduled
 *
 * Cron job (default: a cada 5 min) que verifica ct_content_items onde:
 *   status = 'scheduled' AND scheduled_at <= NOW()
 *
 * Pra cada item, chama /api/publish/instagram com o content_item_id.
 *
 * Auth:
 *  - Vercel Cron: envia header `authorization: Bearer <CRON_SECRET>` automaticamente
 *  - Manual: x-cron-secret header
 */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const header = req.headers.get("x-cron-secret")
  return safeEqual(auth, secret) || safeEqual(header, secret)
}

function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(req.url).origin
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, title, scheduled_at, client_slug
         FROM ct_content_items
        WHERE status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= NOW()
          AND client_slug IS NOT NULL
        ORDER BY scheduled_at ASC
        LIMIT 10`
    )

    if (rows.length === 0) {
      return NextResponse.json({ processed: 0, items: [] })
    }

    const baseUrl = getBaseUrl(req)
    const secret = process.env.CRON_SECRET ?? ""
    const results: Array<Record<string, unknown>> = []

    for (const item of rows) {
      try {
        const resp = await fetch(`${baseUrl}/api/publish/instagram`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": secret,
          },
          body: JSON.stringify({ content_item_id: item.id }),
        })
        const data = await resp.json().catch(() => ({}))
        results.push({
          id: item.id,
          title: item.title,
          status: resp.status,
          ok: resp.ok,
          result: data,
        })
      } catch (err) {
        results.push({
          id: item.id,
          title: item.title,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({ processed: results.length, items: results })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
