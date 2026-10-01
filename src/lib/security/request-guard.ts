// Defesa comum das rotas /api/*: bloqueia pedido de outro site (CSRF), nome de host
// estranho (DNS rebinding) e comparação de segredo vulnerável a medição de tempo.
import { timingSafeEqual } from "node:crypto"

const LOCAIS = ["localhost", "127.0.0.1", "::1"]
const LEITURA = ["GET", "HEAD", "OPTIONS"]
// Kit local: sempre confere o Host. (Na matriz isto fica true: em produção sem nenhum host configurado, só confere mesma origem.)
const LIBERAR_HOST_SEM_LISTA = false
const TIPOS_CORPO = ["application/json", "multipart/form-data"]

function semColchetes(h: string): string {
  return h.replace(/^\[|\]$/g, "")
}

function paraUrl(valor: string): URL | null {
  try {
    return new URL(valor.includes("://") ? valor : `http://${valor}`)
  } catch {
    return null
  }
}

// Hosts públicos configurados pelo dono: URL do painel, URL da Sala e ALLOWED_HOSTS (lista por vírgula).
// Guarda "host" (com porta, se houver) e "hostname" (sem porta).
function configurados(env: NodeJS.ProcessEnv = process.env): { host: string; hostname: string }[] {
  const brutos = [env.NEXT_PUBLIC_APP_URL, env.SALA_URL, ...(env.ALLOWED_HOSTS ?? "").split(",")]
  const saida: { host: string; hostname: string }[] = []
  for (const bruto of brutos) {
    const u = bruto?.trim() ? paraUrl(bruto.trim()) : null
    if (u) saida.push({ host: u.host.toLowerCase(), hostname: semColchetes(u.hostname).toLowerCase() })
  }
  return saida
}

export function hostPermitido(hostHeader: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const u = paraUrl(hostHeader.trim())
  if (!u) return false
  const nome = semColchetes(u.hostname).toLowerCase()
  return LOCAIS.includes(nome) || configurados(env).some((c) => c.hostname === nome)
}

export function origemPermitida(
  origin: string,
  hostHeader: string,
  forwardedHost: string | null,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const o = paraUrl(origin)
  if (!o || origin === "null") return false
  const h = o.host.toLowerCase()
  if (h === hostHeader.toLowerCase() || (forwardedHost && h === forwardedHost.toLowerCase())) return true
  const nome = semColchetes(o.hostname).toLowerCase()
  return configurados(env).some((c) => (c.host === h || c.hostname === nome) && !LOCAIS.includes(c.hostname))
}

export interface Recusa {
  status: number
  error: string
}

/** Devolve a recusa (403/415) ou null se o pedido pode seguir. */
export function checarPedido(req: Request, env: NodeJS.ProcessEnv = process.env): Recusa | null {
  const hostHeader = req.headers.get("host") ?? new URL(req.url).host
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || null
  const semLista = LIBERAR_HOST_SEM_LISTA && env.NODE_ENV === "production" && configurados(env).length === 0
  if (!semLista && !hostPermitido(hostHeader, env)) return { status: 403, error: "Host não permitido" }

  if (LEITURA.includes(req.method)) return null

  const origin = req.headers.get("origin")
  if (origin && !origemPermitida(origin, hostHeader, forwarded, env)) return { status: 403, error: "Origem não permitida" }
  if (req.headers.get("sec-fetch-site") === "cross-site") return { status: 403, error: "Origem não permitida" }

  const temCorpo = Number(req.headers.get("content-length") ?? 0) > 0 || req.headers.has("transfer-encoding")
  if (temCorpo) {
    const tipo = (req.headers.get("content-type") ?? "").toLowerCase()
    if (!TIPOS_CORPO.some((t) => tipo.startsWith(t))) return { status: 415, error: "Content-Type não suportado" }
  }
  return null
}

/** Comparação de segredo em tempo constante. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
