import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import pool from '@/lib/db'
import type { Pool } from 'pg'
import type { TenantDB } from '@/lib/tenant-db'
import type { RequestTenant } from '@/lib/api-auth'

type AuthenticatedHandler = (
  req: NextRequest,
  db: Pool,
  userId: string
) => Promise<NextResponse>

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      // Dev mode: skip auth if Supabase not configured (NEVER in production)
      if (!supabaseUrl || !supabaseKey) {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { error: 'Serviço indisponível - autenticação não configurada' },
            { status: 503 }
          )
        }
        return await handler(req, pool, 'dev-user')
      }

      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll()
            },
            setAll() {},
          },
        }
      )

      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return NextResponse.json(
          { error: 'Não autorizado' },
          { status: 401 }
        )
      }

      return await handler(req, pool, user.id)
    } catch (error) {
      console.error('API Error:', error)
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      )
    }
  }
}

/**
 * Backward-compatible wrapper for old withTenantDB call sites.
 * Adapts the old (request, handler) signature to the new withAuth flow.
 */
export function withTenantDB<T>(
  request: NextRequest,
  handler: (db: TenantDB, tenant: RequestTenant) => Promise<T>
): Promise<NextResponse> {
  const wrapped = withAuth(async (_req: NextRequest, pgPool: Pool, userId: string) => {
    const db: TenantDB = {
      async query(text: string, params?: unknown[]) {
        const result = await pgPool.query(text, params)
        return result.rows
      },
      async queryOne(text: string, params?: unknown[]) {
        const result = await pgPool.query(text, params)
        return result.rows[0] ?? null
      },
    }
    const tenant: RequestTenant = {
      tenantId: userId,
      databaseUrl: process.env.DATABASE_URL ?? '',
      userId,
    }
    const data = await handler(db, tenant)
    return NextResponse.json({ data })
  })
  return wrapped(request)
}

export { pool }
