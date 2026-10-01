import { ExternalLink } from "lucide-react"
import type { Rede, ResumoRede } from "@/lib/sala/types"
import { FUSO } from "@/lib/sala/types"

type Post = ResumoRede["ultimosPosts"][number]

interface UltimosPostsProps {
  rede: Rede
  posts: Post[]
}

// ponytail: sem campo de tipo por post no contrato; aproveita a proporção típica de
// Instagram e TikTok (vertical) e trata as demais como 16:9. Ajustar se o contrato ganhar
// um campo de formato por post.
function proporcaoCapa(rede: Rede): string {
  return rede === "instagram" || rede === "tiktok" ? "aspect-[9/16]" : "aspect-video"
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO })
}

const CHIPS_METRICA: { chave: keyof NonNullable<Post["metricas"]>; rotulo: string }[] = [
  { chave: "views", rotulo: "views" },
  { chave: "likes", rotulo: "curtidas" },
  { chave: "comentarios", rotulo: "comentários" },
  { chave: "salvos", rotulo: "salvos" },
]

export function UltimosPosts({ rede, posts }: UltimosPostsProps) {
  if (posts.length === 0) {
    return <p className="text-sm text-text-secondary">Sem posts registrados.</p>
  }

  return (
    <ul className="space-y-2">
      {posts.slice(0, 5).map((post) => (
        <li key={`${post.peca}-${post.publicadoEm}`} className="flex items-center gap-3">
          <div className={`w-10 shrink-0 overflow-hidden rounded bg-background ${proporcaoCapa(rede)}`}>
            {post.capaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.capaUrl} alt={`Capa de ${post.titulo}`} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm text-text-primary">{post.titulo}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
              <span>{formatarData(post.publicadoEm)}</span>
              {CHIPS_METRICA.map(({ chave, rotulo }) => {
                const valor = post.metricas?.[chave]
                if (valor == null) return null
                return (
                  <span key={chave} className="tabular-nums">
                    {valor.toLocaleString("pt-BR")} {rotulo}
                  </span>
                )
              })}
            </div>
          </div>
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir post "${post.titulo}" na rede`}
              className="shrink-0 rounded p-1 text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
