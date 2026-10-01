import type { Pool } from "pg"

interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

interface PostInsights {
  impressions: number
  reach: number
  engagement: number
  saved: number
  likes: number
  comments: number
  shares: number
}

interface AccountInsights {
  impressions: number
  reach: number
  follower_count: number
  profile_views: number
}

interface MediaItem {
  id: string
  caption?: string
  media_type: string
  timestamp: string
  like_count: number
  comments_count: number
  permalink: string
}

interface InsightsResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface AccountCredentials {
  userId: string
  accessToken: string
  handle?: string
  adAccountId?: string
}

type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM"

const GRAPH_API_BASE = "https://graph.instagram.com/v21.0"

function getCredentialsFromEnv(): AccountCredentials | null {
  const userId = process.env.INSTAGRAM_USER_ID
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN

  if (!userId || !accessToken) {
    return null
  }

  return { userId, accessToken }
}

export async function getAccountCredentials(
  accountIdOrHandle: string,
  pool: Pool
): Promise<AccountCredentials | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountIdOrHandle)

  const query = isUuid
    ? `SELECT ig_user_id, access_token, handle, ad_account_id FROM ct_instagram_accounts WHERE id = $1 AND is_active = true`
    : `SELECT ig_user_id, access_token, handle, ad_account_id FROM ct_instagram_accounts WHERE handle = $1 AND is_active = true`

  const result = await pool.query(query, [accountIdOrHandle])
  const row = result.rows[0]

  if (!row) {
    return null
  }

  return {
    userId: row.ig_user_id,
    accessToken: row.access_token,
    handle: row.handle,
    adAccountId: row.ad_account_id,
  }
}

async function resolveCredentials(
  accountId: string | undefined,
  pool?: Pool
): Promise<AccountCredentials | null> {
  if (accountId && pool) {
    return getAccountCredentials(accountId, pool)
  }
  return getCredentialsFromEnv()
}

async function graphGet(
  endpoint: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const separator = endpoint.includes("?") ? "&" : "?"
  const response = await fetch(
    `${GRAPH_API_BASE}${endpoint}${separator}access_token=${accessToken}`
  )

  return response.json()
}

/**
 * Permalink REAL da midia publicada.
 *
 * `https://www.instagram.com/p/${mediaId}` NAO e o permalink: mediaId e o id numerico da
 * Graph API, o permalink usa o shortcode. A URL montada com o id nao abre e nunca casa com
 * ct_metrics_snapshots.post_url (que vem do campo `permalink`), entao a peca publicada some
 * do join de desempenho. Fallback so pra nao perder a publicacao se o GET falhar.
 */
async function resolvePermalink(
  mediaId: string | undefined,
  accessToken: string,
  fallbackPath: "p" | "reel"
): Promise<string | undefined> {
  if (!mediaId) return undefined
  try {
    const r = await graphGet(`/${mediaId}?fields=permalink`, accessToken)
    if (typeof r.permalink === "string" && r.permalink) return r.permalink
  } catch {
    /* cai no fallback */
  }
  return `https://www.instagram.com/${fallbackPath}/${mediaId}/`
}

async function graphPost(
  endpoint: string,
  body: Record<string, string>,
  accessToken: string
): Promise<{ id?: string; error?: { message: string } }> {
  const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ...body,
      access_token: accessToken,
    }),
  })

  return response.json()
}

async function waitForMediaReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const data = await response.json()

    if (data.status_code === "FINISHED") {
      return true
    }

    if (data.status_code === "ERROR") {
      return false
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return false
}

async function publishImage(
  userId: string,
  accessToken: string,
  caption: string,
  mediaUrl: string
): Promise<PublishResult> {
  const containerResult = await graphPost(`/${userId}/media`, {
    image_url: mediaUrl,
    caption,
  }, accessToken)

  if (containerResult.error) {
    return { success: false, error: containerResult.error.message }
  }

  const containerId = containerResult.id
  if (!containerId) {
    return { success: false, error: "Falha ao criar container de mídia" }
  }

  const publishResult = await graphPost(`/${userId}/media_publish`, {
    creation_id: containerId,
  }, accessToken)

  if (publishResult.error) {
    return { success: false, error: publishResult.error.message }
  }

  return {
    success: true,
    externalId: publishResult.id,
    externalUrl: await resolvePermalink(publishResult.id, accessToken, "p"),
  }
}

