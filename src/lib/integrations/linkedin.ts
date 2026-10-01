interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

interface PostAnalyticsResult {
  success: boolean
  data?: {
    likes: number
    comments: number
    shares: number
    impressions: number
    clicks: number
    engagement_rate: number
  }
  error?: string
}

interface RecentPostsResult {
  success: boolean
  data?: Array<{
    id: string
    text: string
    created: string
    author: string
  }>
  error?: string
}

const LINKEDIN_API_BASE = "https://api.linkedin.com"
const LINKEDIN_API_VERSION = "202401"

function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\s*\([^)]{20,}\)/g, "")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/—/g, " - ")
}

function getCredentials() {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  const personId = process.env.LINKEDIN_PERSON_ID

  if (!accessToken || !personId) {
    return null
  }

  return { accessToken, personId }
}

async function uploadImage(
  accessToken: string,
  personId: string,
  imageUrl: string
): Promise<{ asset?: string; error?: string }> {
  const registerResponse = await fetch(`${LINKEDIN_API_BASE}/v2/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: `urn:li:person:${personId}`,
        serviceRelationships: [{
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        }],
      },
    }),
  })

  const registerData = await registerResponse.json()
  const uploadUrl = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl
  const asset = registerData.value?.asset

  if (!uploadUrl || !asset) {
    return { error: "Falha ao registrar upload de imagem no LinkedIn" }
  }

  const imgResponse = await fetch(imageUrl)
  if (!imgResponse.ok) {
    return { error: "Falha ao baixar imagem da URL fornecida" }
  }

  const imgBuffer = await imgResponse.arrayBuffer()

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "image/png",
    },
    body: imgBuffer,
  })

  if (!uploadResponse.ok) {
    return { error: "Falha ao fazer upload da imagem para o LinkedIn" }
  }

  return { asset }
}

async function publishImagePost(
  accessToken: string,
  personId: string,
  text: string,
  imageUrl: string
): Promise<PublishResult> {
  const uploadResult = await uploadImage(accessToken, personId, imageUrl)

  if (uploadResult.error) {
    return { success: false, error: uploadResult.error }
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [{
            status: "READY",
            media: uploadResult.asset,
          }],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.message || `HTTP ${response.status}`
    return { success: false, error: `Erro ao publicar imagem no LinkedIn: ${errorMessage}` }
  }

  const postId = response.headers.get("x-restli-id") ?? undefined

  return {
    success: true,
    externalId: postId,
    externalUrl: postId
      ? `https://www.linkedin.com/feed/update/${postId}/`
      : undefined,
  }
}

async function uploadVideo(
  accessToken: string,
  personId: string,
  videoUrl: string
): Promise<{ asset?: string; error?: string }> {
  // Step 1: Register upload
  const registerResponse = await fetch(`${LINKEDIN_API_BASE}/rest/videos?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${personId}`,
        fileSizeBytes: 0,
      },
    }),
  })

  const registerData = await registerResponse.json()

  if (!registerData.value?.uploadUrl) {
    return { error: "Falha ao registrar upload de vídeo no LinkedIn" }
  }

  // Step 2: Download video from URL
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    return { error: "Falha ao baixar vídeo da URL fornecida" }
  }

  const videoBuffer = await videoResponse.arrayBuffer()

  // Step 3: Upload video
  const uploadResponse = await fetch(registerData.value.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: videoBuffer,
  })

  if (!uploadResponse.ok) {
    return { error: "Falha ao fazer upload do vídeo para o LinkedIn" }
  }

  return { asset: registerData.value.video }
}

async function publishTextPost(
  accessToken: string,
  personId: string,
  text: string
): Promise<PublishResult> {
  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      visibility: "PUBLIC",
      commentary: text,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.message || `HTTP ${response.status}`
    return { success: false, error: `Erro ao publicar no LinkedIn: ${errorMessage}` }
  }

  const postId = response.headers.get("x-restli-id") ?? undefined

  return {
    success: true,
    externalId: postId,
    externalUrl: postId
      ? `https://www.linkedin.com/feed/update/${postId}/`
      : undefined,
  }
}

async function publishVideoPost(
  accessToken: string,
  personId: string,
  text: string,
  videoUrl: string
): Promise<PublishResult> {
  const uploadResult = await uploadVideo(accessToken, personId, videoUrl)

  if (uploadResult.error) {
    return { success: false, error: uploadResult.error }
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: "PUBLISHED",
      visibility: "PUBLIC",
      commentary: text,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: uploadResult.asset,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.message || `HTTP ${response.status}`
    return { success: false, error: `Erro ao publicar vídeo no LinkedIn: ${errorMessage}` }
  }

  const postId = response.headers.get("x-restli-id") ?? undefined

  return {
    success: true,
    externalId: postId,
    externalUrl: postId
      ? `https://www.linkedin.com/feed/update/${postId}/`
      : undefined,
  }
}

