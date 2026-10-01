-- ============================================
-- Brand Profile (Onboarding Inteligente)
-- ============================================

CREATE TABLE ct_brand_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_voice JSONB DEFAULT '{}',
  visual_identity JSONB DEFAULT '{}',
  content_strategy JSONB DEFAULT '{}',
  audience JSONB DEFAULT '{}',
  social_links JSONB DEFAULT '{}',
  site_url TEXT,
  site_analysis JSONB DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  video_transcripts TEXT[] DEFAULT '{}',
  raw_social_data JSONB DEFAULT '{}',
  questionnaire JSONB DEFAULT '{}',
  onboarding_step VARCHAR(20) DEFAULT 'social_links',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup (only one profile per tenant DB)
CREATE INDEX idx_brand_profile_step ON ct_brand_profile(onboarding_step);
