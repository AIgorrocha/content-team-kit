/**
 * Higgsfield AI wrapper service
 *
 * Thin client sobre a API REST do Higgsfield AI (https://platform.higgsfield.ai/docs).
 * Mesmo codigo usado por:
 *  - Skill ct-higgsfield-prompt + agente ct-video-higgsfield (invocado via Claude Code)
 *
 * ATENCAO: este wrapper e um ESBOCO. Ate responsável configurar HIGGSFIELD_API_KEY e rodar
 * o teste end-to-end, os payloads exatos devem ser validados contra a doc oficial.
 * O codigo segue o formato documentado no README do MCP server geopopos/higgsfield_ai_mcp.
 */

const API_BASE = "https://platform.higgsfield.ai/v1"

export type HiggsfieldQuality = "lite" | "turbo" | "standard"
export type HiggsfieldImageQuality = "720p" | "1080p"

export interface HiggsfieldConfig {
  apiKey: string
  secret: string
}

export interface GenerateVideoInput {
  imageUrl: string
  motionId: string
  prompt?: string
  quality?: HiggsfieldQuality
}

export interface GenerateImageInput {
  prompt: string
  quality?: HiggsfieldImageQuality
  styleId?: string
  characterId?: string
}

export interface JobResponse {
  job_set_id: string
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw"
  results?: Array<{ url: string; type: "image" | "video" }>
  error?: string
}

function getConfig(): HiggsfieldConfig {
  const apiKey = process.env.HIGGSFIELD_API_KEY
  const secret = process.env.HIGGSFIELD_SECRET
  if (!apiKey || !secret) {
    throw new Error(
      "HIGGSFIELD_API_KEY e HIGGSFIELD_SECRET nao configurados. Ver docs/HIGGSFIELD_SETUP.md"
    )
  }
  return { apiKey, secret }
}

function headers(config: HiggsfieldConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "x-api-secret": config.secret,
  }
}

export async function generateImage(
  input: GenerateImageInput
): Promise<JobResponse> {
  const config = getConfig()
  const res = await fetch(`${API_BASE}/soul/generate`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      prompt: input.prompt,
      quality: input.quality ?? "1080p",
      style_id: input.styleId,
      character_id: input.characterId,
    }),
  })
  if (!res.ok) {
    throw new Error(`Higgsfield generate_image failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as JobResponse
}

export async function generateVideo(
  input: GenerateVideoInput
): Promise<JobResponse> {
  const config = getConfig()
  const res = await fetch(`${API_BASE}/dop/generate`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      input_images: [{ url: input.imageUrl }],
      motion_id: input.motionId,
      prompt: input.prompt,
      quality: input.quality ?? "standard",
    }),
  })
  if (!res.ok) {
    throw new Error(`Higgsfield generate_video failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as JobResponse
}

export async function getGenerationStatus(jobSetId: string): Promise<JobResponse> {
  const config = getConfig()
  const res = await fetch(`${API_BASE}/jobs/${jobSetId}`, {
    method: "GET",
    headers: headers(config),
  })
  if (!res.ok) {
    throw new Error(`Higgsfield get_status failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as JobResponse
}

/**
 * Polling helper. Timeout default 3 minutos.
 */
export async function waitForCompletion(
  jobSetId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<JobResponse> {
  const timeoutMs = opts.timeoutMs ?? 180_000
  const intervalMs = opts.intervalMs ?? 10_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await getGenerationStatus(jobSetId)
    if (status.status === "completed") return status
    if (status.status === "failed" || status.status === "nsfw") {
      throw new Error(`Higgsfield job ${jobSetId} ${status.status}: ${status.error ?? "unknown"}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Higgsfield job ${jobSetId} timeout (>${timeoutMs}ms)`)
}

/**
 * Fluxo end-to-end single-image-reveal (imagem base -> video).
 * Retorna a URL final do MP4.
 */
export async function generateReelFromPrompt(input: {
  imagePrompt: string
  motionId: string
  videoActionPrompt?: string
  videoQuality?: HiggsfieldQuality
}): Promise<{ imageUrl: string; videoUrl: string; totalCredits: number }> {
  // 1. Gera imagem
  const imageJob = await generateImage({ prompt: input.imagePrompt, quality: "1080p" })
  const imageDone = await waitForCompletion(imageJob.job_set_id)
  const imageUrl = imageDone.results?.[0]?.url
  if (!imageUrl) throw new Error("Imagem nao retornada pela Higgsfield")

  // 2. Gera video
  const videoJob = await generateVideo({
    imageUrl,
    motionId: input.motionId,
    prompt: input.videoActionPrompt,
    quality: input.videoQuality ?? "standard",
  })
  const videoDone = await waitForCompletion(videoJob.job_set_id, { timeoutMs: 300_000 })
  const videoUrl = videoDone.results?.[0]?.url
  if (!videoUrl) throw new Error("Video nao retornado pela Higgsfield")

  // Creditos aproximados: 3 (img 1080p) + (2 lite | 6.5 turbo | 9 standard)
  const videoCred = input.videoQuality === "lite" ? 2 : input.videoQuality === "turbo" ? 6.5 : 9
  return { imageUrl, videoUrl, totalCredits: 3 + videoCred }
}
