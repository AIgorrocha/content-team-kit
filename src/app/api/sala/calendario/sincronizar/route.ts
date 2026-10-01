import { NextRequest, NextResponse } from "next/server"
import { execFile } from "node:child_process"
import path from "node:path"
import { authCheck } from "@/lib/sala/auth"
import { clienteAtivoSlug } from "@/lib/sala/cliente"

// Sincroniza ct_publications com as redes de verdade (Batelada B6): roda o script
// scripts/sala/sync-publicacoes.mjs como processo filho, sempre pro cliente ativo da Sala.
// O script nunca imprime token; o stdout termina numa linha JSON { porRede, avisos } que
// esta rota repassa pro front.
export async function POST(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  const cliente = await clienteAtivoSlug()
  const scriptPath = path.join(process.cwd(), "scripts", "sala", "sync-publicacoes.mjs")

  try {
    const resultado = await new Promise<{
      porRede: Record<string, number>
      via?: Record<string, "api" | "navegador">
      avisos: string[]
    }>((resolve, reject) => {
      execFile(
        process.execPath,
        [scriptPath, "--cliente", cliente, "--dias", "30", "--rede", "todas"],
        { cwd: process.cwd(), timeout: 120000, env: process.env },
        (err, stdout) => {
          if (err) return reject(new Error("falha ao rodar a sincronizacao"))
          const linha = stdout.trim().split("\n").pop() ?? "{}"
          try {
            resolve(JSON.parse(linha))
          } catch {
            reject(new Error("saida inesperada da sincronizacao"))
          }
        }
      )
    })
    return NextResponse.json(resultado)
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
