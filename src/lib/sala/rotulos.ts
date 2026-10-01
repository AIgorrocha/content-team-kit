// Fonte única de rótulos PT-BR e ícones da Sala de Comando: tipo de peça, status de
// etapa, rede e status de publicação. Antes cada tela (CartaoPeca, DetalhePeca, NoPeca)
// tinha sua própria tradução, e já tinham divergido (Peças mostrava enum cru, Trilha
// traduzia). Toda tela nova usa daqui.
import { Instagram, Linkedin, Youtube, Music2, Twitter, Megaphone, Mail } from "lucide-react"
import type { BadgeProps } from "@/components/ui/badge"
import type { Rede, TipoPeca, StatusEtapa, Publicacao } from "@/lib/sala/types"

export const ICONE_REDE: Record<Rede, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  x: Twitter,
  meta_ads: Megaphone,
  email: Mail,
}

export const LABEL_REDE: Record<Rede, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  meta_ads: "Meta Ads",
  email: "Email",
}

export const LABEL_TIPO: Record<TipoPeca, string> = {
  youtube_longo: "YouTube longo",
  reel: "Reel",
  recorte: "Recorte",
  carrossel: "Carrossel",
  story: "Story",
  post_linkedin: "Post LinkedIn",
  reel_faceless: "Reel faceless",
  capa: "Capa",
  email: "Email",
}

export const LABEL_STATUS_ETAPA: Record<StatusEtapa | "nao_se_aplica", string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  ajuste: "Ajuste",
  concluido: "Concluído",
  nao_se_aplica: "Não se aplica",
}

export const LABEL_STATUS_PUBLICACAO: Record<Publicacao["status"], string> = {
  rascunho: "rascunho",
  agendado: "agendado",
  publicado: "publicado",
  em_analise: "em análise",
  falhou: "falhou",
}

export const VARIANTE_STATUS_PUBLICACAO: Record<Publicacao["status"], NonNullable<BadgeProps["variant"]>> = {
  rascunho: "secondary",
  agendado: "warning",
  publicado: "success",
  em_analise: "warning",
  falhou: "error",
}

// Formata uma data CIVIL ("YYYY-MM-DD", sem hora) em dd/mm/aaaa sem passar por Date/Intl:
// `new Date("2026-09-10")` é meia-noite UTC, e formatar isso em America/Sao_Paulo (UTC-3)
// mostra 09/09. Data civil não tem fuso: só reformata os dígitos.
export function formatarDataCivil(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  const [, ano, mes, dia] = m
  return `${dia}/${mes}/${ano}`
}