async function publishReel(
  userId: string,
  accessToken: string,
  caption: string,
  videoUrl: string
): Promise<PublishResult> {
  const containerResult = await graphPost(`/${userId}/media`, {
    video_url: videoUrl,
    caption,
    media_type: "REELS",
  }, accessToken)

  if (containerResult.error) {
    return { success: false, error: containerResult.error.message }
  }

  const containerId = containerResult.id
  if (!containerId) {
    return { success: false, error: "Falha ao criar container de vídeo" }
  }

  const ready = await waitForMediaReady(containerId, accessToken)
  if (!ready) {
    return { success: false, error: "Timeout aguardando processamento do vídeo" }
  }

  const publishResult = await graphPost(`/${userId}/media_publish`, {
    creation_id: containerId,
  }, accessToken)

  if (publishResult.error) {
    return { success: false, error: publishResult.error.message }
  }

  return {
    success: true,
    externalId: publishResult.id,
    externalUrl: await resolvePermalink(publishResult.id, accessToken, "reel"),
  }
}

async function publishCarousel(
  userId: string,
  accessToken: string,
  caption: string,
  mediaUrls: string[]
): Promise<PublishResult> {
  const childrenIds: string[] = []

  for (const url of mediaUrls) {
    const isVideo = /\.(mp4|mov|avi)$/i.test(url)
    const childParams: Record<string, string> = {
      is_carousel_item: "true",
    }

    if (isVideo) {
      childParams.video_url = url
      childParams.media_type = "VIDEO"
    } else {
      childParams.image_url = url
    }

    const childResult = await graphPost(`/${userId}/media`, childParams, accessToken)

    if (childResult.error) {
      return { success: false, error: `Erro no item do carrossel: ${childResult.error.message}` }
    }

    if (!childResult.id) {
      return { success: false, error: "Falha ao criar item do carrossel" }
    }

    if (isVideo) {
      const ready = await waitForMediaReady(childResult.id, accessToken)
      if (!ready) {
        return { success: false, error: "Timeout processando vídeo do carrossel" }
      }
    }

    childrenIds.push(childResult.id)
  }

  const containerResult = await graphPost(`/${userId}/media`, {
    media_type: "CAROUSEL",
    caption,
    children: childrenIds.join(","),
  }, accessToken)

  if (containerResult.error) {
    return { success: false, error: containerResult.error.message }
  }

  const containerId = containerResult.id
  if (!containerId) {
    return { success: false, error: "Falha ao criar container do carrossel" }
  }

  const ready = await waitForMediaReady(containerId, accessToken)
  if (!ready) {
    return { success: false, error: "Timeout processando carrossel" }
  }

  const publishResult = await graphPost(`/${userId}/media_publish`, {
    creation_id: containerId,
  }, accessToken)

  if (publishResult.error) {
    return { success: false, error: publishResult.error.message }
  }

  return {
    success: true,
    externalId: publishResult.id,
    externalUrl: await resolvePermalink(publishResult.id, accessToken, "p"),
  }
}

