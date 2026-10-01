// Proteção contra SSRF: só deixa buscar URL pública (http/https), nunca rede interna.
import { BlockList, isIP } from "node:net"
import { lookup } from "node:dns/promises"

const bloqueio = new BlockList()
for (const [rede, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) bloqueio.addSubnet(rede, bits, "ipv4")
for (const [rede, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96]] as const) {
  bloqueio.addSubnet(rede, bits, "ipv6")
}

export function ipBloqueado(ip: string): boolean {
  const v = isIP(ip)
  if (!v) return true
  // IPv4 embutido em IPv6 (::ffff:a.b.c.d) vale pelas regras do IPv4
  const mapeado = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapeado) return bloqueio.check(mapeado[1], "ipv4")
  return bloqueio.check(ip, v === 4 ? "ipv4" : "ipv6")
}

/** Lança erro se a URL não for http(s) público. `permitirHosts`: hosts conhecidos e confiáveis (ex.: o Supabase do dono). */
export async function assertPublicUrl(url: string, permitirHosts: string[] = []): Promise<URL> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error("URL inválida")
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Só http e https são permitidos")
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase()
  if (permitirHosts.map((h) => h.toLowerCase()).includes(host)) return u
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("Endereço não permitido")
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address)
  if (ips.length === 0 || ips.some(ipBloqueado)) throw new Error("Endereço não permitido")
  return u
}

/** fetch que confere cada salto de redirect (o fetch normal seguiria para a rede interna sem avisar). */
export async function fetchPublic(url: string, init: RequestInit = {}, permitirHosts: string[] = []): Promise<Response> {
  let atual = url
  for (let salto = 0; salto < 5; salto++) {
    const alvo = await assertPublicUrl(atual, permitirHosts)
    const res = await fetch(alvo, { ...init, redirect: "manual" })
    const destino = res.headers.get("location")
    if (res.status < 300 || res.status >= 400 || !destino) return res
    atual = new URL(destino, alvo).toString()
  }
  throw new Error("Redirecionamentos demais")
}
