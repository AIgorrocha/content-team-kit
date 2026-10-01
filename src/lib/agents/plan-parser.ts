import { SUB_AGENT_SLUGS, type SubAgentSlug } from "./prompt-builder"

export interface DirectorPlanStep {
  agent: SubAgentSlug
  prompt: string
  reason: string
}

export interface DirectorPlan {
  reasoning: string
  steps: DirectorPlanStep[]
  final_agent: SubAgentSlug
}

const MAX_STEPS = 5
const VALID_SLUGS = new Set<string>(SUB_AGENT_SLUGS)

function extractJsonBlock(raw: string): string | null {
  // Try to find ```json ... ``` or ``` ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // Try to find first { ... } block (greedy but matches outermost)
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }

  return null
}

function validatePlan(obj: unknown): DirectorPlan | null {
  if (!obj || typeof obj !== "object") return null
  const plan = obj as Record<string, unknown>

  const reasoning = typeof plan.reasoning === "string" ? plan.reasoning : ""
  const stepsRaw = plan.steps
  const finalAgent = plan.final_agent

  if (!Array.isArray(stepsRaw)) return null
  if (stepsRaw.length < 1 || stepsRaw.length > MAX_STEPS) return null
  if (typeof finalAgent !== "string") return null
  if (!VALID_SLUGS.has(finalAgent)) return null

  const steps: DirectorPlanStep[] = []
  for (const s of stepsRaw) {
    if (!s || typeof s !== "object") return null
    const step = s as Record<string, unknown>
    if (typeof step.agent !== "string" || !VALID_SLUGS.has(step.agent)) return null
    if (typeof step.prompt !== "string" || !step.prompt.trim()) return null
    steps.push({
      agent: step.agent as SubAgentSlug,
      prompt: step.prompt.trim(),
      reason: typeof step.reason === "string" ? step.reason : "",
    })
  }

  // final_agent must be present in steps
  if (!steps.some((s) => s.agent === finalAgent)) return null

  return {
    reasoning,
    steps,
    final_agent: finalAgent as SubAgentSlug,
  }
}

/**
 * Tenta parsear o plano JSON do ct-diretor. Retorna null se não conseguir.
 */
export function parseDirectorPlan(rawOutput: string): DirectorPlan | null {
  if (!rawOutput || !rawOutput.trim()) return null

  // Attempt 1: parse raw as-is
  try {
    const obj = JSON.parse(rawOutput.trim())
    const plan = validatePlan(obj)
    if (plan) return plan
  } catch {
    // fall through
  }

  // Attempt 2: extract JSON block
  const block = extractJsonBlock(rawOutput)
  if (!block) return null
  try {
    const obj = JSON.parse(block)
    return validatePlan(obj)
  } catch {
    return null
  }
}

/**
 * Fallback plan: single ct-redator step, used when parsing fails.
 */
export function buildFallbackPlan(userRequest: string): DirectorPlan {
  return {
    reasoning: "Fallback: diretor não devolveu JSON válido, rodando ct-redator direto.",
    steps: [
      {
        agent: "ct-redator",
        prompt: userRequest,
        reason: "Fallback pra garantir uma resposta",
      },
    ],
    final_agent: "ct-redator",
  }
}
