import { createClient } from '@/lib/supabase'
import { DEFAULT_CLIENT_SLUG } from '@/lib/clients'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

interface UploadResult {
  success: boolean
  publicUrl?: string
  storagePath?: string
  error?: string
}

interface ProjectResult {
  success: boolean
  project?: Record<string, unknown>
  error?: string
}

/**
 * Upload video directly to Supabase Storage from the browser.
 * Bypasses Next.js API to avoid Vercel's 4.5MB body limit.
 */
export async function uploadVideoToStorage(
  file: File,
  clientSlug: string = DEFAULT_CLIENT_SLUG,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  try {
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'mp4'
    const uniqueName = `${generateId()}.${ext}`
    const storagePath = `${clientSlug}/studio/${uniqueName}`

    onProgress?.(10)

    const { error: uploadError } = await supabase.storage
      .from('content-media')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return { success: false, error: `Erro no upload: ${uploadError.message}` }
    }

    onProgress?.(90)

    const { data: urlData } = supabase.storage
      .from('content-media')
      .getPublicUrl(storagePath)

    onProgress?.(100)

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      storagePath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    }
  }
}

/**
 * Create a studio project in the database after uploading the video.
 */
export async function createStudioProject(
  name: string,
  videoUrl: string,
  storagePath: string,
  fileSizeBytes: number,
  clientSlug: string = DEFAULT_CLIENT_SLUG
): Promise<ProjectResult> {
  try {
    const res = await fetch('/api/studio/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        video_url: videoUrl,
        video_storage_path: storagePath,
        video_size_bytes: fileSizeBytes,
        client_slug: clientSlug,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      return { success: false, error: data.error ?? 'Erro ao criar projeto' }
    }

    const data = await res.json()
    return { success: true, project: data.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar projeto',
    }
  }
}

/**
 * Trigger Whisper transcription for a project.
 */
export async function transcribeProject(
  projectId: string
): Promise<{ success: boolean; project?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch('/api/studio/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })

    if (!res.ok) {
      const data = await res.json()
      return { success: false, error: data.error ?? 'Erro na transcrição' }
    }

    const data = await res.json()
    return { success: true, project: data.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro na transcrição',
    }
  }
}
