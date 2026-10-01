"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ListaRegras } from "@/components/sala/padroes/ListaRegras"
import { EditorRegra, type ResultadoSalvarRegra } from "@/components/sala/padroes/EditorRegra"
import type { Regra, Selo } from "@/lib/sala/types"

interface SecaoRegrasProps {
  regrasIniciais: Regra[]
}

// Seção final de /sala/redes (Batelada B5): lista única de regras com selo, editável do
// mesmo jeito que a antiga aba de /sala/padroes (mesma chamada de API, mesmo diálogo de
// edição com detecção de conflito 409), só que sem as abas por tipo de conteúdo.
export function SecaoRegras({ regrasIniciais }: SecaoRegrasProps) {
  const [regras, setRegras] = useState(regrasIniciais)
  const [regraEditando, setRegraEditando] = useState<Regra | null>(null)

  async function salvar(id: string, texto: string, selo: Selo, baseHash: string): Promise<ResultadoSalvarRegra> {
    try {
      const resp = await fetch(`/api/sala/regras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, selo, baseHash }),
      })
      const dados = await resp.json()
      if (resp.status === 409) {
        return { ok: false, conflito: { atual: dados.atual, hashAtual: dados.hashAtual }, erro: dados.erro }
      }
      if (!resp.ok) {
        return { ok: false, erro: dados.erro ?? "erro ao salvar a regra" }
      }
      const regraSalva = dados.regra as Regra
      setRegras((atual) => atual.map((r) => (r.id === regraSalva.id ? regraSalva : r)))
      setRegraEditando((atual) => (atual && atual.id === regraSalva.id ? regraSalva : atual))
      return { ok: true, regra: regraSalva }
    } catch {
      return { ok: false, erro: "falha de rede ao salvar a regra" }
    }
  }

  async function marcarComoFixa(regra: Regra) {
    await salvar(regra.id, regra.texto, "FIXA", regra.hash)
  }

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Regras</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ListaRegras titulo="Todas as regras" regras={regras} onEditar={setRegraEditando} onMarcarFixa={marcarComoFixa} />
      </CardContent>
      <EditorRegra regra={regraEditando} onFechar={() => setRegraEditando(null)} onSalvar={salvar} />
    </Card>
  )
}
