import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FUSO, type Configuracao } from "@/lib/sala/types"

interface KitProps {
  kit: Configuracao["kit"]
}

export function Kit({ kit }: KitProps) {
  const exportadoEm = kit.exportadoEm
    ? new Date(kit.exportadoEm).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" })
    : "nunca exportado"

  return (
    <Card className="rounded-md" data-testid="config-kit">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Kit</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2 text-sm">
        <p>
          Versão: <span className="text-text-primary">{kit.versao}</span>
        </p>
        <p>
          Cliente ativo: <span className="text-text-primary">{kit.cliente}</span>
        </p>
        <p>
          Exportado em: <span className="text-text-primary">{exportadoEm}</span>
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" disabled title="Disponível na Fase 2">
            Exportar
          </Button>
          <Button size="sm" variant="outline" disabled title="Disponível na Fase 2">
            Importar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
