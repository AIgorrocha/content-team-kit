// ============================================
// Content Team AI - TypeScript Interfaces
// Multi-tenant hybrid: auth in central DB, content in client DB
// ============================================

// --- ENUMS ---

export type AgentStatus = "idle" | "active" | "error"

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed"

export type TaskPriority = 0 | 1 | 2 | 3 // 0=low, 1=normal, 2=high, 3=urgent

export type ContentType = "post" | "carousel" | "reel" | "video" | "story" | "article" | "email" | "thread"

export type ContentStatus = "draft" | "scheduled" | "published" | "rejected"

export type Platform = "instagram" | "youtube" | "linkedin" | "x" | "email" | "tiktok"

export type ApprovalStatus = "pending" | "approved" | "rejected"

export type DealStatus = "open" | "won" | "lost"

export type SubscriberStatus = "active" | "unsubscribed" | "bounced"

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed"

export type CampaignType = "broadcast" | "sequence" | "trigger"

export type InfluencerStatus = "prospect" | "contacted" | "active" | "inactive"

export type CollaborationStatus = "proposed" | "accepted" | "in_progress" | "completed" | "cancelled"

export type CollaborationType = "collab_post" | "guest" | "interview" | "cross_promo" | "affiliate"

export type ActivityType = "call" | "email" | "meeting" | "note" | "task" | "dm"

// --- ONBOARDING ---

export type OnboardingStep =
  | "social_links"
  | "upload_videos"
  | "analyzing"
  | "review"
  | "questionnaire"
  | "completed"

