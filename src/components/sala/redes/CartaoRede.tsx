import { Instagram, Linkedin, Youtube, Music2, Twitter, Megaphone, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { Aprendizado, Conexao, Rede, ResumoRede } from "@/lib/sala/types"
import { AcaoConexao } from "@/components/sala/conexoes/AcaoConexao"
import { GradeCapas, type CapaGrade } from "@/components/sala/padroes/GradeCapas"
import { UltimosPosts } from "./UltimosPosts"
import { AutomacaoComentario } from "./AutomacaoComentario"
import { AprendizadosRede } from "./AprendizadosRede"

const ICONE_REDE: Record<Rede, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  x: Twitter,
  meta_ads: Megaphone,
  email: Mail,
}

const NOME_REDE: Record<Rede, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  meta_ads: "Meta Ads",
  email: "E-mail",
}

const ESTADO_PILL: Record<ResumoRede["estadoConta"], { rotulo: string; variant: "success" | "warning" | "secondary" }> = {
  ok: { rotulo: "Em dia", variant: "success" },
  atencao: { rotulo: "Atenção", variant: "warning" },
  desligada: { rotulo: "Desligada", variant: "secondary" },
}

interface CartaoRedeProps {
  resumo: ResumoRede
  conexao: Conexao | null
  capas: CapaGrade[]
  aprendizados: Aprendizado[]
}

// Cartão grande de uma rede (Batelada B5): junta o que antes vivia em três telas
// separadas (Redes, Conexões, Padrões) numa ordem só, do estado da conta até o que o time
// aprendeu publicando nela. `conexao` vem null pras redes sem conexão OAuth cadastrada (X,
// E-mail): o bloco de validade/ação some, o resto do cartão continua igual.
export function CartaoRede({ resumo, conexao, capas, aprendizados }: CartaoRedeProps) {
  const Icone = ICONE_REDE[resumo.rede]
  const pill = ESTADO_PILL[resumo.estadoConta]

  return (
    <Card className="min-w-0 rounded-md" data-testid={`cartao-rede-${resumo.rede}`}>
      <CardHeader className="p-4 pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-hover">
            <Icone className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 break-words">
            <p className="font-semibold text-text-primary">{NOME_REDE[resumo.rede]}</p>
            <p className="text-xs text-text-secondary">{conexao?.conta ?? resumo.conta ?? "sem conta conectada"}</p>
          </div>
        </div>
        <Badge className="shrink-0" variant={pill.variant}>{pill.rotulo}</Badge>
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-border p-4 pt-0 [&>div]:pt-4 [&>div:first-child]:pt-0">
        {conexao && <AcaoConexao conexaoInicial={conexao} />}

        {resumo.estadoConta === "desligada" ? (
          <p className="text-sm text-text-secondary">Rede desligada, sem publicação registrada.</p>
        ) : resumo.rede === "meta_ads" ? (
          <p className="text-sm text-text-secondary">Conta de anúncios, sem conteúdo orgânico nem melhor horário.</p>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Melhor horário: <span className="text-text-primary">{resumo.melhorHorario ?? "sem dado ainda"}</span>
            </p>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Últimos posts</p>
              {resumo.ultimosPosts.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma publicação ainda nesta rede.</p>
              ) : (
                <UltimosPosts rede={resumo.rede} posts={resumo.ultimosPosts} />
              )}
            </div>
          </>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">Automação de comentário</p>
          <AutomacaoComentario automacao={resumo.automacao} />
        </div>

        <GradeCapas capas={capas} titulo="Capas aprovadas" semCard />

        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">Aprendizados</p>
          <AprendizadosRede itens={aprendizados} />
        </div>
      </CardContent>
    </Card>
  )
}
