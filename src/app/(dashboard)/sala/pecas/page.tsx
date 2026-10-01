"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SalaHeader } from "@/components/sala/SalaHeader"
import { QuadroEtapas } from "@/components/sala/pecas/QuadroEtapas"
import { DetalhePeca } from "@/components/sala/pecas/DetalhePeca"
import type { Peca } from "@/lib/sala/types"

export default function SalaPecasPage() {
  const router = useRouter()
  const [pecas, setPecas] = useState<Peca[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [slugAberto, setSlugAberto] = useState<string | null>(null)

  const carregarQuadro = useCallback(async () => {
    try {
      const resp = await fetch("/api/sala/pecas")
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro ?? "erro ao carregar peças")
      setPecas(dados.pecas as Peca[])
      setErro(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro ao carregar peças")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarQuadro()
  }, [carregarQuadro])

  // Deep link: /sala/pecas?peca=<slug> (ex.: vindo da Trilha) abre o painel de
  // detalhe direto ao carregar. Lido de window.location pra não exigir Suspense
  // (useSearchParams) numa página que já é toda client-side.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("peca")
    if (slug) setSlugAberto(slug)
  }, [])

  function abrirPeca(slug: string) {
    setSlugAberto(slug)
    router.replace(`/sala/pecas?peca=${encodeURIComponent(slug)}`, { scroll: false })
  }

  function fecharPeca() {
    setSlugAberto(null)
    router.replace("/sala/pecas", { scroll: false })
  }

  return (
    <div className="space-y-4">
      <SalaHeader
        titulo="Peças"
        descricao="Veja cada conteúdo, confira a prévia e abra a peça para revisar ou aprovar."
      />
      {erro && <p className="text-sm text-error">{erro}</p>}
      {carregando ? (
        <p className="text-sm text-text-secondary">Carregando peças...</p>
      ) : (
        <QuadroEtapas pecas={pecas} onAbrir={abrirPeca} />
      )}
      <DetalhePeca
        slug={slugAberto}
        onFechar={fecharPeca}
        onPecaMudou={(pecaAtualizada) => {
          setPecas((atual) => atual.map((p) => (p.slug === pecaAtualizada.slug ? pecaAtualizada : p)))
        }}
      />
    </div>
  )
}
