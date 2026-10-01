import OpenAI from "openai"
import { z } from "zod"
import type { BrandProfile } from "@/lib/types"
import type { SocialScrapingResult } from "./social-scraper"
import type { SiteAnalysis } from "./site-analyzer"
import type { TranscriptionResult } from "./video-transcriber"

// Schema for validating the AI-generated brand profile
const BrandVoiceSchema = z.object({
  tone: z.string().default("profissional"),
  formality: z.number().min(1).max(10).default(5),
  energy: z.string().default("moderada"),
  favorite_words: z.array(z.string()).default([]),
  forbidden_words: z.array(z.string()).default([]),
  catchphrases: z.array(z.string()).default([]),
  emoji_style: z.string().default("moderado"),
  favorite_emojis: z.array(z.string()).default([]),
  explanation_style: z.string().default("direto"),
  audience_name: z.string().default("seguidores"),
})

const VisualIdentitySchema = z.object({
  primary_colors: z.array(z.string()).default([]),
  font_style: z.string().default("moderna"),
  image_style: z.string().default("clean"),
  carousel_style: z.string().default("informativo"),
})

const ContentStrategySchema = z.object({
  platforms: z.array(z.string()).default([]),
  frequency: z.record(z.number()).default({}),
  best_times: z.record(z.string()).default({}),
  content_mix: z.record(z.number()).default({}),
  themes: z.array(z.string()).default([]),
})

const AudienceSchema = z.object({
  description: z.string().default(""),
  pain_points: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
})

const GeneratedProfileSchema = z.object({
  brand_voice: BrandVoiceSchema,
  visual_identity: VisualIdentitySchema,
  content_strategy: ContentStrategySchema,
  audience: AudienceSchema,
})

export type GeneratedProfile = z.infer<typeof GeneratedProfileSchema>

interface BuilderInput {
  socialResults: SocialScrapingResult[]
  siteAnalysis: SiteAnalysis | null
  transcriptions: TranscriptionResult[]
}

