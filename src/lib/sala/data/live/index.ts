// Provedor real: compõe Markdown, banco e memória. Escritas preservam a fonte em arquivo;
// banco e modelos continuam configurados durante a instalação.
import {
  type Agente,
  type Aprovacao,
  type Conexao,
  type Configuracao,
  type Etapa,
  type EventoAoVivo,
  type ItemCalendario,
  type Peca,
  type Regra,
  type Selo,
  type SalaData,
  type TipoPeca,
  type VisaoGeral,
} from "@/lib/sala/types"
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { clienteAtivoCompleto, clienteAtivoSlug, validarClienteDisponivel } from "@/lib/sala/cliente"
import { construirColunasTrabalho } from "@/lib/sala/fontes"
import { salvarPromptNoArquivo } from "@/lib/sala/escrita/prompt"
import { salvarRegraNoArquivo } from "@/lib/sala/escrita/regra"
import { lerPecasLive } from "./pecas"
import { aprovarLive, criarFilhoLive, reprogramarLive } from "./escrita-editorial"
import { lerAgentesLive } from "./agentes"
import { lerEventosRecentesLive, assinarEventosLive } from "./eventos"
import { lerCalendarioLive } from "./calendario"
import { lerRedesLive } from "./redes"
import { lerRegrasLive } from "./regras"
import { lerPadroesLive } from "./padroes"
import { lerAprendizadosLive } from "./aprendizados"
import { lerConexoesLive } from "./conexoes"
import { acaoConexaoLive } from "./acoes-conexao"
import { ConfiguracaoManual, lerConfiguracaoLive } from "./configuracao"
import { lerOnboardingLive, gravarBlocoLive } from "./onboarding"

function agora(): string {
  return new Date().toISOString()
}

// Cliente ativo desta pasta (Batelada B1): cookie sala_cliente > .workspace/CT_CLIENT.
// Lido a cada chamada (não é mais cacheado por processo): o cookie pode mudar a qualquer
// pedido, ao contrário da pasta do kit do terminal.
function clienteSlugAtivo(): Promise<string> {
  return clienteAtivoSlug()
}

// "sincronizado" = o vigia (scripts/sala/watch-sync.mjs) está rodando: ele escreve um
// heartbeat a cada 5s em output/sala-watch.heartbeat. Arquivo com mais de 10s (ou ausente)
// = vigia parado, a tela avisa que a escrita ficou só no arquivo até ele voltar.
function sincronizado(): boolean {
  const caminho = join(process.cwd(), "output", "sala-watch.heartbeat")
  if (!existsSync(caminho)) return false
  return Date.now() - statSync(caminho).mtimeMs < 10_000
}

