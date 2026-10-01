import OpenAI from "openai"
import type { GeneratedProfile } from "./profile-builder"

export interface GeneratedQuestion {
  id: string
  category: string
  question: string
  why: string
  options: string[] | null
  type: "text" | "select" | "multiselect" | "scale"
}

export async function generateQuestions(
  profile: GeneratedProfile,
  gaps: string[]
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada")
  }

  const client = new OpenAI({ apiKey })

  const prompt = `Você é um consultor de branding. Analisei o perfil de uma marca e gerei o seguinte brand profile parcial:

${JSON.stringify(profile, null, 2)}

Lacunas identificadas: ${gaps.length > 0 ? gaps.join(", ") : "nenhuma específica, mas quero aprofundar"}

Gere de 5 a 10 perguntas complementares para completar o brand profile. As perguntas devem cobrir:
1. Informações que não consegui extrair automaticamente
2. Preferências pessoais do criador
3. Objetivos de negócio e conteúdo
4. Tom e estilo que a IA pode ter errado

Retorne um JSON array com objetos no formato:
[
  {
    "id": "q1",
    "category": "brand_voice | visual_identity | content_strategy | audience | business",
    "question": "pergunta em português",
    "why": "por que essa pergunta é importante (1 frase)",
    "options": ["opção 1", "opção 2"] ou null se for texto livre,
    "type": "text | select | multiselect | scale"
  }
]

IMPORTANTE: Responda APENAS com o JSON array, sem markdown.`

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Responda APENAS com JSON válido, sem markdown code blocks.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  })

  const rawContent = completion.choices[0]?.message?.content || '{"questions":[]}'

  try {
    const parsed = JSON.parse(rawContent)
    // Handle both {questions: [...]} and direct array
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || [])
    return questions as GeneratedQuestion[]
  } catch {
    return []
  }
}

export function identifyGaps(profile: GeneratedProfile): string[] {
  const gaps: string[] = []

  if (profile.brand_voice.favorite_words.length === 0) gaps.push("palavras favoritas")
  if (profile.brand_voice.catchphrases.length === 0) gaps.push("bordões e frases marcantes")
  if (profile.visual_identity.primary_colors.length === 0) gaps.push("cores da marca")
  if (profile.content_strategy.themes.length === 0) gaps.push("temas de conteúdo")
  if (profile.content_strategy.platforms.length === 0) gaps.push("plataformas ativas")
  if (!profile.audience.description) gaps.push("descrição do público-alvo")
  if (profile.audience.pain_points.length === 0) gaps.push("dores do público")
  if (profile.audience.goals.length === 0) gaps.push("objetivos do público")

  return gaps
}
