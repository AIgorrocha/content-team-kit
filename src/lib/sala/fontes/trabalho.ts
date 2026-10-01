// Kanban de Trabalho (Batelada B3): junta o status ao vivo do agente (Agente.status e
// Agente.ultimaAtividade, a MESMA fonte que a tela Time ja usa pra "ha X min") com os
// eventos recentes (aprovacao pendente e conclusao de hoje). Compartilhado pelo mock e
// pelo live, nenhum dos dois reimplementa a regra de coluna.
import { FUSO, type Agente, type CartaoTrabalho, type ColunaTrabalho, type ColunaTrabalhoId, type EventoAoVivo } from "@/lib/sala/types"

const LIMITE_ESPERA_MIN = 30
const ORDEM_COLUNAS: ColunaTrabalhoId[] = ["esperando", "trabalhando", "aguardando_aprovacao", "concluido_hoje"]

function diaLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(iso))
}

function ultimoEventoDoAgente(eventos: EventoAoVivo[], slug: string): EventoAoVivo | null {
  let ultimo: EventoAoVivo | null = null
  for (const e of eventos) {
    if (e.agente !== slug) continue
    if (!ultimo || e.ts > ultimo.ts) ultimo = e
  }
  return ultimo
}

// "aprovacao_pedida sem aprovado": o pedido de aprovacao (do agente) nao tem, depois dele,
// nenhum "aprovado"/"ajuste_pedido" da MESMA peca. Esses dois eventos vem com agente: null
// (quem aprova ou pede ajuste e o dono da conta, nao um agente), entao a checagem de
// resolucao e por peca e por tempo, nao por agente.
function aprovacaoPendente(eventos: EventoAoVivo[], evento: EventoAoVivo): boolean {
  if (evento.tipo !== "aprovacao_pedida" || !evento.peca) return false
  return !eventos.some(
    (e) => e.peca === evento.peca && e.ts > evento.ts && (e.tipo === "aprovado" || e.tipo === "ajuste_pedido")
  )
}

export function construirColunasTrabalho(
  agentes: Agente[],
  eventos: EventoAoVivo[],
  agoraIso: string
): ColunaTrabalho[] {
  const hoje = diaLocal(agoraIso)
  const agoraMs = new Date(agoraIso).getTime()

  const cartoes: { coluna: ColunaTrabalhoId; cartao: CartaoTrabalho }[] = agentes.map((agente) => {
    const ultimo = ultimoEventoDoAgente(eventos, agente.slug)
    const atividade = agente.ultimaAtividade && (!ultimo || new Date(agente.ultimaAtividade) > new Date(ultimo.ts))
      ? agente.ultimaAtividade : ultimo?.ts ?? null
    let coluna: ColunaTrabalhoId
    if (ultimo && aprovacaoPendente(eventos, ultimo)) {
      coluna = "aguardando_aprovacao"
    } else if (ultimo && ["agente_concluiu", "registrado"].includes(ultimo.tipo) && diaLocal(ultimo.ts) === hoje) {
      coluna = "concluido_hoje"
    } else {
      const diffMin = atividade
        ? (agoraMs - new Date(atividade).getTime()) / 60_000
        : Number.POSITIVE_INFINITY
      coluna = diffMin <= LIMITE_ESPERA_MIN ? "trabalhando" : "esperando"
    }
    return {
      coluna,
      cartao: {
        agente: agente.slug,
        apelido: agente.nome,
        familia: ultimo?.familia ?? null,
        modelo: ultimo?.modelo ?? null,
        tarefa: agente.tarefaAtual ?? ultimo?.resumo ?? null,
        desde: atividade,
        pecas: agente.ultimasPecas,
      },
    }
  })

  // Um evento pode trazer um nome de turno que não é um arquivo canônico em agents/*.md
  // (por exemplo, `grok-build`). Mantém esse trabalho visível como alias, sem fabricar um
  // agente permanente nem substituir o cartão do agente oficial.
  const agentesCanonicos = new Set(agentes.map((agente) => agente.slug))
  const ultimosAliases = new Map<string, EventoAoVivo>()
  for (const evento of eventos) {
    if (!evento.agente || agentesCanonicos.has(evento.agente)) continue
    const anterior = ultimosAliases.get(evento.agente)
    if (!anterior || evento.ts >= anterior.ts) ultimosAliases.set(evento.agente, evento)
  }
  for (const [alias, ultimo] of Array.from(ultimosAliases.entries())) {
    const concluido = ["agente_concluiu", "registrado"].includes(ultimo.tipo) && diaLocal(ultimo.ts) === hoje
    const recente = agoraMs - new Date(ultimo.ts).getTime() <= LIMITE_ESPERA_MIN * 60_000
    if (diaLocal(ultimo.ts) !== hoje && !recente) continue
    const coluna = aprovacaoPendente(eventos, ultimo)
      ? "aguardando_aprovacao"
      : concluido ? "concluido_hoje" : recente ? "trabalhando" : "esperando"
    cartoes.push({
      coluna,
      cartao: {
        agente: alias,
        apelido: `Alias ${alias}`,
        familia: ultimo.familia ?? null,
        modelo: ultimo.modelo ?? null,
        tarefa: ultimo.resumo,
        desde: ultimo.ts,
        pecas: [],
      },
    })
  }

  // Um turno direto da CLI não é um dos agentes ct-*. Mostra a atividade do
  // terminal por família sem atribuí-la a um agente que não participou dela.
  const terminais = new Map<string, EventoAoVivo>()
  for (const evento of eventos) {
    if (evento.agente || evento.origem !== "terminal" || !evento.familia) continue
    const anterior = terminais.get(evento.familia)
    if (!anterior || evento.ts >= anterior.ts) terminais.set(evento.familia, evento)
  }
  for (const [familia, evento] of Array.from(terminais.entries())) {
    if (diaLocal(evento.ts) !== hoje) continue
    const concluido = ["registrado", "agente_concluiu"].includes(evento.tipo)
    const recente = agoraMs - new Date(evento.ts).getTime() <= LIMITE_ESPERA_MIN * 60_000
    cartoes.push({
      coluna: concluido ? "concluido_hoje" : recente ? "trabalhando" : "esperando",
      cartao: {
        agente: `terminal-${familia}`,
        apelido: `Terminal ${familia === "codex" ? "Codex" : familia === "claude" ? "Claude" : familia === "grok" ? "Grok" : "Kimi"}`,
        familia: evento.familia ?? null,
        modelo: evento.modelo ?? null,
        tarefa: evento.resumo,
        desde: evento.ts,
        pecas: [],
      },
    })
  }

  return ORDEM_COLUNAS.map((id) => ({
    id,
    agentes: cartoes
      .filter((c) => c.coluna === id)
      .map((c) => c.cartao)
      .sort((a, b) => a.apelido.localeCompare(b.apelido)),
  }))
}
