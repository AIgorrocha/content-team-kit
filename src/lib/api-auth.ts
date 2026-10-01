import { NextRequest } from "next/server"

export interface RequestTenant {
  tenantId: string
  databaseUrl: string
  userId: string | null
}

import { verifyToken } from "@/lib/jwt"

const AUTH_COOKIE = "ct-auth-token"

export async function getRequestTenant(
  request: NextRequest
): Promise<RequestTenant | null> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return null

  // JWT-based auth (signed token)
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      return {
        tenantId: payload.tenantId,
        databaseUrl,
        userId: payload.userId,
      }
    }
  }

  // X-API-Key header (server-to-server)
  const apiKey = request.headers.get("x-api-key")
  if (apiKey && process.env.ADMIN_API_KEY && apiKey === process.env.ADMIN_API_KEY) {
    return {
      tenantId: "admin",
      databaseUrl,
      userId: null,
    }
  }

  return null
}