export async function publishToInstagram(
  caption: string,
  mediaUrl: string,
  mediaType: MediaType,
  extraMediaUrls?: string[],
  accountId?: string,
  pool?: Pool
): Promise<PublishResult> {
  const credentials = await resolveCredentials(accountId, pool)

  if (!credentials) {
    return {
      success: false,
      error: accountId
        ? `Conta Instagram não encontrada para ID: ${accountId}`
        : "Instagram API não configurada. Configure INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no .env.local",
    }
  }

  const { userId, accessToken } = credentials

  // CRITICAL: Ensure UTF-8 encoding for Portuguese characters
  const encodedCaption = caption

  try {
    switch (mediaType) {
      case "IMAGE":
        return await publishImage(userId, accessToken, encodedCaption, mediaUrl)

      case "VIDEO":
        return await publishReel(userId, accessToken, encodedCaption, mediaUrl)

      case "CAROUSEL_ALBUM": {
        const allUrls = [mediaUrl, ...(extraMediaUrls ?? [])]
        return await publishCarousel(userId, accessToken, encodedCaption, allUrls)
      }

      default:
        return { success: false, error: `Tipo de mídia não suportado: ${mediaType}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao publicar no Instagram: ${message}` }
  }
}

export async function publishStory(
  caption: string,
  imageUrl: string,
  accountId?: string,
  pool?: Pool
): Promise<PublishResult> {
  const credentials = await resolveCredentials(accountId, pool)

  if (!credentials) {
    return {
      success: false,
      error: accountId
        ? `Conta Instagram não encontrada para ID: ${accountId}`
        : "Instagram API não configurada.",
    }
  }

  const { userId, accessToken } = credentials

  try {
    const containerResult = await graphPost(`/${userId}/media`, {
      image_url: imageUrl,
      media_type: "STORIES",
    }, accessToken)

    if (containerResult.error) {
      return { success: false, error: containerResult.error.message }
    }

    const containerId = containerResult.id
    if (!containerId) {
      return { success: false, error: "Falha ao criar container de Story" }
    }

    const publishResult = await graphPost(`/${userId}/media_publish`, {
      creation_id: containerId,
    }, accessToken)

    if (publishResult.error) {
      return { success: false, error: publishResult.error.message }
    }

    return {
      success: true,
      externalId: publishResult.id,
      externalUrl: `https://www.instagram.com/stories/${userId}/${publishResult.id}/`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao publicar Story: ${message}` }
  }
}

export async function getPostInsights(
  mediaId: string,
  accountId?: string,
  pool?: Pool
): Promise<InsightsResult<PostInsights>> {
  const credentials = await resolveCredentials(accountId, pool)

  if (!credentials) {
    return {
      success: false,
      error: accountId
        ? `Conta Instagram não encontrada para ID: ${accountId}`
        : "Instagram API não configurada. Configure INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no .env.local",
    }
  }

  const { accessToken } = credentials

  try {
    const metrics = "impressions,reach,engagement,saved,likes,comments,shares"
    const result = await graphGet(
      `/${mediaId}/insights?metric=${metrics}`,
      accessToken
    )

    if ((result as { error?: { message: string } }).error) {
      const apiError = result as { error: { message: string } }
      return { success: false, error: apiError.error.message }
    }

    const dataArray = (result as { data?: Array<{ name: string; values: Array<{ value: number }> }> }).data ?? []
    const insights: Record<string, number> = {}

    for (const metric of dataArray) {
      insights[metric.name] = metric.values[0]?.value ?? 0
    }

    return {
      success: true,
      data: {
        impressions: insights.impressions ?? 0,
        reach: insights.reach ?? 0,
        engagement: insights.engagement ?? 0,
        saved: insights.saved ?? 0,
        likes: insights.likes ?? 0,
        comments: insights.comments ?? 0,
        shares: insights.shares ?? 0,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao buscar insights do post: ${message}` }
  }
}

export async function getAccountInsights(
  period: "day" | "week" | "month" = "month",
  accountId?: string,
  pool?: Pool
): Promise<InsightsResult<AccountInsights>> {
  const credentials = await resolveCredentials(accountId, pool)

  if (!credentials) {
    return {
      success: false,
      error: accountId
        ? `Conta Instagram não encontrada para ID: ${accountId}`
        : "Instagram API não configurada. Configure INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no .env.local",
    }
  }

  const { userId, accessToken } = credentials

  try {
    const metrics = "impressions,reach,follower_count,profile_views"
    const result = await graphGet(
      `/${userId}/insights?metric=${metrics}&period=${period}`,
      accessToken
    )

    if ((result as { error?: { message: string } }).error) {
      const apiError = result as { error: { message: string } }
      return { success: false, error: apiError.error.message }
    }

    const dataArray = (result as { data?: Array<{ name: string; values: Array<{ value: number }> }> }).data ?? []
    const insights: Record<string, number> = {}

    for (const metric of dataArray) {
      insights[metric.name] = metric.values[0]?.value ?? 0
    }

    return {
      success: true,
      data: {
        impressions: insights.impressions ?? 0,
        reach: insights.reach ?? 0,
        follower_count: insights.follower_count ?? 0,
        profile_views: insights.profile_views ?? 0,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao buscar insights da conta: ${message}` }
  }
}

export async function getRecentMedia(
  limit: number = 25,
  accountId?: string,
  pool?: Pool
): Promise<InsightsResult<MediaItem[]>> {
  const credentials = await resolveCredentials(accountId, pool)

  if (!credentials) {
    return {
      success: false,
      error: accountId
        ? `Conta Instagram não encontrada para ID: ${accountId}`
        : "Instagram API não configurada. Configure INSTAGRAM_USER_ID e INSTAGRAM_ACCESS_TOKEN no .env.local",
    }
  }

  const { userId, accessToken } = credentials

  try {
    const fields = "id,caption,media_type,timestamp,like_count,comments_count,permalink"
    const result = await graphGet(
      `/${userId}/media?fields=${fields}&limit=${limit}`,
      accessToken
    )

    if ((result as { error?: { message: string } }).error) {
      const apiError = result as { error: { message: string } }
      return { success: false, error: apiError.error.message }
    }

    const mediaData = (result as { data?: Array<Record<string, unknown>> }).data ?? []
    const items: MediaItem[] = mediaData.map((item) => ({
      id: item.id as string,
      caption: item.caption as string | undefined,
      media_type: item.media_type as string,
      timestamp: item.timestamp as string,
      like_count: (item.like_count as number) ?? 0,
      comments_count: (item.comments_count as number) ?? 0,
      permalink: item.permalink as string,
    }))

    return {
      success: true,
      data: items,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao buscar mídias recentes: ${message}` }
  }
}

export async function collectAndStoreMetrics(
  accountId: string,
  dbPool: Pool,
  limit: number = 25
): Promise<InsightsResult<{ collected: number; failed: number }>> {
  try {
    const mediaResult = await getRecentMedia(limit, accountId, dbPool)

    if (!mediaResult.success || !mediaResult.data) {
      return { success: false, error: mediaResult.error ?? "Erro ao buscar midias" }
    }

    let collected = 0
    let failed = 0

    for (const item of mediaResult.data) {
      try {
        const insightsResult = await getPostInsights(item.id, accountId, dbPool)

        if (!insightsResult.success || !insightsResult.data) {
          failed++
          continue
        }

        const insights = insightsResult.data

        await dbPool.query(
          `INSERT INTO ct_instagram_metrics
            (media_id, account_id, caption, media_type, timestamp, permalink,
             like_count, comments_count, impressions, reach, engagement, saved, shares, collected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (media_id) DO UPDATE SET
             impressions = EXCLUDED.impressions,
             reach = EXCLUDED.reach,
             engagement = EXCLUDED.engagement,
             saved = EXCLUDED.saved,
             shares = EXCLUDED.shares,
             like_count = EXCLUDED.like_count,
             comments_count = EXCLUDED.comments_count,
             collected_at = NOW()`,
          [
            item.id, accountId, item.caption ?? null, item.media_type,
            item.timestamp, item.permalink, item.like_count, item.comments_count,
            insights.impressions, insights.reach, insights.engagement,
            insights.saved, insights.shares,
          ]
        )

        collected++
      } catch {
        failed++
      }
    }

    return { success: true, data: { collected, failed } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao coletar metricas: ${message}` }
  }
}
