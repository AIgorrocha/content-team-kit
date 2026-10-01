// Os 8 blocos de onboarding (conteudo do framework, ships com o Kit), compartilhados pelo
// mock e pelo provedor live (Tarefa A2). `lerOnboarding` devolve os blocos com as respostas
// aplicadas por cima; sem respostas, devolve as mesmas perguntas com resposta vazia.
import { type BlocoOnboarding } from "@/lib/sala/types"

interface PerguntaTemplate { id: string; texto: string; tipo: "texto" | "multipla" | "arquivo" | "lista"; opcoes?: string[] }
interface BlocoTemplate { numero: BlocoOnboarding["numero"]; titulo: string; arquivoDestino: string; perguntas: PerguntaTemplate[] }
export interface RespostasBloco { numero: number; resumo: string | null; gravado: boolean; respostas: Record<string, unknown> }

const BLOCOS_ONBOARDING: BlocoTemplate[] = [
  { numero: 0, titulo: "Identidade", arquivoDestino: "brand-profile.md", perguntas: [
    { id: "nome_empresa", texto: "Nome da empresa e o que vende de verdade", tipo: "texto" },
    { id: "cidade", texto: "Cidade", tipo: "texto" },
    { id: "site", texto: "Site", tipo: "texto" },
    { id: "slug", texto: "Slug confirmado", tipo: "texto" },
  ] },
  { numero: 1, titulo: "Público", arquivoDestino: "brand-profile.md", perguntas: [
    { id: "quem_compra", texto: "Quem compra, quem influencia, quem NÃO é cliente", tipo: "texto" },
    { id: "dores", texto: "As 3 dores que mais ouve, nas palavras do cliente", tipo: "lista" },
    { id: "ja_tentou", texto: "O que já tentou antes e não deu certo", tipo: "texto" },
  ] },
  { numero: 2, titulo: "Persona e voz", arquivoDestino: "voice-patterns.md", perguntas: [
    { id: "quem_assina", texto: "Quem assina o conteúdo: a empresa ou uma pessoa", tipo: "texto" },
    { id: "frases_tipicas", texto: "3 frases que a pessoa fala sempre", tipo: "lista" },
    { id: "nunca_dizer", texto: "O que nunca dizer", tipo: "texto" },
    { id: "tom", texto: "Formal ou informal, técnico ou acessível", tipo: "texto" },
  ] },
  { numero: 3, titulo: "Pilares e prova", arquivoDestino: "brand-profile.md", perguntas: [
    { id: "pilares", texto: "3 a 5 assuntos que dá pra falar toda semana", tipo: "lista" },
    { id: "provas", texto: "Provas concretas: números, casos, antes e depois", tipo: "texto" },
    { id: "diferenciais", texto: "Diferenciais reais que o concorrente não copia amanhã", tipo: "texto" },
  ] },
  { numero: 4, titulo: "Redes e ritmo", arquivoDestino: "brand-profile.md", perguntas: [
    { id: "redes_hoje", texto: "Quais redes existem hoje e qual é a principal", tipo: "multipla", opcoes: ["Instagram", "LinkedIn", "YouTube", "TikTok"] },
    { id: "ritmo", texto: "Quantas peças por semana aguenta aprovar", tipo: "texto" },
    { id: "quem_aprova", texto: "Quem aprova, por onde e em quanto tempo", tipo: "texto" },
    { id: "formatos", texto: "Formatos que topa", tipo: "multipla", opcoes: ["carrossel", "reel com rosto", "reel sem rosto", "story", "artigo", "YouTube longo"] },
  ] },
  { numero: 5, titulo: "Visual", arquivoDestino: "design-system.md", perguntas: [
    { id: "logo", texto: "Logo (arquivo)", tipo: "arquivo" },
    { id: "cores", texto: "2 cores principais", tipo: "texto" },
    { id: "fonte", texto: "Fonte", tipo: "texto" },
    { id: "foto", texto: "Tem foto profissional de quem assina?", tipo: "texto" },
    { id: "referencias", texto: "3 referências que gosta, 1 que odeia", tipo: "texto" },
  ] },
  { numero: 6, titulo: "Concorrentes e inspiração", arquivoDestino: "competitors.md", perguntas: [
    { id: "perfis", texto: "Perfis de referência e concorrentes para acompanhar", tipo: "lista" },
  ] },
  { numero: 7, titulo: "Integrações", arquivoDestino: "integracoes.md", perguntas: [
    { id: "instagram_status", texto: "Instagram: já tem as chaves?", tipo: "multipla", opcoes: ["ligada", "vai ligar", "nao usa"] },
    { id: "linkedin_status", texto: "LinkedIn: já tem as chaves?", tipo: "multipla", opcoes: ["ligada", "vai ligar", "nao usa"] },
    { id: "youtube_status", texto: "YouTube: já tem as chaves?", tipo: "multipla", opcoes: ["ligada", "vai ligar", "nao usa"] },
    { id: "tiktok_status", texto: "TikTok: já tem as chaves?", tipo: "multipla", opcoes: ["ligada", "vai ligar", "nao usa"] },
  ] },
]

export function lerOnboarding(cliente: string, respostas: RespostasBloco[]): BlocoOnboarding[] {
  return BLOCOS_ONBOARDING.map((bloco) => {
    const dados = respostas.find((r) => r.numero === bloco.numero)
    return {
      numero: bloco.numero,
      titulo: bloco.titulo,
      perguntas: bloco.perguntas.map((p) => ({
        id: p.id,
        texto: p.texto,
        tipo: p.tipo,
        opcoes: p.opcoes,
        resposta: (dados?.respostas?.[p.id] as string | string[] | null | undefined) ?? null,
      })),
      resumo: dados?.resumo ?? null,
      gravado: dados?.gravado ?? false,
      arquivoDestino: `clients/${cliente}/${bloco.arquivoDestino}`,
    }
  })
}
