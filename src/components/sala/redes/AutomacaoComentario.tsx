import type { ResumoRede } from "@/lib/sala/types"

interface AutomacaoComentarioProps {
  automacao: ResumoRede["automacao"]
}

export function AutomacaoComentario({ automacao }: AutomacaoComentarioProps) {
  if (automacao.tipo === "nenhuma") {
    return <p className="text-sm text-text-secondary">sem automação nesta rede</p>
  }

  if (automacao.tipo === "ig_webhook") {
    return (
      <ul className="space-y-1 text-sm">
        {automacao.regras.map((regra) => (
          <li key={regra.palavra} className="flex flex-wrap items-center gap-1 text-text-primary">
            <span className="font-medium">{regra.palavra}</span>
            <span className="text-text-secondary">→</span>
            {regra.link.startsWith("http") ? (
              <a
                href={regra.link}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {regra.link}
              </a>
            ) : (
              <span className="text-text-secondary">{regra.link}</span>
            )}
          </li>
        ))}
      </ul>
    )
  }

  // yt_responder: regras de comentário e vídeos monitorados, os dois quando existirem.
  const videos = automacao.videosMonitorados ?? []
  if (automacao.regras.length === 0 && videos.length === 0) {
    return <p className="text-sm text-text-secondary">sem vídeo monitorado</p>
  }
  return (
    <div className="space-y-2 text-sm">
      {automacao.regras.length > 0 && (
        <ul className="space-y-1">
          {automacao.regras.map((regra) => (
            <li key={regra.palavra} className="flex flex-wrap items-center gap-1 text-text-primary">
              <span className="font-medium">{regra.palavra}</span>
              <span className="text-text-secondary">→</span>
              {regra.link.startsWith("http") ? (
                <a
                  href={regra.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {regra.link}
                </a>
              ) : (
                <span className="text-text-secondary">{regra.link}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {videos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {videos.map((id) => (
            <li key={id}>
              <a
                href={`https://youtu.be/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-2 py-0.5 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {id}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
