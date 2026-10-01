interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

type ThreadsMediaType = "IMAGE" | "VIDEO"

const GRAPH_API_BASE = "https://graph.threads.net/v1.0"

// O Threads tem token proprio: NAO cai no token do Instagram (sao produtos diferentes da Meta).
function getCredentials() {
  const userId = process.env.THREADS_USER_ID
  const accessToken = process.env.THREADS_ACCESS_TOKEN

  if (!userId || !accessToken) {
    return null
  }

  return { userId, accessToken }
}

export async function publishToThreads(
  caption: string,
  mediaUrl?: string,
  mediaType?: ThreadsMediaType,
  // Handle da conta que publica (so usado se a API nao devolver o permalink):
  // THREADS_HANDLE, ou IG_HANDLE (mesmo nome do Instagram da marca).
  handle: string = process.env.THREADS_HANDLE || process.env.IG_HANDLE || ""
): Promise<PublishResult> {
  const credentials = getCredentials()

  if (!credentials) {
    return {
      success: false,
      error: "Threads API não configurada. Configure THREADS_USER_ID e THREADS_ACCESS_TOKEN no .env.local",
    }
  }

  const { userId, accessToken } = credentials

  try {
    const containerParams: Record<string, string> = {
      text: caption,
      access_token: accessToken,
    }

    if (mediaUrl && mediaType === "IMAGE") {
      containerParams.media_type = "IMAGE"
      containerParams.image_url = mediaUrl
    } else if (mediaUrl && mediaType === "VIDEO") {
      containerParams.media_type = "VIDEO"
      containerParams.video_url = mediaUrl
    } else {
      containerParams.media_type = "TEXT"
    }

    const containerResponse = await fetch(`${GRAPH_API_BASE}/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(containerParams),
    })

    const containerData = await containerResponse.json()

    if (containerData.error) {
      return { success: false, error: containerData.error.message }
    }

    const containerId = containerData.id
    if (!containerId) {
      return { success: false, error: "Falha ao criar container do Threads" }
    }

    // Wait briefly for processing
    if (mediaUrl && mediaType === "VIDEO") {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    const publishResponse = await fetch(`${GRAPH_API_BASE}/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    })

    const publishData = await publishResponse.json()

    if (publishData.error) {
      return { success: false, error: publishData.error.message }
    }

    // O link real vem do campo permalink (o id da midia nao abre como URL).
    const permalink = await fetch(
      `${GRAPH_API_BASE}/${publishData.id}?fields=permalink&access_token=${accessToken}`
    )
      .then((r) => r.json())
      .then((j) => (typeof j.permalink === "string" ? j.permalink : null))
      .catch(() => null)

    return {
      success: true,
      externalId: publishData.id,
      externalUrl: permalink ?? (handle ? `https://www.threads.net/@${handle}/post/${publishData.id}` : undefined),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao publicar no Threads: ${message}` }
  }
}
