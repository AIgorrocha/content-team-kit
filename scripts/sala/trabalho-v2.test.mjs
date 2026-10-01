import test from "node:test"
import assert from "node:assert/strict"
import { construirColunasTrabalho } from "../../src/lib/sala/fontes/trabalho.ts"
import { agruparCartoesTrabalho } from "../../src/components/sala/trabalho/grupos.ts"

const agora = "2026-09-13T14:00:00Z"
const evento = { id: "1", ts: agora, caixa: 1, tipo: "pedido", agente: null, peca: null, ferramenta: null, resumo: "pedido recebido", origem: "terminal", familia: "claude", modelo: null }
const agente = { slug: "ct-redator", nome: "Redator", ultimaAtividade: null, tarefaAtual: null, ultimasPecas: [] }

test("atividade atual do agente prevalece sobre evento histórico", () => {
  const colunas = construirColunasTrabalho([{ ...agente, ultimaAtividade: agora }], [{ ...evento, agente: agente.slug, ts: "2026-09-12T10:00:00Z" }], agora)
  assert.equal(colunas.find(c => c.id === "trabalhando").agentes[0].desde, agora)
})

test("terminal sem ct-* aparece e o fim do turno conclui o cartão", () => {
  const inicio = construirColunasTrabalho([], [evento], agora)
  assert.equal(inicio.find(c => c.id === "trabalhando").agentes[0].agente, "terminal-claude")
  const fim = construirColunasTrabalho([], [evento, { ...evento, id: "2", tipo: "registrado" }], agora)
  assert.equal(fim.find(c => c.id === "concluido_hoje").agentes.length, 1)
  assert.equal(fim.find(c => c.id === "trabalhando").agentes.length, 0)
})

test("evento do agente move o cartão mesmo sem last_active_at e notify conclui", () => {
  const inicio = construirColunasTrabalho([agente], [{ ...evento, agente: agente.slug, tipo: "agente_iniciou" }], agora)
  assert.equal(inicio.find(c => c.id === "trabalhando").agentes[0].tarefa, "pedido recebido")
  const fim = construirColunasTrabalho([agente], [{ ...evento, agente: agente.slug, tipo: "registrado", familia: "codex" }], agora)
  assert.equal(fim.find(c => c.id === "concluido_hoje").agentes[0].familia, "codex")
})

test("terminal antigo não reaparece e aprovação sem resposta fica pendente", () => {
  assert.equal(construirColunasTrabalho([], [{ ...evento, ts: "2026-09-12T10:00:00Z" }], agora).flatMap(c => c.agentes).length, 0)
  const colunas = construirColunasTrabalho([agente], [{ ...evento, agente: agente.slug, peca: "exemplo", tipo: "aprovacao_pedida" }], agora)
  assert.equal(colunas.find(c => c.id === "aguardando_aprovacao").agentes.length, 1)
})

test("alias ativo aparece no quadro sem virar agente canônico", () => {
  const alias = { ...evento, id: "alias-1", agente: "grok-build", familia: "grok", tipo: "agente_iniciou", resumo: "revisão em andamento" }
  const colunas = construirColunasTrabalho([], [alias], agora)
  const cartao = colunas.flatMap(c => c.agentes).find(c => c.agente === "grok-build")
  assert.equal(cartao?.apelido, "Alias grok-build")
  assert.equal(colunas.find(c => c.id === "trabalhando").agentes.includes(cartao), true)
})

test("quadro agrupa Ads e bridges sem perder alias", () => {
  const base = { familia: null, modelo: null, tarefa: null, desde: null, pecas: [] }
  const cartoes = [
    ...["ct-ads-audit", "ct-ads-conversion-audit", "ct-ads-creative-audit", "ct-ads-budget-audit", "ct-ads-account-structure-audit"].map(agente => ({ ...base, agente, apelido: agente })),
    ...["ct-video-higgsfield", "ct-video-remotion", "ct-video-mpt", "ct-video-hypit", "ct-video-editor"].map(agente => ({ ...base, agente, apelido: agente })),
    { ...base, agente: "grok-build", apelido: "Alias grok-build" },
  ]
  const grupos = agruparCartoesTrabalho(cartoes)
  assert.equal(grupos.find(g => g.id === "anuncios").cartoes.length, 5)
  assert.equal(grupos.find(g => g.id === "integracoes").cartoes.length, 5)
  assert.equal(grupos.find(g => g.id === "aliases").cartoes[0].agente, "grok-build")
})