export async function getPostAnalytics(postUrn: string): Promise<PostAnalyticsResult> {
  const credentials = getCredentials()

  if (!credentials) {
    return {
      success: false,
      error: "LinkedIn API não configurada. Configure LINKEDIN_ACCESS_TOKEN e LINKEDIN_PERSON_ID no .env.local",
    }
  }

  const { accessToken } = credentials

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_API_VERSION,
    }

    // Fetch social actions (likes, comments, shares)
    const socialResponse = await fetch(
      `${LINKEDIN_API_BASE}/v2/socialActions/${encodeURIComponent(postUrn)}`,
      { headers }
    )

    if (!socialResponse.ok) {
      const errorData = await socialResponse.json().catch(() => ({}))
      const errorMessage = errorData.message || `HTTP ${socialResponse.status}`
      return { success: false, error: `Erro ao buscar social actions: ${errorMessage}` }
    }

    const socialData = await socialResponse.json()

    // Fetch share statistics (impressions, clicks)
    const statsResponse = await fetch(
      `${LINKEDIN_API_BASE}/v2/organizationalEntityShareStatistics?q=organizationalEntity&shares=List(${encodeURIComponent(postUrn)})`,
      { headers }
    )

    let impressions = 0
    let clicks = 0

    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      const stats = statsData.elements?.[0]?.totalShareStatistics
      if (stats) {
        impressions = stats.impressionCount ?? 0
        clicks = stats.clickCount ?? 0
      }
    }

    const likes = socialData.likesSummary?.totalLikes ?? 0
    const comments = socialData.commentsSummary?.totalFirstLevelComments ?? 0
    const shares = socialData.sharesSummary?.totalShares ?? 0

    const totalEngagements = likes + comments + shares + clicks
    const engagement_rate = impressions > 0
      ? Number(((totalEngagements / impressions) * 100).toFixed(2))
      : 0

    return {
      success: true,
      data: {
        likes,
        comments,
        shares,
        impressions,
        clicks,
        engagement_rate,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao buscar analytics do LinkedIn: ${message}` }
  }
}

export async function getRecentPosts(limit: number = 20): Promise<RecentPostsResult> {
  const credentials = getCredentials()

  if (!credentials) {
    return {
      success: false,
      error: "LinkedIn API não configurada. Configure LINKEDIN_ACCESS_TOKEN e LINKEDIN_PERSON_ID no .env.local",
    }
  }

  const { accessToken, personId } = credentials

  try {
    const authorUrn = encodeURIComponent(`urn:li:person:${personId}`)
    const response = await fetch(
      `${LINKEDIN_API_BASE}/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": LINKEDIN_API_VERSION,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || `HTTP ${response.status}`
      return { success: false, error: `Erro ao buscar posts recentes: ${errorMessage}` }
    }

    const responseData = await response.json()
    const posts = (responseData.elements ?? []).map((post: Record<string, unknown>) => ({
      id: post.id as string,
      text: ((post.specificContent as Record<string, unknown>)
        ?.["com.linkedin.ugc.ShareContent"] as Record<string, unknown>)
        ?.shareCommentary as string ?? "",
      created: new Date(
        (post.created as Record<string, unknown>)?.time as number ?? 0
      ).toISOString(),
      author: post.author as string,
    }))

    return {
      success: true,
      data: posts,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao buscar posts recentes do LinkedIn: ${message}` }
  }
}

export async function publishToLinkedIn(
  text: string,
  mediaUrl?: string,
  mediaType?: "image" | "video"
): Promise<PublishResult> {
  const credentials = getCredentials()

  if (!credentials) {
    return {
      success: false,
      error: "LinkedIn API não configurada. Configure LINKEDIN_ACCESS_TOKEN e LINKEDIN_PERSON_ID no .env.local",
    }
  }

  const { accessToken, personId } = credentials

  const cleanText = sanitizeForLinkedIn(text)

  try {
    if (mediaUrl && mediaType === "video") {
      return await publishVideoPost(accessToken, personId, cleanText, mediaUrl)
    }

    if (mediaUrl) {
      return await publishImagePost(accessToken, personId, cleanText, mediaUrl)
    }

    return await publishTextPost(accessToken, personId, cleanText)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return { success: false, error: `Erro ao publicar no LinkedIn: ${message}` }
  }
}
