"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function Header() {
  const router = useRouter()
  const [nomeCliente, setNomeCliente] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch("/api/sala/cliente")
      .then((res) => (res.ok ? res.json() : null))
      .then((dados) => {
        if (!cancelado && dados?.nome) setNomeCliente(dados.nome)
      })
      .catch(() => {
        // rota ainda pode não existir (outra batelada em andamento); cabeçalho tolera
      })
    return () => {
      cancelado = true
    }
  }, [])

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="flex h-11 items-center justify-between border-b border-border bg-background px-5">
      <div className="flex items-center gap-3.5 truncate">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-md border border-accent bg-surface" aria-hidden="true" />
          <span className="text-[13px] font-semibold tracking-tight text-text-primary">Content Team AI</span>
        </div>
        {nomeCliente && (
          <>
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="flex items-center gap-1.5 truncate text-xs">
              <span className="text-text-secondary">Cliente ativo</span>
              <span className="truncate font-medium text-text-primary">{nomeCliente}</span>
            </span>
          </>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        title="Sair"
      >
        <LogOut size={14} />
        Sair
      </button>
    </header>
  )
}
