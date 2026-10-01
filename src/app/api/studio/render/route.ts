import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import { query, queryOne } from "@/lib/db"

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { project_id, composition = "SimpleCaption" } = body

    if (!project_id) {
      return NextResponse.json(
        { error: "ID do projeto é obrigatório" },
        { status: 400 }
      )
    }

    const project = await queryOne(
      `SELECT * FROM ct_studio_projects WHERE id = $1`,
      [project_id]
    )

    if (!project) {
      return NextResponse.json(
        { error: "Projeto não encontrado" },
        { status: 404 }
      )
    }

    if (!project.video_url) {
      return NextResponse.json(
        { error: "Projeto não possui vídeo. Faça o upload primeiro." },
        { status: 400 }
      )
    }

    if (!project.srt && !project.srt_entries) {
      return NextResponse.json(
        { error: "Projeto não possui legendas (SRT). Transcreva o vídeo primeiro." },
        { status: 400 }
      )
    }

    const awsAccessKeyId = process.env.REMOTION_AWS_ACCESS_KEY_ID
    const awsSecretAccessKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      return NextResponse.json({
        data: {
          status: "not_configured",
          message:
            "AWS credentials não configuradas. Configure REMOTION_AWS_ACCESS_KEY_ID e REMOTION_AWS_SECRET_ACCESS_KEY nas variáveis de ambiente.",
        },
      })
    }

    const serveUrl = process.env.REMOTION_SERVE_URL
    if (!serveUrl) {
      return NextResponse.json(
        { error: "REMOTION_SERVE_URL não configurada. Execute o script deploy-remotion-lambda.mjs primeiro." },
        { status: 500 }
      )
    }

    let renderMediaOnLambda: typeof import("@remotion/lambda/client").renderMediaOnLambda
    let speculateFunctionName: typeof import("@remotion/lambda/client").speculateFunctionName

    try {
      const lambdaClient = await import("@remotion/lambda/client")
      renderMediaOnLambda = lambdaClient.renderMediaOnLambda
      speculateFunctionName = lambdaClient.speculateFunctionName
    } catch {
      return NextResponse.json({
        data: {
          status: "not_configured",
          message:
            "Pacote @remotion/lambda não instalado. Execute: npm install @remotion/lambda",
        },
      })
    }

    const region = (process.env.REMOTION_AWS_REGION || "us-east-1") as import("@remotion/lambda/client").AwsRegion

    const functionName = speculateFunctionName({
      diskSizeInMb: 2048,
      memorySizeInMb: 2048,
      timeoutInSeconds: 240,
    })

    const inputProps = {
      videoUrl: project.video_url,
      entries: project.srt_entries ?? [],
      captionColor: project.caption_color ?? "white",
      fontSize: project.caption_font_size ?? 48,
    }

    await query(
      `UPDATE ct_studio_projects SET status = 'rendering', updated_at = NOW() WHERE id = $1`,
      [project_id]
    )

    try {
      const { renderId } = await renderMediaOnLambda({
        codec: "h264",
        composition,
        inputProps,
        functionName,
        serveUrl,
        region,
      })

      await query(
        `UPDATE ct_studio_projects SET render_id = $1, updated_at = NOW() WHERE id = $2`,
        [renderId, project_id]
      )

      return NextResponse.json({
        data: {
          renderId,
          status: "rendering",
        },
      })
    } catch (renderError) {
      await query(
        `UPDATE ct_studio_projects SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [project_id]
      )
      throw renderError
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Erro ao iniciar renderização",
      },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const projectId = req.nextUrl.searchParams.get("project_id")

    if (!projectId) {
      return NextResponse.json(
        { error: "project_id é obrigatório" },
        { status: 400 }
      )
    }

    const project = await queryOne(
      `SELECT id, status, render_id, output_url FROM ct_studio_projects WHERE id = $1`,
      [projectId]
    )

    if (!project) {
      return NextResponse.json(
        { error: "Projeto não encontrado" },
        { status: 404 }
      )
    }

    if (!project.render_id) {
      return NextResponse.json({
        data: {
          status: project.status,
          message: "Nenhuma renderização em andamento para este projeto.",
        },
      })
    }

    let getRenderProgress: typeof import("@remotion/lambda/client").getRenderProgress

    try {
      const lambdaClient = await import("@remotion/lambda/client")
      getRenderProgress = lambdaClient.getRenderProgress
    } catch {
      return NextResponse.json({
        data: {
          status: "not_configured",
          message: "Pacote @remotion/lambda não instalado.",
        },
      })
    }

    const region = (process.env.REMOTION_AWS_REGION || "us-east-1") as import("@remotion/lambda/client").AwsRegion

    const functionName = (await import("@remotion/lambda/client")).speculateFunctionName({
      diskSizeInMb: 2048,
      memorySizeInMb: 2048,
      timeoutInSeconds: 240,
    })

    const progress = await getRenderProgress({
      renderId: project.render_id,
      bucketName: process.env.REMOTION_AWS_BUCKET || "remotionlambda-useast1",
      functionName,
      region,
    })

    if (progress.done) {
      await query(
        `UPDATE ct_studio_projects SET status = 'rendered', output_url = $1, updated_at = NOW() WHERE id = $2`,
        [progress.outputFile, projectId]
      )

      return NextResponse.json({
        data: {
          status: "rendered",
          outputUrl: progress.outputFile,
          overallProgress: 1,
        },
      })
    }

    if (progress.fatalErrorEncountered) {
      await query(
        `UPDATE ct_studio_projects SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [projectId]
      )

      return NextResponse.json({
        data: {
          status: "error",
          message: "Erro fatal durante a renderização.",
          errors: progress.errors,
          overallProgress: progress.overallProgress,
        },
      })
    }

    return NextResponse.json({
      data: {
        status: "rendering",
        overallProgress: progress.overallProgress,
        framesRendered: progress.framesRendered,
        chunks: progress.chunks,
        renderSize: progress.renderSize,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Erro ao verificar progresso da renderização",
      },
      { status: 500 }
    )
  }
})
