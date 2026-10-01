// Provedor mock de `SalaData` (contrato v2): implementa todos os métodos sobre o estado
// compartilhado de `state.ts`. Estado em memória do processo, reiniciado por `reset()`.
import { createHash } from "node:crypto"
import {
  ConflitoEdicao,
  type Agente,
  type Aprovacao,
  type Conexao,
  type Configuracao,
  type Etapa,
  type EstadoEtapa,
  type EventoAoVivo,
  type ItemCalendario,
  type Peca,
  type Rede,
  type Regra,
  type Selo,
  type StatusEtapa,
  type SalaData,
  type TipoPeca,
  type VisaoGeral,
} from "@/lib/sala/types"
import { nomeCliente, construirColunasTrabalho, redeDoTipo } from "@/lib/sala/fontes"
import { obterEstado, reiniciarEstado, agora as agoraMock } from "./state"

function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex")
}

function encontrarEtapa(peca: Peca, etapaNum: Etapa, rede: Rede | null): EstadoEtapa | undefined {
  return peca.etapas.find((e) => e.etapa === etapaNum && e.rede === rede)
}

// Recalcula etapaAtual/statusEtapa como a PRIMEIRA etapa (1 a 8) que ainda tem alguma
// rede/entrada não concluída. "aprovado", "concluido" e "nao_se_aplica" contam como prontos.
//
// Correção 1 (revisão independente, achado B1): uma peça que já chegou à etapa 8
// (registrada) é tratada como TERMINAL. Sem isso, reaprovar uma etapa antiga já concluída
// (ex.: etapa 1) numa peça como melhor-fluxo-videochamada, que tem uma rede secundária
// travada (TikTok "em análise") mas já foi registrada, regredia a peça sozinha de volta pra
// coluna 7 só porque essa rede secundária nunca fechou. Só uma ação na PRÓPRIA etapa 8 (ex.:
// reabrir o registro) pode mover uma peça que já é terminal.
function recalcularEtapaAtual(peca: Peca, etapaTocada: Etapa): void {
  const PRONTOS = new Set<EstadoEtapa["status"]>(["concluido", "aprovado", "nao_se_aplica"])

  const etapa8 = peca.etapas.filter((e) => e.etapa === 8)
  const jaRegistrada = etapa8.length > 0 && etapa8.every((e) => PRONTOS.has(e.status))
  if (jaRegistrada && etapaTocada !== 8) {
    peca.etapaAtual = 8
    peca.statusEtapa = "concluido"
    return
  }

  for (let n = 1; n <= 8; n++) {
    const doEtapa = peca.etapas.filter((e) => e.etapa === n)
    if (doEtapa.length === 0) continue
    const pendente = doEtapa.find((e) => !PRONTOS.has(e.status))
    if (pendente) {
      peca.etapaAtual = n as Etapa
      peca.statusEtapa = pendente.status as StatusEtapa
      return
    }
  }
  peca.etapaAtual = 8
  peca.statusEtapa = "concluido"
}

