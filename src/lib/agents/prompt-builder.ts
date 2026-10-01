import fs from "fs/promises"
import path from "path"
import pool from "@/lib/db"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export const SUB_AGENT_SLUGS = [
  "ct-redator",
  "ct-carrossel",
  "ct-video",
  "ct-designer",
  "ct-pesquisador",
  "ct-reciclador",
  "ct-email",
  "ct-trafego",
  "ct-agenda",
  "ct-social",
  "ct-otimizador",
  "ct-parcerias",
  "ct-integrador",
] as const

export type SubAgentSlug = (typeof SUB_AGENT_SLUGS)[number]

export const OUTPUT_RULES = `
## REGRAS DE OUTPUT (CRÍTICO)

- Responda SEMPRE em português do Brasil.
- Tom natural, conversacional — como se estivesse falando com um amigo. Zero jargão técnico desnecessário.
- Use reticências (...) para fluidez, NUNCA travessões (—). Travessão parece IA genérica.
- Acentuação sempre correta (não é "nao", é "não").
- Para Instagram: legenda máximo 500 caracteres (compatível com Threads).
- Sem hashtags nas legendas do LinkedIn (2026 a plataforma despriorizou).
- Sempre entregue o output pronto pra publicar. Sem preâmbulo ("Aqui está sua legenda:"), sem despedida ("Espero que goste!").
- Se a entrega tem múltiplas plataformas, separe com cabeçalhos tipo "## Instagram" e "## LinkedIn".
`.trim()

const PROJECT_ROOT = process.cwd()

async function readFileSafe(relPath: string): Promise<string> {
  try {
    return await fs.readFile(path.join(PROJECT_ROOT, relPath), "utf8")
  } catch {
    return ""
  }
}

export async function readAgentFile(slug: string): Promise<string> {
  // Check DB for edited override first
  try {
    const rows = await pool.query<{ prompt_md: string }>(
      `SELECT prompt_md FROM ct_agent_prompts WHERE agent_slug = $1`,
      [slug]
    )
    if (rows.rows.length > 0 && rows.rows[0].prompt_md?.trim()) {
      return rows.rows[0].prompt_md
    }
  } catch {
    // Table might not exist yet or DB unavailable — fall back to file
  }

  const content = await readFileSafe(`agents/${slug}.md`)
  if (!content) throw new Error(`Agente ${slug} não encontrado em agents/${slug}.md`)
  return content
}

async function readClientFileFromDb(clientSlug: string, fileName: string): Promise<string> {
  try {
    const rows = await pool.query<{ content: string }>(
      `SELECT content FROM ct_client_contexts WHERE client_slug = $1 AND file_name = $2 LIMIT 1`,
      [clientSlug, fileName]
    )
    if (rows.rows.length > 0) return rows.rows[0].content
  } catch {
    // DB unavailable or table missing — fall back to filesystem
  }
  // Fallback: try local file (works in dev, not in Vercel runtime)
  return readFileSafe(`clients/${clientSlug}/${fileName}`)
}

export async function readClientContext(clientSlug: string): Promise<{
  brandProfile: string
  designSystem: string
  competitors: string
}> {
  const [brandProfile, designSystem, competitors] = await Promise.all([
    readClientFileFromDb(clientSlug, "brand-profile.md"),
    readClientFileFromDb(clientSlug, "design-system.md"),
    readClientFileFromDb(clientSlug, "competitors.md"),
  ])
  return { brandProfile, designSystem, competitors }
}

function buildClientContextBlock(ctx: {
  brandProfile: string
  designSystem: string
  competitors: string
}): string {
  const parts: string[] = []
  if (ctx.brandProfile) {
    parts.push(`## BRAND PROFILE DO CLIENTE\n\n${ctx.brandProfile}`)
  }
  if (ctx.designSystem) {
    parts.push(`## DESIGN SYSTEM DO CLIENTE\n\n${ctx.designSystem}`)
  }
  if (ctx.competitors) {
    parts.push(`## CONCORRENTES DO CLIENTE\n\n${ctx.competitors}`)
  }
  return parts.join("\n\n")
}

