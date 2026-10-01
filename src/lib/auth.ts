import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { query, queryOne } from "@/lib/db"
import type { User, Tenant, TenantMember } from "@/lib/types"
import { signToken, verifyToken } from "@/lib/jwt"
import type { SessionPayload } from "@/lib/jwt"

const COOKIE_NAME = "ct-session"

export type { SessionPayload }
export { signToken, verifyToken }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getSession(): SessionPayload | null {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function requireAuth(): SessionPayload {
  const session = getSession()
  if (!session) throw new Error("Unauthorized")
  return session
}

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const hash = await hashPassword(password)
  const rows = await query<User>(
    `INSERT INTO ct_users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email.toLowerCase().trim(), name.trim(), hash]
  )
  return rows[0]
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>(
    "SELECT * FROM ct_users WHERE email = $1",
    [email.toLowerCase().trim()]
  )
}

export async function createTenant(
  name: string,
  slug: string,
  databaseUrl: string,
  userId: string
): Promise<Tenant> {
  const rows = await query<Tenant>(
    `INSERT INTO ct_tenants (name, slug, database_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name.trim(), slug.toLowerCase().trim(), databaseUrl]
  )
  const tenant = rows[0]

  await query(
    `INSERT INTO ct_tenant_members (tenant_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [tenant.id, userId]
  )

  return tenant
}

export async function getUserTenant(userId: string): Promise<{ tenant: Tenant; role: string } | null> {
  const row = await queryOne<Tenant & { role: string }>(
    `SELECT t.*, tm.role
     FROM ct_tenants t
     JOIN ct_tenant_members tm ON tm.tenant_id = t.id
     WHERE tm.user_id = $1
     LIMIT 1`,
    [userId]
  )
  if (!row) return null
  const { role, ...tenant } = row
  return { tenant, role }
}

export { COOKIE_NAME }
