"use client"

import { useState } from "react"
import { Database, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Configuracao } from "@/lib/sala/types"

// Nunca exibe a URL completa: só o esquema e o domínio final, o resto vira "xxxx".
function mascarar(url: string): string {
  try {
    const u = new URL(url)
    const partes = u.hostname.split(".")
    const dominio = partes.length > 1 ? partes.slice(-2).join(".") : u.hostname
    return `${u.protocol}//xxxx…${dominio}`
  } catch {
    return url
  }
}

interface BancoProps {
  banco: Configuracao["banco"]
}

export function Banco({ banco: bancoInicial }: BancoProps) {
  const [banco, setBanco] = useState(bancoInicial)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(modo: "local" | "nuvem") {
    if (modo === banco.modo || carregando) return
    setCarregando(true)
    setErro(null)
    try {
      const resp = await fetch("/api/sala/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parte: "banco", valor: { ...banco, modo } }),
      })
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro ?? "erro ao trocar o modo do banco")
      setBanco(dados.configuracao.banco)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro desconhecido")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Card className="rounded-md" data-testid="config-banco">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          Banco de dados
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex gap-2" role="group" aria-label="Modo do banco">
          {(["local", "nuvem"] as const).map((modo) => (
            <Button
              key={modo}
              size="sm"
              variant={banco.modo === modo ? "default" : "outline"}
              onClick={() => alternar(modo)}
              disabled={carregando || banco.editavel === false}
              aria-pressed={banco.modo === modo}
            >
              {modo === "local" ? "Local" : "Nuvem"}
            </Button>
          ))}
        </div>
        {banco.editavel === false && <p className="text-xs text-text-secondary">A troca de banco é feita durante a instalação.</p>}
        <p className="text-sm text-text-secondary">{mascarar(banco.url)}</p>
        <p className="flex items-center gap-1 text-sm">
          {banco.ok ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="text-text-primary">Conectado</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-error" aria-hidden="true" />
              <span className="text-text-primary">Indisponível</span>
            </>
          )}
        </p>
        {erro && <p className="text-xs text-error">{erro}</p>}
      </CardContent>
    </Card>
  )
}