export function getLive(): SalaData {
  return {
    agora,

    async clienteAtivo() {
      return clienteAtivoCompleto()
    },

    async escolherCliente(slug: string): Promise<void> {
      validarClienteDisponivel(slug)
    },

    async visaoGeral(): Promise<VisaoGeral> {
      const cliente = await clienteSlugAtivo()
      const quando = agora()
      const { pecas, pipelineReal } = await lerPecasLive(cliente, quando)
      // Mesmo filtro de pecas(): só o pipeline real conta na Visão geral.
      const topo = pecas.filter((p) => p.pecaMae == null && pipelineReal.has(p.slug))

      const contagemPorEtapa = new Map<Etapa, number>()
      for (const p of topo.filter((p) => p.etapaAtual < 8)) contagemPorEtapa.set(p.etapaAtual, (contagemPorEtapa.get(p.etapaAtual) ?? 0) + 1)
      const emProducao = Array.from(contagemPorEtapa.entries())
        .map(([etapa, quantidade]) => ({ etapa, quantidade }))
        .sort((a, b) => a.etapa - b.etapa)

      const aguardandoAprovacao = topo.filter((p) => p.statusEtapa === "aguardando_aprovacao")

      const inicioJanela = new Date(quando)
      inicioJanela.setUTCDate(inicioJanela.getUTCDate() - 3)
      const fimJanela = new Date(quando)
      fimJanela.setUTCDate(fimJanela.getUTCDate() + 60)
      const calendario = await lerCalendarioLive(cliente, inicioJanela.toISOString().slice(0, 10), fimJanela.toISOString().slice(0, 10))
      const programados = calendario.filter((i) => i.estado === "agendado" || i.estado === "planejado")

      const seteDiasAntes = new Date(quando)
      seteDiasAntes.setUTCDate(seteDiasAntes.getUTCDate() - 7)
      const limite7dias = seteDiasAntes.toISOString().slice(0, 10)
      const publicadosSemana = pecas
        .flatMap((p) => p.publicacoes)
        .filter((pub) => pub.status === "publicado" && !!pub.publicadoEm && pub.publicadoEm >= limite7dias)

      const conexoes = await lerConexoesLive(cliente)
      const alertas: VisaoGeral["alertas"] = conexoes
        .filter((c) => c.status === "vencida" || c.status === "vencendo")
        .map((c) => ({ nivel: c.status === "vencida" ? "critico" : "atencao", texto: `${c.nome}: ${c.status === "vencida" ? "conexão vencida" : "validade próxima do fim"}.`, link: "/sala/conexoes" }))
      const ritmo: VisaoGeral["ritmo"] = []
      const hoje = new Date(quando)
      hoje.setUTCHours(0, 0, 0, 0)
      // Semanas iniciadas na segunda-feira; datas de eventos continuam em ISO.
      hoje.setUTCDate(hoje.getUTCDate() - (hoje.getUTCDay() + 6) % 7)
      for (let n = 7; n >= 0; n--) {
        const inicio = new Date(hoje.getTime() - n * 7 * 86_400_000).toISOString()
        const fim = new Date(new Date(inicio).getTime() + 7 * 86_400_000).toISOString()
        ritmo.push({
          semana: inicio.slice(0, 10),
          pecasPublicadas: pecas.filter((p) => p.publicacoes.some((pub) => pub.status === "publicado" && pub.publicadoEm && pub.publicadoEm >= inicio && pub.publicadoEm < fim)).length,
          pecasTocadas: pecas.filter((p) => p.atualizadoEm >= inicio && p.atualizadoEm < fim).length,
        })
      }

      return {
        emProducao,
        aguardandoAprovacao,
        programados,
        publicadosSemana,
        alertas,
        ritmo,
      }
    },

    async pecas(): Promise<Peca[]> {
      const cliente = await clienteSlugAtivo()
      // Batelada B4: só o pipeline real aparece no quadro (ver pipelineReal em
      // data/live/pecas.ts). peca()/aprovar()/criarFilho() abaixo continuam sobre a lista
      // cheia, sem esse filtro, pra não impedir aprovar a 1a etapa ou criar o 1o filho de
      // uma peça que ainda não tem nenhum critério.
      const { pecas, pipelineReal } = await lerPecasLive(cliente, agora())
      return pecas.filter((p) => p.pecaMae == null && pipelineReal.has(p.slug))
    },

    async peca(slug: string): Promise<Peca | null> {
      const cliente = await clienteSlugAtivo()
      const { pecas } = await lerPecasLive(cliente, agora())
      return pecas.find((p) => p.slug === slug) ?? null
    },

    async aprovar(slug: string, aprovacao: Aprovacao): Promise<Peca> {
      const cliente = await clienteSlugAtivo()
      return aprovarLive(cliente, slug, aprovacao)
    },

    async criarFilho(slugMae: string, tipo: TipoPeca, rede): Promise<Peca> {
      const cliente = await clienteSlugAtivo()
      return criarFilhoLive(cliente, slugMae, tipo, rede)
    },

    async agentes(): Promise<Agente[]> {
      const cliente = await clienteSlugAtivo()
      return lerAgentesLive(cliente)
    },

    async agente(slug: string): Promise<Agente | null> {
      const cliente = await clienteSlugAtivo()
      const agentes = await lerAgentesLive(cliente, slug)
      return agentes.find((a) => a.slug === slug) ?? null
    },

    async trabalho() {
      const cliente = await clienteSlugAtivo()
      const [agentes, eventos] = await Promise.all([
        lerAgentesLive(cliente),
        lerEventosRecentesLive(300),
      ])
      return { colunas: construirColunasTrabalho(agentes, eventos, agora()) }
    },

    async salvarPrompt(slug: string, promptMd: string, baseHash: string) {
      const hash = salvarPromptNoArquivo(slug, promptMd, baseHash)
      return { ok: true as const, hash, sincronizado: sincronizado() }
    },

    async eventosRecentes(limite = 50): Promise<EventoAoVivo[]> {
      return lerEventosRecentesLive(limite)
    },

    assinarEventos(): AsyncIterable<EventoAoVivo> {
      return assinarEventosLive()
    },

    async trilha(slugMae: string) {
      const cliente = await clienteSlugAtivo()
      const { pecas } = await lerPecasLive(cliente, agora())
      const mae = pecas.find((p) => p.slug === slugMae)
      if (!mae) throw new Error(`peça mãe "${slugMae}" não encontrada`)
      const filhos = pecas.filter((p) => p.pecaMae === slugMae)
      return { mae, filhos }
    },

    async calendario(inicio: string, fim: string): Promise<ItemCalendario[]> {
      const cliente = await clienteSlugAtivo()
      return lerCalendarioLive(cliente, inicio, fim)
    },

    async reprogramar(id: string, novaData: string): Promise<ItemCalendario> {
      const cliente = await clienteSlugAtivo()
      return reprogramarLive(cliente, id, novaData)
    },

    async redes() {
      const cliente = await clienteSlugAtivo()
      return lerRedesLive(cliente)
    },

    async regras(): Promise<Regra[]> {
      const cliente = await clienteSlugAtivo()
      return lerRegrasLive(cliente)
    },

    async salvarRegra(id: string, texto: string, selo: Selo, baseHash: string): Promise<Regra> {
      const cliente = await clienteSlugAtivo()
      return salvarRegraNoArquivo(cliente, id, texto, selo, baseHash)
    },

    async padroes() {
      const cliente = await clienteSlugAtivo()
      return lerPadroesLive(cliente)
    },

    async aprendizados() {
      return lerAprendizadosLive(await clienteSlugAtivo())
    },

    async conexoes(): Promise<Conexao[]> {
      const cliente = await clienteSlugAtivo()
      return lerConexoesLive(cliente)
    },

    async acaoConexao(id: string, acao): Promise<Conexao | { redirect: string }> {
      const cliente = await clienteSlugAtivo()
      return acaoConexaoLive(cliente, id, acao)
    },

    async configuracao(): Promise<Configuracao> {
      const cliente = await clienteSlugAtivo()
      return lerConfiguracaoLive(cliente)
    },

    async alterarConfiguracao(_parte: "banco" | "modelos", _valor: unknown): Promise<Configuracao> {
      throw new ConfiguracaoManual()
    },

    async onboarding() {
      const cliente = await clienteSlugAtivo()
      return lerOnboardingLive(cliente)
    },

    async gravarBloco(numero: number, respostas: Record<string, unknown>, baseHash?: string) {
      const cliente = await clienteSlugAtivo()
      return gravarBlocoLive(cliente, numero, respostas, baseHash)
    },

    async reset(): Promise<void> {
      // no-op no live: não existe seed pra recriar.
    },
  }
}
