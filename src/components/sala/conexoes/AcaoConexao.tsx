"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FUSO, type Conexao } from "@/lib/sala/types"

const STATUS_PILL: Record<Conexao["status"], { rotulo: string; variant: "success" | "warning" | "error" | "secondary" }> = {
  ok: { rotulo: "Em dia", variant: "success" },
  vencendo: { rotulo: "Vencendo", variant: "warning" },
  vencida: { rotulo: "Vencida", variant: "error" },
  sessao: { rotulo: "Sessão", variant: "secondary" },
  desconhecida: { rotulo: "Desconhecida", variant: "secondary" },
  desligada: { rotulo: "Desligada", variant: "secondary" },
}

const RENOVACAO_ROTULO: Record<Conexao["renovacao"], string> = {
  automatica: "automática",
  manual: "manual",
  sessao: "sessão",
  nao_expira: "não expira",
}

const ACAO_ROTULO: Record<NonNullable<Conexao["acao"]>, string> = {
  conectar: "Conectar",
  renovar: "Renovar",
  testar: "Testar",
  copiar_trecho: "Copiar trecho",
}

function formatarDataHora(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" })
}

interface AcaoConexaoProps {
  conexaoInicial: Conexao
}

// Validade + ação (conectar/renovar/testar/copiar trecho) de uma conexão, extraído do
// antigo conexoes/CartaoConexao.tsx (Batelada B5) pra ser embutido tanto no cartão grande
// de cada rede em /sala/redes quanto no cartão de infraestrutura de /sala/ajustes. Cada
// instância gerencia o próprio estado, então "Renovar" atualiza só ela, sem recarregar a
// página nem depender do componente pai.
export function AcaoConexao({ conexaoInicial }: AcaoConexaoProps) {
  const [conexao, setConexao] = useState(conexaoInicial)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const pill = STATUS_PILL[conexao.status]
  const ultimoUso = formatarDataHora(conexao.ultimoUso)
  const percentualExpira =
    conexao.diasRestantes !== null ? Math.min(100, Math.max(0, (conexao.diasRestantes / 60) * 100)) : null

  async function executarAcao() {
    if (!conexao.acao || carregando) return

    if (conexao.acao === "copiar_trecho") {
      if (!conexao.trechoConfig) return
      try {
        await navigator.clipboard.writeText(conexao.trechoConfig)
        setErro(null)
        setMensagem("Copiado")
        setTimeout(() => setMensagem(null), 2000)
      } catch {
        setErro("não deu pra copiar o trecho")
      }
      return
    }

    setCarregando(true)
    setErro(null)
    try {
      const resp = await fetch(`/api/sala/conexoes/${encodeURIComponent(conexao.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: conexao.acao }),
      })
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro ?? "erro ao executar a ação")
      // Conectar/renovar numa rede com OAuth (live) devolve {redirect}: só segue se o prefixo
      // bater exatamente com a rota de OAuth da Sala, nunca outro destino.
      if (typeof dados.redirect === "string" && /^\/api\/sala\/oauth\/(linkedin|youtube|instagram|meta_ads)$/.test(dados.redirect)) {
        window.location.assign(dados.redirect)
        return
      }
      setConexao(dados.conexao)
      if (conexao.acao === "testar") {
        setMensagem("Testado")
        setTimeout(() => setMensagem(null), 2000)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro desconhecido")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div data-testid={`cartao-conexao-${conexao.id}`} className="space-y-2 text-sm text-text-secondary">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={pill.variant}>{pill.rotulo}</Badge>
        <span>Renovação: {RENOVACAO_ROTULO[conexao.renovacao]}</span>
      </div>
      {conexao.diasRestantes !== null ? (
        <div className="space-y-1">
          <p>
            Expira em {conexao.diasRestantes} {conexao.diasRestantes === 1 ? "dia" : "dias"}
          </p>
          <div
            className="h-1.5 w-full rounded-full bg-surface-hover"
            role="progressbar"
            aria-valuenow={conexao.diasRestantes}
            aria-valuemin={0}
            aria-valuemax={60}
            aria-label={`${conexao.diasRestantes} dias restantes de 60`}
          >
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${percentualExpira}%` }} />
          </div>
        </div>
      ) : conexao.renovacao === "nao_expira" ? (
        <p>Não expira</p>
      ) : conexao.renovacao === "sessao" ? (
        <p>Sessão do navegador (validade desconhecida)</p>
      ) : (
        <p>Prazo de validade desconhecido</p>
      )}
      <p>Último uso: {ultimoUso ?? "sem uso registrado"}</p>
      {conexao.detalhe && <p className="text-xs text-text-secondary/80">{conexao.detalhe}</p>}
      {conexao.acao && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={executarAcao}
            disabled={carregando}
            className="focus-visible:ring-2 focus-visible:ring-accent"
          >
            {carregando ? "Aguarde…" : ACAO_ROTULO[conexao.acao]}
          </Button>
          {mensagem && (
            <span className="text-xs text-success" role="status">
              {mensagem}
            </span>
          )}
          {erro && (
            <span role="alert" className="text-xs text-error">
              {erro}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
