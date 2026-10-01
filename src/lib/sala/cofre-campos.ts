export const CAMPOS_COFRE = [
  { nome: "OPENAI_API_KEY", rotulo: "Chave da OpenAI", integracao: "OpenAI" },
  { nome: "ANTHROPIC_API_KEY", rotulo: "Chave da Anthropic", integracao: "Anthropic" },
  { nome: "LINKEDIN_CLIENT_ID", rotulo: "Client ID", integracao: "LinkedIn OAuth" },
  { nome: "LINKEDIN_CLIENT_SECRET", rotulo: "Client secret", integracao: "LinkedIn OAuth" },
  { nome: "YOUTUBE_CLIENT_ID", rotulo: "Client ID", integracao: "YouTube OAuth" },
  { nome: "YOUTUBE_CLIENT_SECRET", rotulo: "Client secret", integracao: "YouTube OAuth" },
  { nome: "IG_APP_ID", rotulo: "App ID", integracao: "Instagram e Meta Ads OAuth" },
  { nome: "INSTAGRAM_APP_SECRET", rotulo: "App secret", integracao: "Instagram e Meta Ads OAuth" },
] as const

export type NomeCampoCofre = (typeof CAMPOS_COFRE)[number]["nome"]

export function campoCofre(nome: string): (typeof CAMPOS_COFRE)[number] | null {
  return CAMPOS_COFRE.find((campo) => campo.nome === nome) ?? null
}
