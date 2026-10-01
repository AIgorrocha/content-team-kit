import type { TenantDB } from "@/lib/tenant-db"
import { encrypt, decrypt } from "@/lib/crypto"

export interface Credential {
  id: string
  service: string
  credential_key: string
  created_at: string
  updated_at: string
}

interface CredentialRow extends Credential {
  encrypted_value: string
  iv: string
  auth_tag: string
}

export async function listCredentialServices(db: TenantDB): Promise<Array<{ service: string; keys: string[] }>> {
  const rows = await db.query<{ service: string; credential_key: string }>(
    `SELECT service, credential_key FROM ct_credentials ORDER BY service, credential_key`
  )

  const grouped: Record<string, string[]> = {}
  for (const row of rows) {
    if (!grouped[row.service]) {
      grouped[row.service] = []
    }
    grouped[row.service].push(row.credential_key)
  }

  return Object.entries(grouped).map(([service, keys]) => ({ service, keys }))
}

export async function saveCredential(
  db: TenantDB,
  service: string,
  key: string,
  value: string
): Promise<Credential> {
  const { encrypted, iv, authTag } = encrypt(value)

  const rows = await db.query<Credential>(
    `INSERT INTO ct_credentials (service, credential_key, encrypted_value, iv, auth_tag)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (service, credential_key)
     DO UPDATE SET encrypted_value = $3, iv = $4, auth_tag = $5, updated_at = NOW()
     RETURNING id, service, credential_key, created_at, updated_at`,
    [service, key, encrypted, iv, authTag]
  )

  return rows[0]
}

export async function getCredentialValue(
  db: TenantDB,
  service: string,
  key: string
): Promise<string | null> {
  const row = await db.queryOne<CredentialRow>(
    `SELECT * FROM ct_credentials WHERE service = $1 AND credential_key = $2`,
    [service, key]
  )

  if (!row) return null
  return decrypt(row.encrypted_value, row.iv, row.auth_tag)
}

export async function getServiceCredentials(
  db: TenantDB,
  service: string
): Promise<Record<string, string>> {
  const rows = await db.query<CredentialRow>(
    `SELECT * FROM ct_credentials WHERE service = $1`,
    [service]
  )

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.credential_key] = decrypt(row.encrypted_value, row.iv, row.auth_tag)
  }
  return result
}

export async function deleteServiceCredentials(db: TenantDB, service: string): Promise<void> {
  await db.query(`DELETE FROM ct_credentials WHERE service = $1`, [service])
}

export async function deleteCredential(db: TenantDB, service: string, key: string): Promise<void> {
  await db.query(
    `DELETE FROM ct_credentials WHERE service = $1 AND credential_key = $2`,
    [service, key]
  )
}
