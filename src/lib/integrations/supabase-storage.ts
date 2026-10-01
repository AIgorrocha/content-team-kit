/**
 * Helper para upload/delete de arquivos no Supabase Storage.
 * Bucket padrao: ct-temp-media (publico, usado para hospedar midias
 * temporariamente durante a publicacao via Graph API).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

export const TEMP_MEDIA_BUCKET = "ct-temp-media"

function assertEnv(): void {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Supabase Storage nao configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)")
  }
}

export function publicUrlFor(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`
}

export async function uploadToStorage(params: {
  bucket?: string
  path: string
  body: ArrayBuffer | Uint8Array | Buffer
  contentType: string
  upsert?: boolean
}): Promise<{ url: string; path: string }> {
  assertEnv()
  const bucket = params.bucket ?? TEMP_MEDIA_BUCKET
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${params.path.replace(/^\/+/, "")}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": params.contentType,
      "x-upsert": params.upsert === false ? "false" : "true",
    },
    body: params.body as BodyInit,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Upload falhou (${response.status}): ${text}`)
  }

  return { url: publicUrlFor(bucket, params.path), path: params.path }
}

export async function deleteFromStorage(params: {
  bucket?: string
  paths: string[]
}): Promise<{ deleted: number; errors: string[] }> {
  assertEnv()
  const bucket = params.bucket ?? TEMP_MEDIA_BUCKET
  if (params.paths.length === 0) return { deleted: 0, errors: [] }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: params.paths }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { deleted: 0, errors: [`${response.status}: ${text}`] }
  }

  const data = (await response.json()) as Array<{ name: string }> | { message?: string }
  if (Array.isArray(data)) {
    return { deleted: data.length, errors: [] }
  }
  return { deleted: 0, errors: [data?.message ?? "resposta inesperada"] }
}

/**
 * Extrai paths relativos ao bucket a partir de URLs publicas do Supabase Storage.
 * Retorna apenas os paths dentro do bucket informado.
 */
export function extractStoragePaths(urls: string[], bucket = TEMP_MEDIA_BUCKET): string[] {
  const marker = `/storage/v1/object/public/${bucket}/`
  return urls
    .map((u) => {
      const idx = u.indexOf(marker)
      return idx === -1 ? null : u.substring(idx + marker.length)
    })
    .filter((p): p is string => Boolean(p))
}
