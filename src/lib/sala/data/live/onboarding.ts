// Onboarding no provedor live (Tarefas A3 e bugfix "Gravar bloco"): os 8 blocos são
// conteúdo do framework (fontes/onboarding), sempre os mesmos; as respostas gravadas moram
// dentro do próprio arquivoDestino do cliente (brand-profile.md etc.), numa seção delimitada
// por `<!-- sala:bloco:N --> ... <!-- /sala:bloco:N -->` com um bloco ```json``` dentro. Todo
// o resto do arquivo (conteúdo manual, outros blocos) é preservado byte a byte.
import { lerOnboarding, inferirRespostasBloco } from "@/lib/sala/fontes"
import { lerArquivo } from "@/lib/sala/fontes/arquivos"
import { sha256 } from "@/lib/sala/fontes/hash"
import { escreverComHash } from "@/lib/sala/escrita/arquivo"
import type { BlocoOnboarding } from "@/lib/sala/types"

interface PayloadBloco {
  numero: number
  gravado: boolean
  resumo: string | null
  respostas: Record<string, unknown>
}

function regexSecao(numero: number): RegExp {
  return new RegExp(`<!--\\s*sala:bloco:${numero}\\s*-->[\\s\\S]*?<!--\\s*/sala:bloco:${numero}\\s*-->`)
}

// Só o JSON dentro da seção é fonte de verdade; o texto humano ao redor é decorativo.
function extrairPayload(secao: string): PayloadBloco | null {
  const match = secao.match(/```json[^\n]*\n([\s\S]*?)```/)
  if (!match) return null
  try {
    const dados = JSON.parse(match[1])
    if (dados && typeof dados === "object" && typeof dados.respostas === "object") return dados as PayloadBloco
    return null
  } catch {
    return null
  }
}

// Neutraliza sequências que fechariam o marcador antes da hora (espaço de largura zero,
// invisível na renderização), só afeta texto vindo de resposta do usuário.
function neutralizarMarcador(texto: string): string {
  return texto.replace(/<!--/g, "<\u200b!--").replace(/-->/g, "--\u200b>").replace(/`/g, "&#96;")
}

function formatarResposta(resposta: unknown): string {
  if (resposta == null || resposta === "") return "(sem resposta)"
  return neutralizarMarcador(Array.isArray(resposta) ? resposta.join(", ") : String(resposta))
}

function construirSecao(
  numero: number,
  titulo: string,
  perguntas: { id: string; texto: string }[],
  respostas: Record<string, unknown>,
  resumo: string | null
): string {
  const linhasHumanas = perguntas.map((p) => `- ${neutralizarMarcador(p.texto)}: ${formatarResposta(respostas[p.id])}`)
  const payload: PayloadBloco = { numero, gravado: true, resumo, respostas }
  // Escapa < e > (unicode escape) pra que "<!--" e "-->" nunca apareçam literais dentro do
  // JSON: JSON.parse devolve os caracteres originais, a leitura fica estável mesmo se a
  // resposta contiver esses trechos.
  const jsonSeguro = JSON.stringify(payload, null, 2).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/`/g, "\\u0060")
  return [
    `<!-- sala:bloco:${numero} -->`,
    `### Bloco ${numero}: ${titulo}`,
    "",
    ...linhasHumanas,
    "",
    "```json sala-onboarding",
    jsonSeguro,
    "```",
    `<!-- /sala:bloco:${numero} -->`,
  ].join("\n")
}

export async function lerOnboardingLive(cliente: string): Promise<BlocoOnboarding[]> {
  const templates = lerOnboarding(cliente, [])
  return templates.map((template) => {
    const raw = lerArquivo(template.arquivoDestino)
    const secao = raw ? raw.match(regexSecao(template.numero))?.[0] ?? null : null
    const payload = secao ? extrairPayload(secao) : null
    const baseHash = raw ? sha256(raw) : undefined

    if (payload) {
      // Gravado pela Sala: o payload é a fonte de verdade, sem pré-preenchimento.
      const respostas = payload.respostas
      return {
        ...template,
        perguntas: template.perguntas.map((p) => ({
          ...p,
          resposta: (respostas[p.id] as string | string[] | null | undefined) ?? null,
        })),
        resumo: payload.resumo ?? null,
        gravado: payload.gravado ?? false,
        baseHash,
      }
    }

    // Sem payload gravado (Batelada B9, causa raiz 1): pré-preenche a partir dos arquivos
    // manuais do cliente (brand-profile.md, design-system.md, competitors.md), que o cliente
    // real preenche à mão sem nunca passar pelo assistente. "origem: arquivo" avisa a tela que
    // é rascunho pra conferir antes de gravar; gravar continua exigindo o "pode" de sempre.
    const inferidas = inferirRespostasBloco(cliente, template.numero) ?? {}
    const temInferencia = Object.values(inferidas).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))

    return {
      ...template,
      perguntas: template.perguntas.map((p) => ({
        ...p,
        resposta: (inferidas[p.id] as string | string[] | null | undefined) ?? null,
      })),
      resumo: null,
      gravado: false,
      origem: temInferencia ? "arquivo" : undefined,
      baseHash,
    }
  })
}

