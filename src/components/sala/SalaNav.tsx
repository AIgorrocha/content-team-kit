"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Film,
  Kanban,
  LayoutDashboard,
  Rocket,
  Settings,
  Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// 7 telas (Batelada B3, spec design v2 secao 3). Ao vivo, Time, Trilha, Padroes, Conexoes
// e Configuracoes somem daqui: cada funcao foi realocada pra uma destas 7 (ver as paginas
// correspondentes, que agora so fazem redirect).
const TELAS = [
  { href: "/sala/inicio", label: "Início", icone: Rocket },
  { href: "/sala", label: "Visão geral", icone: LayoutDashboard },
  { href: "/sala/trabalho", label: "Trabalho", icone: Kanban },
  { href: "/sala/pecas", label: "Peças", icone: Film },
  { href: "/sala/calendario", label: "Calendário", icone: CalendarDays },
  { href: "/sala/redes", label: "Redes", icone: Share2 },
  { href: "/sala/ajustes", label: "Ajustes", icone: Settings },
]

function estaAtiva(pathname: string, href: string): boolean {
  return href === "/sala" ? pathname === "/sala" : pathname.startsWith(href)
}

export function SalaNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Telas da Sala de Comando"
      className="mb-6 flex items-center gap-0.5 overflow-x-auto border-b border-border bg-background px-1"
    >
      {TELAS.map((tela) => {
        const Icone = tela.icone
        const ativa = estaAtiva(pathname, tela.href)
        return (
          <Link
            key={tela.href}
            href={tela.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              ativa
                ? "border-accent text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            <Icone className="h-[15px] w-[15px] shrink-0" aria-hidden />
            {tela.label}
          </Link>
        )
      })}
    </nav>
  )
}
