import OpenAI from "openai"

export interface TranscriptionResult {
  video_url: string
  transcript: string
  duration_seconds: number | null
  language: string | null
  error: string | null
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }
  return new OpenAI({ apiKey })
}

async function downloadAudio(url: string): Promise<{ buffer: Buffer; filename: string }> {
  // For YouTube URLs, we need to extract audio
  // For direct audio/video URLs, download directly
  const response = await fetch(url, {
    signal: AbortSignal.timeout(120000), // 2 min timeout
  })

  if (!response.ok) {
    throw new Error(`Erro ao baixar: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Determine extension from content type
  const contentType = response.headers.get("content-type") || ""
  let ext = "mp3"
  if (contentType.includes("mp4")) ext = "mp4"
  if (contentType.includes("webm")) ext = "webm"
  if (contentType.includes("wav")) ext = "wav"

  return { buffer, filename: `audio.${ext}` }
}

export async function transcribeVideo(videoUrl: string): Promise<TranscriptionResult> {
  try {
    const client = getOpenAIClient()

    // Download the audio
    const { buffer, filename } = await downloadAudio(videoUrl)

    // Max file size for Whisper: 25MB
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error("Arquivo de áudio muito grande (max 25MB). Tente um vídeo mais curto.")
    }

    // Create a File object for the OpenAI API
    const file = new File([new Uint8Array(buffer)], filename, { type: "audio/mpeg" })

    const transcription = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
      response_format: "verbose_json",
    })

    return {
      video_url: videoUrl,
      transcript: transcription.text,
      duration_seconds: transcription.duration ?? null,
      language: transcription.language ?? "pt",
      error: null,
    }
  } catch (error) {
    return {
      video_url: videoUrl,
      transcript: "",
      duration_seconds: null,
      language: null,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function transcribeMultipleVideos(
  videoUrls: string[]
): Promise<TranscriptionResult[]> {
  // Process sequentially to avoid rate limits
  const results: TranscriptionResult[] = []

  for (const url of videoUrls) {
    const result = await transcribeVideo(url)
    results.push(result)
  }

  return results
}