const HASH_HEX_64 = /^[0-9a-f]{64}$/i

export function gravarBlocoLive(
  cliente: string,
  numero: number,
  respostasEntrada: Record<string, unknown>,
  baseHash: string | undefined
): BlocoOnboarding {
  if (!baseHash || !HASH_HEX_64.test(baseHash)) throw new Error("hash obrigatório: recarregue o onboarding e tente de novo")

  const template = lerOnboarding(cliente, []).find((b) => b.numero === numero)
  if (!template) throw new Error(`bloco ${numero} não encontrado`)

  const permitido = new Map(template.perguntas.map((p) => [p.id, p]))
  let tamanhoTotal = 0
  for (const [chave, valor] of Object.entries(respostasEntrada)) {
    const pergunta = permitido.get(chave)
    if (!pergunta) throw new Error(`chave de resposta desconhecida: "${chave}"`)
    if (valor !== null && typeof valor !== "string" && !Array.isArray(valor)) {
      throw new Error(`resposta inválida para "${chave}": tipo não permitido`)
    }
    if (typeof valor === "string" && valor.length > 10_000) {
      throw new Error(`resposta de "${chave}" excede o limite de 10000 caracteres`)
    }
    if (Array.isArray(valor)) {
      if (valor.length > 500) throw new Error(`resposta de "${chave}" excede o limite de 500 itens`)
      for (const item of valor) {
        if (typeof item !== "string") throw new Error(`resposta de "${chave}" deve conter só texto`)
        if (item.length > 10_000) throw new Error(`item de "${chave}" excede o limite de 10000 caracteres`)
      }
    }
    if (pergunta.tipo === "multipla" && valor != null) {
      const opcoes = pergunta.opcoes ?? []
      for (const v of Array.isArray(valor) ? valor : [valor]) {
        if (!opcoes.includes(v)) throw new Error(`opção inválida para "${chave}": "${v}"`)
      }
    }
    tamanhoTotal += Buffer.byteLength(chave, "utf-8") + Buffer.byteLength(JSON.stringify(valor ?? null), "utf-8")
  }
  if (tamanhoTotal > 64 * 1024) throw new Error("respostas excedem o limite de 64KB")

  const caminho = template.arquivoDestino
  const raw = lerArquivo(caminho)
  if (raw == null) {
    throw new Error(`arquivo "${caminho}" não encontrado, copie o template da instalação (kit) pra esse caminho antes de gravar este bloco`)
  }

  const regex = regexSecao(numero)
  const secaoAtual = raw.match(regex)?.[0] ?? null
  const payloadAtual = secaoAtual ? extrairPayload(secaoAtual) : null
  const respostasFinais: Record<string, unknown> = { ...(payloadAtual?.respostas ?? {}), ...respostasEntrada }
  const resumo = payloadAtual?.resumo ?? template.resumo ?? null

  const novaSecao = construirSecao(numero, template.titulo, template.perguntas, respostasFinais, resumo)
  const novoConteudo = secaoAtual
    ? raw.replace(regex, () => novaSecao)
    : `${raw.replace(/\n+$/, "\n")}\n${novaSecao}\n`

  const novoHash = escreverComHash(caminho, novoConteudo, baseHash)

  return {
    numero: template.numero,
    titulo: template.titulo,
    perguntas: template.perguntas.map((p) => ({
      ...p,
      resposta: (respostasFinais[p.id] as string | string[] | null | undefined) ?? null,
    })),
    resumo,
    gravado: true,
    arquivoDestino: caminho,
    baseHash: novoHash,
  }
}
