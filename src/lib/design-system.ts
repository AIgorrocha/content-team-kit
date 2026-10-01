export const designTokens = {
  colors: {
    bg: "#0D0D0D",
    surface: "#1A1A1A",
    surfaceHover: "#252525",
    border: "#2A2A2A",
    text: "#FFFFFF",
    textSecondary: "#A0A0A0",
    accent: "#4A90D9",
    accentHover: "#5BA0E9",
    accent2: "#7C3AED",
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  fonts: {
    primary: "Inter",
    secondary: "Space Grotesk",
    mono: "JetBrains Mono",
  },
  carousel: {
    bgColor: "#0D0D0D",
    textColor: "#FFFFFF",
    font: "Inter",
    profilePhotoPosition: "bottom-left" as const,
    slideWidth: 1080,
    slideHeight: 1350,
    maxSlides: 10,
    style: "quote-minimalist" as const,
  },
  brandVoice:
    "Direto, pratico, sem rodeios. Fala como consultor senior que ja implementou. Nao ensina ferramenta, entrega resultado. Tom confiante mas acessivel. Usa analogias do dia a dia. Evita jargao tecnico desnecessario.",
} as const

export const pipelineColors: Record<string, string> = {
  Lead: "#6B7280",
  Qualified: "#3B82F6",
  Proposal: "#F59E0B",
  Negotiation: "#8B5CF6",
  Won: "#10B981",
  Lost: "#EF4444",
}

export const platformIcons: Record<string, string> = {
  instagram: "Instagram",
  youtube: "Youtube",
  linkedin: "Linkedin",
  x: "Twitter",
  email: "Mail",
  tiktok: "Music",
}

export const statusColors: Record<string, string> = {
  idea: "#6B7280",
  draft: "#F59E0B",
  review: "#8B5CF6",
  approved: "#3B82F6",
  scheduled: "#4A90D9",
  published: "#10B981",
  rejected: "#EF4444",
}
