import jwt from "jsonwebtoken"

export interface SessionPayload {
  userId: string
  tenantId: string
  role: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required")
  }
  return secret
}

const JWT_EXPIRES_IN = "30d"

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" })
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as SessionPayload
  } catch {
    return null
  }
}
