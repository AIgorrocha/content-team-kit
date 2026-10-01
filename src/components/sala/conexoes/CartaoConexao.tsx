import {
  Instagram,
  Linkedin,
  Youtube,
  Music2,
  Megaphone,
  Database,
  Brain,
  Server,
  Send,
  Video,
  Plug,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { Conexao } from "@/lib/sala/types"
import { AcaoConexao } from "./AcaoConexao"

const ICONE_POR_ID: Record<string, LucideIcon> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  meta_ads: Megaphone,
  supabase: Database,
  ai_memory: Brain,
  vps: Server,
  telegram: Send,
  higgsfield: Video,
}

const ICONE_POR_CATEGORIA: Record<Conexao["categoria"], LucideIcon> = {
  rede: LinkIcon,
  infra: Server,
  mcp: Plug,
}

interface CartaoConexaoProps {
  conexao: Conexao
}

// Cartão completo de uma conexão (ícone, nome, conta e o bloco de validade/ação de
// AcaoConexao). Usado hoje só pelas conexões de infraestrutura e MCP em /sala/ajustes: as
// conexões de rede migraram pro cartão grande de cada rede em /sala/redes (Batelada B5).
export function CartaoConexao({ conexao }: CartaoConexaoProps) {
  const Icone = ICONE_POR_ID[conexao.id] ?? ICONE_POR_CATEGORIA[conexao.categoria]

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Icone className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-text-primary">{conexao.nome}</p>
            <p className="text-xs text-text-secondary">{conexao.conta ?? "sem conta"}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <AcaoConexao conexaoInicial={conexao} />
      </CardContent>
    </Card>
  )
}