export function createMockSala(): SalaData {
  return {
    agora() {
      return agoraMock()
    },

    // Mock não muda de comportamento com o cookie: sempre o cliente do seed, disponiveis
    // com só ele (Batelada B1).
    async clienteAtivo() {
      const estado = await obterEstado()
      const slug = estado.configuracao.kit.cliente
      const nome = nomeCliente(slug)
      return { slug, nome, disponiveis: [{ slug, nome }] }
    },

    async escolherCliente(slug: string): Promise<void> {
      const estado = await obterEstado()
      const ativo = estado.configuracao.kit.cliente
      if (slug !== ativo) throw new Error(`cliente "${slug}" não está disponível neste seed (ativo: "${ativo}")`)
    },

    async visaoGeral(): Promise<VisaoGeral> {
      const estado = await obterEstado()
      const topo = estado.pecas.filter((p) => p.pecaMae == null)

      const contagemPorEtapa = new Map<Etapa, number>()
      for (const p of topo) contagemPorEtapa.set(p.etapaAtual, (contagemPorEtapa.get(p.etapaAtual) ?? 0) + 1)
      const emProducao = Array.from(contagemPorEtapa.entries())
        .map(([etapa, quantidade]) => ({ etapa, quantidade }))
        .sort((a, b) => a.etapa - b.etapa)

      const aguardandoAprovacao = topo.filter((p) => p.statusEtapa === "aguardando_aprovacao")
      const programados = estado.calendario.filter((i) => i.estado === "agendado" || i.estado === "planejado")

      // Correção 1 (achado B3): "últimos 7 dias" derivado de agora(), não mais um
      // literal fixo, pra não dessincronizar se RELOGIO_MOCK mudar numa task futura.
      const seteDiasAntes = new Date(agoraMock())
      seteDiasAntes.setUTCDate(seteDiasAntes.getUTCDate() - 7)
      const limite7dias = seteDiasAntes.toISOString().slice(0, 10)
      const publicadosSemana = estado.pecas
        .flatMap((p) => p.publicacoes)
        .filter((pub) => pub.status === "publicado" && !!pub.publicadoEm && pub.publicadoEm >= limite7dias)

      return {
        emProducao,
        aguardandoAprovacao,
        programados,
        publicadosSemana,
        // Correção (Tarefa 14): alertas e ritmo eram literais fixos do dono (nomes de peça,
        // token do LinkedIn) direto no código, aparecendo até no cenário vazio sem nenhuma
        // peça. Agora vêm do seed (seed.json do cliente ativo, ou [] no cenário genérico).
        alertas: estado.alertas,
        ritmo: estado.ritmo,
      }
    },

    async pecas(): Promise<Peca[]> {
      const estado = await obterEstado()
      return estado.pecas.filter((p) => p.pecaMae == null)
    },

    async peca(slug: string): Promise<Peca | null> {
      const estado = await obterEstado()
      return estado.pecas.find((p) => p.slug === slug) ?? null
    },

    async aprovar(slug: string, aprovacao: Aprovacao): Promise<Peca> {
      const estado = await obterEstado()
      const peca = estado.pecas.find((p) => p.slug === slug)
      if (!peca) throw new Error(`peça "${slug}" não encontrada`)
      if (aprovacao.acao === "ajuste" && !aprovacao.motivo) {
        throw new Error("motivo obrigatório para pedir ajuste")
      }
      const alvo = encontrarEtapa(peca, aprovacao.etapa, aprovacao.rede)
      if (!alvo) {
        throw new Error(`peça "${slug}" não tem a etapa ${aprovacao.etapa}${aprovacao.rede ? ` (${aprovacao.rede})` : ""}`)
      }
      // Correção 1 (achado B2): só valida contra revisões que existem quando a peça TEM
      // histórico de revisão pra checar. Peça sem nenhuma revisão ainda (ex.: mãe de
      // arquitetura-multimodelo) não bloqueia aprovar/ajuste por essa checagem; um
      // revisaoId inventado numa peça que TEM revisões reais agora dá erro em vez de
      // ser aceito em silêncio.
      if (peca.revisoes.length > 0 && !peca.revisoes.some((r) => r.id === aprovacao.revisaoId)) {
        throw new Error(`revisão "${aprovacao.revisaoId}" não encontrada na peça "${slug}"`)
      }
      const dono = estado.configuracao.kit.dono.toLowerCase()
      if (aprovacao.acao === "aprovar") {
        alvo.status = "aprovado"
        alvo.revisaoId = aprovacao.revisaoId
        alvo.aprovadoEm = agoraMock()
        alvo.aprovadoPor = dono
        alvo.motivoAjuste = null
        const revisao = peca.revisoes.find((r) => r.id === aprovacao.revisaoId)
        if (revisao && !revisao.aprovadaEm) revisao.aprovadaEm = agoraMock()
      } else {
        alvo.status = "ajuste"
        alvo.revisaoId = aprovacao.revisaoId
        alvo.motivoAjuste = aprovacao.motivo ?? null
        alvo.aprovadoEm = null
        alvo.aprovadoPor = null
        // ponytail: pedir ajuste abre a próxima revisão (o time vai produzir em cima do
        // motivo). Numeração nunca sobrescrita, sempre incrementa a partir da maior existente.
        const maiorNumero = peca.revisoes.reduce((max, r) => Math.max(max, r.numero), 0)
        peca.revisoes.push({
          id: `${slug}:r${maiorNumero + 1}`,
          numero: maiorNumero + 1,
          criadaEm: agoraMock(),
          criadaPor: alvo.dono ?? dono,
          artefatoIds: [],
          oQueMudou: `Ajuste pedido na etapa ${aprovacao.etapa}${aprovacao.rede ? ` (${aprovacao.rede})` : ""}: ${aprovacao.motivo}`,
          aprovadaEm: null,
        })
      }
      peca.atualizadoEm = agoraMock()
      recalcularEtapaAtual(peca, aprovacao.etapa)
      return peca
    },

    async criarFilho(slugMae: string, tipo: TipoPeca, rede: Rede | null): Promise<Peca> {
      const estado = await obterEstado()
      const mae = estado.pecas.find((p) => p.slug === slugMae)
      if (!mae) throw new Error(`peça mãe "${slugMae}" não encontrada`)
      const existentes = estado.pecas.filter((p) => p.pecaMae === slugMae).length
      const slug = `${slugMae}-filho-${existentes + 1}`
      const quando = agoraMock()
      const filho: Peca = {
        slug,
        titulo: `Novo ${tipo} de ${mae.titulo}`,
        tipo,
        cliente: mae.cliente,
        redes: rede ? [rede] : [],
        etapaAtual: 1,
        statusEtapa: "pendente",
        etapas: [{ etapa: 1, status: "pendente", rede: null, revisaoId: null, dono: null, aprovadoEm: null, aprovadoPor: null, motivoAjuste: null }],
        donoEtapa: mae.donoEtapa,
        diasParado: 0,
        capaUrl: null,
        artefatos: [],
        revisoes: [],
        pecaMae: slugMae,
        publicacoes: [],
        pendenciasHumanas: [],
        criadoEm: quando,
        atualizadoEm: quando,
      }
      estado.pecas.push(filho)
      return filho
    },

    async agentes(): Promise<Agente[]> {
      return (await obterEstado()).agentes
    },

    async agente(slug: string): Promise<Agente | null> {
      const estado = await obterEstado()
      return estado.agentes.find((a) => a.slug === slug) ?? null
    },

    async trabalho() {
      const estado = await obterEstado()
      return { colunas: construirColunasTrabalho(estado.agentes, estado.eventos, agoraMock()) }
    },

    async salvarPrompt(slug: string, promptMd: string, baseHash: string) {
      const estado = await obterEstado()
      const agente = estado.agentes.find((a) => a.slug === slug)
      if (!agente) throw new Error(`agente "${slug}" não encontrado`)
      if (agente.promptHash !== baseHash) throw new ConflitoEdicao(agente.promptMd, agente.promptHash)
      agente.promptMd = promptMd
      agente.promptHash = sha256(promptMd)
      return { ok: true as const, hash: agente.promptHash, sincronizado: false }
    },

    async eventosRecentes(limite = 50): Promise<EventoAoVivo[]> {
      const estado = await obterEstado()
      return estado.eventos.slice(-limite)
    },

    assinarEventos(): AsyncIterable<EventoAoVivo> {
      return {
        [Symbol.asyncIterator]() {
          let indice = 0
          let volta = 0
          return {
            async next(): Promise<IteratorResult<EventoAoVivo>> {
              const estado = await obterEstado()
              const eventos = estado.eventos
              await new Promise((resolve) => setTimeout(resolve, 1500))
              const base = eventos[indice]
              const valor: EventoAoVivo = { ...base, id: `${base.id}-v${volta}` }
              indice++
              if (indice >= eventos.length) {
                indice = 0
                volta++
              }
              return { value: valor, done: false }
            },
          }
        },
      }
    },

    async trilha(slugMae: string) {
      const estado = await obterEstado()
      const mae = estado.pecas.find((p) => p.slug === slugMae)
      if (!mae) throw new Error(`peça mãe "${slugMae}" não encontrada`)
      const filhos = estado.pecas.filter((p) => p.pecaMae === slugMae)
      return { mae, filhos }
    },

    async calendario(inicio: string, fim: string): Promise<ItemCalendario[]> {
      const estado = await obterEstado()
      return estado.calendario.filter((item) => item.data >= inicio && item.data <= fim)
    },

    async reprogramar(id: string, novaData: string): Promise<ItemCalendario> {
      const estado = await obterEstado()
      const item = estado.calendario.find((i) => i.id === id)
      if (!item) throw new Error(`item de calendário "${id}" não encontrado`)
      if (item.estado !== "agendado") throw new Error(`item "${id}" não é agendado, não pode ser reprogramado`)
      // novaData só com data (10 chars, "AAAA-MM-DD"): preserva a hora original.
      item.data = novaData.length <= 10 ? `${novaData}${item.data.slice(10)}` : novaData
      return item
    },

    async redes() {
      return (await obterEstado()).redes
    },

    async regras(): Promise<Regra[]> {
      return (await obterEstado()).regras
    },

    async salvarRegra(id: string, texto: string, selo: Selo, baseHash: string): Promise<Regra> {
      const estado = await obterEstado()
      const regra = estado.regras.find((r) => r.id === id)
      if (!regra) throw new Error(`regra "${id}" não encontrada`)
      if (regra.hash !== baseHash) throw new ConflitoEdicao(regra.texto, regra.hash)
      regra.texto = texto
      regra.selo = selo
      regra.atualizadoEm = agoraMock()
      // ponytail: depois da primeira edição o hash passa a ser por regra (sha256 do
      // próprio texto), não mais o hash do arquivo inteiro compartilhado por todas.
      // Simplificação aceitável no mock, que não reescreve o .md de verdade (isso é Fase 2).
      // Correção (Tarefa 14): o hash tem que mudar em QUALQUER campo editável, não só no
      // texto. Trocar somente o selo com o mesmo texto gerava o MESMO hash de antes (sha256
      // dependia só do texto), então um segundo editor concorrente com o baseHash antigo
      // ainda passava na checagem de conflito e sobrescrevia a troca de selo sem avisar.
      regra.hash = sha256(`${texto} ${selo}`)
      return regra
    },

    async padroes() {
      // seed.json de cliente não carrega o campo `rede` (Batelada B5): completa aqui a
      // partir do tipoConteudo com a mesma função pura do provedor live.
      const padroes = (await obterEstado()).padroes
      return padroes.map((p) => ({ ...p, rede: p.rede ?? redeDoTipo(p.tipoConteudo) }))
    },

    async aprendizados() {
      return (await obterEstado()).aprendizados
    },

    async conexoes(): Promise<Conexao[]> {
      return (await obterEstado()).conexoes
    },

    async acaoConexao(id: string, acao: NonNullable<Conexao["acao"]>): Promise<Conexao> {
      const estado = await obterEstado()
      const conexao = estado.conexoes.find((c) => c.id === id)
      if (!conexao) throw new Error(`conexão "${id}" não encontrada`)
      // Correção 1 (Tarefa 13): o mock aceitava qualquer ação válida em qualquer conexão
      // (ex.: "renovar" o Instagram, que só tem "testar" configurado), o que mudava status
      // de um jeito que essa conexão nunca teria de verdade. Só a ação configurada pra ela
      // é permitida, com uma exceção: "testar" em qualquer conexão que já está "ok" (smoke
      // test não muda nada, não precisa ser a ação primária dela).
      if (acao !== conexao.acao && !(acao === "testar" && conexao.status === "ok")) {
        throw new Error("Ação não disponível para esta conexão")
      }
      const quando = agoraMock()
      if (acao === "renovar") {
        conexao.status = "ok"
        conexao.conectadoEm = quando
        const expira = new Date(quando)
        expira.setDate(expira.getDate() + 60)
        conexao.expiraEm = expira.toISOString()
        conexao.diasRestantes = 60
      } else {
        conexao.ultimoUso = quando
      }
      return conexao
    },

    async configuracao(): Promise<Configuracao> {
      const estado = await obterEstado()
      return estado.configuracao
    },

    async alterarConfiguracao(parte: "banco" | "modelos", valor: unknown): Promise<Configuracao> {
      const estado = await obterEstado()
      if (parte === "banco") estado.configuracao.banco = valor as Configuracao["banco"]
      else estado.configuracao.modelos = valor as Configuracao["modelos"]
      return estado.configuracao
    },

    async onboarding() {
      return (await obterEstado()).onboarding
    },

    async gravarBloco(numero: number, respostas: Record<string, unknown>) {
      const estado = await obterEstado()
      const bloco = estado.onboarding.find((b) => b.numero === numero)
      if (!bloco) throw new Error(`bloco ${numero} não encontrado`)
      for (const pergunta of bloco.perguntas) {
        if (Object.prototype.hasOwnProperty.call(respostas, pergunta.id)) {
          pergunta.resposta = respostas[pergunta.id] as typeof pergunta.resposta
        }
      }
      bloco.gravado = true
      return bloco
    },

    async reset(): Promise<void> {
      await reiniciarEstado()
    },
  }
}
