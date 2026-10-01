import { z } from "zod"

// Schema de validação dos posts raspados
const SocialPostSchema = z.object({
  platform: z.string(),
  post_id: z.string(),
  caption: z.string().nullable(),
  likes: z.number().default(0),
  comments: z.number().default(0),
  shares: z.number().default(0),
  media_type: z.enum(["image", "video", "carousel", "text"]).default("image"),
  posted_at: z.string().nullable(),
  url: z.string().nullable(),
})

export type SocialPost = z.infer<typeof SocialPostSchema>

export interface SocialScrapingResult {
  platform: string
  handle: string
  profile: {
    name: string | null
    bio: string | null
    followers: number | null
    following: number | null
    avatar_url: string | null
  }
  posts: SocialPost[]
  error: string | null
}

const RAPIDAPI_HOST_MAP: Record<string, string> = {
  instagram: "instagram-scraper-api2.p.rapidapi.com",
  tiktok: "tiktok-scraper7.p.rapidapi.com",
  youtube: "youtube-v3-alternative.p.rapidapi.com",
  twitter: "twitter154.p.rapidapi.com",
  linkedin: "linkedin-data-api.p.rapidapi.com",
}

async function fetchRapidAPI(
  host: string,
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY não configurada")
  }

  const url = new URL(`https://${host}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": host,
    },
  })

  if (!response.ok) {
    throw new Error(`RapidAPI error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

function extractHandle(url: string, platform: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    // Remove @ prefix if present
    const handle = parts[0] || ""
    return handle.replace(/^@/, "")
  } catch {
    // If not a URL, treat as handle directly
    return url.replace(/^@/, "")
  }
}

