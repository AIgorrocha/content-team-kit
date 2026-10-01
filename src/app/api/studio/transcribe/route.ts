import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query, queryOne } from "@/lib/db"
import { parseSrt } from "@/lib/studio-types"
import OpenAI from "openai"

const WHISPER_MAX_SIZE = 25 * 1024 * 1024 // 25MB

function getMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase() ?? ""
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  }
  return mimeMap[ext] ?? "video/mp4"
}

function getFilename(url: string): string {
  const segments = url.split("/")
  return segments[segments.length - 1] ?? "video.mp4"
}

export const POST = withAuth(async (req: NextRequest) => {
  let projectId: string | null = null

  try {
    const body = await req.json()
    const { project_id } = body
    projectId = project_id ?? null

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id e obrigatorio" },
        { status: 400 }
      )
    }

    const project = await queryOne(
      `SELECT * FROM ct_studio_projects WHERE id = $1`,
      [project_id]
    )

    if (!project) {
      return NextResponse.json(
        { error: "Projeto nao encontrado" },
        { status: 404 }
      )
    }

    if (!project.video_url) {
      return NextResponse.json(
        { error: "Projeto nao possui video para transcrever" },
        { status: 400 }
      )
    }

    // Update status to transcribing
    await query(
      `UPDATE ct_studio_projects SET status = $1, updated_at = NOW() WHERE id = $2`,
      ["transcribing", project_id]
    )

    // Download the video
    const videoResponse = await fetch(project.video_url)

    if (!videoResponse.ok) {
      await query(
        `UPDATE ct_studio_projects SET status = $1, updated_at = NOW() WHERE id = $2`,
        ["error", project_id]
      )
      return NextResponse.json(
        { error: "Falha ao baixar o video para transcricao" },
        { status: 500 }
      )
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())

    if (videoBuffer.length > WHISPER_MAX_SIZE) {
      await query(
        `UPDATE ct_studio_projects SET status = $1, updated_at = NOW() WHERE id = $2`,
        ["error", project_id]
      )
      return NextResponse.json(
        {
          error: `Video muito grande para transcricao direta (${Math.round(videoBuffer.length / 1024 / 1024)}MB). Limite do Whisper: 25MB. Extraia apenas o audio antes de transcrever.`,
        },
        { status: 413 }
      )
    }

    const filename = getFilename(project.video_url)
    const mimetype = getMimeType(project.video_url)
    const fileObj = new File([videoBuffer], filename, { type: mimetype })

    const openai = new OpenAI()

    // Get SRT and plain text in parallel
    const [srtResponse, textResponse] = await Promise.all([
      openai.audio.transcriptions.create({
        file: fileObj,
        model: "whisper-1",
        language: "pt",
        response_format: "srt",
      }),
      openai.audio.transcriptions.create({
        file: fileObj,
        model: "whisper-1",
        language: "pt",
        response_format: "text",
      }),
    ])

    const srt = typeof srtResponse === "string" ? srtResponse : String(srtResponse)
    const transcript = typeof textResponse === "string" ? textResponse : String(textResponse)
    const srtEntries = parseSrt(srt)

    const rows = await query(
      `UPDATE ct_studio_projects
       SET srt = $1, transcript = $2, srt_entries = $3, status = $4, language = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [srt, transcript, JSON.stringify(srtEntries), "transcribed", "pt", project_id]
    )

    return NextResponse.json({ data: rows[0] })
  } catch (error) {
    // Try to set error status if we have the project_id
    if (projectId) {
      try {
        await query(
          `UPDATE ct_studio_projects SET status = $1, updated_at = NOW() WHERE id = $2`,
          ["error", projectId]
        )
      } catch {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao transcrever video" },
      { status: 500 }
    )
  }
})
