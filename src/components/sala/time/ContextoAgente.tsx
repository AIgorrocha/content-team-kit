import Link from "next/link"

interface ContextoAgenteProps {
  arquivos: string[]
}

// Lista dos arquivos que o agente carrega (brand-profile, design-system, regras,
// playbook). O link abre Padrões, onde vivem os padrões visuais e as regras do cliente.
export function ContextoAgente({ arquivos }: ContextoAgenteProps) {
  if (arquivos.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum arquivo de contexto mapeado pra este agente.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {arquivos.map((arquivo) => (
        <li
          key={arquivo}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-2"
        >
          <span className="truncate font-mono text-xs text-text-primary">{arquivo}</span>
          <Link
            href="/sala/padroes"
            className="shrink-0 rounded text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Abrir em Padrões
          </Link>
        </li>
      ))}
    </ul>
  )
}