function buildPrompt(input: BuilderInput): string {
  const { socialResults, siteAnalysis, transcriptions } = input

  let context = "# Dados coletados sobre a marca/criador\n\n"

  // Social media data
  for (const social of socialResults) {
    if (social.error) continue
    context += `## ${social.platform.toUpperCase()} (@${social.handle})\n`
    context += `- Nome: ${social.profile.name || "N/A"}\n`
    context += `- Bio: ${social.profile.bio || "N/A"}\n`
    context += `- Seguidores: ${social.profile.followers || "N/A"}\n\n`

    if (social.posts.length > 0) {
      context += `### Últimos posts (${social.posts.length}):\n`
      for (const post of social.posts.slice(0, 10)) {
        context += `- "${(post.caption || "").slice(0, 200)}"\n`
        context += `  Likes: ${post.likes} | Comentários: ${post.comments}\n`
      }
      context += "\n"
    }
  }

  // Site analysis
  if (siteAnalysis && !siteAnalysis.error) {
    context += `## SITE (${siteAnalysis.url})\n`
    context += `- Título: ${siteAnalysis.title || "N/A"}\n`
    context += `- Descrição: ${siteAnalysis.description || "N/A"}\n`
    context += `- Cores encontradas: ${siteAnalysis.colors.join(", ") || "N/A"}\n`
    context += `- Fontes: ${siteAnalysis.fonts.join(", ") || "N/A"}\n`
    context += `- Tecnologias: ${siteAnalysis.technologies.join(", ") || "N/A"}\n`
    context += `- Tem blog: ${siteAnalysis.has_blog ? "Sim" : "Não"}\n`
    context += `- Tem e-commerce: ${siteAnalysis.has_ecommerce ? "Sim" : "Não"}\n`
    context += `- Headings: ${siteAnalysis.headings.slice(0, 10).join("; ")}\n`
    context += `- Texto principal (trecho): "${siteAnalysis.main_text.slice(0, 1000)}"\n\n`
  }

  // Transcriptions
  if (transcriptions.length > 0) {
    context += `## TRANSCRIÇÕES DE VÍDEOS\n\n`
    for (let i = 0; i < transcriptions.length; i++) {
      const t = transcriptions[i]
      if (t.error) {
        context += `### Vídeo ${i + 1}: Erro - ${t.error}\n`
        continue
      }
      context += `### Vídeo ${i + 1} (${t.duration_seconds ? Math.round(t.duration_seconds / 60) + " min" : "duração desconhecida"}):\n`
      context += `"${t.transcript.slice(0, 2000)}"\n\n`
    }
  }

  return `Você é um especialista em branding e marketing digital. Analise os dados abaixo sobre uma marca/criador de conteúdo e gere um perfil completo (brand profile).

${context}

---

Com base em TODOS os dados acima, gere um JSON com a seguinte estrutura:

{
  "brand_voice": {
    "tone": "tom principal (ex: educativo, inspirador, engraçado, provocativo, acolhedor)",
    "formality": 5, // 1=super informal, 10=super formal
    "energy": "nível de energia (ex: calma, moderada, alta, explosiva)",
    "favorite_words": ["palavras que a pessoa usa muito"],
    "forbidden_words": ["palavras que a pessoa nunca usa ou evita"],
    "catchphrases": ["bordões ou frases marcantes"],
    "emoji_style": "como usa emojis (ex: nunca, poucos, moderado, muito, excessivo)",
    "favorite_emojis": ["emojis mais usados"],
    "explanation_style": "como explica coisas (ex: storytelling, direto ao ponto, analogias, passo a passo)",
    "audience_name": "como chama o público (ex: galera, pessoal, família, turma)"
  },
  "visual_identity": {
    "primary_colors": ["#hex das cores principais do site/posts"],
    "font_style": "estilo de fonte (ex: moderna, clássica, bold, minimalista)",
    "image_style": "estilo visual dos posts (ex: clean, colorido, escuro, neon, natural)",
    "carousel_style": "estilo de carrosséis (ex: educativo, storytelling, tips, antes/depois)"
  },
  "content_strategy": {
    "platforms": ["plataformas ativas"],
    "frequency": {"instagram": 5, "youtube": 2}, // posts por semana por plataforma
    "best_times": {"instagram": "19:00", "youtube": "18:00"},
    "content_mix": {"educativo": 40, "entretenimento": 30, "venda": 20, "bastidores": 10}, // percentuais
    "themes": ["temas principais do conteúdo"]
  },
  "audience": {
    "description": "descrição do público-alvo baseada no conteúdo",
    "pain_points": ["dores/problemas que o público tem"],
    "goals": ["objetivos/desejos do público"]
  }
}

IMPORTANTE:
- Responda APENAS com o JSON, sem markdown, sem explicações
- Baseie-se nos dados reais, não invente
- Se não tiver dados suficientes para um campo, use valores padrão razoáveis
- Todos os textos em português brasileiro`
}

export async function buildBrandProfile(input: BuilderInput): Promise<GeneratedProfile> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }

  const client = new OpenAI({ apiKey })
  const prompt = buildPrompt(input)

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Você é um especialista em branding. Responda APENAS com JSON válido, sem markdown code blocks.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  })

  const rawContent = completion.choices[0]?.message?.content || "{}"

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error("IA retornou JSON inválido")
  }

  // Validate with zod (with defaults for missing fields)
  const validated = GeneratedProfileSchema.parse(parsed)
  return validated
}

export function mergeProfileWithExisting(
  existing: Partial<BrandProfile>,
  generated: GeneratedProfile
): {
  brand_voice: BrandProfile["brand_voice"]
  visual_identity: BrandProfile["visual_identity"]
  content_strategy: BrandProfile["content_strategy"]
  audience: BrandProfile["audience"]
} {
  return {
    brand_voice: { ...generated.brand_voice, ...(existing.brand_voice || {}) },
    visual_identity: { ...generated.visual_identity, ...(existing.visual_identity || {}) },
    content_strategy: { ...generated.content_strategy, ...(existing.content_strategy || {}) },
    audience: { ...generated.audience, ...(existing.audience || {}) },
  }
}
