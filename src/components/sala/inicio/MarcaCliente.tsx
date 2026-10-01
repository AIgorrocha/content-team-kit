"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function MarcaCliente({ cliente }: { cliente: string }) {
  const [marca, setMarca] = useState<{ url: string | null; hash?: string } | null>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [mensagem, setMensagem] = useState("")
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    const controle = new AbortController()
    fetch(`/api/sala/marca?cliente=${encodeURIComponent(cliente)}`, { cache: "no-store", signal: controle.signal }).then(async r => {
      if (!r.ok) throw new Error()
      setMarca(await r.json())
    }).catch(() => { if (!controle.signal.aborted) setMensagem("Não foi possível carregar a marca.") })
    return () => controle.abort()
  }, [cliente])

  async function salvar() {
    if (!arquivo || !marca?.hash) return
    setOcupado(true)
    setMensagem("")
    try {
      const corpo = new FormData()
      corpo.set("cliente", cliente); corpo.set("hash", marca.hash); corpo.set("arquivo", arquivo)
      const resp = await fetch("/api/sala/marca", { method: "POST", body: corpo })
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro)
      setMarca(dados); setArquivo(null); setMensagem("Marca salva. Ela continuará aqui quando você voltar.")
      window.dispatchEvent(new Event("sala-onboarding-atualizado"))
    } catch (e) { setMensagem(e instanceof Error ? e.message : "Não foi possível salvar.") }
    finally { setOcupado(false) }
  }

  return <section className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-surface p-4" data-testid="inicio-marca">
    {marca?.url ? <img src={marca.url} alt="Logo ou avatar cadastrado da marca" className="h-20 w-20 rounded-md border border-border bg-surface-hover object-contain" /> : <div className="flex h-20 w-20 items-center justify-center rounded-md bg-surface-hover p-2 text-center text-xs text-text-secondary">{marca ? "Sem imagem" : "Carregando"}</div>}
    <div className="min-w-0 flex-1 space-y-2">
      <h2 className="font-semibold text-text-primary">Logo e identidade</h2>
      <p className="text-sm text-text-secondary">Esta é a imagem cadastrada nos dados da marca. Para trocar, escolha PNG, JPG ou WebP de até 2 MB.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Escolher logo ou avatar" type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} className="max-w-full text-sm" onChange={e => { setArquivo(e.target.files?.[0] ?? null); setMensagem("") }} />
        <Button size="sm" variant="outline" disabled={!arquivo || !marca?.hash || ocupado} onClick={salvar}>{ocupado ? "Salvando..." : "Salvar imagem da marca"}</Button>
      </div>
      {mensagem && <p role="status" className="text-sm text-text-secondary">{mensagem}</p>}
    </div>
  </section>
}
