import test from "node:test"
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { parseArgs, detectarFamilia, mapearEvento, mapearEventoGrok } from "./hook-forward.mjs"

// cwd real do repo (tem agents/*.md e clients/*/brand-profile.md): so o suficiente pra
// resolverClienteSeguro e detectarSlugAgente funcionarem, nao dependem de rede nem banco.
const cwd = resolve(import.meta.dirname, "..", "..")

test("parseArgs separa flags conhecidas do argumento posicional (caso Codex)", () => {
  const flags = parseArgs(["--familia", "codex", '{"type":"agent-turn-complete"}'])
  assert.equal(flags.familia, "codex")
  assert.deepEqual(flags.positional, ['{"type":"agent-turn-complete"}'])
})

test("Claude Code: UserPromptSubmit vira pedido na caixa 1", () => {
  const payload = { hook_event_name: "UserPromptSubmit", session_id: "sess-1", cwd }
  assert.equal(detectarFamilia(payload), "claude")
  const evento = mapearEvento(payload, cwd)
  assert.equal(evento.familia, "claude")
  assert.equal(evento.event, "pedido")
  assert.equal(evento.payload.caixa, 1)
  assert.equal(evento.source, "terminal")
})

test("Claude Code: SubagentStart do ct-diretor vira diretor_planejou na caixa 2", () => {
  const payload = {
    hook_event_name: "SubagentStart",
    session_id: "sess-2",
    cwd,
    tool_input: { subagent_type: "ct-diretor", description: "orquestra a peca" },
  }
  const evento = mapearEvento(payload, cwd)
  assert.equal(evento.event, "diretor_planejou")
  assert.equal(evento.agent, "ct-diretor")
  assert.equal(evento.payload.caixa, 2)
})

test("Codex: agent-turn-complete (JSON unico, sem hook_event_name) vira registrado na caixa 6", () => {
  const payload = {
    type: "agent-turn-complete",
    "turn-id": "turno-abc",
    "input-messages": ["revisar o diff da Batelada B7"],
    "last-assistant-message": "revisao concluida, tudo verde",
  }
  assert.equal(detectarFamilia(payload), "codex")
  const evento = mapearEvento(payload, cwd, undefined, "gpt-6-astra")
  assert.equal(evento.familia, "codex")
  assert.equal(evento.modelo, "gpt-6-astra")
  assert.equal(evento.event, "registrado")
  assert.equal(evento.payload.caixa, 6)
  assert.equal(evento.payload.resumo, "turno concluído")
  // nunca persiste o texto real das mensagens, so o resumo fixo
  assert.equal(JSON.stringify(evento).includes("revisar o diff"), false)
  assert.equal(JSON.stringify(evento).includes("revisao concluida"), false)
})

test("Kimi Code: JSON com campo event (sem hook_event_name) e reconhecido por heuristica", () => {
  const payload = { event: "UserPromptSubmit", session_id: "sess-kimi", cwd }
  assert.equal(detectarFamilia(payload), "kimi")
  const evento = mapearEvento(payload, cwd)
  assert.equal(evento.familia, "kimi")
  assert.equal(evento.event, "pedido")
  assert.equal(evento.payload.caixa, 1)
})

test("Kimi Code: SubagentStop reconhece o agente pelo texto, igual ao Claude Code", () => {
  const payload = { event: "SubagentStop", session_id: "sess-kimi-2", cwd, result: "ct-redator finalizou a legenda" }
  const evento = mapearEvento(payload, cwd)
  assert.equal(evento.familia, "kimi")
  assert.equal(evento.event, "agente_concluiu")
  assert.equal(evento.agent, "ct-redator")
})

test("Grok: flags de linha de comando viram cartao na caixa do tipo informado", () => {
  const flags = { evento: "agente_iniciou", agente: "grok-build", tarefa: "revisar diff da Batelada B7", modelo: "grok-4.6" }
  const evento = mapearEventoGrok(flags, cwd)
  assert.equal(evento.familia, "grok")
  assert.equal(evento.modelo, "grok-4.6")
  assert.equal(evento.event, "agente_iniciou")
  assert.equal(evento.agent, "grok-build")
  assert.equal(evento.payload.caixa, 3)
  assert.equal(evento.payload.resumo, "revisar diff da Batelada B7")
})

test("Grok: evento fora da allowlist cai em agente_ferramenta (caixa 3), nunca quebra", () => {
  const evento = mapearEventoGrok({ evento: "tipo-invalido-qualquer" }, cwd)
  assert.equal(evento.event, "agente_ferramenta")
  assert.equal(evento.payload.caixa, 3)
})

test("familia forcada por --familia vence a heuristica de deteccao", () => {
  // payload no formato Claude Code, mas --familia codex forca o outro tratamento (usado
  // quando o notify do Codex nao manda nenhum campo reconhecivel pela heuristica).
  const payload = { hook_event_name: "UserPromptSubmit", session_id: "sess-3", cwd }
  const evento = mapearEvento(payload, cwd, "codex")
  assert.equal(evento.familia, "codex")
  assert.equal(evento.event, "registrado")
  assert.equal(evento.payload.resumo, "evento codex")
})
