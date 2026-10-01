import { z } from "zod"
import type { BlocoOnboarding } from "./types"

export function validarMensagemEntrevista(valor: unknown): string {
  const texto = z.string().trim().min(1).max(6000).parse(valor)
  if (/(?:\b(?:senha|password|token|api[_ -]?key|chave(?: secreta)?)\s*(?:[:=]|[eé])\s*\S+|\bsk-[\w-]{12,}|\b(?:gh[pousr]_|github_pat_|xox[baprs]-|AIza|AKIA)[\w-]{12,}|\bBearer\s+\S+|-----BEGIN .*PRIVATE KEY|\beyJ[\w-]+\.[\w-]+\.[\w-]+)/i.test(texto)) {
    throw new Error("Use o cofre de chaves para credenciais. Remova o segredo da mensagem antes de enviar.")
  }
  return texto
}

const resposta = z.union([z.string().max(10000), z.array(z.string().max(1000)).max(500), z.null()])
export function validarPropostaEntrevista(valor: unknown, bloco: BlocoOnboarding) {
  const proposta = z.object({ mensagem: z.string().min(1).max(3000), respostas: z.record(resposta) }).strict().parse(valor)
  for (const [id, valor] of Object.entries(proposta.respostas)) {
    const pergunta = bloco.perguntas.find(p => p.id === id)
    if (!pergunta || pergunta.tipo === "arquivo") throw new Error("Campo não permitido na entrevista")
    if (valor !== null && pergunta.tipo === "texto" && typeof valor !== "string") throw new Error("Resposta textual inválida")
    if (valor !== null && pergunta.tipo === "lista" && !Array.isArray(valor)) throw new Error("Lista de respostas inválida")
    if (pergunta.tipo === "multipla" && valor !== null) {
      for (const item of Array.isArray(valor) ? valor : [valor]) {
        if (!pergunta.opcoes?.includes(item)) throw new Error("Opção inválida")
      }
    }
    if (valor !== null && (Array.isArray(valor) ? valor.length : valor.trim())) validarMensagemEntrevista(Array.isArray(valor) ? valor.join("\n") : valor)
  }
  validarMensagemEntrevista(proposta.mensagem)
  return proposta
}
