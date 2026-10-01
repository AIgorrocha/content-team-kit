"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface CampoCofre { nome: string; rotulo: string; integracao: string; presente: boolean; origem?: "cofre" | "instalacao" | null }

export function Cofre({ cliente }: { cliente: string }) {
  const [campos, setCampos] = useState<CampoCofre[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<Record<string, string>>({})
  const [erroCarga, setErroCarga] = useState("")
  const [origemOAuth, setOrigemOAuth] = useState<string | null>(null)

  useEffect(() => {
    const controle = new AbortController()
    fetch("/api/sala/cofre", { cache: "no-store", signal: controle.signal }).then(async (resposta) => {
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error()
      setCampos(dados.campos)
      setOrigemOAuth(dados.oauthOrigin ?? null)
    }).catch(() => { if (!controle.signal.aborted) setErroCarga("Não foi possível carregar o cofre. Recarregue a página.") })
    return () => controle.abort()
  }, [cliente])

  async function salvar(nome: string) {
    setEstado((anterior) => ({ ...anterior, [nome]: "Salvando" }))
    try {
      const resposta = await fetch("/api/sala/cofre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente, nome, valor: valores[nome] ?? "" }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro ?? "não foi possível salvar")
      setCampos((anterior) => anterior.map((campo) => campo.nome === nome ? { ...campo, presente: true, origem: "cofre" } : campo))
      setValores((anterior) => ({ ...anterior, [nome]: "" }))
      setEstado((anterior) => ({ ...anterior, [nome]: "Salvo" }))
    } catch (erro) {
      setEstado((anterior) => ({ ...anterior, [nome]: erro instanceof Error ? erro.message : "não foi possível salvar" }))
    }
  }

  return (
    <Card className="rounded-md" data-testid="config-cofre">
      <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Cofre de chaves</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <p className="text-sm text-text-secondary">As chaves ficam criptografadas no banco e separadas por cliente. Os valores salvos nunca são exibidos. Preencha somente o que deseja cadastrar ou substituir.</p>
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-text-primary">Endereços de retorno para cadastrar nos aplicativos</summary>
          <p className="my-2 text-xs text-text-secondary">Ao criar o aplicativo de cada rede, copie o endereço correspondente no campo de redirecionamento OAuth.</p>
          {origemOAuth ? ["instagram", "linkedin", "youtube", "meta_ads"].map(rede => <label key={rede} className="mb-2 block text-xs text-text-secondary">{rede}<input readOnly value={`${origemOAuth}/api/sala/oauth/${rede}/callback`} onFocus={e => e.target.select()} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-text-primary" /></label>) : <p className="text-sm text-text-secondary">O endereço de autorização precisa ser configurado na instalação.</p>}
        </details>
        {erroCarga && <p role="alert" className="text-sm text-error">{erroCarga}</p>}
        {!erroCarga && campos.length === 0 && <p role="status" className="text-sm text-text-secondary">Carregando cofre...</p>}
        {campos.map((campo) => (
          <form key={campo.nome} className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(evento) => { evento.preventDefault(); salvar(campo.nome) }}>
            <label className="grid gap-1 text-sm text-text-primary">
              <span>{campo.integracao}: {campo.rotulo}{campo.presente ? campo.origem === "instalacao" ? " (configurado na instalação)" : " (salvo no cofre)" : " (pendente)"}</span>
              <Input type="password" autoComplete="off" maxLength={4096} disabled={estado[campo.nome] === "Salvando"} value={valores[campo.nome] ?? ""} onChange={(evento) => setValores((anterior) => ({ ...anterior, [campo.nome]: evento.target.value }))} />
            </label>
            <div className="flex items-end gap-2"><Button type="submit" size="sm" disabled={!valores[campo.nome]?.trim() || estado[campo.nome] === "Salvando"}>Salvar</Button><span className="text-xs text-text-secondary" aria-live="polite">{estado[campo.nome]}</span></div>
          </form>
        ))}
      </CardContent>
    </Card>
  )
}
