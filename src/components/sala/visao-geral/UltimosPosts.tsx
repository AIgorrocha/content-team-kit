import Link from "next/link"
import { formatDistance } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LABEL_REDE } from "@/lib/sala/rotulos"
import type { ResumoRede } from "@/lib/sala/types"

type Post = ResumoRede["ultimosPosts"][number]

interface PostComRede {
  post: Post
  rede: ResumoRede["rede"]
}

interface UltimosPostsProps {
  redes: ResumoRede[]
  agora: string
}

function dataRelativa(iso: string, agora: string): string {
  return formatDistance(new Date(iso), new Date(agora), { addSuffix: true, locale: ptBR })
}

const CHIPS_METRICA: { chave: keyof NonNullable<Post["metricas"]>; rotulo: string }[] = [
  { chave: "views", rotulo: "views" },
  { chave: "likes", rotulo: "curtidas" },
  { chave: "comentarios", rotulo: "comentários" },
]

export function UltimosPosts({ redes, agora }: UltimosPostsProps) {
  const posts: PostComRede[] = redes
    .filter((resumo) => resumo.ultimosPosts.length > 0)
    .flatMap((resumo) =>
      resumo.ultimosPosts.map((post) => ({ post, rede: resumo.rede }))
    )
    .sort((a, b) => b.post.publicadoEm.localeCompare(a.post.publicadoEm))
    .slice(0, 6)

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Últimos posts
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {posts.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {posts.map(({ post, rede }) => (
              <li
                key={`${rede}-${post.peca}-${post.publicadoEm}`}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-2.5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-hover">
                  {post.capaUrl ? (
                    <div
                      role="img"
                      aria-label={`Capa de ${post.titulo}`}
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${post.capaUrl})` }}
                    />
                  ) : <span className="text-[10px] text-text-secondary">sem capa</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-text-primary">{post.titulo}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {LABEL_REDE[rede]} · {dataRelativa(post.publicadoEm, agora)}
                  </p>
                  {post.metricas ? (
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums text-text-secondary">
                      {CHIPS_METRICA.map(({ chave, rotulo }) => {
                        const valor = post.metricas?.[chave]
                        if (valor == null) return null
                        return <span key={chave}>{valor.toLocaleString("pt-BR")} {rotulo}</span>
                      })}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum post publicado ainda.</p>
        )}
        <Link
          href="/sala/redes"
          className="mt-4 inline-block rounded text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver redes
        </Link>
      </CardContent>
    </Card>
  )
}
