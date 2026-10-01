interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

export async function publishToYouTube(
  _title: string,
  _description: string,
  _tags: string[],
  _videoUrl: string,
  _isShort: boolean
): Promise<PublishResult> {
  return {
    success: false,
    error: "YouTube API não configurada. Configure YOUTUBE_CLIENT_ID no .env.local",
  }
}