export interface BrandProfile {
  id: string
  brand_voice: {
    tone: string
    formality: number
    energy: string
    favorite_words: string[]
    forbidden_words: string[]
    catchphrases: string[]
    emoji_style: string
    favorite_emojis: string[]
    explanation_style: string
    audience_name: string
  }
  visual_identity: {
    primary_colors: string[]
    font_style: string
    image_style: string
    carousel_style: string
  }
  content_strategy: {
    platforms: string[]
    frequency: Record<string, number>
    best_times: Record<string, string>
    content_mix: Record<string, number>
    themes: string[]
  }
  audience: {
    description: string
    pain_points: string[]
    goals: string[]
  }
  social_links: Record<string, string>
  site_url: string | null
  site_analysis: Record<string, unknown>
  video_urls: string[]
  video_transcripts: string[]
  raw_social_data: Record<string, unknown>
  questionnaire: Record<string, unknown>
  onboarding_step: OnboardingStep
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

// --- MULTI-TENANT (central DB) ---

export type MemberRole = "owner" | "admin" | "member"

export interface User {
  id: string
  email: string
  name: string
  password_hash: string
  created_at: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  database_url: string
  created_at: string
}

export interface TenantMember {
  id: string
  tenant_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface ApiKey {
  id: string
  tenant_id: string
  key_hash: string
  key_prefix: string
  label: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

// --- CORE (client DB) ---

export interface Agent {
  id: string
  slug: string
  display_name: string
  role: string
  status: AgentStatus
  last_active_at: string | null
  config: Record<string, unknown>
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  assigned_agent: string | null
  created_by: string | null
  status: TaskStatus
  priority: number
  due_at: string | null
  completed_at: string | null
  result: Record<string, unknown> | null
  parent_task_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  agent: string | null
  action: string | null
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

// --- CONTENT (client DB) ---

export interface ContentItem {
  id: string
  title: string
  content_type: ContentType
  status: ContentStatus
  platform: Platform | null
  scheduled_at: string | null
  published_at: string | null
  publish_url: string | null
  caption: string | null
  hashtags: string[]
  script: string | null
  visual_notes: string | null
  media_urls: string[]
  source_url: string | null
  source_agent: string | null
  approval_status: ApprovalStatus
  approval_notes: string | null
  engagement: Record<string, unknown> | null
  metadata: Record<string, unknown>
  client_slug: string
  created_at: string
  updated_at: string
}

export interface ContentSeries {
  id: string
  name: string
  description: string | null
  frequency: string | null
  platforms: string[]
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface ContentSeriesItem {
  series_id: string
  content_id: string
  sequence_num: number
}

// --- CRM (client DB) ---

export interface PipelineStage {
  id: string
  name: string
  position: number
  color: string | null
  is_default: boolean
  created_at: string
}

export interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  instagram: string | null
  linkedin: string | null
  company: string | null
  source: string | null
  tags: string[]
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  contact_id: string | null
  title: string
  value: number | null
  currency: string
  stage_id: string | null
  status: DealStatus
  expected_close_at: string | null
  closed_at: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DealActivity {
  id: string
  deal_id: string | null
  contact_id: string | null
  activity_type: ActivityType | null
  description: string | null
  performed_by: string | null
  performed_at: string
}

// --- EMAIL MARKETING (client DB) ---

export interface Subscriber {
  id: string
  email: string
  name: string | null
  source: string | null
  lead_magnet_id: string | null
  tags: string[]
  status: SubscriberStatus
  subscribed_at: string
  unsubscribed_at: string | null
  metadata: Record<string, unknown>
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  body_html: string | null
  body_text: string | null
  status: CampaignStatus
  campaign_type: CampaignType | null
  scheduled_at: string | null
  sent_at: string | null
  recipient_tags: string[]
  stats: Record<string, unknown> | null
  provider: string | null
  provider_campaign_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface EmailSequence {
  id: string
  name: string
  description: string | null
  trigger_event: string | null
  is_active: boolean
  created_at: string
}

export interface EmailSequenceStep {
  id: string
  sequence_id: string | null
  step_number: number
  delay_hours: number
  subject: string | null
  body_html: string | null
  body_text: string | null
  metadata: Record<string, unknown>
}

// --- LEAD MAGNETS (client DB) ---

export interface LeadMagnet {
  id: string
  name: string
  description: string | null
  file_url: string | null
  landing_page_url: string | null
  download_count: number
  is_active: boolean
  created_at: string
}

// --- DESIGN SYSTEM (client DB) ---

export interface DesignSystem {
  id: string
  owner: string
  logo_url: string | null
  fonts: {
    primary: string
    secondary: string
    mono: string
  }
  colors: {
    bg: string
    surface: string
    text: string
    textSecondary: string
    accent: string
    accent2: string
    success: string
    error: string
  }
  carousel_style: {
    bgColor: string
    textColor: string
    font: string
    profilePhotoPosition: string
    slideWidth: number
    slideHeight: number
    maxSlides: number
    style: string
  }
  brand_voice: string | null
  updated_at: string
}

// --- COMPETITORS (client DB) ---

export interface Competitor {
  id: string
  handle: string
  platform: string
  display_name: string | null
  niche: string | null
  is_active: boolean
  last_scraped_at: string | null
  metadata: Record<string, unknown>
}

export interface CompetitorPost {
  id: string
  competitor_id: string | null
  platform_post_id: string | null
  post_type: string | null
  caption: string | null
  media_urls: string[]
  engagement: Record<string, unknown> | null
  posted_at: string | null
  analysis: string | null
  is_viral: boolean
  scraped_at: string
}

// --- INFLUENCERS (client DB) ---

export interface Influencer {
  id: string
  name: string
  handles: Record<string, string> | null
  niche: string | null
  followers_approx: number | null
  status: InfluencerStatus
  notes: string | null
  last_contact_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Collaboration {
  id: string
  influencer_id: string | null
  type: CollaborationType | null
  status: CollaborationStatus
  scheduled_at: string | null
  notes: string | null
  content_id: string | null
  created_at: string
}

// --- BILLING (central DB) ---

export type PlanId = "free" | "starter" | "pro" | "enterprise"

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing"

export type BillingCycle = "monthly" | "yearly"

export type BillingProvider = "stripe" | "manual"

export interface PlanLimits {
  agents: number              // -1 = unlimited
  tasks_per_month: number
  content_per_month: number
  emails_per_month: number
  storage_mb: number
}

export interface Plan {
  id: PlanId
  name: string
  description: string | null
  price_monthly: number       // centavos R$
  price_yearly: number        // centavos R$
  limits: PlanLimits
  features: string[]
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Subscription {
  id: string
  tenant_id: string
  plan_id: PlanId
  status: SubscriptionStatus
  billing_cycle: BillingCycle
  provider: BillingProvider | null
  provider_subscription_id: string | null
  provider_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancelled_at: string | null
  trial_ends_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Usage {
  id: string
  tenant_id: string
  period: string              // YYYY-MM
  agents_used: number
  tasks_executed: number
  content_created: number
  emails_sent: number
  storage_bytes: number
  api_calls: number
  created_at: string
  updated_at: string
}

// --- API TYPES ---

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  data?: never
  error: string
  code?: string
}

export type ApiResult<T> = ApiResponse<T> | ApiError

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
}

// --- DASHBOARD ---

export interface DashboardStats {
  content: {
    total: number
    thisWeek: number
    scheduled: number
    published: number
  }
  upcoming: ContentItem[]
  recent: ContentItem[]
  platformDistribution: Array<{ platform: string; count: number }>
}
