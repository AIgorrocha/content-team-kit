"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { EscolhaCliente, type ClienteAtivo } from "./EscolhaCliente"
import { AssistenteBlocos } from "./AssistenteBlocos"
import { EntrevistaInicio } from "./EntrevistaInicio"
import { MarcaCliente } from "./MarcaCliente"
import { IntegracoesInicio } from "./IntegracoesInicio"
import { Cofre } from "@/components/sala/config/Cofre"

interface InicioClienteProps {
  clienteInicial: ClienteAtivo
}

// Página Início (Batelada B1): escolha do cliente ativo + assistente de onboarding do
// cliente escolhido. Trocar de cliente troca a `key` do AssistenteBlocos, remontando-o
// pra recarregar os blocos do novo cliente.
export function InicioCliente({ clienteInicial }: InicioClienteProps) {
  const router = useRouter()
  const [cliente, setCliente] = useState(clienteInicial)
  const trocaEmAndamento = useRef(false)

  async function trocarCliente(slug: string) {
    if (trocaEmAndamento.current) return
    trocaEmAndamento.current = true
    try {
      const resp = await fetch("/api/sala/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ slug }),
      })
      if (!resp.ok) return
      const novo = (await resp.json()) as ClienteAtivo
      setCliente(novo)
      router.refresh()
    } finally {
      trocaEmAndamento.current = false
    }
  }

  return (
    <div className="space-y-4">
      <EscolhaCliente cliente={cliente} onEscolher={trocarCliente} />
      <MarcaCliente key={`marca-${cliente.slug}`} cliente={cliente.slug} />
      <EntrevistaInicio key={`entrevista-${cliente.slug}`} cliente={cliente.slug} />
      <IntegracoesInicio key={`integracoes-${cliente.slug}`} cliente={cliente.slug} />
      <Cofre key={`cofre-${cliente.slug}`} cliente={cliente.slug} />
      <details className="rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-text-primary">Conferir os dados pelo formulário</summary>
        <div className="mt-4"><AssistenteBlocos key={cliente.slug} /></div>
      </details>
    </div>
  )
}
