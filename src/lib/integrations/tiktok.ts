interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

export async function publishToTikTok(
  _caption: string,
  _videoUrl: string
): Promise<PublishResult> {
  return {
    success: false,
    error: "TikTok API não configurada. Configure TIKTOK_CLIENT_KEY no .env.local",
  }
}
