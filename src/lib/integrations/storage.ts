import type { TenantDB } from "@/lib/tenant-db"
import { getCredentialValue } from "@/lib/queries/credentials"

export async function getSupabaseStorageUrl(
  db: TenantDB,
  bucket: string,
  filePath: string
): Promise<string | null> {
  // Uses the tenant's own Supabase URL for storage
  // The database URL contains the project ref we need
  return null // Placeholder - depends on tenant config
}

export function validateFileUpload(file: {
  name: string
  size: number
  type: string
}): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime",
    "application/pdf",
    "audio/mpeg", "audio/wav",
  ]

  if (file.size > maxSize) {
    return { valid: false, error: "Arquivo muito grande (máximo 10MB)" }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Tipo de arquivo não suportado: ${file.type}` }
  }

  return { valid: true }
}
