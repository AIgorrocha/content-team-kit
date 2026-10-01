import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Configuracao } from "@/lib/sala/types"

interface ChavesProps {
  chaves: Configuracao["chaves"]
}

// Mostra só o NOME de cada variável e uma bolinha de presença, nunca o valor: o valor
// real nem chega no cliente (getSala().configuracao() já lê só o nome no servidor).
export function Chaves({ chaves }: ChavesProps) {
  return (
    <Card className="rounded-md" data-testid="config-chaves">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Chaves</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {chaves.map((chave) => (
            <li key={chave.nome} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${chave.presente ? "bg-success" : "bg-error"}`}
                aria-hidden="true"
              />
              <span className="truncate text-text-primary">{chave.nome}</span>
              <span className="sr-only">{chave.presente ? "presente" : "ausente"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
