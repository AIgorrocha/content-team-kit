// Entrega assets da Sala por um ID opaco. Nunca expõe caminho do disco.
import { NextRequest, NextResponse } from "next/server"
import { createReadStream, existsSync, lstatSync, realpathSync, statSync } from "node:fs"
import { extname, relative, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { authCheck } from "@/lib/sala/auth"
import { ROOT, resolverAsset, resolverClienteAtivo } from "@/lib/sala/fontes"

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".html": "text/html; charset=utf-8",
}

function erro404() { return NextResponse.json({ erro: "arquivo não encontrado" }, { status: 404 }) }

function dentroDaRaizReal(caminho: string, cliente: string): boolean {
  try {
    let componente = ROOT
    const partes = relative(ROOT, caminho).split(sep)
    if (partes.includes("..")) return false
    for (const parte of partes) {
      componente = resolve(componente, parte)
      if (lstatSync(componente).isSymbolicLink()) return false
    }
    const real = realpathSync(caminho)
    const raizes = [resolve(ROOT, "content", cliente), resolve(ROOT, "public", "sala-mock")]
      .filter(existsSync)
      .map((raiz) => `${realpathSync(raiz)}${sep}`)
    return raizes.some((raiz) => real.startsWith(raiz))
  } catch {
    return false
  }
}

function parseRange(valor: string, tamanho: number): { inicio: number; fim: number } | null {
  // Só uma faixa é suportada. Sufixo e faixa aberta seguem RFC 9110.
  const match = /^bytes=(\d*)-(\d*)$/.exec(valor)
  if (!match || (!match[1] && !match[2])) return null
  let inicio: number
  let fim: number
  if (!match[1]) {
    const sufixo = Number(match[2])
    if (!Number.isSafeInteger(sufixo) || sufixo <= 0) return null
    inicio = Math.max(0, tamanho - sufixo)
    fim = tamanho - 1
  } else {
    inicio = Number(match[1])
    fim = match[2] ? Math.min(Number(match[2]), tamanho - 1) : tamanho - 1
  }
  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) || inicio < 0 || inicio > fim || inicio >= tamanho) return null
  return { inicio, fim }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })
  if (!/^[a-f0-9]{40}$/i.test(params.id)) return erro404()

  const cliente = await resolverClienteAtivo()
  const caminho = resolverAsset(cliente, params.id)
  if (!caminho || !existsSync(caminho) || !dentroDaRaizReal(caminho, cliente)) return erro404()

  let stats: ReturnType<typeof statSync>
  try { stats = statSync(caminho) } catch { return erro404() }
  if (!stats.isFile()) return erro404()
  const ext = extname(caminho).toLowerCase()
  const contentType = MIME[ext]
  if (!contentType) return erro404()

  const cabecalhos: Record<string, string> = { "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" }
  if (ext === ".html") {
    cabecalhos["Content-Security-Policy"] = "sandbox"
    cabecalhos["X-Frame-Options"] = "SAMEORIGIN"
  }
  const range = ext === ".mp4" ? req.headers.get("range") : null
  if (range) {
    const faixa = parseRange(range, stats.size)
    if (!faixa) return new NextResponse(null, { status: 416, headers: { ...cabecalhos, "Content-Range": `bytes */${stats.size}`, "Accept-Ranges": "bytes" } })
    const stream = createReadStream(caminho, { start: faixa.inicio, end: faixa.fim })
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: 206, headers: { ...cabecalhos, "Content-Type": contentType, "Content-Range": `bytes ${faixa.inicio}-${faixa.fim}/${stats.size}`, "Accept-Ranges": "bytes", "Content-Length": String(faixa.fim - faixa.inicio + 1) } })
  }
  const stream = createReadStream(caminho)
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: 200, headers: { ...cabecalhos, "Content-Type": contentType, "Accept-Ranges": ext === ".mp4" ? "bytes" : "none", "Content-Length": String(stats.size) } })
}