export async function scrapeInstagram(profileUrl: string): Promise<SocialScrapingResult> {
  const handle = extractHandle(profileUrl, "instagram")
  const host = RAPIDAPI_HOST_MAP.instagram

  try {
    const profileData = await fetchRapidAPI(host, "/v1/info", { username_or_id_or_url: handle }) as Record<string, unknown>
    const postsData = await fetchRapidAPI(host, "/v1.2/posts", { username_or_id_or_url: handle }) as Record<string, unknown>

    const data = profileData.data as Record<string, unknown> | undefined
    const items = (postsData as { data?: { items?: unknown[] } }).data?.items || []

    const posts: SocialPost[] = (items as Record<string, unknown>[]).slice(0, 20).map((post) => ({
      platform: "instagram",
      post_id: String(post.id || ""),
      caption: (post.caption as { text?: string })?.text || null,
      likes: Number(post.like_count || 0),
      comments: Number(post.comment_count || 0),
      shares: Number(post.share_count || 0),
      media_type: post.media_type === 2 ? "video" as const : "image" as const,
      posted_at: post.taken_at ? new Date(Number(post.taken_at) * 1000).toISOString() : null,
      url: `https://instagram.com/p/${post.code || ""}`,
    }))

    return {
      platform: "instagram",
      handle,
      profile: {
        name: String(data?.full_name || ""),
        bio: String(data?.biography || ""),
        followers: Number(data?.follower_count || 0),
        following: Number(data?.following_count || 0),
        avatar_url: String(data?.profile_pic_url_hd || data?.profile_pic_url || ""),
      },
      posts,
      error: null,
    }
  } catch (error) {
    return {
      platform: "instagram",
      handle,
      profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
      posts: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function scrapeYouTube(channelUrl: string): Promise<SocialScrapingResult> {
  const handle = extractHandle(channelUrl, "youtube")
  const host = RAPIDAPI_HOST_MAP.youtube

  try {
    const channelData = await fetchRapidAPI(host, "/channel/details", { id: handle }) as Record<string, unknown>
    const videosData = await fetchRapidAPI(host, "/channel/videos", { id: handle, sort: "newest" }) as Record<string, unknown>

    const videos = ((videosData as { videos?: unknown[] }).videos || []) as Record<string, unknown>[]

    const posts: SocialPost[] = videos.slice(0, 10).map((video) => ({
      platform: "youtube",
      post_id: String(video.videoId || ""),
      caption: String(video.title || ""),
      likes: Number(video.likeCount || 0),
      comments: Number(video.commentCount || 0),
      shares: 0,
      media_type: "video" as const,
      posted_at: String(video.publishedTimeText || null),
      url: `https://youtube.com/watch?v=${video.videoId || ""}`,
    }))

    return {
      platform: "youtube",
      handle,
      profile: {
        name: String((channelData as { title?: string }).title || ""),
        bio: String((channelData as { description?: string }).description || ""),
        followers: Number((channelData as { subscriberCount?: number }).subscriberCount || 0),
        following: null,
        avatar_url: String((channelData as { avatar?: unknown[] }).avatar?.[0] || ""),
      },
      posts,
      error: null,
    }
  } catch (error) {
    return {
      platform: "youtube",
      handle,
      profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
      posts: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function scrapeTikTok(profileUrl: string): Promise<SocialScrapingResult> {
  const handle = extractHandle(profileUrl, "tiktok")
  const host = RAPIDAPI_HOST_MAP.tiktok

  try {
    const userData = await fetchRapidAPI(host, "/user/info", { unique_id: handle }) as Record<string, unknown>
    const postsData = await fetchRapidAPI(host, "/user/posts", { unique_id: handle, count: "20" }) as Record<string, unknown>

    const userInfo = (userData as { data?: { user?: Record<string, unknown> } }).data?.user
    const stats = (userData as { data?: { stats?: Record<string, unknown> } }).data?.stats
    const videos = ((postsData as { data?: { videos?: unknown[] } }).data?.videos || []) as Record<string, unknown>[]

    const posts: SocialPost[] = videos.slice(0, 20).map((video) => ({
      platform: "tiktok",
      post_id: String(video.id || ""),
      caption: String(video.desc || ""),
      likes: Number((video.stats as Record<string, unknown>)?.diggCount || 0),
      comments: Number((video.stats as Record<string, unknown>)?.commentCount || 0),
      shares: Number((video.stats as Record<string, unknown>)?.shareCount || 0),
      media_type: "video" as const,
      posted_at: video.createTime ? new Date(Number(video.createTime) * 1000).toISOString() : null,
      url: `https://tiktok.com/@${handle}/video/${video.id || ""}`,
    }))

    return {
      platform: "tiktok",
      handle,
      profile: {
        name: String(userInfo?.nickname || ""),
        bio: String(userInfo?.signature || ""),
        followers: Number(stats?.followerCount || 0),
        following: Number(stats?.followingCount || 0),
        avatar_url: String(userInfo?.avatarLarger || ""),
      },
      posts,
      error: null,
    }
  } catch (error) {
    return {
      platform: "tiktok",
      handle,
      profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
      posts: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function scrapeTwitter(profileUrl: string): Promise<SocialScrapingResult> {
  const handle = extractHandle(profileUrl, "twitter")
  const host = RAPIDAPI_HOST_MAP.twitter

  try {
    const userData = await fetchRapidAPI(host, "/v2/user/details", { username: handle }) as Record<string, unknown>
    const tweetsData = await fetchRapidAPI(host, "/v2/user/tweets", { username: handle, limit: "20" }) as Record<string, unknown>

    const user = (userData as { results?: Record<string, unknown> }).results
    const tweets = ((tweetsData as { results?: unknown[] }).results || []) as Record<string, unknown>[]

    const posts: SocialPost[] = tweets.slice(0, 20).map((tweet) => ({
      platform: "twitter",
      post_id: String(tweet.tweet_id || ""),
      caption: String(tweet.text || ""),
      likes: Number(tweet.favorite_count || 0),
      comments: Number(tweet.reply_count || 0),
      shares: Number(tweet.retweet_count || 0),
      media_type: "text" as const,
      posted_at: String(tweet.creation_date || null),
      url: `https://x.com/${handle}/status/${tweet.tweet_id || ""}`,
    }))

    return {
      platform: "twitter",
      handle,
      profile: {
        name: String(user?.name || ""),
        bio: String(user?.description || ""),
        followers: Number(user?.follower_count || 0),
        following: Number(user?.following_count || 0),
        avatar_url: String(user?.profile_image_url || ""),
      },
      posts,
      error: null,
    }
  } catch (error) {
    return {
      platform: "twitter",
      handle,
      profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
      posts: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export async function scrapeLinkedIn(profileUrl: string): Promise<SocialScrapingResult> {
  const handle = extractHandle(profileUrl, "linkedin")
  const host = RAPIDAPI_HOST_MAP.linkedin

  try {
    const profileData = await fetchRapidAPI(host, "/get-profile-data-by-url", {
      url: profileUrl.includes("linkedin.com") ? profileUrl : `https://linkedin.com/in/${handle}`,
    }) as Record<string, unknown>

    return {
      platform: "linkedin",
      handle,
      profile: {
        name: `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() || null,
        bio: String(profileData.summary || profileData.headline || ""),
        followers: Number(profileData.followersCount || 0),
        following: null,
        avatar_url: String(profileData.profilePicture || ""),
      },
      posts: [],
      error: null,
    }
  } catch (error) {
    return {
      platform: "linkedin",
      handle,
      profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
      posts: [],
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

const SCRAPER_MAP: Record<string, (url: string) => Promise<SocialScrapingResult>> = {
  instagram: scrapeInstagram,
  youtube: scrapeYouTube,
  tiktok: scrapeTikTok,
  twitter: scrapeTwitter,
  x: scrapeTwitter,
  linkedin: scrapeLinkedIn,
}

export async function scrapeAllSocials(
  links: Record<string, string>
): Promise<SocialScrapingResult[]> {
  const promises = Object.entries(links)
    .filter(([platform, url]) => url && SCRAPER_MAP[platform])
    .map(([platform, url]) => {
      const scraper = SCRAPER_MAP[platform]
      return scraper(url)
    })

  return Promise.allSettled(promises).then((results) =>
    results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            platform: "unknown",
            handle: "",
            profile: { name: null, bio: null, followers: null, following: null, avatar_url: null },
            posts: [],
            error: r.reason instanceof Error ? r.reason.message : "Erro desconhecido",
          }
    )
  )
}