/**
 * Monta messages pro ct-diretor com wrapper JSON (força output estruturado).
 */
export async function buildDirectorMessages(
  clientSlug: string,
  userRequest: string
): Promise<ChatMessage[]> {
  const [diretorMd, clientCtx] = await Promise.all([
    readAgentFile("ct-diretor"),
    readClientContext(clientSlug),
  ])

  const jsonInstructions = `
## INSTRUÇÕES DE OUTPUT (CRÍTICO — só para esta execução)

Você NÃO tem acesso à ferramenta Agent neste contexto. Ao invés de delegar via Agent tool, devolva um PLANO em JSON puro — SEM markdown, SEM blocos de código, SEM explicação antes ou depois — com a lista de agentes a chamar e o prompt específico pra cada um.

Formato exato (respeite os nomes das chaves):

{
  "reasoning": "breve explicação de por que essa sequência foi escolhida",
  "steps": [
    {
      "agent": "ct-pesquisador",
      "prompt": "o que você quer que este agente faça nesta etapa",
      "reason": "por que este agente é necessário"
    },
    {
      "agent": "ct-redator",
      "prompt": "o que escrever, com qual ângulo, quais referências usar",
      "reason": "por que este agente"
    }
  ],
  "final_agent": "ct-redator"
}

Regras do plano:
- Use APENAS agentes desta lista (nunca inclua ct-diretor): ${SUB_AGENT_SLUGS.join(", ")}
- Mínimo 1 step, máximo 5 steps
- "final_agent" deve estar presente em "steps" — é ele que produz o output FINAL que vira conteúdo salvo
- NÃO escreva NADA antes ou depois do JSON — sua resposta inteira tem que ser o JSON puro
- NÃO use crases, blocos markdown ou qualquer envoltório

Se o pedido for simples (ex: "escreve uma legenda"), use só 1 step. Se for complexo (ex: "fazer um post com pesquisa de concorrentes e adaptado pra 3 plataformas"), use múltiplos steps com encadeamento lógico.
`.trim()

  const system = [
    "# PAPEL DO AGENTE DIRETOR",
    "",
    diretorMd,
    "",
    buildClientContextBlock(clientCtx),
    "",
    jsonInstructions,
  ]
    .filter(Boolean)
    .join("\n\n")

  return [
    { role: "system", content: system },
    { role: "user", content: userRequest },
  ]
}

/**
 * Monta messages pra um sub-agente específico, incluindo outputs de steps anteriores como contexto.
 */
export async function buildSubAgentMessages(
  slug: SubAgentSlug,
  clientSlug: string,
  userRequest: string,
  stepPrompt: string,
  priorOutputs: Array<{ agent: string; output: string }>
): Promise<ChatMessage[]> {
  const [agentMd, clientCtx] = await Promise.all([
    readAgentFile(slug),
    readClientContext(clientSlug),
  ])

  const system = [
    "# SUAS INSTRUÇÕES DE AGENTE",
    "",
    agentMd,
    "",
    buildClientContextBlock(clientCtx),
    "",
    OUTPUT_RULES,
  ]
    .filter(Boolean)
    .join("\n\n")

  const priorBlock =
    priorOutputs.length > 0
      ? [
          "## Contexto de agentes anteriores",
          "",
          ...priorOutputs.map(
            (p) =>
              `### ${p.agent} devolveu:\n\n${truncateForContext(p.output, 2000)}`
          ),
        ].join("\n\n")
      : ""

  const user = [
    "## Pedido original do usuário",
    userRequest,
    "",
    "## Tarefa específica nesta etapa (definida pelo Diretor)",
    stepPrompt,
    priorBlock ? `\n${priorBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}

function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n\n[... truncado ...]"
}
