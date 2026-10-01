export interface PublishResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  error?: string
}

export type PublishPlatform =
  | "instagram"
  | "threads"
  | "linkedin"
  | "tiktok"
  | "youtube"

export type PublicationStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "scheduled"
  | "cancelled"

export interface PublicationRecord {
  id: string
  content_item_id: string
  platform: PublishPlatform
  status: PublicationStatus
  scheduled_at: string | null
  published_at: string | null
  external_id: string | null
  external_url: string | null
  error_message: string | null
  retry_count: number
  caption: string | null
  media_ids: string[]
  created_at: string
}
