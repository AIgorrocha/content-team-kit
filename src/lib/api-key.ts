import { createHash, randomBytes } from "crypto"
import { query, queryOne } from "@/lib/db"
import type { ApiKey, Tenant } from "@/lib/types"

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

export function generateRawKey(): string {
  return `ctak_${randomBytes(32).toString("hex")}`
}

export async function createApiKey(
  tenantId: string,
  label: string
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  const rawKey = generateRawKey()
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 12)

  const rows = await query<ApiKey>(
    `INSERT INTO ct_api_keys (tenant_id, key_hash, key_prefix, label)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, keyHash, keyPrefix, label]
  )

  return { apiKey: rows[0], rawKey }
}

export async function validateApiKey(
  rawKey: string
): Promise<{ tenantId: string; databaseUrl: string } | null> {
  const keyHash = hashKey(rawKey)

  const row = await queryOne<{ tenant_id: string; database_url: string }>(
    `SELECT ak.tenant_id, t.database_url
     FROM ct_api_keys ak
     JOIN ct_tenants t ON t.id = ak.tenant_id
     WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
    [keyHash]
  )

  if (!row) return null

  await query(
    "UPDATE ct_api_keys SET last_used_at = NOW() WHERE key_hash = $1",
    [keyHash]
  )

  return { tenantId: row.tenant_id, databaseUrl: row.database_url }
}

export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  return query<ApiKey>(
    `SELECT id, tenant_id, key_hash, key_prefix, label, last_used_at, revoked_at, created_at
     FROM ct_api_keys
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  )
}

export async function revokeApiKey(keyId: string, tenantId: string): Promise<boolean> {
  const row = await queryOne<ApiKey>(
    `UPDATE ct_api_keys SET revoked_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [keyId, tenantId]
  )
  return row !== null
}
